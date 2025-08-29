import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export function hasSqlite3(): boolean {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function mkTmpDir(prefix = 'cursor-settings-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function initStateDb(dbPath: string): void {
  execFileSync('sqlite3', [dbPath, 'CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT);']);
}

export function writeDbValue(dbPath: string, key: string, jsonString: string): void {
  const sql = `INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('${key.replace(/'/g, "''")}', '${jsonString.replace(/'/g, "''")}');`;
  execFileSync('sqlite3', [dbPath, sql]);
}

export function readDbValue(dbPath: string, key: string): string {
  const sql = `SELECT value FROM ItemTable WHERE key='${key.replace(/'/g, "''")}';`;
  return execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();
}
