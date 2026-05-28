import { useCallback } from 'react';
import { useStopwatch } from '../hooks/useStopwatch';
import { secondsToMmSs } from '../utils/time';
import TimeInput from './TimeInput';

interface Props {
  value: number | null;
  onStop: (seconds: number) => Promise<void>;
  label: string;
  disabled?: boolean;
}

export default function Stopwatch({ value, onStop, label, disabled }: Props) {
  const handleStop = useCallback(
    async (seconds: number) => {
      await onStop(seconds);
    },
    [onStop]
  );

  const { running, elapsed, start, stop } = useStopwatch(handleStop);

  const display = running ? elapsed : value;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[90px]">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className={`font-mono text-lg font-semibold ${running ? 'text-blue-600' : 'text-gray-800'}`}>
        {display != null ? secondsToMmSs(display) : '--:--'}
      </div>
      {!disabled && (
        <div className="flex gap-1">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              ▶ Štart
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              ⏹ Stop
            </button>
          )}
        </div>
      )}
      {!running && !disabled && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">alebo:</span>
          <TimeInput
            value={value}
            onChange={(s) => { if (s != null) onStop(s); }}
            disabled={running}
            className="!w-16"
          />
        </div>
      )}
    </div>
  );
}
