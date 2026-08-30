import { Hono } from 'hono';
import { jsonError, jsonOk } from './lib/response';
import admin from './routes/admin';
import klines from './routes/klines';
import records from './routes/records';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => jsonOk({ status: 'ok' }));

app.route('/', admin);
app.route('/', klines);
app.route('/', records);

app.notFound(() => jsonError('Not found', 404));

export default app;
