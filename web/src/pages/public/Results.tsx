import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { events as eventsApi } from '../../api/endpoints';
import { publicApi } from '../../api/endpoints';
import { useEventSocket } from '../../hooks/useEventSocket';
import { centisecondsToDisplay, formatEventDate } from '../../utils/time';
import type { PublicEvent } from '../../api/endpoints';
import Layout from '../../components/Layout';

interface PublicEntry {
  id: string;
  plotNumber: number | null;
  baseTime: number | null;
  penalty: number;
  dnr: boolean;
  rank: number | null;
  participant: { firstName: string; lastName: string; city: string; dateOfBirth: string | null };
}

interface PublicCategory {
  id: string;
  name: string;
  plotDimensions: string;
  scored: boolean;
  categoryType: string;
  entries: PublicEntry[];
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([eventsApi.getPublic(id), publicApi.results(id)])
      .then(([e, r]) => {
        setEvent(e.data);
        setCats(r.data);
        if (r.data.length > 0) setActiveTab(r.data[0].id);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEventSocket(id, {
    onEntryUpdated: ({ entryId, baseTime, penalty, totalTime }) => {
      setCats((prev) =>
        prev.map((cat) => ({
          ...cat,
          entries: cat.entries.map((e) =>
            e.id === entryId ? { ...e, baseTime, penalty } : e
          ),
        }))
      );
    },
    onCategoryClosed: ({ categoryId, results }) => {
      const ranked = results as Array<{ entryId: string; rank: number | null }>;
      setCats((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                entries: cat.entries.map((e) => {
                  const r = ranked.find((rr) => rr.entryId === e.id);
                  return r ? { ...e, rank: r.rank } : e;
                }),
              }
            : cat
        )
      );
    },
  });

  if (loading) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;
  if (!event) return <Layout><div className="p-8">Podujatie nenájdené.</div></Layout>;

  const activeCategory = cats.find((c) => c.id === activeTab);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
        <p className="text-sm text-gray-500 mb-6">{formatEventDate(event.date)} · {event.location}</p>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.id)}
              className={`px-3 py-1.5 rounded text-sm border ${
                activeTab === c.id ? 'bg-green-700 text-white border-green-700' : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {activeCategory && (
          <div>
            {activeCategory.scored ? (
              <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[360px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400 text-left">
                    <th className="px-3 py-2 w-10">Por.</th>
                    <th className="px-3 py-2">Meno</th>
                    <th className="px-3 py-2 hidden sm:table-cell">Bydlisko</th>
                    <th className="px-3 py-2 w-16 text-right">Políčko</th>
                    <th className="px-3 py-2 w-20 text-right font-mono">Výsl. čas</th>
                  </tr>
                </thead>
                <tbody>
                  {[...activeCategory.entries]
                    .sort((a, b) => {
                      if (a.rank == null && b.rank == null) return 0;
                      if (a.rank == null) return 1;
                      if (b.rank == null) return -1;
                      return a.rank - b.rank;
                    })
                    .map((entry) => {
                      const totalTime = entry.dnr ? null : entry.baseTime != null ? entry.baseTime + entry.penalty : null;
                      return (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-semibold">{entry.rank ?? ''}</td>
                          <td className="px-3 py-2">
                            {entry.participant.firstName} {entry.participant.lastName}
                          </td>
                          <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{entry.participant.city}</td>
                          <td className="px-3 py-2 text-right font-mono">{entry.plotNumber ?? ''}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {entry.dnr ? 'DNR' : totalTime != null ? centisecondsToDisplay(totalTime) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="italic text-gray-500">nehodnotení</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
