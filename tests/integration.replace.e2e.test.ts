import { describe, it, expect, beforeAll, skip } from 'vitest';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { hasSqlite3, mkTmpDir, initStateDb, writeDbValue, readDbValue } from './helpers';

const KEY =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';

(hasSqlite3() ? describe : skip)('e2e: replace', () => {
  let tmp: string;
  let dbPath: string;
  let bin: string;

  beforeAll(() => {
    tmp = mkTmpDir();
    dbPath = path.join(tmp, 'state.vscdb');
    initStateDb(dbPath);
    writeDbValue(dbPath, KEY, JSON.stringify({ a: 1 }));
    bin = path.join(__dirname, '..', 'dist', 'bin', 'cursor-settings.js');
  });

  it('backs up and replaces JSON', () => {
    const newJsonPath = path.join(tmp, 'new.json');
    fs.writeFileSync(newJsonPath, JSON.stringify({ a: 2, b: 3 }));

    const out = execFileSync(
      'node',
      [
        bin,
        'replace',
        '--db',
        dbPath,
        '--file',
        newJsonPath,
        '--backup-dir',
        path.join(tmp, 'bk'),
        '--yes',
      ],
      { encoding: 'utf8' }
    );
    expect(out).toMatch(/Replacement successful and verified/);

    const after = readDbValue(dbPath, KEY);
    expect(JSON.parse(after)).toEqual({ a: 2, b: 3 });
  });
});
