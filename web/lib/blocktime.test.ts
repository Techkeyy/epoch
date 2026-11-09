import { describe, expect, it } from 'vitest';
import anchors from './blocktimes.json' with { type: 'json' };
import { timeOf } from './blocktime';

describe('timeOf', () => {
  const table: [number, number][] = [[100, 1_000], [200, 3_000], [300, 4_000]];
  it('interpolates between anchors and hits them exactly', () => {
    expect(timeOf(table, 150, 300, 4_000)).toBe(2_000);
    expect(timeOf(table, 200, 300, 4_000)).toBe(3_000);
  });
  it('uses the head and the clock past the last anchor', () => {
    expect(timeOf(table, 350, 400, 6_000)).toBe(5_000);
  });

  // Real pairs: block heights stamped in ruble.near's key nonces, and the times NearBlocks recorded for
  // those keys being added. None of these blocks is an anchor.
  it.each([
    [95_702_651, Date.parse('2023-07-04T18:45:34.058Z')],
    [95_702_734, Date.parse('2023-07-04T18:47:09.978Z')],
  ])('dates mainnet block %i within two hours (measured: about 66 minutes off)', (height, real) => {
    const t = timeOf(anchors as [number, number][], height, 230_000_000, Date.now());
    expect(Math.abs(t - real)).toBeLessThan(2 * 3_600_000);
  });
});
