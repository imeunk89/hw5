/**
 * Shared API base URL configuration.
 * Single source of truth for localhost:3001 - used by frontend and backend.
 * Note: package.json "proxy" must match DEV_API_BASE (CRA doesn't support variables there).
 */
const DEV_API_BASE = 'http://localhost:3001';
const DEV_PORT = 3001;

/** Frontend: where to send API requests */
const getFrontendApiBase = () =>
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development' ? DEV_API_BASE : '');

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
