import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { z } from 'zod';
import type { QRCodeDesign, TypeContenuQR } from '@free-qr/shared-types';
 import { buildPreviewUrl } from '@/lib/qrPreview';


const templateFormSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  type: z.enum(['statique', 'dynamique'] as const),
  contenu: z.string().min(1, 'Le contenu est requis'),
  estPublic: z.boolean(),
  categorie: z.string().optional(),
  typeContenu: z.enum(['url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf'] as const),
  taille: z.coerce.number().min(100).max(2000).default(300),
  correction: z.enum(['L', 'M', 'Q', 'H'] as const).default('M'),
  couleur: z.string().default('#000000'),
  background: z.string().default('#FFFFFF'),
});

export type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  defaultValues?: Partial<TemplateFormData>;
  onSubmit: (data: TemplateFormData) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const typeContenuOptions: { value: TypeContenuQR; label: string }[] = [
  { value: 'url', label: 'URL' },
  { value: 'texte', label: 'Texte' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'sms', label: 'SMS' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'vcard', label: 'vCard' },
  { value: 'geo', label: 'Géolocalisation' },
  { value: 'pdf', label: 'PDF' },
];

export function buildTemplateDesignFromForm(data: TemplateFormData): QRCodeDesign {
  return {
    taille: data.taille,
    correction: data.correction,
    couleur: data.couleur,
    background: data.background,
  };
}

function useMemoPreviewUrl(
  contenu: string,
  typeContenu: TypeContenuQR,
  couleur: string,
  background: string,
  taille: number,
  correction: string,
): string | null {
  return useMemo(() => {
    if (!contenu) return null;
    let data = contenu;
    if (typeContenu === 'url') {
      try {
        new URL(contenu);
      } catch {
        data = `https://${contenu}`;
      }
    }
    return buildPreviewUrl(data, { couleur, background, correction }, taille);
  }, [contenu, typeContenu, couleur, background, taille, correction]);
}

export function TemplateForm({ defaultValues, onSubmit, onCancel, isSubmitting, submitLabel }: TemplateFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      nom: '',
      description: '',
      type: 'statique',
      contenu: '',
      estPublic: false,
      categorie: '',
      typeContenu: 'url',
      taille: 300,
      correction: 'M',
      couleur: '#000000',
      background: '#FFFFFF',
      ...defaultValues,
    },
  });

  const typeContenu = watch('typeContenu');
  const couleur = watch('couleur');
  const background = watch('background');
  const taille = watch('taille');
  const correction = watch('correction');
  const contenu = watch('contenu');

  const previewUrl = useMemoPreviewUrl(contenu, typeContenu, couleur, background, taille, correction);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 rounded-lg bg-white p-6 shadow-sm lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <label htmlFor="nom" className="block text-sm font-medium text-gray-700">
            Nom du modèle
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
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            {...register('description')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="type"
              {...register('type')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="statique">Statique</option>
              <option value="dynamique">Dynamique</option>
            </select>
          </div>
          <div>
            <label htmlFor="typeContenu" className="block text-sm font-medium text-gray-700">Contenu</label>
            <select
              id="typeContenu"
              {...register('typeContenu')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              {typeContenuOptions.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="contenu" className="block text-sm font-medium text-gray-700">
            Contenu par défaut
          </label>
          <textarea
            id="contenu"
            rows={4}
            {...register('contenu')}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
          {errors.contenu && <p className="mt-1 text-sm text-red-600">{errors.contenu.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <input
            id="estPublic"
            type="checkbox"
            {...register('estPublic')}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="estPublic" className="text-sm text-gray-700">
            Modèle public (visible par tous les utilisateurs)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="taille" className="block text-sm font-medium text-gray-700">Taille (px)</label>
            <input
              id="taille"
              type="number"
              {...register('taille')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="correction" className="block text-sm font-medium text-gray-700">Correction</label>
            <select
              id="correction"
              {...register('correction')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="L">L (7%)</option>
              <option value="M">M (15%)</option>
              <option value="Q">Q (25%)</option>
              <option value="H">H (30%)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="couleur" className="block text-sm font-medium text-gray-700">Couleur principale</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="couleur"
                type="color"
                {...register('couleur')}
                className="h-10 w-12 rounded border border-gray-300 p-1"
              />
              <input
                type="text"
                {...register('couleur')}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="background" className="block text-sm font-medium text-gray-700">Couleur de fond</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="background"
                type="color"
                {...register('background')}
                className="h-10 w-12 rounded border border-gray-300 p-1"
              />
              <input
                type="text"
                {...register('background')}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          </div>
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
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6">
        <span className="mb-3 text-sm font-medium text-gray-700">Aperçu</span>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Aperçu du modèle QR"
            className="rounded-md border border-gray-200 bg-white p-2"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-md bg-white text-sm text-gray-400">
            Saisissez un contenu
          </div>
        )}
      </div>
    </form>
  );
}
