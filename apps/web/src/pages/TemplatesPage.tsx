import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ModeleQR, TypeContenuQR } from '@free-qr/shared-types';
import { usePublicTemplates } from '@/hooks/usePublicTemplates';
import { buildTemplatePreviewUrl } from '@/lib/qrPreview';
import { QR_CONTENT_OPTIONS } from '@/lib/qrForm';

const typeLabels = Object.fromEntries(
  QR_CONTENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TypeContenuQR, string>;

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { templates, total, isLoading, error, refetch } = usePublicTemplates();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'tous' | TypeContenuQR>('tous');

  const filteredTemplates = useMemo(() => {
    const query = normalizeText(search.trim());
    return templates.filter((template) => {
      if (typeFilter !== 'tous' && template.typeContenu !== typeFilter) {
        return false;
      }
      if (!query) return true;
      return (
        normalizeText(template.nom).includes(query) ||
        normalizeText(template.description ?? '').includes(query)
      );
    });
  }, [templates, search, typeFilter]);

  const hasFilters = search.trim().length > 0 || typeFilter !== 'tous';

  const utiliserModele = (template: ModeleQR) => {
    navigate(`/dashboard/qr/new?modele=${encodeURIComponent(template.id)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Modèles publics</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Partez d&apos;un design prêt à l&apos;emploi : le type de contenu et le
            style du QR sont préremplis. Vous gardez la main sur le contenu et
            pouvez tout ajuster avant de créer.
          </p>
        </div>
        <Link
          to="/dashboard/qr/new"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Créer sans modèle
        </Link>
      </div>

      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-red-100 px-3 py-1.5 font-semibold text-red-800 hover:bg-red-200"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <div className="w-full sm:w-72">
          <label htmlFor="template-search" className="sr-only">
            Rechercher un modèle
          </label>
          <input
            id="template-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un modèle…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="template-type" className="sr-only">
            Filtrer par type de contenu
          </label>
          <select
            id="template-type"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as 'tous' | TypeContenuQR)
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="tous">Tous les contenus</option>
            {QR_CONTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTypeFilter('tous');
            }}
            className="rounded-md px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Réinitialiser
          </button>
        )}

        {!isLoading && !error && (
          <p className="ml-auto text-sm text-gray-500">
            {filteredTemplates.length} modèle
            {filteredTemplates.length !== 1 ? 's' : ''}
            {hasFilters ? ` sur ${total}` : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-label="Chargement des modèles publics"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mx-auto h-32 w-32 rounded-md bg-gray-100" />
              <div className="mt-4 h-4 w-2/3 rounded bg-gray-100" />
              <div className="mt-2 h-3 w-full rounded bg-gray-100" />
              <div className="mt-2 h-3 w-4/5 rounded bg-gray-100" />
              <div className="mt-5 h-9 w-full rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onReset={() => {
          setSearch('');
          setTypeFilter('tous');
        }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => utiliserModele(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
      <p className="text-base font-semibold text-gray-900">
        {hasFilters
          ? 'Aucun modèle ne correspond à votre recherche'
          : 'La galerie est vide pour le moment'}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        {hasFilters
          ? 'Essayez un autre mot-clé ou affichez tous les types de contenu.'
          : 'Vous pouvez créer un QR code dès maintenant avec vos propres couleurs et votre propre contenu.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Réinitialiser les filtres
          </button>
        )}
        <Link
          to="/dashboard/qr/new"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Créer un QR code
        </Link>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: ModeleQR;
  onUse: () => void;
}) {
  const previewUrl = useMemo(
    () => buildTemplatePreviewUrl(template, 240),
    [template],
  );

  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-center rounded-md bg-gray-50 p-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Aperçu du modèle ${template.nom}`}
            className="h-32 w-32 rounded-md border border-gray-100 bg-white object-contain p-1"
            loading="lazy"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
            Aperçu indisponible
          </div>
        )}
      </div>

      <div className="mt-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">{template.nom}</h3>
          <span className="inline-flex shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {typeLabels[template.typeContenu] ?? template.typeContenu}
          </span>
        </div>
        {template.description && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {template.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span
            className="h-4 w-4 rounded-full border border-gray-200"
            style={{ backgroundColor: template.parametresParDefaut?.couleur ?? '#000000' }}
            title={`Couleur ${template.parametresParDefaut?.couleur ?? '#000000'}`}
          />
          <span
            className="h-4 w-4 rounded-full border border-gray-200"
            style={{ backgroundColor: template.parametresParDefaut?.background ?? '#FFFFFF' }}
            title={`Fond ${template.parametresParDefaut?.background ?? '#FFFFFF'}`}
          />
          <span>Correction {template.parametresParDefaut?.correction ?? 'M'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onUse}
        className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
      >
        Utiliser ce modèle
      </button>
    </article>
  );
}
