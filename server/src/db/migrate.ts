import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, './migrations');

export function runMigrations() {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      db.exec(sql);
      console.log(`Migration applied: ${file}`);
    } catch (err: any) {
      if (err.message?.includes('duplicate column')) {
        console.log(`Migration already applied: ${file}`);
      } else {
        throw err;
      }
    }
  }
}
