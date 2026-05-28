import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, participants as participantsApi } from '../../api/endpoints';
import type { PublicEvent, Category } from '../../api/endpoints';
import { formatEventDate } from '../../utils/time';
import Layout from '../../components/Layout';

export default function Register() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', city: '', dateOfBirth: '', email: '', emailConsent: false, categoryId: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([eventsApi.getPublic(id), categoriesApi.list(id)])
      .then(([e, c]) => {
        setEvent(e.data);
        setCats(c.data.filter((cat) => cat.categoryType === 'INDIVIDUAL'));
        if (c.data.length > 0) setForm((f) => ({ ...f, categoryId: c.data[0].id }));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await participantsApi.registerPublic(id!, {
        firstName: form.firstName,
        lastName: form.lastName,
        city: form.city,
        dateOfBirth: form.dateOfBirth || undefined,
        email: form.email || undefined,
        emailConsent: form.emailConsent,
        categoryId: form.categoryId,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Chyba pri registrácii. Skúste znova.');
    }
  };

  if (loading) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;
  if (!event) return <Layout><div className="p-8">Podujatie nenájdené.</div></Layout>;

  if (event.status !== 'REGISTRATION') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold mb-2">{event.name}</h1>
          <p className="text-gray-500">Registrácia nie je momentálne otvorená.</p>
        </div>
      </Layout>
    );
  }

  if (submitted) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold mb-2">Registrácia úspešná!</h1>
          <p className="text-gray-500 mb-2">
            {form.firstName} {form.lastName} — {cats.find((c) => c.id === form.categoryId)?.name}
          </p>
          <p className="text-sm text-gray-400">Uvidíme sa na podujatí!</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
        <p className="text-sm text-gray-500 mb-8">
          {formatEventDate(event.date)} · {event.location}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meno *</label>
              <input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priezvisko *</label>
              <input required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bydlisko *</label>
            <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dátum narodenia</label>
            <input placeholder="DD.MM.YYYY alebo YYYY" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategória *</label>
            <select required value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.emailConsent} onChange={(e) => setForm((f) => ({ ...f, emailConsent: e.target.checked }))}
              className="mt-0.5" />
            <span>Chcem dostávať informácie o výsledkoch a nových podujatiach</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="w-full bg-green-700 text-white py-2.5 rounded text-sm font-medium hover:bg-green-800">
            Registrovať sa
          </button>
        </form>
      </div>
    </Layout>
  );
}
