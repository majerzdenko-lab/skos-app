export interface Rankable {
  id: string;
  baseTime: number | null;
  penalty: number;
  dnr: boolean;
}

export interface Ranked extends Rankable {
  rank: number | null;
  totalTime: number | null;
}

export function computeRankings(entries: Rankable[]): Ranked[] {
  const withTotal = entries.map((e) => ({
    ...e,
    totalTime: e.dnr || e.baseTime == null ? null : e.baseTime + e.penalty,
  }));

  const completed = withTotal
    .filter((e) => !e.dnr && e.totalTime != null)
    .sort((a, b) => a.totalTime! - b.totalTime!);

  const dnrEntries = withTotal.filter((e) => e.dnr || e.totalTime == null);

  const ranked: Ranked[] = [];
  let rank = 1;

  for (let i = 0; i < completed.length; i++) {
    const entry = completed[i];
    if (i > 0 && entry.totalTime !== completed[i - 1].totalTime) {
      rank = i + 1;
    }
    ranked.push({ ...entry, rank });
  }

  for (const e of dnrEntries) {
    ranked.push({ ...e, rank: null });
  }

  return ranked;
}
