import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../api/endpoints';
import { useAuthStore } from '../../stores/authStore';
import Layout from '../../components/Layout';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await auth.login({ email, password });
      login(data.accessToken, data.user);
      navigate('/dashboard');
    } catch {
      setError('Nesprávny email alebo heslo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-2">SKoS</h1>
          <p className="text-center text-gray-500 text-sm mb-8">Správa koseckých podujatí</p>
          <form onSubmit={handleSubmit} className="space-y-4 border border-gray-200 rounded-lg p-6 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heslo</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? 'Prihlasovanie...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
