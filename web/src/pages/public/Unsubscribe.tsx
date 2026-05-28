import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../../api/client';
import Layout from '../../components/Layout';

export default function Unsubscribe() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    client.get(`/api/unsubscribe/${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        {status === 'loading' && <p className="text-gray-400">Spracovávam...</p>}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-xl font-bold mb-2">Odhlásenie úspešné</h1>
            <p className="text-gray-500">Váš email bol odhlásený z odberu správ SKoS.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold mb-2">Neplatný odkaz</h1>
            <p className="text-gray-500">Tento odkaz na odhlásenie je neplatný alebo vypršal.</p>
          </>
        )}
      </div>
    </Layout>
  );
}
