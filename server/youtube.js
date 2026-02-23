/**
 * YouTube channel download — resolves channel URL, fetches videos and transcripts.
 * Requires YOUTUBE_API_KEY (or REACT_APP_YOUTUBE_API_KEY) in .env.
 */
const { google } = require('googleapis');
const { YoutubeTranscript } = require('youtube-transcript');
const fs = require('fs').promises;
const path = require('path');

const API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
const DOWNLOADS_DIR = path.join(__dirname, '..', 'downloads');

function parseChannelUrl(channelUrl) {
  const url = String(channelUrl).trim();
  // @handle: https://www.youtube.com/@veritasium or youtube.com/@veritasium
  const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  // channel ID: https://www.youtube.com/channel/UCxxxx
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };
  return null;
}

function parseDuration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const [, h, m, s] = match;
  const hours = parseInt(h || 0, 10);
  const mins = parseInt(m || 0, 10);
  const secs = parseInt(s || 0, 10);
  return hours * 3600 + mins * 60 + secs;
}

async function getYoutubeClient() {
  if (!API_KEY) throw new Error('YOUTUBE_API_KEY (or REACT_APP_YOUTUBE_API_KEY) is required');
  return google.youtube({ version: 'v3', auth: API_KEY });
}

async function resolveChannelId(youtube, parsed) {
  if (parsed.type === 'id') return parsed.value;
  const res = await youtube.channels.list({
    part: 'id',
    forHandle: parsed.value,
  });
  if (!res.data.items?.length) throw new Error(`Channel not found: @${parsed.value}`);
  return res.data.items[0].id;
}

async function fetchChannelVideos(youtube, channelId, maxVideos, onProgress) {
  const res = await youtube.channels.list({
    part: 'contentDetails',
    id: channelId,
  });
  const uploadsId = res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error('Channel has no uploads playlist');

  const videoIds = [];
  let pageToken = null;
  if (typeof onProgress === 'function') onProgress(null, null, 'Collecting video list...');

  while (videoIds.length < maxVideos) {
    const listRes = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsId,
      maxResults: Math.min(50, maxVideos - videoIds.length),
      pageToken,
    });
    for (const item of listRes.data.items || []) {
      const vid = item.snippet?.resourceId?.videoId;
      if (vid) videoIds.push(vid);
    }
    pageToken = listRes.data.nextPageToken;
    if (!pageToken || videoIds.length >= maxVideos) break;
  }

  const toFetch = videoIds.slice(0, maxVideos);
  if (toFetch.length === 0) return [];

  const videosRes = await youtube.videos.list({
    part: 'snippet,statistics,contentDetails',
    id: toFetch.join(','),
  });

  const items = videosRes.data.items || [];
  const result = [];
  const total = items.length;

  for (let i = 0; i < total; i++) {
    const v = items[i];
    const snippet = v.snippet || {};
    const stats = v.statistics || {};
    const content = v.contentDetails || {};
    const thumbnails = snippet.thumbnails || {};
    const thumb = thumbnails.maxres || thumbnails.high || thumbnails.medium || thumbnails.default;

    onProgress?.(i, total, `Fetching video ${i + 1}/${total}: ${snippet.title?.slice(0, 30)}...`);

    let transcript = null;
    let transcript_status = 'unavailable';
    try {
      const segments = await YoutubeTranscript.fetchTranscript(v.id);
      transcript = segments.map((s) => s.text).join(' ');
      transcript_status = 'available';
    } catch {
      transcript_status = 'unavailable';
    }

    result.push({
      title: snippet.title || null,
      description: snippet.description || null,
      duration: parseDuration(content.duration),
      release_date: snippet.publishedAt || null,
      view_count: stats.viewCount ? parseInt(stats.viewCount, 10) : null,
      like_count: stats.likeCount ? parseInt(stats.likeCount, 10) : null,
      comment_count: stats.commentCount ? parseInt(stats.commentCount, 10) : null,
      video_url: `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail_url: thumb?.url || null,
      transcript,
      transcript_status,
    });
  }

  return result;
}

async function runDownload(channelUrl, maxVideos, updateProgress) {
  const parsed = parseChannelUrl(channelUrl);
  if (!parsed) throw new Error('Invalid channel URL. Use format: https://www.youtube.com/@handle or https://www.youtube.com/channel/UC...');

  const max = Math.min(100, Math.max(1, maxVideos || 10));
  const youtube = await getYoutubeClient();

  updateProgress(5, 'Resolving channel...');
  const channelId = await resolveChannelId(youtube, parsed);

  updateProgress(15, 'Fetching videos...');
  const videos = await fetchChannelVideos(youtube, channelId, max, (i, total, msg) => {
    const pct = 15 + Math.floor((65 * (i + 1)) / total);
    updateProgress(pct, msg);
  });

  updateProgress(85, 'Building JSON...');
  const payload = { channelUrl, channelId, videoCount: videos.length, videos };
  const timestamp = Date.now();
  const fileName = `channel_${timestamp}.json`;
  const downloadsDir = path.join(DOWNLOADS_DIR);
  await fs.mkdir(downloadsDir, { recursive: true });
  await fs.writeFile(path.join(downloadsDir, fileName), JSON.stringify(payload, null, 2));

  updateProgress(100, 'Complete');
  return { fileName, videoCount: videos.length };
}

module.exports = { runDownload, DOWNLOADS_DIR };
