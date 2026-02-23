/**
 * Server-side Gemini chat with tool calling support.
 * Registers function declarations for YouTube AI Chat Assistant tools.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-2.5-flash';

const GEMINI_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate an image from a text prompt. Optionally use an anchor/reference image the user attached. Use when the user asks for a thumbnail, visual mockup, infographic, or any image creation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Detailed text description of the image to generate.',
        },
        anchorImage: {
          type: 'OBJECT',
          description: 'Optional reference image when user attached an image.',
          properties: {
            name: { type: 'STRING', description: 'File name.' },
            mimeType: { type: 'STRING', description: 'MIME type (e.g. image/png, image/jpeg).' },
            base64: { type: 'STRING', description: 'Base64-encoded image data.' },
          },
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot a numeric metric from the loaded JSON channel data over time (by release_date). Use when the user asks to visualize how views, likes, comments, or duration trend over time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric: {
          type: 'STRING',
          description: 'Numeric field name. Examples: view_count, like_count, comment_count, duration.',
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'play_video',
    description: 'Open or preview a specific video from the channel data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        videoUrl: {
          type: 'STRING',
          description: 'Full YouTube video URL (e.g. https://www.youtube.com/watch?v=VIDEO_ID).',
        },
      },
      required: ['videoUrl'],
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute statistics (mean, median, std, min, max, count) for a numeric field in the loaded JSON channel data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description: 'Numeric field name. Examples: view_count, like_count, comment_count, duration.',
        },
      },
      required: ['field'],
    },
  },
];

const tools = [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS }];

/**
 * Create a Gemini model configured with the YouTube assistant tools.
 * Uses generateContent / streamGenerateContent via startChat.
 * No tool execution logic — tools are registered only.
 */
function createChatModel(systemInstruction, history = []) {
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    tools,
  });

  const baseHistory = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content || '' }],
  }));

  const chatHistory = systemInstruction
    ? [
        { role: 'user', parts: [{ text: `Follow these instructions:\n\n${systemInstruction}` }] },
        { role: 'model', parts: [{ text: "Got it! I'll follow those instructions." }] },
        ...baseHistory,
      ]
    : baseHistory;

  return model.startChat({ history: chatHistory });
}

module.exports = {
  GEMINI_TOOL_DECLARATIONS,
  tools,
  createChatModel,
  MODEL,
};
