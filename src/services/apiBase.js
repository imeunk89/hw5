/**
 * API base URL for backend requests.
 * - Development: falls back to http://localhost:3001 when REACT_APP_API_URL is not set
 * - Production: must set REACT_APP_API_URL in Render/build env (e.g. https://chatapp-backend.onrender.com)
 */
const API_BASE =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '');

export default API_BASE;
