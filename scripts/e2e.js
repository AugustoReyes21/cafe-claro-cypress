import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';

// El IPC señala que el servidor está escuchando: sin sleeps ni herramientas de SO.
const server = fork('server/index.js', [], {
  execArgv: ['--env-file=.env.test'],
  stdio: ['ignore', 'inherit', 'inherit', 'ipc']
});
const ready = new Promise((resolve, reject) => {
  server.once('message', message => message === 'ready' && resolve());
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`El servidor terminó antes de estar listo (${code}).`)));
});
try {
  await ready;
  const health = await fetch('http://127.0.0.1:3000/api/health');
  if (!health.ok) throw new Error('Falló la verificación de disponibilidad');
  const runner = spawn(process.execPath, ['scripts/cypress.js', 'run', '--browser', 'chrome', ...process.argv.slice(2)], { stdio: 'inherit' });
  const [code] = await once(runner, 'exit');
  process.exitCode = code ?? 1;
} finally {
  if (server.connected) {
    const stopped = once(server, 'exit');
    server.send('shutdown');
    await stopped;
  }
}
