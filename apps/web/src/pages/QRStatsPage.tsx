import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQRStats } from '@/hooks/useQRStats';

export default function QRStatsPage() {
  const { id } = useParams<{ id: string }>();
  const { stats, dailyStats, recentScans, isLoading, error, period, setPeriod } = useQRStats(id);

  const deviceEntries = useMemo(() => {
    if (!stats?.appareils) return [];
    return Object.entries(stats.appareils).sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const countryEntries = useMemo(() => {
    if (!stats?.pays) return [];
    return Object.entries(stats.pays).sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const maxDaily = useMemo(() => {
    if (!dailyStats.length) return 0;
    return Math.max(...dailyStats.map((d) => d.nombreScans));
  }, [dailyStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
        <Link
          to="/dashboard/qr"
          className="inline-flex rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Statistiques</h2>
          <p className="mt-1 text-sm text-gray-600">
            Performance du QR code sur la période sélectionnée.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          <option value="24h">24 dernières heures</option>
          <option value="7j">7 derniers jours</option>
          <option value="30j">30 derniers jours</option>
          <option value="90j">90 derniers jours</option>
          <option value="1an">1 an</option>
        </select>
        <Link
          to={`/dashboard/qr/${id}`}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Retour au détail
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total scans</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.totalScans ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Scans uniques</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats?.scansUniques ?? 0}</p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Taux d'unicité</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {stats?.totalScans
              ? `${Math.round((stats.scansUniques / stats.totalScans) * 100)}%`
              : '0%'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Appareils</h3>
          {deviceEntries.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Aucune donnée disponible.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {deviceEntries.map(([device, count]) => (
                <li key={device} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{device}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Pays</h3>
          {countryEntries.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Aucune donnée disponible.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {countryEntries.map(([country, count]) => (
                <li key={country} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{country}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Scans par jour</h3>
        {dailyStats.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucune donnée disponible.</p>
        ) : (
          <div className="mt-4 flex items-end gap-1 overflow-x-auto">
            {dailyStats.map((day) => {
              const height = maxDaily ? `${Math.max((day.nombreScans / maxDaily) * 100, 4)}%` : '4%';
              const label = new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
              return (
                <div key={day.id} className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 rounded-t bg-indigo-600"
                    style={{ height }}
                    title={`${label}: ${day.nombreScans} scans`}
                  />
                  <span className="text-[10px] text-gray-500">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Scans récents</h3>
        {recentScans.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucun scan récent.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="pb-2 text-left font-medium text-gray-500">Date</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Pays</th>
                  <th className="pb-2 text-left font-medium text-gray-500">Appareil</th>
                  <th className="pb-2 text-left font-medium text-gray-500">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentScans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="py-2 text-gray-900">
                      {new Date(scan.dateScan).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-2 text-gray-700">{scan.pays || '—'}</td>
                    <td className="py-2 text-gray-700">{scan.userAgent || '—'}</td>
                    <td className="py-2 text-gray-700">{scan.adresseIP}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
