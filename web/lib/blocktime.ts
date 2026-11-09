// The time of a block height by straight-line interpolation between known [height, ms] anchors a million
// blocks apart. Block times drift, so this can be about an hour off: fine for a date, not for comparing two
// events minutes apart. epoch.ts uses an indexer's exact time when it has one.
export function timeOf(anchors: [number, number][], height: number, head: number, now: number): number {
  const points = head > (anchors.at(-1)?.[0] ?? 0) ? [...anchors, [head, now] as [number, number]] : anchors;
  if (points.length < 2) throw new Error('No block times to date from');
  let i = points.findIndex(([h]) => h > height);
  if (i === -1) i = points.length - 1;
  if (i === 0) i = 1;
  const [h0, t0] = points[i - 1];
  const [h1, t1] = points[i];
  return Math.round(t0 + ((height - h0) * (t1 - t0)) / (h1 - h0));
}
