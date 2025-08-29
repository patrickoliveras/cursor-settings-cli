import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/utils';

describe('parseArgs', () => {
  it('parses long flags and values', () => {
    const res = parseArgs(['node', 'bin', '--db', '/tmp/x', '--raw']);
    expect(res.db).toBe('/tmp/x');
    expect(res.raw).toBe(true);
  });

  it('parses key=value form', () => {
    const res = parseArgs(['node', 'bin', '--key=a.b', '--out=foo.json']);
    expect(res.key).toBe('a.b');
    expect(res.out).toBe('foo.json');
  });

  it('supports repeated options as array', () => {
    const res = parseArgs(['node', 'bin', '--ignore', 'a', '--ignore', 'b']);
    expect(res.ignore).toEqual(['a', 'b']);
  });

  it('collects positionals in _', () => {
    const res = parseArgs(['node', 'bin', 'x', 'y']);
    expect(res._).toEqual(['x', 'y']);
  });
});
