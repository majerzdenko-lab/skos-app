import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, entries as entriesApi } from '../../api/endpoints';
import type { Event, Category, EntryWithParticipant } from '../../api/endpoints';
import { useEventSocket } from '../../hooks/useEventSocket';
import Layout from '../../components/Layout';

export default function Draw() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [entryMap, setEntryMap] = useState<Record<string, EntryWithParticipant[]>>({});
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
    categoriesApi.list(id).then((r) => {
      const sorted = r.data.filter(c => c.categoryType === 'INDIVIDUAL');
      setCats(r.data);
      if (sorted.length > 0) setActiveCat(sorted[0].id);
      // Load all individual categories upfront for progress tracking
      sorted.forEach((cat) => {
        entriesApi.list(id, cat.id).then((er) => {
          setEntryMap((prev) => ({ ...prev, [cat.id]: er.data }));
        });
      });
    });
  }, [id]);

  useEventSocket(id, {
    onEntryDrawn: ({ entryId, plotNumber }) => {
      setEntryMap((prev) => {
        const next = { ...prev };
        for (const catId of Object.keys(next)) {
          next[catId] = next[catId].map((e) => (e.id === entryId ? { ...e, plotNumber } : e));
        }
        return next;
      });
    },
  });

  const currentEntries = entryMap[activeCat] ?? [];

  const handleDrawAll = async () => {
    if (!id) return;
    await entriesApi.drawAll(id, activeCat);
    const { data } = await entriesApi.list(id, activeCat);
    setEntryMap((prev) => ({ ...prev, [activeCat]: data }));
  };

  const handleSetPlot = async (entryId: string, plot: string) => {
    const n = parseInt(plot, 10);
    if (!plot || isNaN(n)) return;
    await entriesApi.setPlot(entryId, n);
    setEntryMap((prev) => ({
      ...prev,
      [activeCat]: prev[activeCat].map((e) => (e.id === entryId ? { ...e, plotNumber: n } : e)),
    }));
  };

  const handleStartCompetition = async () => {
    if (!id) return;
    setAdvancing(true);
    setAdvanceError('');
    try {
      await eventsApi.setStatus(id, 'ACTIVE');
      navigate(`/events/${id}/judging`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAdvanceError(msg ?? 'Chyba pri spustení súťaže.');
      setAdvancing(false);
    }
  };

  const individualCats = cats.filter((c) => c.categoryType === 'INDIVIDUAL');

  const drawnCount = (catId: string) => {
    const entries = entryMap[catId];
    if (!entries) return null;
    return { drawn: entries.filter((e) => e.plotNumber != null).length, total: entries.length };
  };

  const allDrawn = individualCats.length > 0 && individualCats.every((c) => {
    const prog = drawnCount(c.id);
    return prog !== null && prog.drawn === prog.total && prog.total > 0;
  });

  const allLoaded = individualCats.every((c) => entryMap[c.id] !== undefined);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-6">
          <h1 className="text-2xl font-bold">{event?.name} — Žrebovanie</h1>
        </div>

        {/* All drawn banner */}
        {allLoaded && allDrawn && event?.status === 'DRAW' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-green-800 font-medium text-sm">Všetky kategórie sú vyžrebované.</p>
              <p className="text-green-600 text-xs">Môžete spustiť súťaž a rozhodcovia môžu začať zapisovať časy.</p>
            </div>
            <button
              onClick={handleStartCompetition}
              disabled={advancing}
              className="bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50 whitespace-nowrap sm:ml-4"
            >
              {advancing ? 'Spúšťam…' : 'Začať súťaž →'}
            </button>
          </div>
        )}

        {allLoaded && !allDrawn && event?.status === 'DRAW' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded px-4 py-2 text-sm text-amber-800">
            Vyžrebujte políčka vo všetkých kategóriách — potom môžete spustiť súťaž.
          </div>
        )}

        {advanceError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
            {advanceError}
          </div>
        )}

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {individualCats.map((c) => {
            const prog = drawnCount(c.id);
            const done = prog !== null && prog.drawn === prog.total && prog.total > 0;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-3 py-1.5 rounded text-sm border flex items-center gap-1.5 ${
                  activeCat === c.id
                    ? 'bg-green-700 text-white border-green-700'
                    : done
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                {c.name}
                {prog !== null && (
                  <span className={`text-xs font-mono ${activeCat === c.id ? 'text-green-200' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {done ? '✓' : `${prog.drawn}/${prog.total}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeCat && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500">{currentEntries.length} súťažiacich</span>
              <button
                onClick={handleDrawAll}
                className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800"
              >
                Vyžrebuj všetkých
              </button>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[400px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-left">
                  <th className="px-3 py-2">Meno</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Bydlisko</th>
                  <th className="px-3 py-2 w-32">Číslo políčka</th>
                </tr>
              </thead>
              <tbody>
                {currentEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {entry.participant.firstName} {entry.participant.lastName}
                    </td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{entry.participant.city}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        defaultValue={entry.plotNumber ?? ''}
                        className={`border rounded px-2 py-0.5 text-sm w-20 font-mono ${
                          entry.plotNumber ? 'border-green-400 bg-green-50' : 'border-gray-300'
                        }`}
                        onBlur={(e) => handleSetPlot(entry.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
