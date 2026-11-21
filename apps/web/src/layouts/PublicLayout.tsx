import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p>Chargement…</p>
      </div>
    );
  }

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  if (user && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-indigo-600 sm:text-xl">
              <Logo className="h-7 w-7 shrink-0" />
              Free QR Code
            </Link>
            <nav className="flex items-center gap-2 sm:gap-4" aria-label="Navigation publique">
              <Link to="/features" className="hidden text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600 sm:inline-block">
                Fonctionnalités
              </Link>
              <Link to="/pricing" className="hidden text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600 sm:inline-block">
                Tarifs
              </Link>
              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="whitespace-nowrap text-sm font-semibold text-gray-900 transition-colors hover:text-indigo-600">
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    className="whitespace-nowrap rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                  >
                    S'inscrire
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children || <Outlet />}
      </main>
      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Free QR Code —{' '}
          <Link to="/legal/privacy" className="hover:text-indigo-600">Confidentialité</Link> —{' '}
          <Link to="/legal/terms" className="hover:text-indigo-600">Conditions</Link>
        </div>
      </footer>
    </div>
  );
}
