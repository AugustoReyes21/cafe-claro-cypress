import { openDatabase, resetDatabase } from '../server/database.js';
const path = process.env.DB_PATH || 'data/cafe.sqlite';
const db = openDatabase(path);
resetDatabase(db);
db.close();
console.log(`Datos reiniciados en ${path}: 4 productos y 0 pedidos.`);
