// A cap across all callers, because request headers that name a caller can be forged. Free RPC and indexer
// limits are shared by everyone using the site, so the cap protects them for the next visitor.
const windows = new Map<string, { minute: number; perMinute: number; day: string; perDay: number }>();

export function overGlobalLimit(route: string, perMinute = 40, perDay = 2000): boolean {
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  const day = now.toISOString().slice(0, 10);
  const w = windows.get(route) ?? { minute, perMinute: 0, day, perDay: 0 };
  if (w.minute !== minute) Object.assign(w, { minute, perMinute: 0 });
  if (w.day !== day) Object.assign(w, { day, perDay: 0 });
  w.perMinute++;
  w.perDay++;
  windows.set(route, w);
  return w.perMinute > perMinute || w.perDay > perDay;
}
