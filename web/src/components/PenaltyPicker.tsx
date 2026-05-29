import { useState } from 'react';
import { centisecondsToDisplay, parseCentiseconds } from '../utils/time';

const PRESETS = [0, 300, 500, 800, 1000, 1300, 1500, 2000, 2500, 3000]; // centiseconds

interface Props {
  value: number;
  onChange: (centiseconds: number) => void;
  disabled?: boolean;
}

export default function PenaltyPicker({ value, onChange, disabled }: Props) {
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState(false);

  const handleCustomBlur = () => {
    if (!custom.trim()) return;
    const cs = parseCentiseconds(custom);
    if (cs == null) {
      setCustomError(true);
    } else {
      setCustomError(false);
      setCustom('');
      onChange(cs);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PRESETS.map((cs) => (
        <button
          key={cs}
          type="button"
          disabled={disabled}
          onClick={() => onChange(cs)}
          className={`px-2 py-0.5 text-xs rounded border font-mono ${
            value === cs
              ? 'bg-amber-500 border-amber-600 text-white'
              : 'bg-white border-gray-300 hover:bg-gray-50'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {centisecondsToDisplay(cs)}
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
