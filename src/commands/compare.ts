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
	readFileMaybeStdin,
} from '../utils';

export type DiffRecord =
	| { type: 'onlyInFile'; path: string; value: unknown }
	| { type: 'onlyInDb'; path: string; value: unknown }
	| { type: 'valueDiff'; path: string; db: unknown; file: unknown }
	| { type: 'typeMismatch'; path: string; db: unknown; file: unknown; dbType: string; fileType: string };

type DiffType = DiffRecord['type'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === '[object Object]';
}

function formatPath(pathSegments: Array<string | number>): string {
	return pathSegments.reduce<string>((acc, seg) =>
		typeof seg === 'number' ? acc + `[${seg}]` : acc ? `${acc}.${seg}` : String(seg),
	'',
	);
}

function normalizeArray(
	arr: unknown[],
	unorderedPaths: Set<string>,
	pathSegments: Array<string | number>,
): unknown[] {
	const pathStr = formatPath(pathSegments);
	if (unorderedPaths.has(pathStr)) {
		try {
			return [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
		} catch {
			return arr;
		}
	}
	return arr;
}

function shouldIgnore(pathSegments: Array<string | number>, ignoreSet: Set<string>): boolean {
	const p = formatPath(pathSegments);
	if (!p) return false;
	if (ignoreSet.has(p)) return true;
	let cur = p;
	while (cur.includes('.')) {
		cur = cur.slice(0, cur.lastIndexOf('.'));
		if (ignoreSet.has(cur)) return true;
	}
	return false;
}

export function diffValues(
	dbValue: unknown,
	fileValue: unknown,
	pathSegments: Array<string | number> = [],
	diffs: DiffRecord[] = [],
	options: { ignoreSet: Set<string>; unorderedPaths: Set<string> },
): DiffRecord[] {
	const { ignoreSet, unorderedPaths } = options;
	if (shouldIgnore(pathSegments, ignoreSet)) return diffs;
	const a = dbValue;
	const b = fileValue;
	const pathStr = formatPath(pathSegments);
	const aIsObj = isPlainObject(a);
	const bIsObj = isPlainObject(b);
	const aIsArr = Array.isArray(a);
	const bIsArr = Array.isArray(b);
	if (aIsObj && bIsObj) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const key of keys) {
			if (!(key in a)) {
				diffs.push({ type: 'onlyInFile', path: formatPath([...pathSegments, key]), value: (b as any)[key] });
				continue;
			}
			if (!(key in b)) {
				diffs.push({ type: 'onlyInDb', path: formatPath([...pathSegments, key]), value: (a as any)[key] });
				continue;
			}
			diffValues((a as any)[key], (b as any)[key], [...pathSegments, key], diffs, options);
		}
		return diffs;
	}
	if (aIsArr && bIsArr) {
		const normA = normalizeArray(a as unknown[], unorderedPaths, pathSegments);
		const normB = normalizeArray(b as unknown[], unorderedPaths, pathSegments);
		const maxLen = Math.max(normA.length, normB.length);
		for (let i = 0; i < maxLen; i++) {
			if (i >= normA.length) {
				diffs.push({ type: 'onlyInFile', path: formatPath([...pathSegments, i]), value: normB[i] });
				continue;
			}
			if (i >= normB.length) {
				diffs.push({ type: 'onlyInDb', path: formatPath([...pathSegments, i]), value: normA[i] });
				continue;
			}
			diffValues(normA[i], normB[i], [...pathSegments, i], diffs, options);
		}
		return diffs;
	}
	const aType = Array.isArray(a) ? 'array' : typeof a;
	const bType = Array.isArray(b) ? 'array' : typeof b;
	if (aType !== bType) {
		diffs.push({ type: 'typeMismatch', path: pathStr, db: a, file: b, dbType: aType, fileType: bType });
		return diffs;
	}
	if (JSON.stringify(a) !== JSON.stringify(b)) {
		diffs.push({ type: 'valueDiff', path: pathStr, db: a, file: b });
	}
	return diffs;
}

export function renderMarkdownReport({
	dbPath,
	key,
	filePath,
	diffs,
}: {
	dbPath: string;
	key: string;
	filePath: string;
	diffs: DiffRecord[];
}): string {
	const lines: string[] = [];
	lines.push('# Cursor state comparison for key');
	lines.push('');
	lines.push('`' + key + '`');
	lines.push('');
	lines.push(`- DB: \`${dbPath}\``);
	lines.push(`- File: \`${filePath}\``);
	lines.push('');
	if (diffs.length === 0) {
		lines.push('**No differences found.**');
		return lines.join('\n');
	}
	const groups: { [K in DiffType]: DiffRecord[] } = {
		onlyInDb: [],
		onlyInFile: [],
		valueDiff: [],
		typeMismatch: [],
	};
	diffs.forEach((d) => groups[d.type].push(d));
	if (groups.typeMismatch.length) {
		lines.push('## Type mismatches');
		for (const d of groups.typeMismatch) {
			lines.push(`- **${d.path || '(root)'}**: DB type \`${(d as any).dbType}\` vs File type \`${(d as any).fileType}\``);
			lines.push('');
			lines.push('```json');
			lines.push(stableStringify({ db: (d as any).db, file: (d as any).file }));
			lines.push('```');
		}
		lines.push('');
	}
	if (groups.valueDiff.length) {
		lines.push('## Value differences');
		for (const d of groups.valueDiff) {
			lines.push(`- **${d.path || '(root)'}**`);
			lines.push('');
			lines.push('```json');
			lines.push(stableStringify({ db: (d as any).db, file: (d as any).file }));
			lines.push('```');
		}
		lines.push('');
	}
	if (groups.onlyInDb.length) {
		lines.push('## Present only in DB');
		for (const d of groups.onlyInDb) {
			lines.push(`- **${(d as any).path}**`);
			lines.push('');
			lines.push('```json');
			lines.push(stableStringify((d as any).value));
			lines.push('```');
		}
		lines.push('');
	}
	if (groups.onlyInFile.length) {
		lines.push('## Present only in file');
		for (const d of groups.onlyInFile) {
			lines.push(`- **${(d as any).path}**`);
			lines.push('');
			lines.push('```json');
			lines.push(stableStringify((d as any).value));
			lines.push('```');
		}
		lines.push('');
	}
	return lines.join('\n');
}

export async function runCompare(rawArgv: string[]): Promise<void> {
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
	const filePathArg = args.file as string | undefined;
	if (!filePathArg) throw new Error('Missing --file <path|->');
	const outPath = args.out ? path.resolve(args.out as string) : null;
	const format = ((args.format as string) || 'md').toLowerCase();
	const ignoreArg = args.ignore as string | string[] | undefined;
	const unorderedArg = args.unordered as string | string[] | undefined;
	const ignoreList = Array.isArray(ignoreArg) ? ignoreArg : ignoreArg ? [ignoreArg] : [];
	const unorderedList = Array.isArray(unorderedArg) ? unorderedArg : unorderedArg ? [unorderedArg] : [];
	const ignoreSet = new Set<string>(ignoreList.filter(Boolean));
	const unorderedPaths = new Set<string>(unorderedList.filter(Boolean));

	const raw = await fetchValueString(dbPath, key);
	if (!raw) throw new Error('Key not found or empty value: ' + key);
	const dbObj = parseJsonStrict(raw);
	const fileJson = await readFileMaybeStdin(filePathArg === '-' ? '-' : path.resolve(filePathArg));
	const fileObj = parseJsonStrict(fileJson);

	const diffs = diffValues(dbObj, fileObj, [], [], { ignoreSet, unorderedPaths });
	const output =
		format === 'json'
			? JSON.stringify({ dbPath, key, file: filePathArg, diffCount: diffs.length, diffs }, null, 2)
			: renderMarkdownReport({ dbPath, key, filePath: filePathArg, diffs });

	if (outPath) {
		writeFileSyncEnsuringDir(outPath, output + (output.endsWith('\n') ? '' : '\n'));
		console.log(`Wrote report to ${outPath}`);
	} else {
		process.stdout.write(output + (output.endsWith('\n') ? '' : '\n'));
	}
	if (((args['fail-on-diff'] as boolean) || (args.fail as boolean)) && diffs.length > 0) process.exit(2);
}

export function printHelp(): void {
	console.log(`Usage: cursor-settings compare --file <path|-> [--db <path>] [--key <key>] [--out <report.md>] [--format md|json] [--ignore a.b --unordered path]
`);
}
