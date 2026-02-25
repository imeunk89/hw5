import API_BASE from './apiBase';

function parseApiResponse(text) {
  if (!text || !text.trim()) return {};
  if (text.trim().startsWith('<')) {
    throw new Error('Backend request failed (likely wrong URL).');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Backend request failed (likely wrong URL).');
  }
}

const api = async (path, options = {}) => {
  const base = (API_BASE || '').replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const text = await res.text();
  if (!res.ok) {
    if (text?.trim().startsWith('<')) {
      throw new Error('Backend request failed (likely wrong URL).');
    }
    try {
      const json = JSON.parse(text);
      throw new Error(json?.error || text || res.statusText);
    } catch (e) {
      throw new Error(e instanceof SyntaxError ? 'Backend request failed (likely wrong URL).' : (e.message || text || res.statusText));
    }
  }
  return parseApiResponse(text);
};

// ── Users ────────────────────────────────────────────────────────────────────

export const createUser = async (username, password, email = '', firstName = '', lastName = '') => {
  await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, email, firstName, lastName }),
  });
};

export const findUser = async (username, password) => {
  const data = await api('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data.ok
    ? {
        username: data.username,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
      }
    : null;
};

// ── Sessions ─────────────────────────────────────────────────────────────────

export const getSessions = async (username) => {
  return api(`/api/sessions?username=${encodeURIComponent(username)}`);
};

export const createSession = async (username, agent = null, title = null) => {
  return api('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ username, agent, title }),
  });
};

export const deleteSession = async (sessionId) => {
  return api(`/api/sessions/${sessionId}`, { method: 'DELETE' });
};

export const updateSessionTitle = async (sessionId, title) => {
  return api(`/api/sessions/${sessionId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
};

// ── Messages ─────────────────────────────────────────────────────────────────

export const saveMessage = async (sessionId, role, content, imageData = null, charts = null, toolCalls = null) => {
  return api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, role, content, imageData, charts, toolCalls }),
  });
};

export const loadMessages = async (sessionId) => {
  return api(`/api/messages?session_id=${encodeURIComponent(sessionId)}`);
};

// ── YouTube channel download ─────────────────────────────────────────────────

function apiUrl(path) {
  const base = (API_BASE || '').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function youtubeFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const text = await res.text();
  if (!res.ok) {
    if (text?.trim().startsWith('<')) {
      throw new Error('Backend request failed (likely wrong URL).');
    }
    try {
      const json = JSON.parse(text);
      if (typeof json?.error === 'string') throw new Error(json.error);
      throw new Error(text || res.statusText);
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error('Backend request failed (likely wrong URL).');
      throw e; // rethrow backend error message
    }
  }
  return parseApiResponse(text);
}

export const startYoutubeDownload = async (channelUrl, maxVideos) => {
  const payload = {
    channelUrl: String(channelUrl || '').trim(),
    maxVideos: Number(maxVideos) || 10,
  };
  return youtubeFetch(apiUrl('/api/youtube/download'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

export { apiUrl };
export const getYoutubeProgress = async (jobId) => {
  return youtubeFetch(apiUrl(`/api/youtube/progress/${jobId}`));
};

// ── JSON upload (channel data for chat) ──────────────────────────────────────

export const uploadJson = async (data) => {
  return api('/api/json/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const computeStatsJson = async (field, dataOrJsonId) => {
  const body =
    typeof dataOrJsonId === 'string'
      ? { field, jsonId: dataOrJsonId }
      : { field, data: dataOrJsonId };
  return api('/api/json/compute-stats', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const generateImage = async (prompt, anchorImage = null) => {
  const body = { prompt };
  if (anchorImage?.base64) {
    body.anchorImage = {
      name: anchorImage.name || 'anchor.png',
      mimeType: anchorImage.mimeType || 'image/png',
      base64: anchorImage.base64,
    };
  }
  return api('/api/images/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};
