import { Link, useSearchParams } from 'react-router-dom';
import { QRCreateForm } from '@/components/QRForm';
import { usePublicTemplate } from '@/hooks/usePublicTemplates';
import { QR_CONTENT_OPTIONS } from '@/lib/qrForm';

export default function QRCreatePage() {
  const [searchParams] = useSearchParams();
  const modeleId = searchParams.get('modele') ?? undefined;
  const { template, isLoading, error } = usePublicTemplate(modeleId);
  const typeLabel = template
    ? QR_CONTENT_OPTIONS.find((option) => option.value === template.typeContenu)
        ?.label ?? template.typeContenu
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Créer un QR code</h2>
        <p className="mt-1 text-sm text-gray-600">
          Choisissez le type de contenu, personnalisez le design et prévisualisez avant de créer.
        </p>
      </div>

      {modeleId && isLoading ? (
        <div className="flex items-center justify-center rounded-lg bg-white py-12 shadow-sm" role="status">
          <p className="text-gray-600">Chargement du modèle…</p>
        </div>
      ) : (
        <>
          {template && (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
              <div>
                <p>
                  Modèle <strong>{template.nom}</strong> appliqué : type{' '}
                  <strong>{typeLabel}</strong> et design préremplis.
                </p>
                <p className="mt-1 text-indigo-800">
                  Le contenu reste à saisir. Vous pouvez modifier le design et le
                  type avant de créer.
                </p>
              </div>
              <Link
                to="/dashboard/qr/new"
                className="shrink-0 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
              >
                Retirer le modèle
              </Link>
            </div>
          )}

          {modeleId && !isLoading && error && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="alert">
              Ce modèle public est introuvable ou n&apos;est plus disponible. Le
              formulaire reste utilisable avec les valeurs par défaut.
            </div>
          )}

          <QRCreateForm
            key={template?.id ?? 'sans-modele'}
            template={template}
          />
        </>
      )}
    </div>
  );
}
