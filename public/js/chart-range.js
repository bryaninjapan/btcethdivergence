export const PADDING_SECONDS = 24 * 3600;
export const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;

export function recordToRange(record) {
  const startMs = (record.start_time - PADDING_SECONDS) * 1000;
  const endMs = (record.end_time + PADDING_SECONDS) * 1000;
  return { startMs, endMs };
}

export function parseRangeParams(search) {
  const params = new URLSearchParams(search);
  if (params.get('start') === null || params.get('end') === null) return null;
  const start = Number(params.get('start'));
  const end = Number(params.get('end'));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= end) return null;
  return { startMs: start, endMs: end };
}

export function nowRange() {
  const endMs = Date.now();
  return { startMs: endMs - DEFAULT_WINDOW_SECONDS * 1000, endMs };
}