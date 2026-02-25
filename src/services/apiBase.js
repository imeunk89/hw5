/**
 * API base URL for backend requests.
 * - Development: falls back to DEV_API_BASE when REACT_APP_API_URL is not set
 * - Production: must set REACT_APP_API_URL in Render/build env (e.g. https://chatapp-backend.onrender.com)
 */
import apiConfig from '../config/apiBase';

const API_BASE = apiConfig.getFrontendApiBase();

export default API_BASE;
