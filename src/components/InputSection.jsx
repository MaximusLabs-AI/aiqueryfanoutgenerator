import React from 'react';

export default function InputSection({ prompt, setPrompt, engine, setEngine, isLoading, onSimulate }) {
    return (
        <section className="ml-tool-section">
            <div className="ml-tool-input-group">
                <label className="ml-tool-input-label">
                    Target Query
                </label>
                <textarea
                    className="ml-tool-textarea"
                    placeholder="e.g., Which enterprise CRM improves sales revenue the fastest?"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '240px' }} className="ml-tool-input-group">
                    <label className="ml-tool-input-label">
                        Simulation Engine
                    </label>
                    <select
                        className="ml-tool-select"
                        value={engine}
                        onChange={(e) => setEngine(e.target.value)}
                        disabled={isLoading}
                    >
                        <option value="chatgpt">ChatGPT Search</option>
                        <option value="google_ai_mode">Google AI Overviews</option>
                        <option value="perplexity">Perplexity Engine</option>
                    </select>
                </div>

                <div className="ml-tool-input-group">
                    <button
                        onClick={onSimulate}
                        disabled={isLoading || !prompt.trim()}
                        className="ml-tool-primary-button"
                        style={{ minWidth: '200px', height: '48px', marginBottom: '0' }}
                    >
                        {isLoading ? (
                            <>
                                <div className="ml-tool-spinner-white" />
                                Processing...
                            </>
                        ) : (
                            <>
                                Audit Intent Flow <span style={{ fontFamily: 'sans-serif' }}>&rarr;</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
