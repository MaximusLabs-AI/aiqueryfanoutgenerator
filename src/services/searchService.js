/**
 * Search Service — fetches live Google results via SerpApi backend proxy
 */

// Client-side cache to avoid redundant network calls within the same session
const clientCache = new Map();

export async function fetchSearchResults(query) {
    const cacheKey = query.toLowerCase().trim();
    if (clientCache.has(cacheKey)) {
        return clientCache.get(cacheKey);
    }

    const response = await fetch('/api/search-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed: ${response.status}`);
    }

    const data = await response.json();
    clientCache.set(cacheKey, data);
    return data;
}

export async function fetchSearchBatch(queries) {
    const response = await fetch('/api/search-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Check if it's a config error (no API key)
        if (errorData.configRequired) {
            throw new Error('SEARCH_NOT_CONFIGURED');
        }
        throw new Error(errorData.error || `Batch search failed: ${response.status}`);
    }

    const data = await response.json();

    // Cache individual results
    if (data.results) {
        Object.entries(data.results).forEach(([query, result]) => {
            if (!result.error) {
                clientCache.set(query.toLowerCase().trim(), result);
            }
        });
    }

    return data;
}

export function clearSearchCache() {
    clientCache.clear();
}
