import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const catalog = [
  { id: 'latte', name: 'Latte de la casa', description: 'Espresso suave, leche cremosa y un momento para ti.', category: 'Café', priceCents: 2400, stock: 12, art: 'latte' },
  { id: 'americano', name: 'Americano', description: 'Nuestro café de altura, con un sabor limpio e intenso.', category: 'Café', priceCents: 1800, stock: 15, art: 'americano' },
  { id: 'croissant', name: 'Croissant de mantequilla', description: 'Horneado dorado, ligero por dentro y crujiente por fuera.', category: 'Panadería', priceCents: 1600, stock: 8, art: 'croissant' },
  { id: 'chocolate', name: 'Chocolate caliente', description: 'Cacao, leche y el equilibrio perfecto de dulzura.', category: 'Sin café', priceCents: 2200, stock: 0, art: 'chocolate' }
];

export function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, priceCents INTEGER NOT NULL CHECK(priceCents > 0),
      stock INTEGER NOT NULL CHECK(stock >= 0), art TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, totalCents INTEGER NOT NULL, createdAt TEXT NOT NULL, items TEXT NOT NULL
    );`);
  if (!db.prepare('SELECT COUNT(*) AS n FROM products').get().n) resetDatabase(db);
  return db;
}

export function resetDatabase(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM orders; DELETE FROM products;');
    const insert = db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const p of catalog) insert.run(p.id, p.name, p.description, p.category, p.priceCents, p.stock, p.art);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
