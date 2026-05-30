import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { events as eventsApi, categories as categoriesApi, participants as participantsApi, auth, me as meApi } from '../../api/endpoints';
import type { PublicEvent, Category } from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { formatEventDate, toInputDate, fromInputDate } from '../../utils/time';
import Layout from '../../components/Layout';

export default function Register() {
  const { id } = useParams<{ id: string }>();
  const authUser = useAuthStore((s) => s.user);
  const storeLogin = useAuthStore((s) => s.login);
  const storeLogout = useAuthStore((s) => s.logout);

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', city: '', dateOfBirth: '', email: '', emailConsent: false, categoryId: '' });
  const [submitted, setSubmitted] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState<string | null>(null); // category name
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const applyMeStatus = (data: {
    registered: boolean;
    participant?: { firstName: string; lastName: string; entries: Array<{ category: { name: string } }> };
    profile: { firstName: string | null; lastName: string | null; email: string | null; city: string | null; dateOfBirth: string | null } | null;
  }) => {
    if (data.registered && data.participant) {
      setAlreadyRegistered(data.participant.entries[0]?.category?.name ?? '');
    } else if (data.profile) {
      const p = data.profile;
      setForm((f) => ({
        ...f,
        firstName: p.firstName ?? f.firstName,
        lastName: p.lastName ?? f.lastName,
        email: p.email ?? f.email,
        city: p.city ?? f.city,
        dateOfBirth: p.dateOfBirth ?? f.dateOfBirth,
      }));
    }
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [e, c, m] = await Promise.all([
          eventsApi.getPublic(id),
          categoriesApi.list(id),
          meApi.eventStatus(id),
        ]);
        setEvent(e.data);
        const indCats = c.data.filter((cat) => cat.categoryType === 'INDIVIDUAL');
        setCats(indCats);
        if (indCats.length > 0) setForm((f) => ({ ...f, categoryId: indCats[0].id }));
        applyMeStatus(m.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const r = await auth.login({ email: loginForm.email, password: loginForm.password });
      storeLogin(r.data.accessToken, r.data.user);
      setShowLogin(false);
      const m = await meApi.eventStatus(id!);
      applyMeStatus(m.data);
    } catch {
      setLoginError('Nesprávny email alebo heslo.');
    }
  };

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

  if (alreadyRegistered !== null) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold mb-2">Ste zaregistrovaný!</h1>
          <p className="text-gray-500 mb-1">{event.name}</p>
          {alreadyRegistered && <p className="text-gray-400 text-sm">{alreadyRegistered}</p>}
          <button onClick={() => { storeLogout(); setAlreadyRegistered(null); }} className="mt-6 text-xs text-gray-400 hover:underline">
            Odhlásiť sa
          </button>
        </div>
      </Layout>
    );
  }

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
        <p className="text-sm text-gray-500 mb-6">
          {formatEventDate(event.date)} · {event.location}
        </p>

        {/* Login / account section */}
        {authUser ? (
          <div className="flex items-center gap-2 mb-6 bg-green-50 border border-green-200 rounded px-4 py-2.5 text-sm">
            <span className="flex-1 text-green-800">
              Prihlásený ako <strong>{authUser.firstName} {authUser.lastName}</strong>
            </span>
            <button
              onClick={() => storeLogout()}
              className="text-xs text-gray-500 hover:underline shrink-0"
            >
              Odhlásiť
            </button>
          </div>
        ) : (
          <div className="mb-6">
            {!showLogin ? (
              <button
                onClick={() => setShowLogin(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Mám konto pretekára → Prihlásiť sa
              </button>
            ) : (
              <form onSubmit={handleLogin} className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Prihlásiť sa</p>
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  placeholder="Heslo"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                {loginError && <p className="text-sm text-red-600">{loginError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800">
                    Prihlásiť sa
                  </button>
                  <button type="button" onClick={() => setShowLogin(false)} className="text-sm text-gray-500 hover:underline">
                    Zrušiť
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <input
              type="date"
              value={toInputDate(form.dateOfBirth)}
              max={new Date().toISOString().split('T')[0]}
              min="1920-01-01"
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: fromInputDate(e.target.value) }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
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
