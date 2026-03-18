import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file
dotenv.config();

// Prevent server crash on unhandled promise rejections
process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err?.message || err);
});

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy for rate limiters if deployed behind reverse proxy (Heroku, Render, AWS, Railway)
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// Security & Utility Middleware
// ---------------------------------------------------------------------------
app.use(helmet()); // Basic security headers
app.use(morgan("dev")); // Request logging
app.use(express.json({ limit: "10kb" })); // Body parser with size limit

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "https://www.maximuslabs.ai",
        "https://maximuslabs.ai"
      ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            // In production, block non-origin requests to prevent simple script abuse
            if (process.env.NODE_ENV === "production") {
                return callback(new Error("CORS policy requires an Origin header in production."), false);
            }
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
}));

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------
// General limit: 100 requests per 15 mins
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Fan-out/LLM limit: 20 per 15 mins (more expensive)
const fanoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Fan-out limit reached. Please wait a while before generating more queries." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Search limit: 50 per 15 mins
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Search rate limit reached." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api/", generalLimiter);

// ---------------------------------------------------------------------------
// Groq client
// ---------------------------------------------------------------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
    console.error("\n  ✗ GROQ_API_KEY is not set in .env file.");
    console.error("    Get a free key at https://console.groq.com/keys\n");
    process.exit(1);
}
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ---------------------------------------------------------------------------
// SerpApi config (soft — feature degrades gracefully without it)
// ---------------------------------------------------------------------------
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
if (!SERPAPI_API_KEY) {
    console.warn("\n  ⚠ SERPAPI_API_KEY is not set in .env file.");
    console.warn("    Live search results will be unavailable.");
    console.warn("    Get a free key at https://serpapi.com (250 searches/month)\n");
}

// ---------------------------------------------------------------------------
// In-memory caching (Generic for both search and LLM results)
// ---------------------------------------------------------------------------
const globalCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 1000;

function getFromCache(key) {
    const entry = globalCache.get(key.toLowerCase().trim());
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        globalCache.delete(key.toLowerCase().trim());
        return null;
    }
    return entry.data;
}

function setToCache(key, data) {
    if (globalCache.size >= CACHE_MAX_SIZE) {
        const firstKey = globalCache.keys().next().value;
        globalCache.delete(firstKey);
    }
    globalCache.set(key.toLowerCase().trim(), {
        data,
        timestamp: Date.now(),
    });
}

async function fetchSerpApiResults(query) {
    const cacheKey = `search:${query}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
        console.log(`  ✓ Search Cache hit: "${query.substring(0, 50)}..."`);
        return cached;
    }

    const params = new URLSearchParams({
        api_key: SERPAPI_API_KEY,
        engine: "google",
        q: query,
        num: "5",
    });

    // 10 second timeout for external API requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
        response = await fetch(`https://serpapi.com/search.json?${params}`, {
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        let errorText = "Unknown error";
        try { errorText = await response.text(); } catch(e) {}
        console.error(`  ✗ SerpApi upstream error (${response.status}): ${errorText}`);
        throw new Error("Upstream search service error.");
    }

    const data = await response.json();

    // Extract organic results into a clean shape
    const results = (data.organic_results || []).slice(0, 5).map((r) => ({
        title: r.title || "",
        link: r.link || "",
        snippet: r.snippet || "",
        displayedLink: r.displayed_link || "",
        position: r.position || 0,
        favicon: r.favicon || null,
    }));

    // Also include knowledge graph if available
    const knowledgeGraph = data.knowledge_graph
        ? {
            title: data.knowledge_graph.title || "",
            description: data.knowledge_graph.description || "",
            source: data.knowledge_graph.source?.name || "",
        }
        : null;

    const payload = { results, knowledgeGraph, query };
    setToCache(cacheKey, payload);
    return payload;
}

// ---------------------------------------------------------------------------
// Already handled by Helmet and Morgan
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------
const currentYear = new Date().getFullYear();

const CHATGPT_FANOUT_SYSTEM_PROMPT = `
You are simulating ChatGPT's web search query decomposition system.
When ChatGPT receives a user prompt that triggers web search, it
breaks the prompt into multiple focused search queries sent to Bing.
 
Your job: Given a user prompt, generate the exact search queries
that ChatGPT would send to Bing.
 
Rules for generating fan-out queries:
1. Break the prompt into EXACTLY 8 specific, focused search queries regardless of the input language.
2. Each query targets a different aspect/angle of the original question
3. Use natural search-engine-style queries (how a human would type)
4. Include brand-specific queries when relevant
   (e.g., "MacBook Pro M3 video editing review ${currentYear}")
5. Include comparison queries ("best vs comparison" style)
6. Include review-style queries ("[product] review [year]")
7. Include "best of" list queries
8. Include specific technical specification queries when relevant
9. Include pricing/value queries when budget is mentioned
10. Add the current year (${currentYear}) to time-sensitive queries
 
Example for "What's a good first surfboard for a beginner?":
- "best surfboard for beginner"
- "soft-top surfboard beginner recommendations"
- "beginner surfboard size guide"
- "foam surfboard vs fiberglass beginner"
 
Respond ONLY with a JSON object:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Brief explanation of why these sub-queries were generated"
}
`;

const GOOGLE_AI_MODE_FANOUT_SYSTEM_PROMPT = `
You are simulating Google AI Mode's query fan-out technique.
When Google AI Mode receives a complex question, it uses Gemini
to break the question into different subtopics and issues multiple
search queries simultaneously.
 
Google AI Mode's fan-out is characterized by:
1. Deeper semantic decomposition than ChatGPT
2. More sub-queries (typically 12)
3. Focus on entity extraction and entity-specific queries
4. "People Also Ask" style variant queries
5. Considers latent intent (what the user didn't explicitly ask
   but probably wants to know)
6. Generates both head-term and long-tail variants
 
Example for "What are the best beaches in Europe for families?":
- "best family beaches Europe ${currentYear}"
- "Europe beaches shallow water kids safe"
- "Mediterranean family beach resorts"
- "best beaches Spain families"
- "best beaches Greece families children"
- "best beaches Italy families"
- "family beach vacation Europe budget"
- "Europe beaches amenities children facilities"
- "warmest European beaches summer families"
- "European beaches avoid crowds families"
 
Rules:
1. Generate EXACTLY 12 sub-queries regardless of the input language.
2. Include geographic variants when relevant
3. Include intent variants (informational, commercial, navigational)
4. Include "People Also Ask" style questions
5. Include entity-specific queries for products/brands/places
6. Add the current year (${currentYear}) to time-sensitive queries.
 
Respond ONLY with a JSON object:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Brief explanation of the fan-out logic"
}
`;

const PERPLEXITY_FANOUT_SYSTEM_PROMPT = `
You are simulating Perplexity's search query decomposition.
 
Perplexity is known for:
1. Citing Reddit, forums, and community sources heavily
2. Breaking queries into academic/research-style sub-queries
3. Including "site:reddit.com" style queries
4. Focusing on recent, authoritative sources
5. Generating fewer but more precise queries
 
Rules:
1. Generate EXACTLY 6 focused sub-queries regardless of the input language.
2. Include at least one Reddit-focused query variant
3. Include at least one academic/authoritative source query
4. Focus on specificity over breadth
5. Include recency signals (add year ${currentYear}, "latest", or "${currentYear}/${currentYear + 1}")
 
Respond ONLY with a JSON object:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Brief explanation of Perplexity's search approach"
}
`;

const SYSTEM_PROMPTS = {
    chatgpt: CHATGPT_FANOUT_SYSTEM_PROMPT,
    google_ai_mode: GOOGLE_AI_MODE_FANOUT_SYSTEM_PROMPT,
    perplexity: PERPLEXITY_FANOUT_SYSTEM_PROMPT,
};

// ---------------------------------------------------------------------------
// API Endpoint
// ---------------------------------------------------------------------------
app.post("/api/query-fanout", fanoutLimiter, async (req, res) => {
    const { prompt, engine } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required." });
    }

    if (prompt.length > 2000) {
        return res.status(400).json({ error: "Prompt too long. Max 2000 characters." });
    }

    const systemPrompt = SYSTEM_PROMPTS[engine] || SYSTEM_PROMPTS.chatgpt;
    const engineLabel = engine || "chatgpt";

    // Check cache for fan-out
    const cacheKey = `fanout:${engineLabel}:${prompt}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
        console.log(`  ✓ Fan-out Cache hit: "${prompt.substring(0, 50)}..."`);
        return res.json(cached);
    }

    console.log(`\n  → Fan-out request [${engineLabel}]: "${prompt.substring(0, 80)}..."`);

    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 1,
            max_completion_tokens: 2048,
            top_p: 1,
            reasoning_effort: "medium",
            stream: false,
        });

        const raw = completion.choices[0].message.content;
        console.log("  ✓ LLM response received");

        // Parse the JSON response
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (parseErr) {
            // Try extracting JSON from markdown code blocks
            const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1].trim());
            } else {
                throw new Error("Failed to parse LLM response as JSON.");
            }
        }

        // Validate the response structure
        if (!parsed.queries || !Array.isArray(parsed.queries)) {
            throw new Error("LLM response missing 'queries' array.");
        }

        const responseData = {
            queries: parsed.queries,
            reasoning: parsed.reasoning || "No reasoning provided.",
        };

        setToCache(cacheKey, responseData);
        return res.json(responseData);
    } catch (err) {
        console.error("  ✗ Error:", err.message);
        return res.status(500).json({
            error: "Failed to generate fan-out queries. An upstream error occurred.",
        });
    }
});

// ---------------------------------------------------------------------------
// Search Results Endpoints
// ---------------------------------------------------------------------------
app.post("/api/search-results", searchLimiter, async (req, res) => {
    if (!SERPAPI_API_KEY) {
        return res.status(503).json({
            error: "Search API not configured. Add SERPAPI_API_KEY to .env file.",
            configRequired: true,
        });
    }

    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: "Query is required." });
    }

    console.log(`  🔍 Search request: "${query.substring(0, 60)}..."`);

    try {
        const data = await fetchSerpApiResults(query);
        return res.json(data);
    } catch (err) {
        console.error("  ✗ Search error:", err.message);
        return res.status(500).json({ error: "Failed to fetch search results. An upstream error occurred." });
    }
});

// Batch endpoint — fetch results for multiple queries in parallel
app.post("/api/search-batch", searchLimiter, async (req, res) => {
    if (!SERPAPI_API_KEY) {
        return res.status(503).json({
            error: "Search API not configured. Add SERPAPI_API_KEY to .env file.",
            configRequired: true,
        });
    }

    const { queries } = req.body;
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: "'queries' array is required." });
    }

    // Limit to 15 queries max to prevent abuse
    const limitedQueries = queries.slice(0, 15);
    console.log(`  🔍 Batch search: ${limitedQueries.length} queries`);

    try {
        // Process with concurrency limit of 3 to avoid rate limits
        const batchResults = {};
        const chunks = [];
        for (let i = 0; i < limitedQueries.length; i += 3) {
            chunks.push(limitedQueries.slice(i, i + 3));
        }

        for (const chunk of chunks) {
            const chunkResults = await Promise.allSettled(
                chunk.map((q) => fetchSerpApiResults(q))
            );
            chunk.forEach((q, idx) => {
                const result = chunkResults[idx];
                if (result.status === "fulfilled") {
                    batchResults[q] = result.value;
                } else {
                    batchResults[q] = { error: result.reason?.message || "Search failed", results: [] };
                }
            });
        }

        return res.json({ results: batchResults });
    } catch (err) {
        console.error("  ✗ Batch search error:", err.message);
        return res.status(500).json({ error: "Failed to fetch batched search results. An upstream error occurred." });
    }
});

// Static Assets & Frontend Routing
const PUBLIC_PATH = "/tools/query-fan-out-generator";

// Serve built frontend files from 'dist' folder
app.use(PUBLIC_PATH, express.static(path.join(__dirname, "dist")));

// Health check
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        engine: "groq/openai-gpt-oss-120b",
        searchApi: SERPAPI_API_KEY ? "configured" : "not_configured",
        cacheSize: globalCache.size,
    });
});

// Fallback for SPA — serve index.html for any non-API routes
app.get("*", (req, res) => {
    if (req.path.includes("/api/")) {
        return res.status(404).json({ error: "API endpoint not found." });
    }
    
    // Serve SPA for the tool path or root
    if (req.path.startsWith(PUBLIC_PATH) || req.path === "/") {
        return res.sendFile(path.join(__dirname, "dist", "index.html"));
    }
    
    // Redirect other paths to the tool path
    res.redirect(PUBLIC_PATH);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`\n  🚀 Query Fan-Out Generator API running at http://localhost:${PORT}`);
    console.log(`  📡 Search API: ${SERPAPI_API_KEY ? "Configured ✓" : "Not configured (set SERPAPI_API_KEY)"}\n`);
});
