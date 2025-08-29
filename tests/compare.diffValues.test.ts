import { describe, it, expect } from 'vitest';
import { diffValues, type DiffRecord } from '../src/commands/compare';

const run = (a: unknown, b: unknown, opts?: { ignore?: string[]; unordered?: string[] }) => {
  const diffs = diffValues(
    a,
    b,
    [],
    [],
    { ignoreSet: new Set(opts?.ignore || []), unorderedPaths: new Set(opts?.unordered || []) }
  );
  return diffs;
};

describe('diffValues', () => {
  it('returns no diffs for equal primitives', () => {
    expect(run(1, 1)).toEqual([]);
    expect(run('a', 'a')).toEqual([]);
    expect(run(true, true)).toEqual([]);
  });

  it('detects type mismatch', () => {
    const diffs = run(1, '1');
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ type: 'typeMismatch', path: '' });
  });

  it('diffs nested objects', () => {
    const diffs = run({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(diffs).toEqual([{ type: 'valueDiff', path: 'b', db: 2, file: 3 }]);
  });

  it('detects keys only in DB or only in file', () => {
    const diffs = run({ a: 1 }, { b: 2 });
    expect(diffs).toEqual([
      { type: 'onlyInDb', path: 'a', value: 1 },
      { type: 'onlyInFile', path: 'b', value: 2 },
    ]);
  });

  it('diffs arrays positionally by default', () => {
    const diffs = run([1, 2], [2, 1]);
    expect(diffs.some((d) => d.type === 'valueDiff')).toBe(true);
  });

  it('supports unordered array comparison at a path', () => {
    const diffs = run({ x: [1, 2] }, { x: [2, 1] }, { unordered: ['x'] });
    expect(diffs).toEqual([]);
  });

  it('supports ignoring a nested path', () => {
    const diffs = run({ a: { b: 1, c: 2 } }, { a: { b: 9, c: 2 } }, { ignore: ['a.b'] });
    expect(diffs).toEqual([]);
  });
});
