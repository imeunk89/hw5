/**
 * Robust retry for Gemini API (paid tier).
 * Handles 429 (Rate Limit) and 500 (Server Error) with exponential backoff.
 * No aggressive throttling - optimized for throughput.
 */

import pRetry from 'p-retry';

const MAX_RETRIES = 4; // 5 total attempts
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 16000;
const FACTOR = 2;

function isRetryable(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('500') ||
    msg.includes('internal server error') ||
    msg.includes('service unavailable') ||
    msg.includes('503')
  );
}

export async function withRetry(fn) {
  return pRetry(fn, {
    retries: MAX_RETRIES,
    minTimeout: MIN_DELAY_MS,
    maxTimeout: MAX_DELAY_MS,
    factor: FACTOR,
    onFailedAttempt: (err) => {
      if (isRetryable(err)) {
        console.warn(
          `[Gemini] Retryable error (attempt ${err.attemptNumber}/${MAX_RETRIES + 1}): ${err.message?.slice(0, 120)}...`
        );
      }
    },
    shouldRetry: (err) => isRetryable(err),
  }).catch((err) => {
    console.error('[Gemini] Request failed after retries:', err.message);
    throw err;
  });
}

export function logTokenUsage(response, context = '') {
  const usage = response?.usageMetadata;
  if (!usage) return;
  const prompt = usage.promptTokenCount ?? usage.prompt_token_count ?? 0;
  const output = usage.candidatesTokenCount ?? usage.candidates_token_count ?? usage.outputTokenCount ?? 0;
  const total = usage.totalTokenCount ?? usage.total_token_count ?? prompt + output;
  if (total > 0) {
    console.log(
      `[Gemini] Token usage${context ? ` (${context})` : ''}: prompt=${prompt} output=${output} total=${total}`
    );
  }
}
