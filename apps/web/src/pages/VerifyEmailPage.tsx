import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
        {status === 'loading' && <p>Confirmation en cours…</p>}
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Email confirmé !</h1>
            <p className="mt-2 text-gray-600">
              Votre compte est maintenant actif.{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Connectez-vous
              </Link>
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Lien invalide</h1>
            <p className="mt-2 text-gray-600">
              Le lien de confirmation est invalide ou a expiré.{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
                Se connecter
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
