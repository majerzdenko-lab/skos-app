import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, entries as entriesApi } from '../../api/endpoints';
import type { Event, Category, EntryWithParticipant, EntryUpdate } from '../../api/endpoints';
import { useEventSocket } from '../../hooks/useEventSocket';
import Stopwatch from '../../components/Stopwatch';
import PenaltyPicker from '../../components/PenaltyPicker';
import TimeInput from '../../components/TimeInput';
import { secondsToMmSs } from '../../utils/time';
import Layout from '../../components/Layout';

export default function Judging() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [entryMap, setEntryMap] = useState<Record<string, EntryWithParticipant[]>>({});
  const [closedCats, setClosedCats] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
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
  });

  const updateEntry = useCallback(
    async (entryId: string, data: EntryUpdate) => {
      const { data: updated } = await entriesApi.update(entryId, data);
      setEntryMap((prev) => {
        const next = { ...prev };
        for (const catId of Object.keys(next)) {
          next[catId] = next[catId].map((e) => (e.id === entryId ? { ...e, ...updated } : e));
        }
        return next;
      });
    },
    []
  );

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

  return (
    <Layout>
      <div className="max-w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{event?.name} — Rozhodcovia</h1>
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
              {!isClosed && (
                <button
                  onClick={handleClose}
                  disabled={!canClose || closing}
                  className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Uzatvoriť kategóriu
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 text-left">
                    <th className="px-2 py-2 w-16">Políčko</th>
                    <th className="px-2 py-2 w-36">Meno</th>
                    <th className="px-2 py-2 w-28">Stopky R1</th>
                    <th className="px-2 py-2 w-28">Stopky R2</th>
                    <th className="px-2 py-2 w-24">Základný čas</th>
                    <th className="px-2 py-2 w-44">Penalizácia</th>
                    <th className="px-2 py-2 w-40">Poznámka</th>
                    <th className="px-2 py-2 w-24 text-right">Výsledný čas</th>
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
                        <td className="px-2 py-2 font-medium">
                          {entry.participant.firstName} {entry.participant.lastName}
                        </td>
                        <td className="px-2 py-2">
                          <Stopwatch
                            value={entry.time1}
                            label="R1"
                            disabled={isClosed || entry.dnr}
                            onStop={async (s) => updateEntry(entry.id, { time1: s })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Stopwatch
                            value={entry.time2}
                            label="R2"
                            disabled={isClosed || entry.dnr}
                            onStop={async (s) => updateEntry(entry.id, { time2: s })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <TimeInput
                            value={entry.baseTime}
                            disabled={isClosed || entry.dnr}
                            onChange={(s) => updateEntry(entry.id, { baseTime: s })}
                            className={
                              timesMatch
                                ? '!border-green-400 !bg-green-50'
                                : timesMismatch
                                ? '!border-orange-400 !bg-orange-50'
                                : ''
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <PenaltyPicker
                            value={entry.penalty}
                            disabled={isClosed}
                            onChange={(s) => updateEntry(entry.id, { penalty: s })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            defaultValue={entry.penaltyNote ?? ''}
                            disabled={isClosed}
                            className="border border-gray-200 rounded px-2 py-0.5 text-xs w-36 disabled:bg-gray-50"
                            onBlur={(e) => updateEntry(entry.id, { penaltyNote: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">
                          {totalTime != null ? secondsToMmSs(totalTime) : '—'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={entry.dnr}
                            disabled={isClosed}
                            onChange={(e) => updateEntry(entry.id, { dnr: e.target.checked })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
