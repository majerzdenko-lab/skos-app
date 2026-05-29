import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { auth as authApi, events as eventsApi } from '../api/endpoints';
import type { Role } from '../api/endpoints';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrátor',
  REGISTRAR: 'Registrátor',
  JUDGE: 'Rozhodca',
  COMPETITOR: 'Súťažiaci',
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: 'bg-green-100 text-green-800',
  REGISTRAR: 'bg-blue-100 text-blue-800',
  JUDGE: 'bg-amber-100 text-amber-800',
  COMPETITOR: 'bg-gray-100 text-gray-700',
};

export default function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { id: eventId } = useParams<{ id: string }>();
  const [eventRole, setEventRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!eventId || !user) { setEventRole(null); return; }
    eventsApi.getMyRole(eventId)
      .then((r) => setEventRole(r.data.role))
      .catch(() => setEventRole(null));
  }, [eventId, user]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 h-28 flex items-center justify-between gap-4">

        {/* SKoS logo */}
        <div className="flex items-center shrink-0">
          <img src="/skos-logo.jpg" alt="Slovenský kosecký spolok" className="h-24 w-auto" />
        </div>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 text-sm">
            {eventRole && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline ${ROLE_COLORS[eventRole]}`}>
                {ROLE_LABELS[eventRole]}
              </span>
            )}
            <span className="text-gray-700 hidden sm:block">
              {user.firstName} {user.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-700 text-xs border border-gray-200 rounded px-2 py-1"
            >
              Odhlásiť
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
