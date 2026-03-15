import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import InputSection from './components/InputSection';
import OutputSection from './components/OutputSection';
import { generateFanOutQueries } from './services/llmService';

function App() {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState('chatgpt');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);

  // Check if search API is configured on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setSearchEnabled(data.searchApi === 'configured');
      })
      .catch(() => {
        setSearchEnabled(false);
      });
  }, []);

  const handleSimulate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResult(null);
    setIsCopied(false);

    try {
      const data = await generateFanOutQueries(prompt, engine);
      setResult(data);
    } catch (error) {
      console.error('Error generating queries:', error);
      alert('Failed to simulate fan-out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (!result) return;
    const text = result.queries.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div id="ml-tool-query-fanout">
      <Header />
      <div className="ml-tool-body">
        <InputSection
          prompt={prompt}
          setPrompt={setPrompt}
          engine={engine}
          setEngine={setEngine}
          isLoading={isLoading}
          onSimulate={handleSimulate}
        />
        <OutputSection
          result={result}
          onCopyAll={handleCopyAll}
          isCopied={isCopied}
          searchEnabled={searchEnabled}
        />
      </div>
      <div className="ml-tool-footer">
        Powered by <a href="https://maximuslabs.ai" target="_blank" rel="noopener noreferrer">MaximusLabs AI</a>
      </div>
    </div>
  );
}

export default App;
