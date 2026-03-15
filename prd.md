Tool 4/7: Query Fan-Out Generator (Merged)
4.1 Overview
Tool Name: Query Fan-Out Generator
Purpose: Show how AI search engines (ChatGPT, Google AI Mode, Perplexity) decompose a user prompt into multiple sub-queries (fan-out queries) that are sent to search APIs behind the scenes.
Use Case: SEOs understanding what sub-queries their content needs to rank for. Content strategists identifying content gaps. Keyword researchers discovering long-tail query variants.
Complexity: MEDIUM - Single LLM API call with specialized system prompts.

MERGE NOTE: The original site had two separate tools - Tool 4 was a Chrome Extension (ChatGPT Search Query Extractor using network interception) and Tool 7 was a web-based Query Fan-Out Generator. Since both are now web-based, they are merged into a single, superior tool. This merger eliminates redundancy and allows for a richer feature set.

4.2 UI Specification
4.2.1 Page Layout
•	Page Header: "Query Fan-Out Generator"
•	Subtitle: "See the hidden sub-queries AI search engines use when answering your prompt."

4.2.2 Input Section
25.	Textarea: User prompt input with placeholder "eg. What is the best laptop for video editing under $2000?"
26.	Dropdown: "Simulate as:" with options: "ChatGPT Search" (default), "Google AI Mode", "Perplexity"
27.	Button: "Simulate Fan-Out ->"

4.2.3 Loading State
•	"Simulating query decomposition..." with a spinner animation

4.2.4 Output Section
•	Original prompt displayed at top for context
•	List of 5-15 fan-out sub-queries, each displayed as a card/chip element
•	For each sub-query: "Search on Google" and "Search on Bing" link buttons (open in new tab with query pre-filled in the search URL)
•	Summary explanation of why these sub-queries were generated
•	"Copy All Queries" button (copies all queries as newline-separated text)

4.3 Complete Backend Logic
4.3.1 API Endpoint
Endpoint: POST /api/query-fanout

4.3.2 Request Body
{
  "prompt": "What is the best laptop for video editing under $2000?",
  "engine": "chatgpt"  // or "google_ai_mode" or "perplexity"
}

4.3.3 Core Logic
async function generateFanOutQueries(prompt, engine) {
  const systemPrompts = {
    chatgpt: CHATGPT_FANOUT_SYSTEM_PROMPT,
    google_ai_mode: GOOGLE_AI_MODE_FANOUT_SYSTEM_PROMPT,
    perplexity: PERPLEXITY_FANOUT_SYSTEM_PROMPT,
  };
  
  const response = await callLLMAPI(
    'openai',
    systemPrompts[engine],
    prompt
  );
  
  return JSON.parse(response);
}

4.4 System Prompts
These system prompts are the core intellectual property of this tool. They encode the specific fan-out behavior patterns of each AI search engine.

4.4.1 ChatGPT Search Fan-Out Prompt
SYSTEM:
You are simulating ChatGPT's web search query decomposition system.
When ChatGPT receives a user prompt that triggers web search, it
breaks the prompt into multiple focused search queries sent to Bing.
 
Your job: Given a user prompt, generate the exact search queries
that ChatGPT would send to Bing.
 
Rules for generating fan-out queries:
1. Break the prompt into 5-12 specific, focused search queries
2. Each query targets a different aspect/angle of the original question
3. Use natural search-engine-style queries (how a human would type)
4. Include brand-specific queries when relevant
   (e.g., "MacBook Pro M3 video editing review 2025")
5. Include comparison queries ("best vs comparison" style)
6. Include review-style queries ("[product] review [year]")
7. Include "best of" list queries
8. Include specific technical specification queries when relevant
9. Include pricing/value queries when budget is mentioned
10. Add the current year to time-sensitive queries
 
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

4.4.2 Google AI Mode Fan-Out Prompt
SYSTEM:
You are simulating Google AI Mode's query fan-out technique.
When Google AI Mode receives a complex question, it uses Gemini
to break the question into different subtopics and issues multiple
search queries simultaneously.
 
Google AI Mode's fan-out is characterized by:
1. Deeper semantic decomposition than ChatGPT
2. More sub-queries (8-15 typically)
3. Focus on entity extraction and entity-specific queries
4. "People Also Ask" style variant queries
5. Considers latent intent (what the user didn't explicitly ask
   but probably wants to know)
6. Generates both head-term and long-tail variants
 
Example for "What are the best beaches in Europe for families?":
- "best family beaches Europe 2025"
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
1. Generate 8-15 sub-queries
2. Include geographic variants when relevant
3. Include intent variants (informational, commercial, navigational)
4. Include "People Also Ask" style questions
5. Include entity-specific queries for products/brands/places
 
Respond ONLY with a JSON object:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Brief explanation of the fan-out logic"
}

4.4.3 Perplexity Fan-Out Prompt
SYSTEM:
You are simulating Perplexity's search query decomposition.
 
Perplexity is known for:
1. Citing Reddit, forums, and community sources heavily
2. Breaking queries into academic/research-style sub-queries
3. Including "site:reddit.com" style queries
4. Focusing on recent, authoritative sources
5. Generating fewer but more precise queries (5-8)
 
Rules:
1. Generate 5-8 focused sub-queries
2. Include at least one Reddit-focused query variant
3. Include at least one academic/authoritative source query
4. Focus on specificity over breadth
5. Include recency signals (add year, "latest", or "2025/2026")
 
Respond ONLY with a JSON object:
{
  "queries": ["query1", "query2", ...],
  "reasoning": "Brief explanation of Perplexity's search approach"
}

4.5 LLM API Recommendation
Recommended Model: OpenAI GPT-4o-mini. Fast, cheap (~$0.001 per fan-out generation), and excellent at structured query decomposition tasks.
