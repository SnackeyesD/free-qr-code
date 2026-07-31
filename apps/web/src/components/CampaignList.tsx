import { useMemo } from 'react';
import type { CampagneEmail, StatutCampagneEmail } from '@free-qr/shared-types';

interface CampaignListProps {
  campaigns: CampagneEmail[];
  onDelete?: (id: string) => void;
  onSend?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDuplicate?: (campaign: CampagneEmail) => void;
}

const statusLabels: Record<StatutCampagneEmail, string> = {
  brouillon: 'Brouillon',
  programmee: 'Programmée',
  envoyee: 'Envoyée',
  annulee: 'Annulée',
};

const statusClasses: Record<StatutCampagneEmail, string> = {
  brouillon: 'bg-gray-100 text-gray-800',
  programmee: 'bg-indigo-100 text-indigo-800',
  envoyee: 'bg-green-100 text-green-800',
  annulee: 'bg-red-100 text-red-800',
};

const cibleLabels: Record<string, string> = {
  tous: 'Tous',
  actifs: 'Actifs',
  inactifs: 'Inactifs',
  non_verifies: 'Non vérifiés',
  consentants: 'Consentants',
};

export function CampaignList({ campaigns, onDelete, onSend, onCancel, onDuplicate }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-600">Aucune campagne pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          onDelete={onDelete}
          onSend={onSend}
          onCancel={onCancel}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}

interface CampaignCardProps {
  campaign: CampagneEmail;
  onDelete?: (id: string) => void;
  onSend?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDuplicate?: (campaign: CampagneEmail) => void;
}

function CampaignCard({ campaign, onDelete, onSend, onCancel, onDuplicate }: CampaignCardProps) {
  const ouvertureRate = useMemo(() => {
    if (!campaign.nombreOuvertures && !campaign.nombreClics) return null;
    return { ouvertures: campaign.nombreOuvertures, clics: campaign.nombreClics };
  }, [campaign]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900">{campaign.nom}</h3>
          <p className="text-sm text-gray-600">Sujet : {campaign.sujet}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${statusClasses[campaign.statut]}`}>
              {statusLabels[campaign.statut]}
            </span>
            <span className="text-gray-500">
              Cible : {cibleLabels[campaign.cible] ?? campaign.cible}
            </span>
            {campaign.dateEnvoi && (
              <span className="text-gray-500">
                Envoi : {new Date(campaign.dateEnvoi).toLocaleString('fr-FR')}
              </span>
            )}
          </div>
          {ouvertureRate && (
            <div className="mt-2 flex gap-4 text-xs text-gray-600">
              <span>Ouvertures : {ouvertureRate.ouvertures}</span>
              <span>Clics : {ouvertureRate.clics}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(campaign.statut === 'brouillon' || campaign.statut === 'programmee') && onSend && (
            <button
              type="button"
              onClick={() => onSend(campaign.id)}
              className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {campaign.statut === 'programmee' ? 'Envoyer maintenant' : 'Envoyer'}
            </button>
          )}
          {campaign.statut === 'programmee' && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(campaign.id)}
              className="rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
            >
              Annuler
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(campaign)}
              className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Dupliquer
            </button>
          )}
          <a
            href={`/admin/campaigns/${campaign.id}`}
            className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            Détails
          </a>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(campaign.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
