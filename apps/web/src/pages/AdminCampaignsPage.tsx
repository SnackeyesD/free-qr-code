import { Link } from 'react-router-dom';
import { CampaignList } from '@/components/CampaignList';
import { useCampaigns } from '@/hooks/useCampaigns';

export default function AdminCampaignsPage() {
  const {
    campaigns,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    deleteCampaign,
    sendCampaign,
    cancelCampaign,
  } = useCampaigns();

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cette campagne ?')) return;
    await deleteCampaign(id);
  };

  const handleSend = async (id: string) => {
    if (!confirm('Envoyer cette campagne maintenant ?')) return;
    await sendCampaign(id);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Annuler cette campagne programmée ?')) return;
    await cancelCampaign(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Campagnes email</h2>
        <Link
          to="/admin/campaigns/new"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nouvelle
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Rechercher une campagne..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:w-72"
        />

        <select
          value={filters.statut}
          onChange={(e) => setFilters({ statut: e.target.value as typeof filters.statut })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="programmee">Programmée</option>
          <option value="envoyee">Envoyée</option>
          <option value="annulee">Annulée</option>
        </select>

        <select
          value={filters.limit}
          onChange={(e) => setFilters({ limit: Number(e.target.value) })}
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
        <CampaignList
          campaigns={campaigns}
          onDelete={handleDelete}
          onSend={handleSend}
          onCancel={handleCancel}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ page: filters.page - 1 })}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {filters.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters({ page: filters.page + 1 })}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {total} campagne{total !== 1 ? 's' : ''} au total
      </p>
    </div>
  );
}
