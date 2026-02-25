/**
 * Shared API base URL configuration.
 * Single source of truth for localhost:3001 - used by frontend and backend.
 * Note: package.json "proxy" must match DEV_API_BASE (CRA doesn't support variables there).
 */
const DEV_API_BASE = 'http://localhost:3001';
const DEV_PORT = 3001;

/** Frontend: where to send API requests */
const getFrontendApiBase = () => {
  const fromEnv = process.env.REACT_APP_API_URL;
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv;
  if (process.env.NODE_ENV === 'development') return DEV_API_BASE;
  // Production fallback: when on Render, derive backend URL from frontend hostname
  // e.g. chatapp-frontend.onrender.com -> chatapp-backend.onrender.com
  if (typeof window !== 'undefined' && window.location?.hostname?.includes('onrender.com')) {
    const h = window.location.hostname;
    const derived = h.replace(/-frontend/, '-backend');
    if (derived !== h) {
      return `${window.location.protocol}//${derived}`;
    }
  }
  return fromEnv || '';
};

/** Backend: public URL for generated resources (images, etc.) */
const getBackendPublicUrl = () =>
  process.env.REACT_APP_API_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${process.env.PORT || DEV_PORT}`;

module.exports = {
  DEV_API_BASE,
  DEV_PORT,
  getFrontendApiBase,
  getBackendPublicUrl,
};
