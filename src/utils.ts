'use strict';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

export const TARGET_KEY =
	'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';

export function getDefaultCursorStateDbPath(): string {
	const homeDir = os.homedir();
	const platform = process.platform;
	const candidates: string[] = [];
	if (platform === 'darwin') {
		candidates.push(
			path.join(
				homeDir,
				'Library',
				'Application Support',
				'Cursor',
				'User',
				'globalStorage',
				'state.vscdb'
			),
			path.join(
				homeDir,
				'Library',
				'Application Support',
				'Cursor',
				'user',
				'globalStorage',
				'state.vscdb'
			)
		);
	} else if (platform === 'linux') {
		candidates.push(
			path.join(homeDir, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
			path.join(homeDir, '.config', 'Cursor', 'user', 'globalStorage', 'state.vscdb')
		);
	} else if (platform === 'win32') {
		const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
		candidates.push(
			path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
			path.join(appData, 'Cursor', 'user', 'globalStorage', 'state.vscdb')
		);
	}
	if (candidates.length === 0) {
		candidates.push(
			path.join(
				homeDir,
				'Library',
				'Application Support',
				'Cursor',
				'User',
				'globalStorage',
				'state.vscdb'
			)
		);
	}
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return candidates[0]!;
}

export function resolveDbPathFromArgs(argv: string[]): string {
	const dbArgIdx = argv.findIndex((arg) => arg === '--db');
	if (dbArgIdx !== -1 && argv[dbArgIdx + 1]) {
		return path.resolve(argv[dbArgIdx + 1] as string);
	}
	const envDb = process.env.CURSOR_STATE_DB;
	if (envDb && envDb.length > 0) {
		return path.resolve(envDb);
	}
	return getDefaultCursorStateDbPath();
}

export function ensureSqlite3Available(): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile('sqlite3', ['-version'], { timeout: 5000 }, (err, stdout) => {
			if (err)
				return reject(new Error('sqlite3 CLI not found. Please install or ensure it is on PATH.'));
			resolve((stdout || '').toString().trim());
		});
	});
}

export function runSqlite(dbPath: string, sql: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const args = ['-batch', '-noheader', dbPath, sql];
		execFile('sqlite3', args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
			if (err) return reject(new Error(`sqlite3 error: ${stderr || err.message}`));
			resolve((stdout || '').toString());
		});
	});
}

export async function fetchValueString(dbPath: string, key: string = TARGET_KEY): Promise<string> {
	const sql = `SELECT value FROM ItemTable WHERE key = '${key.replace(/'/g, "''")}' LIMIT 1;`;
	const out = await runSqlite(dbPath, sql);
	return (out || '').trim();
}

export function parseJsonStrict<T = unknown>(possibleJson: string): T {
	try {
		return JSON.parse(possibleJson) as T;
	} catch (e) {
		throw new Error(
			'Value is not valid JSON. Raw value length: ' + (possibleJson ? possibleJson.length : 0)
		);
	}
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

export function ensureDirSync(dirPath: string): void {
	if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

export function writeFileSyncEnsuringDir(filePath: string, content: string): void {
	ensureDirSync(path.dirname(filePath));
	fs.writeFileSync(filePath, content);
}

export function timestampString(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
		d.getMinutes()
	)}${pad(d.getSeconds())}`;
}

export interface ParsedArgs {
	[key: string]: unknown;
	_: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
	const args = Array.from(argv || []).slice(2);
	const result: ParsedArgs = { _: [] };
	const pushOpt = (k: string, v: unknown = true) => {
		if (Object.prototype.hasOwnProperty.call(result, k)) {
			const current = (result as Record<string, unknown>)[k];
			if (Array.isArray(current)) (result as Record<string, unknown>)[k] = [...current, v];
			else (result as Record<string, unknown>)[k] = [current, v];
		} else {
			(result as Record<string, unknown>)[k] = v;
		}
	};
	for (let i = 0; i < args.length; i++) {
		const token = args[i] as string;
		if (token.startsWith('--')) {
			const eq = token.indexOf('=');
			if (eq !== -1) {
				const key = token.slice(2, eq);
				const val = token.slice(eq + 1);
				pushOpt(key, val);
				continue;
			}
			const key = token.slice(2);
			const next = args[i + 1] as string | undefined;
			if (next == null || next.startsWith('-')) {
				pushOpt(key, true);
			} else {
				pushOpt(key, next);
				i++;
			}
			continue;
		}
		if (token.startsWith('-') && token.length === 2) {
			pushOpt(token.slice(1), true);
			continue;
		}
		result._.push(token);
	}
	return result;
}

export async function validateDbReadable(dbPath: string): Promise<boolean> {
	if (!fs.existsSync(dbPath)) throw new Error('SQLite DB not found: ' + dbPath);
	try {
		await runSqlite(dbPath, 'PRAGMA schema_version;');
		return true;
	} catch (err) {
		throw new Error(
			'Failed to read SQLite DB. Is the path correct? Details: ' + (err as Error).message
		);
	}
}

export async function probeDbWritable(
	dbPath: string
): Promise<{ writable: boolean; error?: Error }> {
	try {
		await runSqlite(dbPath, 'BEGIN IMMEDIATE; ROLLBACK;');
		return { writable: true };
	} catch (error) {
		return { writable: false, error: error as Error };
	}
}

export function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk) => {
			data += chunk;
		});
		process.stdin.on('end', () => resolve(data));
		process.stdin.on('error', (err) => reject(err));
	});
}

export async function readFileMaybeStdin(filePathOrDash: string): Promise<string> {
	if (filePathOrDash === '-' || filePathOrDash === '/dev/stdin') {
		return await readStdin();
	}
	return fs.readFileSync(filePathOrDash, 'utf8');
}

export function copyFileWithTimestamp(
	srcPath: string,
	destDir: string,
	baseName?: string,
	ext: string = ''
): string {
	ensureDirSync(destDir);
	const ts = timestampString();
	const srcBase = baseName || path.basename(srcPath);
	const outPath = path.join(destDir, `${srcBase}.${ts}${ext}`);
	fs.copyFileSync(srcPath, outPath);
	return outPath;
}
