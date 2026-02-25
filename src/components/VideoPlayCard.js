export default function VideoPlayCard({ videoUrl, title, thumbnailUrl }) {
  if (!videoUrl) return null;

  const displayTitle = title || 'Watch on YouTube';

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="video-play-card"
      aria-label={`Play: ${displayTitle}`}
    >
      <div className="video-play-card-thumb">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="video-play-card-placeholder">▶</div>
        )}
      </div>
      <div className="video-play-card-title">{displayTitle}</div>
      <span className="video-play-card-hint">Click to open on YouTube</span>
    </a>
  );
}
