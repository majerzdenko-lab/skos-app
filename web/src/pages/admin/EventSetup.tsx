import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, users as usersApi } from '../../api/endpoints';
import type { Event, Category, EventUser, Role } from '../../api/endpoints';
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

  useEffect(() => {
    if (!id) return;
    eventsApi.get(id).then((r) => setEvent(r.data));
    eventsApi.getMyRole(id).then((r) => setMyRole(r.data.role)).catch(() => {});
    categoriesApi.list(id).then((r) => setCats(r.data));
    usersApi.list(id).then((r) => setUsers(r.data)).catch(() => {});
  }, [id]);

  const isJudge = myRole === 'JUDGE';
  const canEdit = myRole === 'ADMIN' || myRole === 'REGISTRAR';

  const handleLoadTemplate = async () => {
    if (!id) return;
    const { data } = await categoriesApi.loadTemplate(id);
    setCats((prev) => [...prev, ...data]);
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
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="text-sm text-gray-500">{event.location} · {event.date ? new Date(event.date).toLocaleDateString('sk-SK') : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
            {nextStatus && (
              <button
                onClick={handleAdvanceStatus}
                className="bg-green-700 text-white px-3 py-1.5 rounded text-sm hover:bg-green-800"
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
        <div className="flex items-center gap-1 mb-6 text-xs">
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
        <div className="flex flex-wrap gap-4 mb-6 text-sm border-b border-gray-200">
          {([
            { key: 'info', label: 'Informácie' },
            { key: 'categories', label: 'Kategórie' },
            ...(myRole === 'ADMIN' ? [{ key: 'users', label: 'Používatelia' }] : []),
          ] as { key: typeof tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2 px-1 border-b-2 transition-colors ${
                tab === key ? 'border-green-600 text-green-700 font-medium' : 'border-transparent text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
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
                <div className="flex gap-2">
                  <button onClick={handleLoadTemplate} className="border border-gray-300 text-sm px-3 py-1.5 rounded hover:bg-gray-50">
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
              />
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
                    />
                  ) : (
                    <>
                      <div>
                        <span className="font-medium text-sm">{cat.name}</span>
                        <span className="ml-3 text-xs text-gray-400">{cat.plotDimensions} · {cat.plotCount} políčok · {cat.categoryType === 'TEAM' ? 'Tímy' : 'Jednotlivci'}</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
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

        {tab === 'users' && (
          <div>
            <h2 className="font-semibold mb-3">Používatelia a roly</h2>
            {myRole === 'ADMIN' && (
              <form onSubmit={handleInvite} className="flex gap-2 mb-4">
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
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-blue-700 hover:bg-blue-50 hover:border-blue-200 truncate max-w-lg"
        >
          {url}
        </a>
        <button
          onClick={handleCopy}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 hover:bg-gray-50 shrink-0 text-gray-500"
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
}: {
  eventId: string;
  existing?: Category;
  onSave: (cat: Category) => void;
  onCancel: () => void;
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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end p-3 bg-gray-50 rounded border border-gray-200 mb-2">
      <input required placeholder="Názov" value={name} onChange={(e) => setName(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-48" />
      <input required placeholder="Rozmery (napr. 10×1,8 m)" value={plotDimensions} onChange={(e) => setPlotDimensions(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-36" />
      <input required type="number" min={1} placeholder="Počet políčok" value={plotCount} onChange={(e) => setPlotCount(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm w-28" />
      <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as 'INDIVIDUAL' | 'TEAM')} className="border border-gray-300 rounded px-2 py-1 text-sm">
        <option value="INDIVIDUAL">Jednotlivci</option>
        <option value="TEAM">Tímy</option>
      </select>
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={scored} onChange={(e) => setScored(e.target.checked)} />
        Hodnotená
      </label>
      <button type="submit" className="bg-green-700 text-white px-3 py-1 rounded text-sm hover:bg-green-800">Uložiť</button>
      <button type="button" onClick={onCancel} className="border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-100">Zrušiť</button>
    </form>
  );
}
