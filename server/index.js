import { createApp } from './app.js';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const { app, db } = createApp({
  dbPath: process.env.DB_PATH || 'data/cafe.sqlite',
  testMode: process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_API === 'true'
});
const server = app.listen(port, host, () => {
  console.log(`Café Claro: http://${host}:${port}`);
  process.send?.('ready');
});
const shutdown = () => server.close(() => { db.close(); process.exit(0); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
process.on('message', message => { if (message === 'shutdown') shutdown(); });
