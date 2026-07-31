import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

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
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <div className="flex h-16 items-center px-6">
          <Link to="/" className="text-xl font-bold text-indigo-600">
            Free QR Code
          </Link>
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
            className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <Link to="/dashboard/settings" className="text-sm font-medium text-gray-700 hover:text-indigo-600">
            Mon compte
          </Link>
        </header>
        <main className="flex-1 p-8">
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
