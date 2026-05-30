export function centisecondsToDisplay(cs: number): string {
  const totalSec = Math.floor(cs / 100);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export function parseCentiseconds(value: string): number | null {
  const full = value.trim().match(/^(\d{1,2}):(\d{2})\.(\d{1,2})$/);
  if (full) {
    const m = parseInt(full[1], 10);
    const s = parseInt(full[2], 10);
    const c = parseInt(full[3].padEnd(2, '0'), 10);
    if (s > 59 || c > 99) return null;
    return m * 6000 + s * 100 + c;
  }
  const sec = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (sec) {
    const m = parseInt(sec[1], 10);
    const s = parseInt(sec[2], 10);
    if (s > 59) return null;
    return (m * 60 + s) * 100;
  }
  return null;
}

// kept for legacy display in results/export
export function secondsToMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatEventDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Convert "DD.MM.YYYY" stored value to "YYYY-MM-DD" for <input type="date">
export function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.split('.');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return value; // already ISO or unknown format
}

// Convert "YYYY-MM-DD" from <input type="date"> to "DD.MM.YYYY" for storage
export function fromInputDate(value: string): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return value;
}
