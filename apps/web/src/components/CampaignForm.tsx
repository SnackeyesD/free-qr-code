import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CibleCampagneEmail } from '@free-qr/shared-types';

const campaignFormSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  sujet: z.string().min(1, 'Le sujet est requis'),
  corpsHtml: z.string().min(1, 'Le contenu HTML est requis'),
  corpsTexte: z.string().optional(),
  cible: z.enum(['tous', 'actifs', 'inactifs', 'non_verifies', 'consentants'] as const),
});

export type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  defaultValues?: Partial<CampaignFormData>;
  onSubmit: (data: CampaignFormData) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const cibles: { value: CibleCampagneEmail; label: string }[] = [
  { value: 'tous', label: 'Tous les utilisateurs' },
  { value: 'actifs', label: 'Utilisateurs actifs' },
  { value: 'inactifs', label: 'Utilisateurs inactifs' },
  { value: 'non_verifies', label: 'Utilisateurs non vérifiés' },
  { value: 'consentants', label: 'Utilisateurs consentants marketing' },
];

export function CampaignForm({ defaultValues, onSubmit, onCancel, isSubmitting, submitLabel }: CampaignFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      nom: '',
      sujet: '',
      corpsHtml: '',
      corpsTexte: '',
      cible: 'tous',
      ...defaultValues,
    },
  });

  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="nom" className="block text-sm font-medium text-gray-700">
          Nom de la campagne
        </label>
        <input
          id="nom"
          type="text"
          {...register('nom')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errors.nom && <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>}
      </div>

      <div>
        <label htmlFor="sujet" className="block text-sm font-medium text-gray-700">
          Sujet de l'email
        </label>
        <input
          id="sujet"
          type="text"
          {...register('sujet')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errors.sujet && <p className="mt-1 text-sm text-red-600">{errors.sujet.message}</p>}
      </div>

      <div>
        <label htmlFor="cible" className="block text-sm font-medium text-gray-700">
          Cible
        </label>
        <select
          id="cible"
          {...register('cible')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          {cibles.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-gray-700">Programmation</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              value="now"
              checked={sendMode === 'now'}
              onChange={() => setSendMode('now')}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="text-sm text-gray-700">Envoi immédiat</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sendMode"
              value="scheduled"
              checked={sendMode === 'scheduled'}
              onChange={() => { setSendMode('scheduled'); setShowSchedule(true); }}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="text-sm text-gray-700">Programmée</span>
          </label>
        </div>

        {showSchedule && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        )}
      </div>

      <div>
        <label htmlFor="corpsHtml" className="block text-sm font-medium text-gray-700">
          Contenu HTML
        </label>
        <textarea
          id="corpsHtml"
          rows={10}
          {...register('corpsHtml')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
        {errors.corpsHtml && <p className="mt-1 text-sm text-red-600">{errors.corpsHtml.message}</p>}
      </div>

      <div>
        <label htmlFor="corpsTexte" className="block text-sm font-medium text-gray-700">
          Version texte (optionnel)
        </label>
        <textarea
          id="corpsTexte"
          rows={4}
          {...register('corpsTexte')}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="unsubscribe"
          type="checkbox"
          defaultChecked
          disabled
          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
        />
        <label htmlFor="unsubscribe" className="text-sm text-gray-700">
          Inclure le lien de désinscription obligatoire
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Enregistrement…' : (submitLabel ?? 'Enregistrer')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
