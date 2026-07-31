import { Link } from 'react-router-dom';
import { QRCodeList } from '@/components/QRCodeList';
import { useQRList } from '@/hooks/useQRList';

export default function QRListPage() {
  const {
    qrcodes,
    total,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    type,
    setType,
    isLoading,
    error,
    refetch,
  } = useQRList();

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement ce QR code ?')) return;
    await import('@/lib/qrApi').then((m) => m.qrApi.remove(id));
    await refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Mes QR codes</h2>
        <Link
          to="/dashboard/qr/new"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nouveau
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un QR code..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:w-72"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          <option value="tous">Tous les types</option>
          <option value="statique">Statiques</option>
          <option value="dynamique">Dynamiques</option>
        </select>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          {[6, 12, 24, 48].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement…</p>
        </div>
      ) : (
        <QRCodeList qrcodes={qrcodes} onDelete={handleDelete} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {total} QR code{total !== 1 ? 's' : ''} au total
      </p>
    </div>
  );
}
