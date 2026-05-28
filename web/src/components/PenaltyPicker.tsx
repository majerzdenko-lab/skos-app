import { useState } from 'react';
import { secondsToMmSs, mmSsToSeconds } from '../utils/time';

const PRESETS = [0, 3, 5, 8, 10, 13, 15, 20, 25, 30];

interface Props {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
}

export default function PenaltyPicker({ value, onChange, disabled }: Props) {
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState(false);

  const handleCustomBlur = () => {
    if (!custom.trim()) return;
    const s = mmSsToSeconds(custom);
    if (s == null) {
      setCustomError(true);
    } else {
      setCustomError(false);
      setCustom('');
      onChange(s);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESETS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`px-2 py-0.5 text-xs rounded border font-mono ${
            value === s
              ? 'bg-amber-500 border-amber-600 text-white'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {secondsToMmSs(s)}
        </button>
      ))}
      <input
        type="text"
        inputMode="numeric"
        placeholder="vlastná"
        value={custom}
        disabled={disabled}
        onChange={(e) => { setCustom(e.target.value); setCustomError(false); }}
        onBlur={handleCustomBlur}
        className={`border rounded px-2 py-0.5 text-xs font-mono w-20 ${
          customError ? 'border-red-500 bg-red-50' : 'border-gray-300'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      />
    </div>
  );
}
