import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { toQRCodeListItem, type RecentQRCode, type TopQRCode } from '@/lib/dashboardApi';
import type { QRCode } from '@free-qr/shared-types';

function formatDate(value: Date | string | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function QRPreviewImage({ qr }: { qr: QRCode }) {
  if (qr.urlImage) {
    return (
      <img
        src={qr.urlImage}
        alt=""
        className="h-12 w-12 rounded-md border border-gray-100 bg-white object-contain p-0.5"
      />
    );
  }

  const params = new URLSearchParams();
  params.set('data', qr.contenu);
  if (qr.parametres?.couleur) params.set('color', String(qr.parametres.couleur).replace('#', ''));
  if (qr.parametres?.background) params.set('bgcolor', String(qr.parametres.background).replace('#', ''));
  params.set('size', '80');
  if (qr.parametres?.correction) params.set('level', qr.parametres.correction);
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`}
      alt=""
      className="h-12 w-12 rounded-md border border-gray-100 bg-white object-contain p-0.5"
    />
  );
}

function QRListItem({ qr, showScans }: { qr: QRCode; showScans?: boolean }) {
  const typeLabel = qr.estDynamique ? 'Dynamique' : 'Statique';
  const typeClass = qr.estDynamique
    ? 'bg-indigo-100 text-indigo-800'
    : 'bg-gray-100 text-gray-800';

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <QRPreviewImage qr={qr} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeClass}`}>
            {typeLabel}
          </span>
          <span className={`text-xs ${qr.estActif ? 'text-green-600' : 'text-red-600'}`}>
            {qr.estActif ? 'Actif' : 'Inactif'}
          </span>
        </div>
        <Link
          to={`/dashboard/qr/${qr.id}`}
          className="mt-0.5 block truncate text-sm font-semibold text-gray-900 hover:text-indigo-600"
          title={qr.aliasCourt || qr.contenu}
        >
          {qr.aliasCourt || qr.contenu}
        </Link>
        <p className="truncate text-xs text-gray-500" title={qr.contenu}>
          {qr.contenu}
        </p>
      </div>
      {showScans && (
        <div className="text-right text-sm">
          <div className="font-semibold text-gray-900">{qr.nombreScansTotal}</div>
          <div className="text-xs text-gray-500">scan{qr.nombreScansTotal !== 1 ? 's' : ''}</div>
        </div>
      )}
      <div className="text-right text-xs text-gray-500">
        <div>{formatDate(qr.dateCreation)}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, isLoading, error, refetch } = useDashboardStats();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bonjour, {user?.nom}</h2>
          <p className="mt-2 text-gray-600">
            Bienvenue sur votre tableau de bord. Voici un aperçu de vos QR codes et de leurs performances.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/qr/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Créer un QR
          </Link>
          <Link
            to="/dashboard/qr"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Voir tous mes QR
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-2 font-semibold underline hover:text-red-800"
          >
            Réessayer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">QR codes</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{stats?.totalQRCodes ?? 0}</div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">Scans 7j</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{stats?.scans7j ?? 0}</div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">Scans uniques 7j</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{stats?.scansUniques7j ?? 0}</div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-medium text-gray-500">Total scans</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{stats?.totalScans ?? 0}</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">QR codes récents</h3>
                <Link
                  to="/dashboard/qr"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Voir tout
                </Link>
              </div>
              {stats?.recentQRCodes && stats.recentQRCodes.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentQRCodes.map((qr: RecentQRCode) => (
                    <QRListItem key={qr.id} qr={toQRCodeListItem(qr)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-600">Aucun QR code pour le moment.</p>
                  <Link
                    to="/dashboard/qr/new"
                    className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    Créer un QR code
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Top QR codes</h3>
                <Link
                  to="/dashboard/qr"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Voir tout
                </Link>
              </div>
              {stats?.topQRcodes && stats.topQRcodes.length > 0 ? (
                <div className="space-y-3">
                  {stats.topQRcodes.map((qr: TopQRCode) => (
                    <QRListItem key={qr.id} qr={toQRCodeListItem(qr)} showScans />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-600">Aucune donnée de scan pour le moment.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
