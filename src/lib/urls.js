export function validateExternalUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    return url.href;
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
}
