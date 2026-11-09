// An account's life as the entries of a register, oldest first, with the era line placed where control
// changed. The page draws exactly this, so what you see cannot drift from what the engine found.
import type { Report } from './epoch';

export type Entry =
  | { kind: 'earlier'; from: number | null; to: number; keys: number }
  | { kind: 'keyless'; from: number; to: number; days: number }
  | { kind: 'era'; at: number }
  | { kind: 'current'; from: number | null; keys: number; oldKeptUntil?: number; fromCreation?: boolean }
  | { kind: 'locked'; contract: boolean };

export function register(r: Report): Entry[] {
  const v = r.verdict;
  const fullNow = r.keys.filter((k) => k.full).length;
  switch (v.kind) {
    case 'missing':
      return [];
    case 'locked':
      return [{ kind: 'locked', contract: v.contract }];
    case 'unchanged':
      return [{ kind: 'current', from: v.since?.time ?? null, keys: fullNow, fromCreation: v.fromCreation }];
    case 'changed': {
      const first = r.previous?.[0]?.added ?? null;
      const out: Entry[] = [];
      if (v.pattern === 'handover') {
        out.push({ kind: 'earlier', from: first, to: v.oldRemoved.time, keys: v.previousKeys });
        out.push({ kind: 'keyless', from: v.oldRemoved.time, to: v.at.time, days: v.keylessDays });
      } else {
        out.push({ kind: 'earlier', from: first, to: v.pattern === 'overlap' ? v.oldRemoved.time : v.at.time, keys: v.previousKeys });
      }
      out.push({ kind: 'era', at: v.at.time });
      out.push({ kind: 'current', from: v.at.time, keys: fullNow, ...(v.pattern === 'overlap' ? { oldKeptUntil: v.oldRemoved.time } : {}) });
      return out;
    }
  }
}
