import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, participants as participantsApi, entries as entriesApi } from '../../api/endpoints';
import type { Event, Category, ParticipantWithEntries } from '../../api/endpoints';
import Layout from '../../components/Layout';

const EMPTY_FORM = { firstName: '', lastName: '', city: '', dateOfBirth: '', email: '', emailConsent: false, categoryId: '' };

export default function Registration() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [parts, setParts] = useState<ParticipantWithEntries[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Array<{ firstName: string; lastName: string; city: string; dateOfBirth: string | null; email: string | null }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  // Three-dots menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Judge modal
  const [judgeTarget, setJudgeTarget] = useState<ParticipantWithEntries | null>(null);
  const [judgeEmail, setJudgeEmail] = useState('');
  const [judgePassword, setJudgePassword] = useState('');
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeSuccess, setJudgeSuccess] = useState<string | null>(null);
  const [judgeError, setJudgeError] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState<ParticipantWithEntries | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', city: '', dateOfBirth: '', email: '', emailConsent: false });
  const [editLoading, setEditLoading] = useState(false);

  // Status workflow
  const [closeRegModal, setCloseRegModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([eventsApi.get(id), categoriesApi.list(id), participantsApi.list(id)])
      .then(([e, c, p]) => { setEvent(e.data); setCats(c.data); setParts(p.data); })
      .finally(() => setLoading(false));
  }, [id]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Autocomplete search
  const triggerSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      const { data } = await participantsApi.search(q);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    }, 300);
  }, []);

  const handleFormChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'firstName' || field === 'lastName') {
      const combined = field === 'firstName' ? `${value} ${form.lastName}` : `${form.firstName} ${value}`;
      triggerSearch(combined.trim());
    }
  };

  const applySuggestion = (s: typeof suggestions[0]) => {
    setForm((f) => ({
      ...f,
      firstName: s.firstName,
      lastName: s.lastName,
      city: s.city,
      dateOfBirth: s.dateOfBirth ?? '',
      email: s.email ?? '',
    }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const { data } = await participantsApi.create(id, {
      firstName: form.firstName, lastName: form.lastName, city: form.city,
      dateOfBirth: form.dateOfBirth || undefined, email: form.email || undefined,
      emailConsent: form.emailConsent, categoryId: form.categoryId || undefined,
    });
    const category = cats.find((c) => c.id === form.categoryId);
    setParts((prev) => [...prev, {
      ...data,
      entries: category ? [{ id: '', categoryId: form.categoryId, plotNumber: null, category }] : [],
    }]);
    setForm(EMPTY_FORM);
    setSuggestions([]);
  };

  const handleDelete = async (pid: string) => {
    if (!id || !confirm('Naozaj vymazať súťažiaceho?')) return;
    await participantsApi.delete(id, pid);
    setParts((prev) => prev.filter((p) => p.id !== pid));
    setOpenMenuId(null);
  };

  const openJudgeModal = (p: ParticipantWithEntries) => {
    setJudgeTarget(p);
    setJudgeEmail(p.email ?? '');
    setJudgePassword('');
    setJudgeSuccess(null);
    setJudgeError('');
    setOpenMenuId(null);
  };

  const openEditModal = (p: ParticipantWithEntries) => {
    setEditTarget(p);
    setEditForm({
      firstName: p.firstName, lastName: p.lastName, city: p.city,
      dateOfBirth: p.dateOfBirth ?? '', email: p.email ?? '', emailConsent: p.emailConsent,
    });
    setOpenMenuId(null);
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

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editTarget) return;
    setEditLoading(true);
    try {
      const { data } = await participantsApi.update(id, editTarget.id, {
        firstName: editForm.firstName, lastName: editForm.lastName, city: editForm.city,
        dateOfBirth: editForm.dateOfBirth || undefined, email: editForm.email || undefined,
        emailConsent: editForm.emailConsent,
      });
      setParts((prev) => prev.map((p) => p.id === editTarget.id ? { ...p, ...data } : p));
      setEditTarget(null);
    } finally {
      setEditLoading(false);
    }
  };

  // Close registration → advance to DRAW
  const handleCloseRegistration = async () => {
    if (!id) return;
    setStatusLoading(true);
    setStatusError('');
    try {
      const { data } = await eventsApi.setStatus(id, 'DRAW');
      setEvent(data);
      setCloseRegModal(false);
    } catch {
      setStatusError('Nepodarilo sa uzavrieť registráciu.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Close draw → advance to ACTIVE (checks all entries have plotNumber)
  const handleStartCompetition = async () => {
    if (!id) return;
    setStatusLoading(true);
    setStatusError('');
    try {
      // Check all categories have fully drawn plots
      const allEntries = await Promise.all(cats.map((c) => entriesApi.list(id, c.id).then((r) => ({ cat: c, entries: r.data }))));
      const incomplete = allEntries.filter(({ entries }) => entries.some((e) => e.plotNumber === null));
      if (incomplete.length > 0) {
        setStatusError(`Nie všetky políčka sú vyžrebované. Chýba v kategóriách: ${incomplete.map((x) => x.cat.name).join(', ')}.`);
        setStatusLoading(false);
        return;
      }
      const { data } = await eventsApi.setStatus(id, 'ACTIVE');
      setEvent(data);
    } catch {
      setStatusError('Nepodarilo sa spustiť súťaž.');
    } finally {
      setStatusLoading(false);
    }
  };

  const filtered = parts.filter((p) => {
    const matchSearch = !search || `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat
      ? true
      : filterCat === '__none__'
        ? p.entries.length === 0
        : p.entries.some((e) => e.categoryId === filterCat);
    return matchSearch && matchCat;
  });

  const countByCat = cats.map((c) => ({ ...c, count: parts.filter((p) => p.entries.some((e) => e.categoryId === c.id)).length }));
  const withoutCat = parts.filter((p) => p.entries.length === 0).length;

  if (loading) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to={`/events/${id}/setup`} className="text-sm text-gray-400 hover:text-gray-700">← Nastavenia</Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">{event?.name} — Registrácia</h1>
          <div className="flex flex-col items-end gap-2">
            {event?.status === 'REGISTRATION' && (
              <button onClick={() => { setStatusError(''); setCloseRegModal(true); }}
                className="bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-amber-700 whitespace-nowrap">
                Uzavrieť registráciu →
              </button>
            )}
            {event?.status === 'DRAW' && (
              <button onClick={handleStartCompetition} disabled={statusLoading}
                className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-800 disabled:opacity-50 whitespace-nowrap">
                {statusLoading ? 'Kontrolujem…' : 'Začať súťaž →'}
              </button>
            )}
            {statusError && <p className="text-xs text-red-600 max-w-xs text-right">{statusError}</p>}
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCat('')}
            className={`text-xs rounded px-3 py-1 transition-colors ${filterCat === '' ? 'bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Všetci: <strong>{parts.length}</strong>
          </button>
          {countByCat.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
              className={`text-xs rounded px-3 py-1 transition-colors ${filterCat === c.id ? 'bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {c.name}: <strong>{c.count}</strong>
            </button>
          ))}
          {withoutCat > 0 && (
            <button
              onClick={() => setFilterCat(filterCat === '__none__' ? '' : '__none__')}
              className={`text-xs rounded px-3 py-1 transition-colors ${filterCat === '__none__' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
            >
              Bez kategórie (rozhodcovia): <strong>{withoutCat}</strong>
            </button>
          )}
        </div>

        {/* Quick add form */}
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50 relative">
          <h2 className="font-semibold text-sm mb-3">Pridaj osobu</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3" ref={suggestionBoxRef}>
            <div className="relative">
              <input required placeholder="Meno" value={form.firstName}
                onChange={(e) => handleFormChange('firstName', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div className="relative">
              <input required placeholder="Priezvisko" value={form.lastName}
                onChange={(e) => handleFormChange('lastName', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px] max-h-48 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onMouseDown={() => applySuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-100 last:border-0">
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="text-gray-400 ml-2 text-xs">{s.city}{s.dateOfBirth ? ` · ${s.dateOfBirth}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input required placeholder="Bydlisko" value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input placeholder="Dátum nar. (DD.MM.YYYY)" value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">— Bez kategórie (rozhodca) —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" className="bg-green-700 text-white rounded px-3 py-1.5 text-sm hover:bg-green-800">Pridaj</button>
          </div>
          <div className="flex gap-3 items-center">
            <input placeholder="Email (nepovinný)" type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-64" />
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input type="checkbox" checked={form.emailConsent} onChange={(e) => setForm((f) => ({ ...f, emailConsent: e.target.checked }))} />
              Súhlas s emailom
            </label>
          </div>
        </form>

        {/* Search */}
        <div className="flex gap-3 mb-4">
          <input placeholder="Hľadaj..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56" />
          <span className="text-sm text-gray-500 self-center">{filtered.length} záznamov</span>
        </div>

        {/* Participant list */}
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-300">
              <th className="px-3 py-2">Meno</th>
              <th className="px-3 py-2">Bydlisko</th>
              <th className="px-3 py-2">Dátum nar.</th>
              <th className="px-3 py-2">Kategória</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 ${p.entries.length === 0 ? 'bg-amber-50' : ''}`}>
                <td className="px-3 py-2">{p.firstName} {p.lastName}</td>
                <td className="px-3 py-2">{p.city}</td>
                <td className="px-3 py-2 text-gray-500">{p.dateOfBirth ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {p.entries.length > 0 ? p.entries.map((e) => e.category.name).join(', ') : <span className="text-amber-600">— rozhodca</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="relative" ref={openMenuId === p.id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 font-bold text-lg leading-none"
                    >
                      ···
                    </button>
                    {openMenuId === p.id && (
                      <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                        <button onClick={() => openEditModal(p)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                          Upraviť
                        </button>
                        <button onClick={() => openJudgeModal(p)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                          Určiť za rozhodcu
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button onClick={() => handleDelete(p.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          Vymazať
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Close registration confirmation modal */}
      {closeRegModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <h2 className="font-bold text-lg mb-1">Uzavrieť registráciu?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Po uzavretí registrácie bude možné pristúpiť k žrebovaniu políčok. Skontroluj zoznam prihlásených.
            </p>
            <div className="overflow-y-auto flex-1 border border-gray-200 rounded mb-4">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Meno</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Bydlisko</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Kategória</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.filter((p) => p.entries.length > 0).map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5">{p.firstName} {p.lastName}</td>
                      <td className="px-3 py-1.5 text-gray-500">{p.city}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">{p.entries.map((e) => e.category.name).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <span className="text-sm text-gray-500">
                Celkom súťažiacich: <strong>{parts.filter((p) => p.entries.length > 0).length}</strong>
                {withoutCat > 0 && <span className="ml-3 text-amber-600">+ {withoutCat} rozhodcov (bez kategórie)</span>}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCloseRegModal(false)}
                  className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50">
                  Zrušiť
                </button>
                <button onClick={handleCloseRegistration} disabled={statusLoading}
                  className="bg-amber-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                  {statusLoading ? 'Uzatvárám…' : 'Uzavrieť registráciu'}
                </button>
              </div>
            </div>
            {statusError && <p className="text-xs text-red-600 mt-2">{statusError}</p>}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">Upraviť účastníka</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Meno</label>
                  <input required value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Priezvisko</label>
                  <input required value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Bydlisko</label>
                <input required value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dátum narodenia (DD.MM.YYYY)</label>
                <input value={editForm.dateOfBirth} onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={editForm.emailConsent} onChange={(e) => setEditForm((f) => ({ ...f, emailConsent: e.target.checked }))} />
                Súhlas s emailom
              </label>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={editLoading}
                  className="flex-1 bg-green-700 text-white rounded px-3 py-2 text-sm hover:bg-green-800 disabled:opacity-50">
                  {editLoading ? 'Ukladám…' : 'Uložiť'}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm hover:bg-gray-50">
                  Zrušiť
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Judge modal */}
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
                  <input required type="email" value={judgeEmail} onChange={(e) => setJudgeEmail(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full" placeholder="email@priklad.sk" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Heslo (min. 6 znakov)</label>
                  <input required type="text" value={judgePassword} onChange={(e) => setJudgePassword(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full font-mono" placeholder="napr. Rozhodca2026" minLength={6} />
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
