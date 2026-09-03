import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorMiddleware, type ApiResponse } from './lib/error-middleware';
import { ErrorCode } from './lib/errors';
import admin from './routes/admin';
import klines from './routes/klines';
import records from './routes/records';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS policy: allow credentials from trusted origins only
// - Development: localhost (any port)
// - Production: btcethdivergence.bryanlab.cc
// Note: All /api/* endpoints are also protected by Cloudflare Access,
// so CORS rejection is a second layer of defense (defense-in-depth)
app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => {
      if (!origin) return '*'; // allow requests without origin header

      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;

      // Allow production domain
      if (origin === 'https://btcethdivergence.bryanlab.cc') return origin;

      // Reject other origins (null makes Hono omit Access-Control-Allow-Origin header)
      return null;
    },
  }),
);

// Register error middleware to catch all errors from route handlers
app.onError((err, c) => errorMiddleware(err, c));

app.get('/api/health', (c) => {
  const response: ApiResponse<{ status: string }> = {
    ok: true,
    data: { status: 'ok' },
  };
  return c.json(response);
});

app.route('/', admin);
app.route('/', klines);
app.route('/', records);

app.notFound((c) => {
  const response: ApiResponse<never> = {
    ok: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Not found',
    },
  };
  return c.json(response, 404);
});

export default app;
