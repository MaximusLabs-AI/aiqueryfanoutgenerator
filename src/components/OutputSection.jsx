import React, { useState } from 'react';
import { Copy, Check, Search, Info } from 'lucide-react';
import QueryCard from './QueryCard';
import { fetchSearchBatch } from '../services/searchService';

export default function OutputSection({ result, onCopyAll, isCopied, searchEnabled }) {
    const [isBatchLoading, setIsBatchLoading] = useState(false);
    const [batchResults, setBatchResults] = useState(null);
    const [batchError, setBatchError] = useState(null);

    if (!result) return null;

    const handleFetchAll = async () => {
        if (batchResults || isBatchLoading) return;
        setIsBatchLoading(true);
        setBatchError(null);

        try {
            const data = await fetchSearchBatch(result.queries);
            setBatchResults(data.results);
        } catch (err) {
            if (err.message === 'SEARCH_NOT_CONFIGURED') {
                setBatchError('Add SERPAPI_API_KEY to .env to enable live search results.');
            } else {
                setBatchError('Failed to fetch batch results. Try individual queries instead.');
            }
        } finally {
            setIsBatchLoading(false);
        }
    };

    return (
        <section className="ml-tool-section">
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-end', marginBottom: '24px',
                flexWrap: 'wrap', gap: '16px',
            }}>
                <div>
                    <h2 className="ml-tool-section-heading" style={{ marginBottom: '4px' }}>Detected Intent Divergence</h2>
                    <p className="ml-tool-text-muted">
                        Underlying searches generated for semantic validation.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {searchEnabled && (
                        <button
                            onClick={handleFetchAll}
                            disabled={isBatchLoading || !!batchResults}
                            className={`ml-tool-secondary-button`}
                        >
                            {isBatchLoading ? (
                                <>
                                    <div className="ml-tool-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                    Fetching All...
                                </>
                            ) : batchResults ? (
                                <>
                                    <Check size={15} />
                                    {Object.values(batchResults).some(res => res && res.results && res.results.length > 0) 
                                        ? `Loaded (${Object.values(batchResults).filter(res => res && res.results && res.results.length > 0).length}/${Object.keys(batchResults).length})` 
                                        : "No Results"}
                                </>
                            ) : (
                                <>
                                    <Search size={15} />
                                    Fetch All Results
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={onCopyAll}
                        className="ml-tool-secondary-button"
                    >
                        {isCopied ? <Check size={16} color="#34d399" /> : <Copy size={16} />}
                        {isCopied ? 'Copied' : 'Export Queries'}
                    </button>
                </div>
            </div>

            {batchError && (
                <div className="ml-tool-alert-error">
                    {batchError}
                </div>
            )}

            <div className="ml-tool-result-card-container">
                {result.queries.map((query, index) => (
                    <QueryCard
                        key={index}
                        query={query}
                        index={index}
                        searchEnabled={searchEnabled}
                        batchData={batchResults && batchResults[query]}
                    />
                ))}
            </div>

            <div className="ml-tool-info-callout">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <Info size={16} color="#0070e0" style={{ marginRight: '8px' }} />
                    <span style={{ fontWeight: '600', color: '#1e3251', fontSize: '0.875rem' }}>Engine Analysis</span>
                </div>
                <p>
                    {result.reasoning}
                </p>
            </div>
        </section>
    );
}
