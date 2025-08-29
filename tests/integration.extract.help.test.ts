import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

describe('cli extract --help', () => {
  it('prints usage', () => {
    const bin = path.join(__dirname, '..', 'dist', 'bin', 'cursor-settings.js');
    const out = execFileSync('node', [bin, 'extract', '--help'], { encoding: 'utf8' });
    expect(out).toMatch(/Usage: cursor-settings extract/);
  });
});
