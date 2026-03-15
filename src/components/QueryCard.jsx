import React, { useState, useEffect } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Search } from 'lucide-react';
import SearchResultsPanel from './SearchResultsPanel';
import { fetchSearchResults } from '../services/searchService';

export default function QueryCard({ query, index, searchEnabled, batchData }) {
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const bingSearchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  const [isExpanded, setIsExpanded] = useState(false);
  const [searchData, setSearchData] = useState(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (batchData) {
      if (batchData.error) {
        setSearchError(batchData.error);
        setSearchData(null);
      } else {
        setSearchData(batchData);
        setSearchError(null);
      }
      setIsExpanded(true);
    }
  }, [batchData]);

  const handleToggleResults = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    // Only fetch if we haven't already
    if (!searchData && !searchError) {
      setIsSearchLoading(true);
      try {
        const data = await fetchSearchResults(query);
        setSearchData(data);
      } catch (err) {
        setSearchError(err.message);
      } finally {
        setIsSearchLoading(false);
      }
    }
  };

  return (
    <div
      className="ml-tool-result-card"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="ml-tool-card-query">
        {query}
      </div>

      <div className="ml-tool-link-group">
        <a
          href={googleSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-tool-search-link"
        >
          Google <ExternalLink size={12} />
        </a>
        <a
          href={bingSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-tool-search-link"
        >
          Bing <ExternalLink size={12} />
        </a>

        {searchEnabled && (
          <button
            onClick={handleToggleResults}
            className={`ml-tool-search-toggle ${isExpanded ? 'active' : ''}`}
            title="Show live search results"
          >
            <Search size={13} />
            {isExpanded ? 'Hide Results' : 'Live Results'}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <div
        className="ml-tool-search-results-viewport"
        style={{
          maxHeight: isExpanded ? '600px' : '0',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div className="ml-tool-search-results-panel">
          <SearchResultsPanel
            searchData={searchData}
            isLoading={isSearchLoading}
            error={searchError}
          />
        </div>
      </div>
    </div>
  );
}
