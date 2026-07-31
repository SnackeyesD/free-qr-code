import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CampaignForm, type CampaignFormData } from '@/components/CampaignForm';
import { useCampaign } from '@/hooks/useCampaigns';

export default function AdminCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaign, isLoading, error, updateCampaign, sendCampaign, cancelCampaign } = useCampaign(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSubmit = async (data: CampaignFormData) => {
    if (!id) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await updateCampaign(data);
      navigate('/admin/campaigns');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!campaign) return;
    if (!confirm('Envoyer cette campagne maintenant ?')) return;
    setActionError(null);
    try {
      await sendCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    }
  };

  const handleCancel = async () => {
    if (!campaign) return;
    if (!confirm('Annuler cette campagne ?')) return;
    setActionError(null);
    try {
      await cancelCampaign();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error ?? 'Campagne introuvable'}
        </div>
        <Link to="/admin/campaigns" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← Retour aux campagnes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/campaigns" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            ← Retour aux campagnes
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{campaign.nom}</h2>
        </div>
        <div className="flex items-center gap-2">
          {(campaign.statut === 'brouillon' || campaign.statut === 'programmee') && (
            <button
              type="button"
              onClick={() => void handleSend()}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Envoyer maintenant
            </button>
          )}
          {campaign.statut === 'programmee' && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              className="rounded-md bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-100"
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Ouvertures</p>
          <p className="text-2xl font-bold text-gray-900">{campaign.nombreOuvertures}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Clics</p>
          <p className="text-2xl font-bold text-gray-900">{campaign.nombreClics}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Statut</p>
          <p className="text-2xl font-bold text-gray-900">{campaign.statut}</p>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}

      <CampaignForm
        defaultValues={{
          nom: campaign.nom,
          sujet: campaign.sujet,
          corpsHtml: campaign.corpsHtml,
          corpsTexte: campaign.corpsTexte ?? '',
          cible: campaign.cible,
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/campaigns')}
        isSubmitting={isSubmitting}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
