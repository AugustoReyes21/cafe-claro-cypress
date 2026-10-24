import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.js';

async function fixture(t, testMode = false) {
  const directory = mkdtempSync(join(tmpdir(), 'cafe-test-'));
  const dbPath = join(directory, 'test.sqlite');
  const { app, db } = createApp({ dbPath, testMode });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(directory, { recursive: true }); });
  const request = (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { request, db, dbPath };
}

test('el endpoint de reset no existe fuera del modo de prueba', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/test/reset', {})).status, 404);
});
test('valida los límites del contrato sin insertar órdenes', async t => {
  const { request, db } = await fixture(t);
  for (const items of [[], [{ productId: 'latte', quantity: 0 }], [{ productId: 'latte', quantity: 1.5 }], [{ productId: 'latte', quantity: 11 }], [{ productId: 'latte', quantity: '2' }], [{ productId: 'latte', quantity: 1 }, { productId: 'latte', quantity: 1 }], [{ productId: 'unknown', quantity: 1 }]]) {
    assert.equal((await request('/api/orders', { items })).status, 400);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
});
test('un fallo de stock no descuenta ninguna línea ni guarda una orden', async t => {
  const { request, db } = await fixture(t);
  const result = await request('/api/orders', { items: [{ productId: 'latte', quantity: 2 }, { productId: 'chocolate', quantity: 1 }] });
  assert.equal(result.status, 409);
  assert.equal(db.prepare("SELECT stock FROM products WHERE id = 'latte'").get().stock, 12);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
});
test('calcula precios en servidor y conserva la orden al reabrir SQLite', async t => {
  const { request, dbPath } = await fixture(t);
  const result = await request('/api/orders', { totalCents: 1, items: [{ productId: 'latte', quantity: 2, priceCents: 1 }, { productId: 'croissant', quantity: 1 }] });
  assert.equal(result.status, 201);
  const order = await result.json();
  assert.equal(order.totalCents, 6400);
  const reopened = createApp({ dbPath });
  try {
    const persisted = reopened.db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    assert.equal(persisted.totalCents, 6400);
    assert.equal(JSON.parse(persisted.items).length, 2);
  } finally { reopened.db.close(); }
});
test('el reset restaura existencias y elimina órdenes', async t => {
  const { request, db } = await fixture(t, true);
  await request('/api/orders', { items: [{ productId: 'latte', quantity: 2 }] });
  assert.equal((await request('/api/test/reset', {})).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  assert.equal(db.prepare("SELECT stock FROM products WHERE id = 'latte'").get().stock, 12);
});
