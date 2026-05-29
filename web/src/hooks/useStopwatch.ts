import { useState, useRef, useCallback, useEffect } from 'react';

export function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // centiseconds
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (running) return;
    startTimeRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 10));
    }, 50);
  }, [running]);

  const stop = useCallback((): number => {
    if (!running || startTimeRef.current == null) return elapsed;
    const cs = Math.round((Date.now() - startTimeRef.current) / 10);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setElapsed(cs);
    startTimeRef.current = null;
    return cs;
  }, [running, elapsed]);

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
