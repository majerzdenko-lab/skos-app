import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, entries as entriesApi } from '../../api/endpoints';
import { exportApi } from '../../api/endpoints';
import type { Event, Category, EntryWithParticipant } from '../../api/endpoints';
import ResultsSheet from '../../components/ResultsSheet';
import Layout from '../../components/Layout';

export default function ResultsAdmin() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Array<Category & { entries: EntryWithParticipant[] }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([eventsApi.get(id), categoriesApi.list(id)]).then(async ([e, c]) => {
      setEvent(e.data);
      const catsWithEntries = await Promise.all(
        c.data.map(async (cat) => {
          const { data } = await entriesApi.list(id, cat.id);
          return { ...cat, entries: data };
        })
      );
      setCats(catsWithEntries);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSendAnnouncement = async () => {
    if (!id || !confirm('Odoslať oznámenie o podujatí všetkým odberateľom?')) return;
    await exportApi.sendAnnouncement(id);
    alert('Oznámenie bolo zaradené do frontu na odoslanie.');
  };

  if (loading || !event) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{event.name} — Výsledky</h1>
          <div className="flex flex-wrap gap-2 no-print">
            <a
              href={exportApi.participants(id!)}
              download
              className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              Export účastníci CSV
            </a>
            <a
              href={exportApi.results(id!)}
              download
              className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              Export výsledky CSV
            </a>
            <a
              href={exportApi.pdf(id!)}
              download
              className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-800"
            >
              Export PDF
            </a>
            <button
              onClick={handleSendAnnouncement}
              className="border border-blue-300 text-blue-700 px-3 py-1.5 rounded text-sm hover:bg-blue-50"
            >
              Odoslať oznámenie
            </button>
          </div>
        </div>

        <ResultsSheet event={event} categories={cats} />
      </div>
    </Layout>
  );
}
