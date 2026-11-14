// Versioned optional media stored alongside the existing announcement text.
const PREFIX = 'CODEEMY_ANNOUNCEMENT_V1:';
export function announcementContent(value) {
  const message = typeof value === 'string' ? value : '';
  if (message.startsWith(PREFIX)) {
    try {
      const data = JSON.parse(message.slice(PREFIX.length));
      if (
        typeof data.message === 'string' &&
        (data.imageUrl === null ||
          (typeof data.imageUrl === 'string' && data.imageUrl.startsWith('/api/storage/object?')))
      )
        return { message: data.message, image_url: data.imageUrl };
    } catch {}
  }
  return { message, image_url: null };
}
export function encodeAnnouncement(message, imageUrl) {
  const text = message || '';
  return imageUrl || text.startsWith(PREFIX)
    ? PREFIX + JSON.stringify({ message: text, imageUrl: imageUrl || null })
    : text;
}
export function presentAnnouncement(record) {
  return { ...record, ...announcementContent(record.message) };
}
