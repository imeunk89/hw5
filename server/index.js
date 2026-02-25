console.log("SERVER BOOT: start");
const path = require('path');
const fs = require('fs');
require('node:dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const http = require('http');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

const ALLOWED_ORIGINS = [
  'https://hw5-k8eo.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));

/** Ensure JSON response is sent with explicit Content-Length (avoids empty body issues) */
function sendJson(res, data) {
  const body = JSON.stringify(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
  res.end(body);
}

// ── YouTube routes first (before any static/catch-all) ───────────────────────
const { runDownload, DOWNLOADS_DIR } = require('./youtube');
const { getBackendPublicUrl, DEV_PORT } = require('../src/config/apiBase');
const youtubeJobs = new Map();

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

app.post('/api/youtube/download', async (req, res) => {
  try {
    const { channelUrl, maxVideos = 10 } = req.body;
    if (!channelUrl || typeof channelUrl !== 'string')
      return res.status(400).json({ error: 'channelUrl (string) required' });

    const jobId = generateJobId();
    youtubeJobs.set(jobId, { status: 'pending', progress: 0, message: 'Starting...' });

    res.json({ ok: true, jobId });

    const job = youtubeJobs.get(jobId);
    job.status = 'running';

    const max = Math.min(100, Math.max(1, parseInt(maxVideos, 10) || 10));
    runDownload(channelUrl.trim(), max, (percent, message) => {
      const j = youtubeJobs.get(jobId);
      if (j && j.status === 'running') {
        j.progress = percent;
        j.message = message;
      }
    })
      .then(({ fileName, videoCount }) => {
        const j = youtubeJobs.get(jobId);
        if (j) {
          j.status = 'complete';
          j.progress = 100;
          j.message = 'Complete';
          j.fileName = fileName;
          j.publicUrl = `/api/youtube/downloads/${fileName}`;
          j.videoCount = videoCount;
        }
      })
      .catch((err) => {
        const j = youtubeJobs.get(jobId);
        if (j) {
          j.status = 'error';
          j.error = err.message || 'Download failed';
        }
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/youtube/progress/:jobId', (req, res) => {
  const job = youtubeJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { status, progress, message, error, fileName, publicUrl, videoCount } = job;
  if (status === 'complete') {
    res.json({ ok: true, status: 'complete', fileName, publicUrl, videoCount });
  } else if (status === 'error') {
    res.json({ ok: false, status: 'error', error });
  } else {
    res.json({ status: 'running', progress, message });
  }
});

app.get('/api/youtube/downloads/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  if (!/^channel_\d+\.json$/.test(fileName))
    return res.status(400).json({ error: 'Invalid file name' });
  const filePath = path.resolve(DOWNLOADS_DIR, fileName);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
  });
});

// ── Rest of app ─────────────────────────────────────────────────────────────

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

const { createChatModel } = require('./geminiChat');
const { withRetry, logTokenUsage } = require('./utils/retryGemini');

let db;

async function connect() {
  console.log("SERVER BOOT: before Mongo connect");
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log("SERVER BOOT: Mongo connected");
}

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email, and password required' });
    if (!firstName || !lastName)
      return res.status(400).json({ error: 'firstName and lastName required' });
    const name = String(username).trim().toLowerCase();
    const emailNorm = String(email).trim().toLowerCase();
    const first = String(firstName).trim();
    const last = String(lastName).trim();
    const existingByEmail = await db.collection('users').findOne({ email: emailNorm });
    if (existingByEmail)
      return res.status(409).json({ ok: false, error: 'Email already exists' });
    const existingByUsername = await db.collection('users').findOne({ username: name });
    if (existingByUsername)
      return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({
      username: name,
      email: emailNorm,
      firstName: first,
      lastName: last,
      password: hashed,
      createdAt: new Date().toISOString(),
    });
    sendJson(res, {
      ok: true,
      user: { id: result.insertedId.toString(), username: name, email: emailNorm, firstName: first, lastName: last },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    // Return firstName/lastName for personalization; existing users may lack these (graceful fallback)
    sendJson(res, {
      ok: true,
      username: name,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generated images (generateImage tool) ───────────────────────────────────

const IMAGES_STORE_DIR = path.join(__dirname, '..', 'generated-images');
const { GoogleGenAI } = require('@google/genai');

function generateImageId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Serve generated images as static files
app.use('/generated', express.static(IMAGES_STORE_DIR, { maxAge: '1d' }));

app.post('/api/images/generate', async (req, res) => {
  try {
    const { prompt, anchorImage } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim())
      return res.status(400).json({ error: 'prompt (string) is required' });

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: 'REACT_APP_GEMINI_API_KEY or GEMINI_API_KEY not configured' });

    const apiBase = getBackendPublicUrl();
    const storeDir = path.resolve(IMAGES_STORE_DIR);
    await fs.promises.mkdir(storeDir, { recursive: true });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt.trim(),
      config: { numberOfImages: 1 },
    });

    const genImg = response?.generatedImages?.[0];
    if (!genImg?.image?.imageBytes)
      return res.status(500).json({ error: genImg?.raiFilteredReason || 'No image generated' });

    const imgBytes = genImg.image.imageBytes;
    const mimeType = genImg.image.mimeType || 'image/png';
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const imgId = generateImageId();
    const fileName = `${imgId}.${ext}`;
    const filePath = path.join(storeDir, fileName);
    const buffer = Buffer.from(imgBytes, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    const imageUrl = `${apiBase.replace(/\/$/, '')}/generated/${fileName}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error('[generateImage]', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ── JSON upload (channel data for chat) ──────────────────────────────────────

const JSON_STORE_DIR = path.join(__dirname, '..', 'json_store');

function generateJsonId() {
  return `json_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

app.post('/api/json/upload', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object')
      return res.status(400).json({ error: 'JSON body required' });
    const jsonId = generateJsonId();
    const fileName = `${jsonId}.json`;
    const storeDir = path.resolve(JSON_STORE_DIR);
    await require('fs').promises.mkdir(storeDir, { recursive: true });
    await require('fs').promises.writeFile(
      path.join(storeDir, fileName),
      JSON.stringify(body, null, 2)
    );
    res.json({ ok: true, jsonId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/json/:jsonId', async (req, res) => {
  try {
    const jsonId = req.params.jsonId;
    if (!/^json_\d+_[a-z0-9]+$/.test(jsonId))
      return res.status(400).json({ error: 'Invalid jsonId' });
    const filePath = path.join(JSON_STORE_DIR, `${jsonId}.json`);
    const data = await require('fs').promises.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/json/compute-stats', (req, res) => {
  try {
    const { field, jsonId, data } = req.body;
    if (!field || typeof field !== 'string')
      return res.status(400).json({ error: 'field (string) is required' });

    let videos = [];
    if (data?.videos && Array.isArray(data.videos)) {
      videos = data.videos;
    } else if (jsonId && /^json_\d+_[a-z0-9]+$/.test(jsonId)) {
      const fp = path.join(JSON_STORE_DIR, `${jsonId}.json`);
      const raw = require('fs').readFileSync(fp, 'utf8');
      const parsed = JSON.parse(raw);
      videos = parsed?.videos || [];
    }
    if (!videos.length) return res.status(400).json({ error: 'No video data. Load JSON channel data first.' });

    const vals = videos.map((v) => (v[field] != null ? Number(v[field]) : NaN)).filter((n) => !Number.isNaN(n) && typeof n === 'number');
    if (!vals.length)
      return res.status(400).json({
        error: `Field "${field}" has no numeric values. Try: view_count, like_count, comment_count, duration.`,
      });

    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const sorted = [...vals].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);

    res.json({
      field,
      mean: +mean.toFixed(4),
      median: +median.toFixed(4),
      std: +std.toFixed(4),
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Gemini chat with tool calling (tools registered, no execution logic yet) ───

const DEFAULT_SYSTEM_PROMPT = `You are the YouTube AI Chat Assistant. Help users analyze YouTube channel performance using JSON data they upload.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], systemInstruction } = req.body;
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'message (string) is required' });
    const chat = createChatModel(systemInstruction || DEFAULT_SYSTEM_PROMPT, history);
    const result = await withRetry(() => chat.sendMessage(message));
    const response = result.response;
    logTokenUsage(response, '/api/chat');
    const text = response.text();
    const parts = response.candidates?.[0]?.content?.parts || [];
    const funcCall = parts.find((p) => p.functionCall);
    res.json({
      text: text || '',
      functionCall: funcCall
        ? { name: funcCall.functionCall.name, args: funcCall.functionCall.args }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve React build when build folder exists ─────────────────────────────────

const buildPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || DEV_PORT;

connect()
  .then(() => {
    console.log("SERVER BOOT: before listen");
    const server = http.createServer({ maxHeaderSize: 32768 }, app);
    server.listen(PORT, () => {
      console.log("SERVER BOOT: listening", PORT);
      console.log(`Server on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("SERVER BOOT: Mongo connect error", err);
    process.exit(1);
  });
