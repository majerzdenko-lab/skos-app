export function secondsToMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function mmSsToSeconds(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  if (s > 59) return null;
  return m * 60 + s;
}
