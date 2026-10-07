import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';

const navItems = [
  { to: '/dashboard', label: "Vue d'ensemble" },
  { to: '/dashboard/qr', label: 'Mes QR codes' },
  { to: '/dashboard/qr/new', label: "Créer un QR" },
  { to: '/dashboard/templates', label: 'Modèles publics' },
  { to: '/dashboard/api-keys', label: 'Clés API' },
  { to: '/dashboard/settings', label: 'Paramètres' },
];

const adminItems = [
  { to: '/admin', label: 'Vue admin' },
  { to: '/admin/campaigns', label: 'Campagnes' },
  { to: '/admin/templates', label: 'Modèles QR' },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/metrics', label: 'Métriques' },
];

export function DashboardLayout() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Ferme le drawer à chaque navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Échap + scroll lock pendant que le drawer est ouvert
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p>Chargement…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="flex min-h-screen">
      {menuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
        />
      )}
      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white motion-safe:transition-transform motion-safe:duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-600">
            <Logo className="h-7 w-7 shrink-0" />
            Free QR Code
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label="Menu dashboard" className="flex-1 space-y-1 px-4 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Administration
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 px-3 text-sm font-medium text-gray-900">{user.nom}</div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200"
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="dashboard-sidebar"
              aria-label="Ouvrir le menu"
              className="rounded-md p-1.5 text-gray-700 transition-colors hover:bg-gray-100 lg:hidden"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          </div>
          <Link to="/dashboard/settings" className="whitespace-nowrap text-sm font-medium text-gray-700 transition-colors hover:text-indigo-600">
            Mon compte
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <p>Chargement…</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
