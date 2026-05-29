import { useState } from 'react';
import { useStopwatch } from '../hooks/useStopwatch';
import { centisecondsToDisplay } from '../utils/time';
import PenaltyPicker from './PenaltyPicker';

interface Props {
  savedCs: number | null;
  savedPenalty: number;
  locked: boolean;
  disabled: boolean;
  onSave: (centiseconds: number, penalty: number) => Promise<void>;
}

type Phase = 'idle' | 'stopped' | 'saving';

export default function JudgeStopwatch({ savedCs, savedPenalty, locked, disabled, onSave }: Props) {
  const { running, elapsed, start, stop, reset } = useStopwatch();
  const [phase, setPhase] = useState<Phase>('idle');
  const [stoppedCs, setStoppedCs] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [localSaved, setLocalSaved] = useState<{ cs: number; penalty: number } | null>(null);

  const isLocked = locked || localSaved != null;
  const displayCs = localSaved?.cs ?? savedCs;
  const displayPenalty = localSaved?.penalty ?? savedPenalty;

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-base font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1 tabular-nums">
          {displayCs != null ? centisecondsToDisplay(displayCs) : '--:--.--'}
        </span>
        {displayPenalty > 0 && (
          <span className="text-xs text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 font-mono">
            +{centisecondsToDisplay(displayPenalty)}
          </span>
        )}
        <span className="text-gray-400 text-sm" title="Uložené">🔒</span>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-2xl font-bold text-blue-600 tabular-nums min-w-[6rem]">
          {centisecondsToDisplay(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => { const cs = stop(); setStoppedCs(cs); setPhase('stopped'); }}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 font-semibold shadow"
        >
          ⏹ Stop
        </button>
      </div>
    );
  }

  if (phase === 'stopped' || phase === 'saving') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xl font-semibold text-gray-800 bg-green-50 border border-green-300 rounded px-2 py-1 tabular-nums">
            {centisecondsToDisplay(stoppedCs)}
          </span>
          <button
            type="button"
            onClick={() => { reset(); setPhase('idle'); setPenalty(0); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Znova
          </button>
        </div>
        <PenaltyPicker value={penalty} onChange={setPenalty} disabled={phase === 'saving'} />
        <button
          type="button"
          disabled={phase === 'saving'}
          onClick={async () => {
            setPhase('saving');
            try {
              await onSave(stoppedCs, penalty);
              setLocalSaved({ cs: stoppedCs, penalty });
            } catch {
              setPhase('stopped');
            }
          }}
          className="self-start bg-green-700 text-white text-sm rounded px-4 py-1.5 hover:bg-green-800 disabled:opacity-50 font-semibold"
        >
          {phase === 'saving' ? 'Ukladám…' : 'Uložiť'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { reset(); start(); setPhase('idle'); }}
      disabled={disabled}
      className="px-5 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 font-semibold shadow"
    >
      ▶ Štart
    </button>
  );
}
