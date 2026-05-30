import { useState } from 'react';
import { useStopwatch } from '../hooks/useStopwatch';
import { centisecondsToDisplay, parseCentiseconds } from '../utils/time';

const PENALTY_PRESETS = [0, 300, 500, 800, 1000, 1300, 1500, 2000, 2500, 3000];

interface Props {
  plotNumber: number | null;
  firstName: string;
  lastName: string;
  city: string;
  onSave: (centiseconds: number, penalty: number) => Promise<void>;
  onBack: () => void;
}

type Phase = 'ready' | 'running' | 'confirm' | 'edit' | 'penalty' | 'saving';

export default function JudgeRaceScreen({ plotNumber, firstName, lastName, city, onSave, onBack }: Props) {
  const { running, elapsed, start, stop, reset } = useStopwatch();
  const [phase, setPhase] = useState<Phase>('ready');
  const [measuredCs, setMeasuredCs] = useState(0);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState(false);
  const [penalty, setPenalty] = useState(0);
  const [customPenalty, setCustomPenalty] = useState('');
  const [customPenaltyError, setCustomPenaltyError] = useState(false);

  const handleStart = () => {
    reset();
    start();
    setPhase('running');
  };

  const handleStop = () => {
    const cs = stop();
    setMeasuredCs(cs);
    setEditText(centisecondsToDisplay(cs));
    setPhase('confirm');
  };

  const handleConfirmTime = () => {
    setPenalty(0);
    setCustomPenalty('');
    setPhase('penalty');
  };

  const handleEditConfirm = () => {
    const cs = parseCentiseconds(editText);
    if (cs == null) { setEditError(true); return; }
    setMeasuredCs(cs);
    setPenalty(0);
    setCustomPenalty('');
    setPhase('penalty');
  };

  const handleCustomPenaltyBlur = () => {
    if (!customPenalty.trim()) return;
    const cs = parseCentiseconds(customPenalty);
    if (cs == null) {
      setCustomPenaltyError(true);
    } else {
      setCustomPenaltyError(false);
      setPenalty(cs);
      setCustomPenalty('');
    }
  };

  const handleSave = async () => {
    setPhase('saving');
    try {
      await onSave(measuredCs, penalty);
    } catch {
      setPhase('penalty');
    }
  };

  const participantLine = (
    <div className="text-center">
      <div className="font-mono text-6xl font-bold text-gray-200 leading-none mb-1">{plotNumber ?? '—'}</div>
      <div className="text-lg font-semibold text-gray-800">{firstName} {lastName}</div>
      <div className="text-sm text-gray-400">{city}</div>
    </div>
  );

  // ── READY ──────────────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-between py-10 px-6 select-none safe-area">
        <button onClick={onBack} className="self-start text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
          ← Späť
        </button>
        {participantLine}
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={handleStart}
          className="w-48 h-48 sm:w-52 sm:h-52 rounded-full bg-green-600 text-white shadow-xl active:scale-95 transition-transform flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl leading-none">▶</span>
          <span className="text-2xl font-bold tracking-wide">Štart</span>
        </button>
        <div className="text-xs text-gray-300">Stlačte Štart keď pretekár začne kosiť</div>
      </div>
    );
  }

  // ── RUNNING ─────────────────────────────────────────────────────────────
  if (phase === 'running') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-between py-10 px-6 select-none">
        <div className="text-sm text-gray-400 text-center">
          {firstName} {lastName} · políčko {plotNumber ?? '—'}
        </div>
        <div className="font-mono text-6xl sm:text-7xl font-bold text-blue-600 tabular-nums tracking-tight text-center">
          {centisecondsToDisplay(elapsed)}
        </div>
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={handleStop}
          className="w-48 h-48 sm:w-52 sm:h-52 rounded-full bg-red-600 text-white shadow-xl active:scale-95 transition-transform flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl leading-none">⏹</span>
          <span className="text-2xl font-bold tracking-wide">Stop</span>
        </button>
        <div className="text-xs text-gray-300">Stlačte Stop keď pretekár skončí</div>
      </div>
    );
  }

  // ── CONFIRM / EDIT TIME ─────────────────────────────────────────────────
  if (phase === 'confirm' || phase === 'edit') {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-between py-10 px-6">
        {participantLine}

        <div className="text-center w-full">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Nameraný čas</p>
          {phase === 'confirm' ? (
            <div className="font-mono text-6xl font-bold text-gray-800 tabular-nums">
              {centisecondsToDisplay(measuredCs)}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={editText}
                onChange={(e) => { setEditText(e.target.value); setEditError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleEditConfirm()}
                className={`font-mono text-5xl font-bold text-center w-52 border-b-4 outline-none bg-transparent pb-1 ${
                  editError ? 'border-red-500 text-red-600' : 'border-green-500 text-gray-800'
                }`}
                placeholder="m:ss.cc"
              />
              {editError && <p className="text-sm text-red-500">Nesprávny formát (napr. 3:47.82)</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {phase === 'confirm' ? (
            <>
              <button
                onClick={handleConfirmTime}
                className="w-full py-4 bg-green-600 text-white text-lg font-semibold rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Potvrdiť čas →
              </button>
              <button
                onClick={() => { setEditText(centisecondsToDisplay(measuredCs)); setPhase('edit'); }}
                className="w-full py-3 border-2 border-gray-200 text-gray-600 text-base rounded-2xl"
              >
                Upraviť
              </button>
              <button
                onClick={() => { reset(); setPhase('ready'); }}
                className="text-sm text-gray-300 text-center py-1"
              >
                Merať znova
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEditConfirm}
                className="w-full py-4 bg-green-600 text-white text-lg font-semibold rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Potvrdiť čas →
              </button>
              <button
                onClick={() => setPhase('confirm')}
                className="w-full py-3 border-2 border-gray-200 text-gray-600 text-base rounded-2xl"
              >
                Zrušiť
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── PENALTY ──────────────────────────────────────────────────────────────
  if (phase === 'penalty' || phase === 'saving') {
    const totalCs = measuredCs + penalty;
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col py-8 px-6 overflow-y-auto">
        <div className="text-center mb-6">
          <div className="text-sm text-gray-400">{firstName} {lastName} · políčko {plotNumber ?? '—'}</div>
          <div className="font-mono text-3xl font-bold text-gray-700 mt-1">{centisecondsToDisplay(measuredCs)}</div>
        </div>

        <p className="text-xs uppercase tracking-widest text-gray-400 text-center mb-4">Trestné sekundy</p>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {PENALTY_PRESETS.map((cs) => (
            <button
              key={cs}
              onClick={() => setPenalty(cs)}
              disabled={phase === 'saving'}
              className={`py-3.5 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                penalty === cs
                  ? 'bg-amber-500 border-amber-500 text-white shadow'
                  : 'bg-white border-gray-200 text-gray-700'
              } disabled:opacity-40`}
            >
              {cs === 0 ? '0 s' : `+${cs / 100} s`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            inputMode="numeric"
            placeholder="vlastná (napr. 0:12.00)"
            value={customPenalty}
            disabled={phase === 'saving'}
            onChange={(e) => { setCustomPenalty(e.target.value); setCustomPenaltyError(false); }}
            onBlur={handleCustomPenaltyBlur}
            className={`border-2 rounded-xl px-3 py-2 text-sm font-mono flex-1 ${
              customPenaltyError ? 'border-red-400' : 'border-gray-200'
            }`}
          />
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-center">
          <p className="text-xs text-gray-400 mb-1">Výsledný čas</p>
          <p className="font-mono text-3xl font-bold text-gray-800">{centisecondsToDisplay(totalCs)}</p>
          {penalty > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              {centisecondsToDisplay(measuredCs)} + {penalty / 100} s penalizácia
            </p>
          )}
        </div>

        <div className="mt-auto space-y-2">
          <button
            onClick={handleSave}
            disabled={phase === 'saving'}
            className="w-full py-4 bg-green-700 text-white text-lg font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            {phase === 'saving' ? 'Ukladám…' : 'Potvrdiť výsledok'}
          </button>
          <button
            onClick={() => setPhase('confirm')}
            disabled={phase === 'saving'}
            className="w-full py-3 text-gray-400 text-sm"
          >
            ← Späť na čas
          </button>
        </div>
      </div>
    );
  }

  return null;
}
