export async function generateFanOutQueries(prompt, engine) {
  const response = await fetch('https://aiqueryfanoutgenerator.onrender.com/api/query-fanout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, engine }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  return response.json();
}
