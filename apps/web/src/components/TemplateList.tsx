import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ModeleQR, TypeContenuQR } from '@free-qr/shared-types';
 import { buildPreviewUrl } from '@/lib/qrPreview';


interface TemplateListProps {
  templates: ModeleQR[];
  onDelete?: (id: string) => void;
}

const typeLabels: Record<TypeContenuQR, string> = {
  url: 'URL',
  texte: 'Texte',
  email: 'Email',
  telephone: 'Téléphone',
  sms: 'SMS',
  wifi: 'Wi-Fi',
  vcard: 'vCard',
  geo: 'Géo',
  pdf: 'PDF',
};

export function TemplateList({ templates, onDelete }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-600">Aucun modèle pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} onDelete={onDelete} />
      ))}
    </div>
  );
}

interface TemplateCardProps {
  template: ModeleQR;
  onDelete?: (id: string) => void;
}

function TemplateCard({ template, onDelete }: TemplateCardProps) {
  const previewUrl = useMemo(() => {
    return buildPreviewUrl('https://example.com', template.parametresParDefaut, template.parametresParDefaut?.taille ?? 300);
  }, [template]);

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center justify-center">
        {previewUrl ? (
          <img
          src={previewUrl}
          alt={`Aperçu de ${template.nom}`}
          className="h-24 w-24 rounded-md border border-gray-100 bg-white object-contain p-1"
        />
        ) : (
         <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
           QR
         </div>
       ) }
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-gray-900">{template.nom}</h3>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${template.estPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {template.estPublic ? 'Public' : 'Privé'}
          </span>
        </div>
        {template.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{template.description}</p>}
        <p className="mt-2 text-xs text-gray-500">
          Type : {typeLabels[template.typeContenu] ?? template.typeContenu}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          to={`/admin/templates?edit=${template.id}`}
          className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          Modifier
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(template.id)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
