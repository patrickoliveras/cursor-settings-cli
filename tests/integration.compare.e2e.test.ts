import { describe, it, expect, beforeAll, skip } from 'vitest';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { hasSqlite3, mkTmpDir, initStateDb, writeDbValue } from './helpers';

const KEY = 'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';

(hasSqlite3() ? describe : skip)('e2e: compare', () => {
  let tmp: string;
  let dbPath: string;
  let bin: string;

  beforeAll(() => {
    tmp = mkTmpDir();
    dbPath = path.join(tmp, 'state.vscdb');
    initStateDb(dbPath);
    writeDbValue(dbPath, KEY, JSON.stringify({ a: 1, b: [2, 3] }));
    bin = path.join(__dirname, '..', 'dist', 'bin', 'cursor-settings.js');
  });

  it('outputs markdown report by default and can fail on diff', () => {
    const refPath = path.join(tmp, 'ref.json');
    fs.writeFileSync(refPath, JSON.stringify({ a: 1, b: [3, 2] }));
    const out = execFileSync('node', [bin, 'compare', '--db', dbPath, '--file', refPath], {
      encoding: 'utf8',
    });
    expect(out).toMatch(/Cursor state comparison for key/);

    let exit = 0;
    try {
      execFileSync('node', [bin, 'compare', '--db', dbPath, '--file', refPath, '--fail-on-diff']);
    } catch (e: any) {
      exit = e.status || e.code || 1;
    }
    expect(exit).toBe(2);
  });

  it('outputs JSON report with --format json', () => {
    const refPath = path.join(tmp, 'ref2.json');
    fs.writeFileSync(refPath, JSON.stringify({ a: 1, b: [2, 3] }));
    const out = execFileSync(
      'node',
      [bin, 'compare', '--db', dbPath, '--file', refPath, '--format', 'json'],
      { encoding: 'utf8' }
    );
    const parsed = JSON.parse(out);
    expect(parsed.diffs.length).toBe(0);
  });
});
