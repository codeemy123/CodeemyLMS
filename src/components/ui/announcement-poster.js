export default function AnnouncementPoster({ record }) {
  if (!record.image_url) return null;
  return (
    <figure className="announcement-poster">
      <a
        href={record.image_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={'Open poster: ' + record.title}
      >
        <img src={record.image_url} alt={record.title + ' — announcement poster'} loading="lazy" />
      </a>
      <figcaption>Tap the poster to view the full image.</figcaption>
    </figure>
  );
}
