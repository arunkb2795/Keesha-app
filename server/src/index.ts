import { serve } from '@hono/node-server';
import app from './app.js';
import { serverConfig } from './env.js';

const { HOST, PORT } = serverConfig();
serve({ fetch: app.fetch, hostname: HOST, port: PORT }, ({ port }) => {
  console.log(`Keesha expense API is listening on ${HOST}:${port}.`);
});
