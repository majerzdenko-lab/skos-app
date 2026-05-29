import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { events as eventsApi, auth } from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import { formatEventDate } from '../../utils/time';
import type { Event } from '../../api/endpoints';
import Layout from '../../components/Layout';

const STATUS_LABELS: Record<string, string> = {
  SETUP: 'Príprava',
  REGISTRATION: 'Registrácia',
  ACTIVE: 'Prebieha',
  CLOSED: 'Uzatvorené',
};

const STATUS_COLORS: Record<string, string> = {
  SETUP: 'bg-gray-100 text-gray-600',
  REGISTRATION: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  CLOSED: 'bg-amber-100 text-amber-700',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [eventList, setEventList] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  useEffect(() => {
    eventsApi.list().then((r) => setEventList(r.data)).finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await auth.logout();
    logout();
    navigate('/login');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await eventsApi.create({
      name: newEventName,
      date: new Date(newEventDate).toISOString(),
      location: newEventLocation,
    });
    setEventList((prev) => [data, ...prev]);
    setCreating(false);
    setNewEventName('');
    setNewEventDate('');
    setNewEventLocation('');
    navigate(`/events/${data.id}/setup`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Podujatia</h1>
            <p className="text-sm text-gray-500">
              {user?.email}
              {user?.systemRole === 'ADMIN' && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Systémový administrátor</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCreating(true)}
              className="bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800"
            >
              + Nové podujatie
            </button>
            <button
              onClick={handleLogout}
              className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50"
            >
              Odhlásiť
            </button>
          </div>
        </div>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-4 border border-gray-200 rounded-lg space-y-3 bg-gray-50"
          >
            <h2 className="font-semibold text-sm">Nové podujatie</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                required
                placeholder="Názov podujatia"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                required
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Miesto"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-green-700 text-white px-4 py-1.5 rounded text-sm hover:bg-green-800">
                Vytvoriť
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-100"
              >
                Zrušiť
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Načítavanie...</p>
        ) : eventList.length === 0 ? (
          <p className="text-gray-400 text-sm">Zatiaľ žiadne podujatia.</p>
        ) : (
          <div className="space-y-3">
            {eventList.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}/setup`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-green-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{event.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatEventDate(event.date)} · {event.location}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status]}`}
                  >
                    {STATUS_LABELS[event.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
