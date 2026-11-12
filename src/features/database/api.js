export async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
