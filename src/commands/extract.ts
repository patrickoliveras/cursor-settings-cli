'use strict';

import path from 'path';
import {
	TARGET_KEY,
	resolveDbPathFromArgs,
	ensureSqlite3Available,
	fetchValueString,
	parseJsonStrict,
	stableStringify,
	writeFileSyncEnsuringDir,
	parseArgs,
	validateDbReadable,
} from '../utils';

export async function runExtract(rawArgv: string[]): Promise<void> {
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
	const outArg = args.out as string | undefined;
	const outFile = outArg ? (outArg === '-' ? null : path.resolve(outArg)) : null;
	const raw = Boolean(args.raw);
	const compact = Boolean(args.compact);

	const rawVal = await fetchValueString(dbPath, key);
	if (!rawVal) throw new Error('Key not found or empty value: ' + key);
	let printable = rawVal;
	if (!raw) {
		const obj = parseJsonStrict(rawVal);
		printable = compact ? JSON.stringify(obj) : stableStringify(obj);
	}
	if (outFile) {
		writeFileSyncEnsuringDir(outFile, printable);
		console.log(`Wrote ${raw ? 'raw' : compact ? 'compact' : 'pretty'} JSON to: ${outFile}`);
	} else {
		process.stdout.write(printable + (printable.endsWith('\n') ? '' : '\n'));
	}
}

export function printHelp(): void {
	console.log(`Usage: cursor-settings extract [--db <path>] [--key <key>] [--out <file|->] [--raw|--compact|--pretty]
`);
}
