import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Bonjour, {user?.nom}</h2>
      <p className="mt-2 text-gray-600">
        Bienvenue sur votre tableau de bord. Ici s'afficheront vos QR codes récents et vos statistiques.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">QR codes</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Scans 7j</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">0</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-500">Scans uniques</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">0</div>
        </div>
      </div>
    </div>
  );
}
