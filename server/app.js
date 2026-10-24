import express from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase, resetDatabase } from './database.js';

export function createApp({ dbPath = 'data/cafe.sqlite', testMode = false } = {}) {
  const db = openDatabase(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/products', (_req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY rowid').all()));
  app.get('/api/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ message: 'No encontramos ese pedido.' });
    res.json({ ...order, items: JSON.parse(order.items) });
  });
  app.post('/api/orders', (req, res, next) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 20 || items.some(item =>
      !item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10
    ) || new Set(items.map(item => item.productId)).size !== items.length) {
      return res.status(400).json({ code: 'INVALID_ORDER', message: 'Agrega productos con cantidades enteras entre 1 y 10.' });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const lines = [];
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
        if (!product) {
          db.exec('ROLLBACK');
          return res.status(400).json({ code: 'INVALID_PRODUCT', message: 'Uno de los productos no existe.' });
        }
        if (product.stock < item.quantity) {
          db.exec('ROLLBACK');
          return res.status(409).json({ code: 'OUT_OF_STOCK', message: `No hay suficientes existencias de ${product.name}. Quedan ${product.stock}. Ajusta tu pedido e inténtalo de nuevo.` });
        }
        lines.push({ productId: product.id, name: product.name, quantity: item.quantity, priceCents: product.priceCents, subtotalCents: product.priceCents * item.quantity });
      }
      const order = { id: `CAF-${randomUUID()}`, totalCents: lines.reduce((total, line) => total + line.subtotalCents, 0), createdAt: new Date().toISOString(), items: lines };
      for (const line of lines) db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(line.quantity, line.productId);
      db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?)').run(order.id, order.totalCents, order.createdAt, JSON.stringify(lines));
      db.exec('COMMIT');
      return res.status(201).json(order);
    } catch (error) {
      db.exec('ROLLBACK');
      next(error);
    }
  });
  // Doble condición en index.js: este endpoint no existe al ejecutar npm start.
  if (testMode) app.post('/api/test/reset', (_req, res) => {
    resetDatabase(db);
    res.json({ status: 'reset', products: 4, orders: 0 });
  });
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Recurso no encontrado.' }));
  app.use((error, _req, res, _next) => {
    const invalidJson = error.type === 'entity.parse.failed';
    res.status(invalidJson ? 400 : 500).json({ message: invalidJson ? 'La solicitud no contiene JSON válido.' : 'No pudimos procesar tu pedido. Inténtalo de nuevo.' });
  });
  return { app, db };
}
