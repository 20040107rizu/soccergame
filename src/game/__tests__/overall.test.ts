import { describe, expect, it } from 'vitest';
import { overallFor, OVR_WEIGHTS, STAT_KEYS } from '../stats';
import { POSITIONS, type Stats, type StatKey } from '../types';

const all = (v: number) => Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as unknown as Stats;

describe('総合値', () => {
  it('全ての能力値が 99 なら、どのポジションでも 109', () => {
    for (const pos of POSITIONS) expect(overallFor(all(99), pos)).toBe(109);
  });
  it('88 以下はそのまま', () => {
    for (const pos of POSITIONS) expect(overallFor(all(80), pos)).toBe(80);
  });
  it('ポジションに関係する能力を上げると総合値が上がる', () => {
    for (const pos of POSITIONS) {
      const base = all(85);
      const up = { ...base };
      for (const k of Object.keys(OVR_WEIGHTS[pos]) as StatKey[]) up[k] = 95;
      expect(overallFor(up, pos)).toBeGreaterThan(overallFor(base, pos));
    }
  });
});
