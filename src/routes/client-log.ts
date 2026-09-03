/**
 * POST /api/client-log — client-log ingestion beacon.
 *
 * Frontend loggers (charts.js / records.js) POST structured records here so
 * they surface in Workers Logs for production observability. Fire-and-forget:
 * the endpoint validates, injects into stdout (Workers Logs), and returns 202
 * immediately.
 *
 * Authentication is enforced at the Cloudflare Access edge (same policy as
 * /api/records), not in Worker code.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { validationMessage } from '../lib/validate';
import { createLogger } from '../lib/logger';
import type { Env } from '../types';

export const MAX_PAYLOAD_BYTES = 64 * 1024;

export const clientLogSchema = z.object({
  timestamp: z.string().min(1),
  level: z.enum(['error', 'warn', 'info', 'debug']),
  component: z.string().min(1),
  action: z.string().min(1),
  message: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      code: z.string().optional(),
      kind: z
        .enum(['abort-timeout', 'abort-superseded', 'validation', 'service', 'database', 'auth', 'unknown'])
        .optional(),
      stack: z.string().optional(),
    })
    .optional(),
});

/**
 * Structured logger for the beacon endpoint. All logs flow through the logger
 * sink (consoleSink → Workers Logs), never raw console.* calls.
 */
const logger = createLogger('client-log');

const clientLog = new Hono<{ Bindings: Env }>();

clientLog.post('/api/client-log', async (c) => {
  // Reject oversized payloads before any parsing (413).
  const rawBody = await c.req.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return c.json({ status: 'error', message: 'Payload exceeds 64 KB limit' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const parsed = clientLogSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') || 'body';
    return c.json({ status: 'error', message: `Missing required field: ${field}` }, 400);
  }

  const record = parsed.data;

  // Inject into Workers Logs via the structured logger. The client already
  // redacts notes/tags; logger-side redaction is defense-in-depth.
  logger.info('clientLog.ingest', record.message, {
    source: 'client',
    clientLevel: record.level,
    clientComponent: record.component,
    clientAction: record.action,
    context: record.context,
    error: record.error,
  });

  return c.json({ status: 'accepted', id: crypto.randomUUID() }, 202);
});

export default clientLog;