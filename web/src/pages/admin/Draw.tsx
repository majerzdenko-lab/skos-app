import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, entries as entriesApi } from '../../api/endpoints';
import type { Event, Category, EntryWithParticipant } from '../../api/endpoints';
import { useEventSocket } from '../../hooks/useEventSocket';
import Layout from '../../components/Layout';

export default function Draw() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [entryMap, setEntryMap] = useState<Record<string, EntryWithParticipant[]>>({});
  const [loadedCats, setLoadedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
    categoriesApi.list(id).then((r) => {
      setCats(r.data);
      if (r.data.length > 0) setActiveCat(r.data[0].id);
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

  useEffect(() => {
    if (!id || !activeCat || loadedCats.has(activeCat)) return;
    entriesApi.list(id, activeCat).then((r) => {
      setEntryMap((prev) => ({ ...prev, [activeCat]: r.data }));
      setLoadedCats((prev) => new Set([...prev, activeCat]));
    });
  }, [activeCat, id, loadedCats]);

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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">{event?.name} — Žrebovanie</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded text-sm border ${
                activeCat === c.id ? 'bg-green-700 text-white border-green-700' : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
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

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-left">
                  <th className="px-3 py-2">Meno</th>
                  <th className="px-3 py-2">Bydlisko</th>
                  <th className="px-3 py-2 w-32">Číslo políčka</th>
                </tr>
              </thead>
              <tbody>
                {currentEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {entry.participant.firstName} {entry.participant.lastName}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{entry.participant.city}</td>
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
        )}
      </div>
    </Layout>
  );
}
