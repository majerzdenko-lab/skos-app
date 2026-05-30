import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, users as usersApi } from '../../api/endpoints';
import type { Event, Category, EventUser, Role, CategoryType } from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';

const STATUS_FLOW = ['SETUP', 'REGISTRATION', 'DRAW', 'ACTIVE', 'CLOSED'] as const;
const STATUS_LABELS: Record<string, string> = {
  SETUP: 'Príprava',
  REGISTRATION: 'Registrácia',
  DRAW: 'Žrebovanie',
  ACTIVE: 'Prebieha',
  CLOSED: 'Uzatvorené',
};
const STATUS_NEXT_LABEL: Record<string, string> = {
  SETUP: 'Otvoriť registráciu',
  REGISTRATION: 'Uzatvoriť registráciu',
  DRAW: 'Začať súťaž',
  ACTIVE: 'Uzatvoriť súťaž',
};
const STATUS_HINT: Record<string, string> = {
  SETUP: 'Nastavte kategórie a pridajte rozhodcov. Keď ste pripravení, otvorte registráciu.',
  REGISTRATION: 'Registrácia je otvorená — účastníci sa môžu prihlásiť online aj na mieste. Po uzavretí registrácie pokračujete žrebovaním.',
  DRAW: 'Registrácia je uzavretá. Vyžrebujte políčka pre každú kategóriu. Keď sú všetky vyžrebované, môžete začať súťaž.',
  ACTIVE: 'Súťaž prebieha. Rozhodcovia zapisujú časy. Po ukončení všetkých kategórií uzatvorte súťaž.',
  CLOSED: 'Súťaž je ukončená. Výsledky sú dostupné verejnosti.',
};

export default function EventSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [event, setEvent] = useState<Event | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [users, setUsers] = useState<EventUser[]>([]);
  const [tab, setTab] = useState<'info' | 'categories' | 'users'>('info');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'REGISTRAR' | 'JUDGE' | 'COMPETITOR'>('JUDGE');
  const [dragging, setDragging] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<Array<{ name: string; plotDimensions: string; plotCount: number; categoryType: string; scored: boolean }>>([]);
  const [templateSelected, setTemplateSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
    eventsApi.getMyRole(id).then((r) => setMyRole(r.data.role)).catch(() => {});
    categoriesApi.list(id).then((r) => setCats(r.data));
    usersApi.list(id).then((r) => setUsers(r.data)).catch(() => {});
  }, [id]);

  const isSystemAdmin = currentUser?.systemRole === 'ADMIN';
  const isJudge = myRole === 'JUDGE';
  const canEdit = myRole === 'ADMIN' || myRole === 'REGISTRAR';

  const handleDelete = async () => {
    if (!id) return;
    await eventsApi.delete(id);
    navigate('/dashboard');
  };

  const handleLoadTemplate = async (selected?: Array<{ name: string; plotDimensions: string; plotCount: number; categoryType: string; scored: boolean }>) => {
    if (!id) return;
    if (selected) {
      const created = await Promise.all(
        selected.map((cat) =>
          categoriesApi.create(id, {
            name: cat.name,
            plotDimensions: cat.plotDimensions,
            plotCount: cat.plotCount,
            scored: cat.scored,
            categoryType: cat.categoryType as CategoryType,
          }).then((r) => r.data)
        )
      );
      setCats((prev) => [...prev, ...created]);
    } else {
      const { data } = await categoriesApi.loadTemplate(id);
      setCats((prev) => [...prev, ...data]);
    }
  };

  const handleSaveTemplate = async () => {
    if (!id) return;
    await categoriesApi.saveTemplate(id);
  };

  const handleDeleteCat = async (catId: string) => {
    if (!id) return;
    await categoriesApi.delete(id, catId);
    setCats((prev) => prev.filter((c) => c.id !== catId));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const { data } = await usersApi.invite(id, { email: inviteEmail, role: inviteRole });
    setUsers((prev) => [...prev, data]);
    setInviteEmail('');
  };

  const handleRemoveUser = async (userId: string) => {
    if (!id) return;
    await usersApi.remove(id, userId);
    setUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  const handleDrop = async (targetId: string) => {
    if (!dragging || dragging === targetId || !id) return;
    const from = cats.findIndex((c) => c.id === dragging);
    const to = cats.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...cats];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setCats(reordered);
    setDragging(null);
    await categoriesApi.reorder(id, reordered.map((c) => c.id));
  };

  if (!event) return <Layout><div className="p-8 text-gray-400">Načítavanie...</div></Layout>;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(event.status as typeof STATUS_FLOW[number]) + 1];

  const handleAdvanceStatus = async () => {
    if (!event || !id) return;
    const next = STATUS_FLOW[STATUS_FLOW.indexOf(event.status as typeof STATUS_FLOW[number]) + 1];
    if (!next) return;
    try {
      setAdvanceError('');
      const { data } = await eventsApi.setStatus(id, next);
      setEvent(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAdvanceError(msg ?? 'Chyba pri zmene stavu.');
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    SETUP: 'bg-gray-100 text-gray-700',
    REGISTRATION: 'bg-blue-100 text-blue-700',
    DRAW: 'bg-amber-100 text-amber-700',
    ACTIVE: 'bg-green-100 text-green-700',
    CLOSED: 'bg-slate-100 text-slate-600',
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-700">← Podujatia</Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
          <div>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-sm text-gray-500">{event.location} · {event.date ? new Date(event.date).toLocaleDateString('sk-SK') : ''}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
            {nextStatus && (
              <button
                onClick={handleAdvanceStatus}
                className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-800 whitespace-nowrap"
              >
                → {STATUS_NEXT_LABEL[event.status] ?? STATUS_LABELS[nextStatus]}
              </button>
            )}
          </div>
        </div>

        {/* Status hint */}
        <p className="text-sm text-gray-500 mb-5">{STATUS_HINT[event.status]}</p>
        {advanceError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
            {advanceError}
          </div>
        )}

        {/* Workflow steps */}
        <div className="flex flex-wrap items-center gap-1 mb-6 text-xs">
          {STATUS_FLOW.map((s, i) => {
            const idx = STATUS_FLOW.indexOf(event.status as typeof STATUS_FLOW[number]);
            const done = i < idx;
            const active = i === idx;
            return (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 mx-0.5">›</span>}
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  active ? STATUS_COLORS[s] :
                  done ? 'bg-gray-100 text-gray-400 line-through' :
                  'text-gray-300'
                }`}>
                  {STATUS_LABELS[s]}
                </span>
              </span>
            );
          })}
        </div>

        {/* Navigation links */}
        <div className="flex flex-wrap gap-x-3 gap-y-0 mb-6 text-sm border-b border-gray-200">
          <button
            onClick={() => setTab('info')}
            className={`pb-2 px-1 border-b-2 transition-colors ${tab === 'info' ? 'border-green-600 text-green-700 font-medium' : 'border-transparent text-gray-500'}`}
          >
            Informácie
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`pb-2 px-1 border-b-2 transition-colors ${tab === 'categories' ? 'border-green-600 text-green-700 font-medium' : 'border-transparent text-gray-500'}`}
          >
            Kategórie
          </button>
          {myRole === 'ADMIN' && (
            <button
              onClick={() => setTab('users')}
              className={`pb-2 px-1 border-b-2 transition-colors ${tab === 'users' ? 'border-green-600 text-green-700 font-medium' : 'border-transparent text-gray-500'}`}
            >
              Používatelia
            </button>
          )}
          {!isJudge && (
            <Link
              to={`/events/${id}/registration`}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                event.status === 'REGISTRATION' ? 'border-blue-500 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Registrácia
            </Link>
          )}
          {!isJudge && (
            <Link
              to={`/events/${id}/draw`}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                event.status === 'DRAW' ? 'border-amber-500 text-amber-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Žrebovanie
            </Link>
          )}
          {myRole !== 'REGISTRAR' && (
            <Link
              to={`/events/${id}/judging`}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                event.status === 'ACTIVE' ? 'border-green-500 text-green-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Súťaž
            </Link>
          )}
          <Link to={`/events/${id}/results-admin`} className="pb-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700">Výsledky</Link>
        </div>

        {tab === 'categories' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">Kategórie</h2>
              {canEdit && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        const { data } = await categoriesApi.templatePreview(id);
                        setTemplatePreview(data);
                        setTemplateSelected(new Set(data.map((_, i) => i)));
                      } catch {
                        setTemplatePreview([]);
                        setTemplateSelected(new Set());
                      }
                      setTemplateModal(true);
                    }}
                    className="border border-gray-300 text-sm px-3 py-1.5 rounded hover:bg-gray-50"
                  >
                    Načítaj šablónu
                  </button>
                  <button onClick={() => setNewCat(true)} className="bg-green-700 text-white text-sm px-3 py-1.5 rounded hover:bg-green-800">
                    + Pridaj kategóriu
                  </button>
                </div>
              )}
            </div>

            {newCat && (
              <CategoryForm
                eventId={id!}
                onSave={(cat) => { setCats((p) => [...p, cat]); setNewCat(false); }}
                onCancel={() => setNewCat(false)}
                onSaveTemplate={cats.length > 0 ? async () => { await handleSaveTemplate(); alert('Šablóna uložená.'); } : undefined}
              />
            )}

            {templateModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Šablóna kategórií</h3>
                    {templatePreview.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (templateSelected.size === templatePreview.length) {
                            setTemplateSelected(new Set());
                          } else {
                            setTemplateSelected(new Set(templatePreview.map((_, i) => i)));
                          }
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        {templateSelected.size === templatePreview.length ? 'Odznačiť všetky' : 'Označiť všetky'}
                      </button>
                    )}
                  </div>
                  {templatePreview.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-5">Žiadna šablóna nie je uložená.</p>
                  ) : (
                    <div className="space-y-1 mb-5 max-h-80 overflow-y-auto">
                      {templatePreview.map((cat, i) => (
                        <label
                          key={i}
                          className="flex items-center gap-3 border border-gray-200 rounded px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={templateSelected.has(i)}
                            onChange={() => {
                              setTemplateSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            className="accent-green-700"
                          />
                          <span className="font-medium flex-1">{cat.name}</span>
                          <span className="text-xs text-gray-400">{cat.plotDimensions} · {cat.plotCount} políčok · {cat.categoryType === 'TEAM' ? 'Tímy' : 'Jednotlivci'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {templatePreview.length > 0 && (
                      <button
                        disabled={templateSelected.size === 0}
                        onClick={async () => {
                          const sel = templatePreview.filter((_, i) => templateSelected.has(i));
                          await handleLoadTemplate(sel);
                          setTemplateModal(false);
                        }}
                        className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pridaj do podujatia ({templateSelected.size})
                      </button>
                    )}
                    <button
                      onClick={() => setTemplateModal(false)}
                      className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      Zavrieť
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {cats.map((cat) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => setDragging(cat.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(cat.id)}
                  className="flex items-center justify-between border border-gray-200 rounded px-4 py-2 bg-white cursor-grab active:cursor-grabbing"
                >
                  {editingCat?.id === cat.id ? (
                    <CategoryForm
                      eventId={id!}
                      existing={cat}
                      onSave={(updated) => {
                        setCats((p) => p.map((c) => (c.id === updated.id ? updated : c)));
                        setEditingCat(null);
                      }}
                      onCancel={() => setEditingCat(null)}
                      onSaveTemplate={async () => { await handleSaveTemplate(); alert('Šablóna uložená.'); }}
                    />
                  ) : (
                    <>
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{cat.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{cat.plotDimensions} · {cat.plotCount} políčok · {cat.categoryType === 'TEAM' ? 'Tímy' : 'Jednotlivci'}</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setEditingCat(cat)} className="text-xs text-blue-600 hover:underline">Upraviť</button>
                          <button onClick={() => handleDeleteCat(cat.id)} className="text-xs text-red-500 hover:underline">Zmazať</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && myRole === 'ADMIN' && (
          <div>
            <h2 className="font-semibold mb-3">Používatelia a roly</h2>
            {myRole === 'ADMIN' && (
              <form onSubmit={handleInvite} className="flex flex-wrap gap-2 mb-4">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="REGISTRAR">Registrátor</option>
                  <option value="JUDGE">Rozhodca</option>
                  <option value="COMPETITOR">Súťažiaci</option>
                </select>
                <button type="submit" className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-800">
                  Pozvať
                </button>
              </form>
            )}
            <div className="space-y-2">
              {users
                .filter((u) => myRole === 'ADMIN' || u.userId === currentUser?.id)
                .map((u) => {
                  const roleLabels: Record<string, string> = { ADMIN: 'Administrátor', REGISTRAR: 'Registrátor', JUDGE: 'Rozhodca', COMPETITOR: 'Súťažiaci' };
                  return (
                    <div key={u.id} className="flex items-center justify-between border border-gray-200 rounded px-4 py-2 text-sm">
                      <div>
                        <span className="font-medium">{u.user.firstName} {u.user.lastName}</span>
                        <span className="ml-2 text-gray-400 text-xs">{u.user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{roleLabels[u.role] ?? u.role}</span>
                        {myRole === 'ADMIN' && u.userId !== currentUser?.id && (
                          <button onClick={() => handleRemoveUser(u.userId)} className="text-xs text-red-500 hover:underline">Odstrániť</button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {tab === 'info' && (
          <div className="text-sm text-gray-600">
            <p>Dátum: {event.date ? new Date(event.date).toLocaleDateString('sk-SK') : '—'}</p>
            <p>Miesto: {event.location}</p>
            {event.edition && <p>Ročník: {event.edition}</p>}
            <div className="mt-5 space-y-3">
              <UrlBox label="Verejná registrácia" path={`/events/${id}/register`} />
              <UrlBox label="Verejné výsledky" path={`/events/${id}/results`} />
            </div>
            {isSystemAdmin && (
              <div className="mt-10 pt-6 border-t border-red-100">
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-sm text-red-500 border border-red-200 rounded px-4 py-2 hover:bg-red-50"
                  >
                    Vymazať podujatie…
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm">
                    <p className="text-sm font-medium text-red-800 mb-1">Naozaj vymazať <strong>{event.name}</strong>?</p>
                    <p className="text-xs text-red-600 mb-4">Vymaže sa podujatie aj všetci účastníci, kategórie a výsledky. Táto akcia je nevratná.</p>
                    <div className="flex gap-2">
                      <button onClick={handleDelete}
                        className="bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-700">
                        Áno, vymazať
                      </button>
                      <button onClick={() => setDeleteConfirm(false)}
                        className="border border-gray-300 text-sm px-4 py-1.5 rounded hover:bg-gray-50">
                        Zrušiť
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function UrlBox({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2 min-w-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-blue-700 hover:bg-blue-50 hover:border-blue-200 truncate min-w-0 flex-1"
        >
          {url}
        </a>
        <button
          onClick={handleCopy}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 hover:bg-gray-50 shrink-0 text-gray-500 whitespace-nowrap"
        >
          {copied ? '✓ Skopírované' : 'Kopírovať'}
        </button>
      </div>
    </div>
  );
}

function CategoryForm({
  eventId,
  existing,
  onSave,
  onCancel,
  onSaveTemplate,
}: {
  eventId: string;
  existing?: Category;
  onSave: (cat: Category) => void;
  onCancel: () => void;
  onSaveTemplate?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [plotDimensions, setPlotDimensions] = useState(existing?.plotDimensions ?? '');
  const [plotCount, setPlotCount] = useState(String(existing?.plotCount ?? 23));
  const [categoryType, setCategoryType] = useState(existing?.categoryType ?? 'INDIVIDUAL');
  const [scored, setScored] = useState(existing?.scored ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, plotDimensions, plotCount: Number(plotCount), categoryType, scored };
    if (existing) {
      const { data: updated } = await categoriesApi.update(eventId, existing.id, data);
      onSave(updated);
    } else {
      const { data: created } = await categoriesApi.create(eventId, data);
      onSave(created);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded border border-gray-200 mb-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <div className="lg:col-span-2">
          <label className="text-xs text-gray-500 block mb-1">Názov kategórie</label>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" placeholder="napr. Ženy Profi" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Rozmery políčka</label>
          <input required value={plotDimensions} onChange={(e) => setPlotDimensions(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" placeholder="napr. 10×1,8 m" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Počet políčok</label>
          <input required type="number" min={1} value={plotCount} onChange={(e) => setPlotCount(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Typ</label>
          <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as 'INDIVIDUAL' | 'TEAM')}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
            <option value="INDIVIDUAL">Jednotlivci</option>
            <option value="TEAM">Tímy</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Hodnotená</label>
          <label className="flex items-center gap-2 h-8 text-sm cursor-pointer">
            <input type="checkbox" checked={scored} onChange={(e) => setScored(e.target.checked)} />
            Áno
          </label>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="submit" className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800">Uložiť</button>
        {onSaveTemplate && (
          <button type="button" onClick={onSaveTemplate} className="border border-green-600 text-green-700 px-4 py-1.5 rounded text-sm hover:bg-green-50">
            Uložiť ako šablónu
          </button>
        )}
        <button type="button" onClick={onCancel} className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Zrušiť</button>
      </div>
    </form>
  );
}
