'use strict';

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	TARGET_KEY,
	resolveDbPathFromArgs,
	ensureSqlite3Available,
	runSqlite,
	fetchValueString,
	parseJsonStrict,
	stableStringify,
	writeFileSyncEnsuringDir,
	ensureDirSync,
	timestampString,
	parseArgs,
	validateDbReadable,
	probeDbWritable,
	readFileMaybeStdin,
	copyFileWithTimestamp,
} from '../utils';

export async function runReplace(rawArgv: string[]): Promise<void> {
	if (rawArgv.includes('-h') || rawArgv.includes('--help')) {
		printHelp();
		return;
	}
	await ensureSqlite3Available();
	const argv = ['node', 'cursor-settings', ...rawArgv];
	const args = parseArgs(argv);
	const dbPath = resolveDbPathFromArgs(argv);
	await validateDbReadable(dbPath);
	const key = (args.key as string) || TARGET_KEY;
	const newFilePath = args.file as string | undefined;
	if (!newFilePath) throw new Error('Missing --file <path|->');

	const probe = await probeDbWritable(dbPath);
	if (!probe.writable) console.error('Warning: DB may be locked or not writable. Close Cursor and try again.');

	const srcJson = await readFileMaybeStdin(newFilePath === '-' ? '-' : path.resolve(newFilePath));
	const newObj = parseJsonStrict(srcJson) as unknown;
	const newJsonString = JSON.stringify(newObj);

	const currentRaw = await fetchValueString(dbPath, key);
	if (!currentRaw) throw new Error('Key not found or empty value: ' + key);
	const backupDir = (args['backup-dir'] as string | undefined)
		? path.resolve(args['backup-dir'] as string)
		: path.join(process.cwd(), 'cursor_state_backups');
	ensureDirSync(backupDir);
	const backupFile = path.join(
		backupDir,
		`${key.replace(/[^a-zA-Z0-9_.-]/g, '_')}.backup_${timestampString()}.json`
	);
	writeFileSyncEnsuringDir(backupFile, currentRaw);
	console.log(`JSON backup written: ${backupFile}`);

	if (args['backup-db']) {
		const dbBackupDir = path.join(backupDir, 'db');
		const copied = copyFileWithTimestamp(dbPath, dbBackupDir, 'state.vscdb', '');
		console.log(`DB backup written: ${copied}`);
	}

	if (args['dry-run']) {
		console.log('Dry run: would replace value for key: ' + key);
		console.log('New JSON preview:');
		console.log(stableStringify(newObj));
		return;
	}

	if (!(args.yes as boolean)) {
		console.log('About to write new JSON into the DB. If Cursor is open, close it now. Proceeding in 3 seconds...');
		await new Promise((resolve) => setTimeout(resolve, 3000));
	}

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-state-'));
	const tmpPath = path.join(tmpDir, 'payload.json');
	fs.writeFileSync(tmpPath, newJsonString);
	const escapedKey = key.replace(/'/g, "''");
	const sql = `BEGIN; UPDATE ItemTable SET value = CAST(readfile('${tmpPath.replace(/'/g, "''")}') AS TEXT) WHERE key = '${escapedKey}'; COMMIT;`;
	await runSqlite(dbPath, sql);

	const afterRaw = await fetchValueString(dbPath, key);
	let ok = false;
	try {
		ok = JSON.stringify(parseJsonStrict(afterRaw)) === JSON.stringify(newObj);
	} catch {
		ok = false;
	}
	if (!ok) throw new Error('Verification failed: DB content does not match the provided JSON. The original value was backed up.');
	console.log('Replacement successful and verified.');
}

export function printHelp(): void {
	console.log(`Usage: cursor-settings replace --file <path|-> [--db <path>] [--key <key>] [--backup-dir <dir>] [--backup-db] [--dry-run] [--yes]
`);
}
