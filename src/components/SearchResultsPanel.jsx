import React from 'react';
import { ExternalLink, Globe, AlertCircle } from 'lucide-react';

export default function SearchResultsPanel({ searchData, isLoading, error }) {
    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div className="ml-tool-spinner" />
                    <span className="ml-tool-text-muted" style={{ fontWeight: '500' }}>
                        Fetching live results...
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ml-tool-alert-error" style={{ marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} />
                {error === 'SEARCH_NOT_CONFIGURED'
                    ? 'Add SERPAPI_API_KEY to .env to enable live results'
                    : 'Could not load results'}
            </div>
        );
    }

    if (!searchData || !searchData.results || searchData.results.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <span className="ml-tool-text-muted">
                    No results found
                </span>
            </div>
        );
    }

    return (
        <div>
            {searchData.knowledgeGraph && (
                <div style={{
                    padding: '14px 16px', marginBottom: '8px',
                    background: '#e2e2e220',
                    border: '1px solid #e2e2e2',
                    borderRadius: '6px'
                }}>
                    <div style={{
                        fontSize: '0.75rem', fontWeight: '700', color: '#0070e0',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
                    }}>
                        Knowledge Panel
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#001c64', marginBottom: '4px' }}>
                        {searchData.knowledgeGraph.title}
                    </div>
                    {searchData.knowledgeGraph.description && (
                        <p className="ml-tool-text-muted" style={{ fontSize: '0.8125rem', marginBottom: '0' }}>
                            {searchData.knowledgeGraph.description}
                        </p>
                    )}
                </div>
            )}

            {searchData.results.map((result, idx) => (
                <a
                    key={idx}
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'block',
                        padding: '14px 10px',
                        textDecoration: 'none',
                        borderBottom: idx < searchData.results.length - 1 ? '1px solid #e2e2e2' : 'none',
                        transition: 'background 0.15s ease',
                        borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#449afb08'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        marginBottom: '4px',
                    }}>
                        {result.favicon ? (
                            <img
                                src={result.favicon}
                                alt=""
                                width={14}
                                height={14}
                                style={{ borderRadius: '3px' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ) : (
                            <Globe size={12} color="#999" />
                        )}
                        <span style={{
                            fontSize: '0.75rem', color: '#555555',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: '260px',
                        }}>
                            {result.displayedLink}
                        </span>
                    </div>

                    <div style={{
                        fontSize: '0.875rem', fontWeight: '600',
                        color: '#003087',
                        marginBottom: '4px', lineHeight: '1.4',
                        display: 'flex', alignItems: 'flex-start', gap: '6px',
                    }}>
                        <span style={{ flex: 1 }}>{result.title}</span>
                        <ExternalLink size={12} style={{ flexShrink: 0, marginTop: '3px', opacity: 0.5 }} />
                    </div>

                    {result.snippet && (
                        <p className="ml-tool-text-muted" style={{
                            fontSize: '0.8125rem',
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}>
                            {result.snippet}
                        </p>
                    )}
                </a>
            ))}
        </div>
    );
}
