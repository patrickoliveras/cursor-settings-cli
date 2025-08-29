'use strict';

const os = require('os');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const { existsSync } = require('fs');

function ensureSqlite3Available() {
  return new Promise((resolve, reject) => {
    execFile('sqlite3', ['-version'], { timeout: 5000 }, (err, stdout) => {
      if (err)
        return reject(new Error('sqlite3 CLI not found. Please install or ensure it is on PATH.'));
      resolve(String(stdout || '').trim());
    });
  });
}

function getDefaultCursorStateDbPath() {
  const homeDir = os.homedir();
  const platform = process.platform;
  const candidates = [];
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
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function resolveDbPathFromArgs(argv) {
  const dbArgIdx = argv.findIndex((arg) => arg === '--db');
  if (dbArgIdx !== -1 && argv[dbArgIdx + 1]) {
    return path.resolve(argv[dbArgIdx + 1]);
  }
  if (process.env.CURSOR_STATE_DB) {
    return path.resolve(process.env.CURSOR_STATE_DB);
  }
  return getDefaultCursorStateDbPath();
}

function log(section, ok, msg) {
  const status = ok ? 'OK' : 'FAIL';
  console.log(`[${status}] ${section} - ${msg}`);
}

(async () => {
  try {
    const node = process.version;
    const major = Number(node.replace(/^v/, '').split('.')[0]);
    log('node', major >= 16, `version ${node}`);

    try {
      const v = execFileSync('npm', ['-v'], { encoding: 'utf8' }).trim();
      log('npm', !!v, `version ${v}`);
    } catch {
      log('npm', false, 'npm not found on PATH');
    }

    try {
      await ensureSqlite3Available();
      log('sqlite3', true, 'sqlite3 CLI found');
    } catch (e) {
      log('sqlite3', false, e.message);
    }

    const dbGuess = resolveDbPathFromArgs(['node', 'doctor']);
    const dbExists = existsSync(dbGuess);
    log('state.vscdb', dbExists, dbExists ? `found at ${dbGuess}` : 'not found');

    console.log('\nEnvironment:');
    console.log(`- OS: ${os.platform()} ${os.release()} (${os.arch()})`);
    console.log(`- Home: ${os.homedir()}`);
  } catch (err) {
    console.error('Doctor error:', err.message);
    process.exit(1);
  }
})();
