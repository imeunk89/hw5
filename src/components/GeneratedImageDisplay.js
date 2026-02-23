import { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function downloadImage(url) {
  const abs = toAbsoluteUrl(url);
  const filename = url.split('/').pop() || 'generated-image.svg';
  try {
    const res = await fetch(abs);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(abs, '_blank');
  }
}

export default function GeneratedImageDisplay({ imageUrl }) {
  const [modalOpen, setModalOpen] = useState(false);
  const absUrl = toAbsoluteUrl(imageUrl);

  if (!imageUrl || !absUrl) return null;

  return (
    <>
      <div
        className="generated-image-wrap"
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setModalOpen(true)}
        aria-label="Click to enlarge"
      >
        <img src={absUrl} alt="Generated" className="generated-image-thumb" />
      </div>

      {modalOpen && (
        <div className="generated-image-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="generated-image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="generated-image-modal-header">
              <h3>Generated Image</h3>
              <button
                className="generated-image-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="generated-image-modal-body">
              <img src={absUrl} alt="Generated" />
            </div>
            <div className="generated-image-modal-actions">
              <button type="button" onClick={() => downloadImage(imageUrl)}>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
