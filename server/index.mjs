import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { createSqlite, createPostgres } from './database.mjs';
import { seed } from '../lib/documents.mjs';
const dev = process.argv.includes('--dev');
if (process.env.RENDER && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required on Render; refusing ephemeral storage.');
const db = process.env.DATABASE_URL ? await createPostgres(process.env.DATABASE_URL) : createSqlite(process.env.SQLITE_PATH || './data/folio.db');
await seed(db);
const app = createApp(db);
if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')));
}
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, '0.0.0.0', () => console.log(`Folio is ready at http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await db.close(); process.exit(0); }));
