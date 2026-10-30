import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app.js';

// Vercel serverless entry point. The Fastify app is built once per warm
// instance and handed raw Node requests.
const app = buildApp();
const ready = app.ready();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Routing rewrites /api/<path> to the function as /api?__path=<path>; restore the original URL.
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path !== null) {
    url.searchParams.delete('__path');
    req.url = `/api/${path}${url.search}`;
  }
  await ready;
  app.server.emit('request', req, res);
}
