import { useState, useRef, useCallback, useEffect } from 'react';

const OFFLINE_QUEUE_KEY = 'skos_stopwatch_queue';

interface QueueItem {
  entryId: string;
  field: 'time1' | 'time2';
  seconds: number;
}

function flushQueue(updateFn: (item: QueueItem) => Promise<void>) {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return;
  try {
    const queue: QueueItem[] = JSON.parse(raw);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    queue.forEach((item) => updateFn(item).catch(console.error));
  } catch {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  }
}

function enqueue(item: QueueItem) {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
  queue.push(item);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function useStopwatch(onStop: (seconds: number) => Promise<void>) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (running) return;
    startTimeRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 100);
  }, [running]);

  const stop = useCallback(async () => {
    if (!running || startTimeRef.current == null) return;
    const seconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(seconds);
    startTimeRef.current = null;
    await onStop(seconds);
  }, [running, onStop]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { running, elapsed, start, stop, reset };
}

export { flushQueue, enqueue };
export type { QueueItem };
