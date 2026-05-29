import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, entries as entriesApi } from '../../api/endpoints';
import type { Event, Category, EntryWithParticipant, EntryUpdate, Role } from '../../api/endpoints';
import { useEventSocket } from '../../hooks/useEventSocket';
import { useAuthStore } from '../../stores/authStore';
import Stopwatch from '../../components/Stopwatch';
import PenaltyPicker from '../../components/PenaltyPicker';
import TimeInput from '../../components/TimeInput';
import JudgeRaceScreen from '../../components/JudgeRaceScreen';
import { centisecondsToDisplay } from '../../utils/time';
import Layout from '../../components/Layout';

export default function Judging() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const [event, setEvent] = useState<Event | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [entryMap, setEntryMap] = useState<Record<string, EntryWithParticipant[]>>({});
  const [closedCats, setClosedCats] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [activeRaceEntryId, setActiveRaceEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
    eventsApi.getMyRole(id).then((r) => setMyRole(r.data.role)).catch(() => {});
    categoriesApi.list(id).then((r) => {
      setCats(r.data);
      if (r.data.length > 0) setActiveCat(r.data[0].id);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !activeCat || entryMap[activeCat]) return;
    entriesApi.list(id, activeCat).then((r) => {
      setEntryMap((prev) => ({ ...prev, [activeCat]: r.data.sort((a, b) => (a.plotNumber ?? 999) - (b.plotNumber ?? 999)) }));
    });
  }, [activeCat, id, entryMap]);

  useEventSocket(id, {
    onEntryUpdated: ({ entryId, baseTime, penalty, totalTime }) => {
      setEntryMap((prev) => {
        const next = { ...prev };
        for (const catId of Object.keys(next)) {
          next[catId] = next[catId].map((e) =>
            e.id === entryId ? { ...e, baseTime, penalty, totalTime: totalTime ?? undefined } : e
          );
        }
        return next;
      });
    },
    onCategoryClosed: ({ categoryId }) => {
      setClosedCats((prev) => new Set([...prev, categoryId]));
    },
    onEntryClaimed: ({ entryId, judge }) => {
      setEntryMap((prev) => {
        const next = { ...prev };
        for (const catId of Object.keys(next)) {
          next[catId] = next[catId].map((e) => {
            if (e.id !== entryId) return e;
            const alreadyHas = e.judges.some((j) => j.userId === judge.id);
            if (alreadyHas) return e;
            return { ...e, judges: [...e.judges, { id: `tmp-${judge.id}`, userId: judge.id, user: judge, assignedAt: new Date().toISOString(), completedAt: null, centiseconds: null }] };
          });
        }
        return next;
      });
    },
    onEntryUnclaimed: ({ entryId, userId }) => {
      setEntryMap((prev) => {
        const next = { ...prev };
        for (const catId of Object.keys(next)) {
          next[catId] = next[catId].map((e) =>
            e.id === entryId ? { ...e, judges: e.judges.filter((j) => j.userId !== userId) } : e
          );
        }
        return next;
      });
    },
  });

  const updateEntry = useCallback(async (entryId: string, data: EntryUpdate) => {
    const { data: updated } = await entriesApi.update(entryId, data);
    setEntryMap((prev) => {
      const next = { ...prev };
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].map((e) => (e.id === entryId ? { ...e, ...updated } : e));
      }
      return next;
    });
  }, []);

  const handleClaim = async (entryId: string) => {
    const { data } = await entriesApi.claim(entryId);
    setEntryMap((prev) => {
      const next = { ...prev };
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].map((e) => (e.id === entryId ? { ...e, judges: data.judges } : e));
      }
      return next;
    });
  };

  const handleUnclaim = async (entryId: string, userId?: string) => {
    await entriesApi.unclaim(entryId, userId);
    const targetId = userId ?? currentUser?.id;
    setEntryMap((prev) => {
      const next = { ...prev };
      for (const catId of Object.keys(next)) {
        next[catId] = next[catId].map((e) =>
          e.id === entryId ? { ...e, judges: e.judges.filter((j) => j.userId !== targetId) } : e
        );
      }
      return next;
    });
  };

  const handleAssignJudges = async () => {
    if (!id || !activeCat) return;
    setAssigning(true);
    try {
      await entriesApi.assignJudges(id, activeCat);
      const { data } = await entriesApi.list(id, activeCat);
      setEntryMap((prev) => ({ ...prev, [activeCat]: data.sort((a, b) => (a.plotNumber ?? 999) - (b.plotNumber ?? 999)) }));
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = async () => {
    if (!id || !activeCat) return;
    const confirmed = confirm('Uzatvoriť kategóriu? Táto akcia je nevratná.');
    if (!confirmed) return;
    setClosing(true);
    try {
      await entriesApi.closeCategory(id, activeCat);
      setClosedCats((prev) => new Set([...prev, activeCat]));
    } finally {
      setClosing(false);
    }
  };

  const currentEntries = (entryMap[activeCat] ?? []).sort(
    (a, b) => (a.plotNumber ?? 999) - (b.plotNumber ?? 999)
  );
  const isClosed = closedCats.has(activeCat);
  const canClose = currentEntries.length > 0 && currentEntries.every((e) => e.dnr || e.baseTime != null);
  const isJudge = myRole === 'JUDGE';

  const myEntries = isJudge ? currentEntries.filter((e) => e.judges.some((j) => j.userId === currentUser?.id)) : [];
  const otherEntries = isJudge ? currentEntries.filter((e) => !e.judges.some((j) => j.userId === currentUser?.id)) : [];

  return (
    <Layout>
      <div className="max-w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{event?.name} — {isJudge ? 'Môj prehľad' : 'Rozhodcovia'}</h1>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded text-sm border ${
                activeCat === c.id
                  ? 'bg-green-700 text-white border-green-700'
                  : closedCats.has(c.id)
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.name}
              {closedCats.has(c.id) && ' ✓'}
            </button>
          ))}
        </div>

        {activeCat && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${isClosed ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {isClosed ? 'Uzatvorená' : 'Prebieha'}
              </span>
              <div className="flex gap-2">
                {!isJudge && !isClosed && (
                  <button
                    onClick={handleAssignJudges}
                    disabled={assigning}
                    className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-40"
                  >
                    {assigning ? 'Prideľujem…' : 'Prideliť náhodne'}
                  </button>
                )}
                {!isJudge && !isClosed && (
                  <button
                    onClick={handleClose}
                    disabled={!canClose || closing}
                    className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Uzatvoriť kategóriu
                  </button>
                )}
              </div>
            </div>

            {/* ── JUDGE VIEW ────────────────────────────────────── */}
            {isJudge ? (
              <div className="space-y-6">
                {/* Fullscreen race overlay */}
                {activeRaceEntryId && (() => {
                  const entry = currentEntries.find((e) => e.id === activeRaceEntryId);
                  if (!entry) return null;
                  return (
                    <JudgeRaceScreen
                      plotNumber={entry.plotNumber}
                      firstName={entry.participant.firstName}
                      lastName={entry.participant.lastName}
                      city={entry.participant.city}
                      onSave={async (cs, pen) => {
                        await entriesApi.saveJudgeTime(entry.id, { centiseconds: cs, penalty: pen });
                        const { data } = await entriesApi.list(id!, activeCat);
                        setEntryMap((prev) => ({ ...prev, [activeCat]: data.sort((a, b) => (a.plotNumber ?? 999) - (b.plotNumber ?? 999)) }));
                        setActiveRaceEntryId(null);
                      }}
                      onBack={() => setActiveRaceEntryId(null)}
                    />
                  );
                })()}

                {/* My participants */}
                <div>
                  <h2 className="text-sm font-semibold text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3 flex items-center justify-between">
                    Moji účastníci
                    <span className="font-mono text-green-600">{myEntries.length}</span>
                  </h2>
                  {myEntries.length === 0 ? (
                    <p className="text-sm text-gray-400 px-1 py-2">Zatiaľ žiadni. Prevezmite si účastníka nižšie.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                      {myEntries.map((entry) => {
                        const myJudgeRecord = entry.judges.find((j) => j.userId === currentUser?.id);
                        const isCompleted = myJudgeRecord?.completedAt != null;
                        const sortedJudges = [...entry.judges].sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
                        const judgeIndex = sortedJudges.findIndex((j) => j.userId === currentUser?.id);
                        const savedCs = judgeIndex === 0 ? entry.time1 : entry.time2;
                        return (
                          <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${isCompleted ? 'bg-gray-50' : 'bg-white'}`}>
                            <div className="font-mono font-bold text-xl text-gray-400 w-8 shrink-0 text-center">
                              {entry.plotNumber ?? '—'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{entry.participant.firstName} {entry.participant.lastName}</div>
                              <div className="text-xs text-gray-400">{entry.participant.city}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {isCompleted ? (
                                <div className="text-right">
                                  <div className="font-mono text-sm font-semibold text-gray-700">{savedCs != null ? centisecondsToDisplay(savedCs) : '—'}</div>
                                  {entry.penalty > 0 && <div className="text-xs text-amber-600">+{entry.penalty / 100} s</div>}
                                  <div className="text-xs text-green-600 font-medium">✓ Hotovo</div>
                                </div>
                              ) : isClosed ? (
                                <span className="text-xs text-gray-400">Uzatvorené</span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setActiveRaceEntryId(entry.id)}
                                    className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
                                  >
                                    ▶ Pretek
                                  </button>
                                  <button
                                    onClick={() => handleUnclaim(entry.id)}
                                    className="text-xs text-gray-300 hover:text-red-400 px-1"
                                  >
                                    ×
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Other entries - claim */}
                {otherEntries.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-3 flex items-center justify-between">
                      Ostatní účastníci
                      <span className="font-mono text-gray-400">{otherEntries.length}</span>
                    </h2>
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                      {otherEntries.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <div className="font-mono font-bold text-xl text-gray-300 w-8 shrink-0 text-center">
                            {entry.plotNumber ?? '—'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{entry.participant.firstName} {entry.participant.lastName}</div>
                            <div className="text-xs text-gray-400 flex flex-wrap gap-1 mt-0.5">
                              {entry.judges.map((j) => (
                                <span key={j.userId} className={`rounded px-1 ${j.completedAt ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {j.user.firstName} {j.user.lastName}{j.completedAt ? ' ✓' : ''}
                                </span>
                              ))}
                              {entry.judges.length === 0 && <span className="text-gray-300">—</span>}
                            </div>
                          </div>
                          {!isClosed && (
                            <button
                              onClick={() => handleClaim(entry.id)}
                              className="shrink-0 text-sm border border-green-300 text-green-700 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100"
                            >
                              Prebrať si
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── ADMIN VIEW ───────────────────────────────────── */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-left">
                      <th className="px-2 py-2 w-16">Políčko</th>
                      <th className="px-2 py-2 w-32">Meno</th>
                      <th className="px-2 py-2 w-28">Stopky R1</th>
                      <th className="px-2 py-2 w-28">Stopky R2</th>
                      <th className="px-2 py-2 w-24">Základný čas</th>
                      <th className="px-2 py-2 w-44">Penalizácia</th>
                      <th className="px-2 py-2 w-36">Poznámka</th>
                      <th className="px-2 py-2 w-24 text-right">Výsledok</th>
                      <th className="px-2 py-2 w-28">Rozhodcovia</th>
                      <th className="px-2 py-2 w-12 text-center">DNR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEntries.map((entry) => {
                      const totalTime = entry.dnr ? null : entry.baseTime != null ? entry.baseTime + entry.penalty : null;
                      const timesMatch = entry.time1 != null && entry.time2 != null && entry.time1 === entry.time2;
                      const timesMismatch = entry.time1 != null && entry.time2 != null && entry.time1 !== entry.time2;
                      return (
                        <tr key={entry.id} className={`border-b border-gray-100 ${entry.dnr ? 'opacity-50' : ''}`}>
                          <td className="px-2 py-2 font-mono font-semibold">{entry.plotNumber ?? '—'}</td>
                          <td className="px-2 py-2 font-medium">{entry.participant.firstName} {entry.participant.lastName}</td>
                          <td className="px-2 py-2">
                            <Stopwatch value={entry.time1} label="R1" disabled={isClosed || entry.dnr} onStop={async (s) => updateEntry(entry.id, { time1: s })} />
                          </td>
                          <td className="px-2 py-2">
                            <Stopwatch value={entry.time2} label="R2" disabled={isClosed || entry.dnr} onStop={async (s) => updateEntry(entry.id, { time2: s })} />
                          </td>
                          <td className="px-2 py-2">
                            <TimeInput value={entry.baseTime} disabled={isClosed || entry.dnr} onChange={(s) => updateEntry(entry.id, { baseTime: s })}
                              className={timesMatch ? '!border-green-400 !bg-green-50' : timesMismatch ? '!border-orange-400 !bg-orange-50' : ''} />
                          </td>
                          <td className="px-2 py-2">
                            <PenaltyPicker value={entry.penalty} disabled={isClosed} onChange={(s) => updateEntry(entry.id, { penalty: s })} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="text" defaultValue={entry.penaltyNote ?? ''} disabled={isClosed}
                              className="border border-gray-200 rounded px-2 py-0.5 text-xs w-32 disabled:bg-gray-50"
                              onBlur={(e) => updateEntry(entry.id, { penaltyNote: e.target.value })} />
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-semibold">
                            {totalTime != null ? centisecondsToDisplay(totalTime) : '—'}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-0.5">
                              {entry.judges.map((j) => (
                                <span key={j.userId} className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 rounded px-1 text-xs group">
                                  {j.user.firstName} {j.user.lastName}
                                  <button onClick={() => handleUnclaim(entry.id, j.userId)} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-red-500 ml-0.5">×</button>
                                </span>
                              ))}
                              {entry.judges.length === 0 && (
                                <button onClick={() => handleClaim(entry.id)} className="text-xs text-gray-300 hover:text-green-600">+ Priradiť seba</button>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked={entry.dnr} disabled={isClosed} onChange={(e) => updateEntry(entry.id, { dnr: e.target.checked })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
