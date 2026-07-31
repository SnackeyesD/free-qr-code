import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignForm, type CampaignFormData } from '@/components/CampaignForm';
import { useCampaigns } from '@/hooks/useCampaigns';

export default function AdminCampaignCreatePage() {
  const navigate = useNavigate();
  const { createCampaign } = useCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CampaignFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createCampaign(data);
      navigate('/admin/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la campagne');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Nouvelle campagne email</h2>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <CampaignForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/campaigns')}
        isSubmitting={isSubmitting}
        submitLabel="Créer et envoyer"
      />
    </div>
  );
}
