import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorMiddleware, type ApiResponse } from './lib/error-middleware';
import { ErrorCode } from './lib/errors';
import admin from './routes/admin';
import klines from './routes/klines';
import records from './routes/records';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ credentials: true }));

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
