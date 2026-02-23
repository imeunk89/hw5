import { useState } from 'react';
import { startYoutubeDownload, getYoutubeProgress } from '../services/mongoApi';
import './YouTubeChannelDownload.css';

// Hardcoded: "http://localhost:3001" + path (no relative paths)
const YOUTUBE_BACKEND = 'http://localhost:3001';

async function downloadChannelData(channelUrl, maxVideos, onProgress) {
  const trimmed = channelUrl.trim();
  if (!trimmed) throw new Error('YouTube channel URL is required');

  const clamped = Math.min(100, Math.max(1, parseInt(maxVideos, 10) || 10));

  const { jobId } = await startYoutubeDownload(trimmed, clamped);
  if (!jobId) throw new Error('No jobId returned');

  const poll = async () => {
    const data = await getYoutubeProgress(jobId);
    if (data.status === 'complete') {
      return YOUTUBE_BACKEND + `/api/youtube/downloads/${data.fileName}`;
    }
    if (data.status === 'error') throw new Error(data.error || 'Download failed');
    onProgress?.(data.progress ?? 0, data.message ?? 'Processing...');
    await new Promise((r) => setTimeout(r, 800));
    return poll();
  };
  return poll();
}

export default function YouTubeChannelDownload() {
  const [channelUrl, setChannelUrl] = useState('');
  const [maxVideos, setMaxVideos] = useState(10);
  const [progress, setProgress] = useState(null); // { percent, status }
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setError('');
    setDownloadUrl(null);

    if (!channelUrl.trim()) {
      setError('YouTube channel URL is required');
      return;
    }

    const clampedMax = Math.min(100, Math.max(1, maxVideos));
    setProgress({ percent: 0, status: 'Starting...' });

    try {
      const url = await downloadChannelData(channelUrl, clampedMax, (percent, status) => {
        setProgress({ percent, status });
      });
      setDownloadUrl(url);
      setProgress(null);
    } catch (err) {
      let msg = err.message || 'Download failed';
      if (msg.trim().startsWith('<') || msg.length > 500) {
        msg = 'Backend request failed (likely wrong URL).';
      }
      try {
        const parsed = JSON.parse(msg);
        if (typeof parsed?.error === 'string') msg = parsed.error;
      } catch {}
      setError(msg);
      setProgress(null);
    }
  };

  return (
    <div className="youtube-download">
      <div className="youtube-download-card">
        <div className="youtube-download-header">
          <h1>YouTube Channel Download</h1>
          <p className="youtube-download-subtitle">Export channel video data as JSON</p>
          <p className="youtube-sample-note">
            <a href="/veritasium_10.json" target="_blank" rel="noopener noreferrer">
              Sample output (Veritasium, 10 videos)
            </a>
            — for quick testing.
          </p>
        </div>

        <div className="youtube-download-form">
          <input
            type="url"
            placeholder="https://www.youtube.com/@veritasium"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            disabled={!!progress}
          />
          <input
            type="number"
            placeholder="Max videos (1–100)"
            min={1}
            max={100}
            value={maxVideos}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setMaxVideos(Number.isNaN(v) ? 10 : Math.min(100, Math.max(1, v)));
            }}
            disabled={!!progress}
          />
          <button
            type="button"
            className="youtube-download-btn"
            onClick={handleDownload}
            disabled={!!progress}
          >
            Download Channel Data
          </button>
        </div>

        {progress && (
          <div className="youtube-progress">
            <div className="youtube-progress-bar-wrap">
              <div
                className="youtube-progress-bar"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="youtube-progress-status">{progress.status}</p>
          </div>
        )}

        {downloadUrl && (
          <div className="youtube-result">
            <a href={downloadUrl} download="channel-data.json" target="_blank" rel="noopener noreferrer" className="youtube-download-link">
              Download channel-data.json (opens in new tab)
            </a>
          </div>
        )}

        {error && <p className="youtube-error">{error}</p>}
      </div>
    </div>
  );
}
