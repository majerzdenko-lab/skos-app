import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, participants as participantsApi } from '../../api/endpoints';
import type { Event, Category, ParticipantWithEntries } from '../../api/endpoints';
import Layout from '../../components/Layout';

export default function Registration() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [parts, setParts] = useState<ParticipantWithEntries[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', city: '', dateOfBirth: '', email: '', emailConsent: false, categoryId: '' });
  const [loading, setLoading] = useState(true);

  // Make-judge modal state
  const [judgeTarget, setJudgeTarget] = useState<ParticipantWithEntries | null>(null);
  const [judgeEmail, setJudgeEmail] = useState('');
  const [judgePassword, setJudgePassword] = useState('');
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeSuccess, setJudgeSuccess] = useState<string | null>(null);
  const [judgeError, setJudgeError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      eventsApi.get(id),
      categoriesApi.list(id),
      participantsApi.list(id),
    ]).then(([e, c, p]) => {
      setEvent(e.data);
      setCats(c.data);
      setParts(p.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const { data } = await participantsApi.create(id, {
      firstName: form.firstName,
      lastName: form.lastName,
      city: form.city,
      dateOfBirth: form.dateOfBirth || undefined,
      email: form.email || undefined,
      emailConsent: form.emailConsent,
      categoryId: form.categoryId || undefined,
    });
    const category = cats.find((c) => c.id === form.categoryId);
    setParts((prev) => [
      ...prev,
      {
        ...data,
        entries: category
          ? [{ id: '', categoryId: form.categoryId, plotNumber: null, category }]
          : [],
      },
    ]);
    setForm((f) => ({ ...f, firstName: '', lastName: '', city: '', dateOfBirth: '', email: '' }));
  };

  const handleDelete = async (pid: string) => {
    if (!id || !confirm('Naozaj odstrániť súťažiaceho?')) return;
    await participantsApi.delete(id, pid);
    setParts((prev) => prev.filter((p) => p.id !== pid));
  };

  const openJudgeModal = (p: ParticipantWithEntries) => {
    setJudgeTarget(p);
    setJudgeEmail(p.email ?? '');
    setJudgePassword('');
    setJudgeSuccess(null);
    setJudgeError('');
  };

  const handleMakeJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !judgeTarget) return;
    setJudgeLoading(true);
    setJudgeError('');
    try {
      await participantsApi.makeJudge(id, judgeTarget.id, { email: judgeEmail, password: judgePassword });
      setJudgeSuccess(judgeEmail);
    } catch {
      setJudgeError('Chyba pri vytváraní účtu. Skontroluj email a heslo (min. 6 znakov).');
    } finally {
      setJudgeLoading(false);
    }
  };

  const filtered = parts.filter((p) => {
    const matchSearch =
      !search ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || p.entries.some((e) => e.categoryId === filterCat);
    return matchSearch && matchCat;
  });

  const countByCat = cats.map((c) => ({
    ...c,
    count: parts.filter((p) => p.entries.some((e) => e.categoryId === c.id)).length,
  }));
  const withoutCat = parts.filter((p) => p.entries.length === 0).length;

  if (loading) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">{event?.name} — Registrácia</h1>

        {/* Category summary */}
        <div className="flex flex-wrap gap-2 mb-6">
          {countByCat.map((c) => (
            <div key={c.id} className="text-xs bg-gray-100 rounded px-3 py-1">
              {c.name}: <strong>{c.count}</strong>
            </div>
          ))}
          {withoutCat > 0 && (
            <div className="text-xs bg-amber-100 text-amber-700 rounded px-3 py-1">
              Bez kategórie (rozhodcovia): <strong>{withoutCat}</strong>
            </div>
          )}
        </div>

        {/* Quick add form */}
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
          <h2 className="font-semibold text-sm mb-3">Pridaj osobu</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
            <input required placeholder="Meno" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input required placeholder="Priezvisko" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input required placeholder="Bydlisko" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input placeholder="Dátum nar. (DD.MM.YYYY)" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">— Bez kategórie (rozhodca) —</option>
              {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <button type="submit" className="bg-green-700 text-white rounded px-3 py-1.5 text-sm hover:bg-green-800">Pridaj</button>
          </div>
          <div className="flex gap-3 items-center">
            <input placeholder="Email (nepovinný)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-64" />
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" checked={form.emailConsent} onChange={(e) => setForm((f) => ({ ...f, emailConsent: e.target.checked }))} />
              Súhlas s emailom
            </label>
          </div>
        </form>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input placeholder="Hľadaj..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
            <option value="">Všetky</option>
            {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <span className="text-sm text-gray-500 self-center">{filtered.length} záznamov</span>
        </div>

        {/* Participant list */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-300">
              <th className="px-3 py-2">Meno</th>
              <th className="px-3 py-2">Bydlisko</th>
              <th className="px-3 py-2">Dátum nar.</th>
              <th className="px-3 py-2">Kategória</th>
              <th className="px-3 py-2 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${p.entries.length === 0 ? 'bg-amber-50' : ''}`}>
                <td className="px-3 py-2">{p.firstName} {p.lastName}</td>
                <td className="px-3 py-2">{p.city}</td>
                <td className="px-3 py-2 text-gray-500">{p.dateOfBirth ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {p.entries.length > 0
                    ? p.entries.map((e) => e.category.name).join(', ')
                    : <span className="text-amber-600">— rozhodca</span>}
                </td>
                <td className="px-3 py-2 flex gap-2 justify-end">
                  <button
                    onClick={() => openJudgeModal(p)}
                    className="text-xs bg-amber-50 border border-amber-300 text-amber-700 rounded px-2 py-0.5 hover:bg-amber-100"
                  >
                    Určiť za rozhodcu
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">Zmazať</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Make-judge modal */}
      {judgeTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg mb-1">Určiť za rozhodcu</h2>
            <p className="text-sm text-gray-500 mb-4">
              {judgeTarget.firstName} {judgeTarget.lastName} dostane prístup do systému ako rozhodca.
            </p>
            {judgeSuccess ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-800 mb-4">
                  Účet vytvorený. Rozhodca sa môže prihlásiť emailom <strong>{judgeSuccess}</strong>.
                </div>
                <button onClick={() => setJudgeTarget(null)} className="w-full border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50">
                  Zatvoriť
                </button>
              </div>
            ) : (
              <form onSubmit={handleMakeJudge} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Email (prihlásenie)</label>
                  <input
                    required type="email" value={judgeEmail}
                    onChange={(e) => setJudgeEmail(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                    placeholder="email@priklad.sk"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Heslo (min. 6 znakov)</label>
                  <input
                    required type="text" value={judgePassword}
                    onChange={(e) => setJudgePassword(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full font-mono"
                    placeholder="napr. Rozhodca2026"
                    minLength={6}
                  />
                </div>
                {judgeError && <p className="text-xs text-red-600">{judgeError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={judgeLoading}
                    className="flex-1 bg-green-700 text-white rounded px-3 py-2 text-sm hover:bg-green-800 disabled:opacity-50">
                    {judgeLoading ? 'Vytvárám…' : 'Vytvoriť účet'}
                  </button>
                  <button type="button" onClick={() => setJudgeTarget(null)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50">
                    Zrušiť
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
