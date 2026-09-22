import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TemplateForm, type TemplateFormData } from '@/components/TemplateForm';
import { buildTemplateDesignFromForm } from '@/components/TemplateForm';
import { TemplateList } from '@/components/TemplateList';
import { useTemplate, useTemplates } from '@/hooks/useTemplates';

export default function AdminTemplatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    templates,
    total,
    isLoading,
    error,
    filters,
    setFilters,
    refetch,
    createTemplate,
    deleteTemplate,
  } = useTemplates();

  const { template: editingTemplate, isLoading: isEditingTemplate, updateTemplate } = useTemplate(editId ?? undefined);

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  const handleCreate = async (data: TemplateFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await createTemplate({
        nom: data.nom,
        description: data.description || undefined,
        estPublic: data.estPublic,
        typeContenu: data.typeContenu,
        parametresParDefaut: buildTemplateDesignFromForm(data),
      });
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création du modèle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: TemplateFormData) => {
    if (!editId) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await updateTemplate({
        nom: data.nom,
        description: data.description || undefined,
        estPublic: data.estPublic,
        typeContenu: data.typeContenu,
        parametresParDefaut: buildTemplateDesignFromForm(data),
      });
      closeForm();
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du modèle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeForm = () => {
    searchParams.delete('edit');
    setSearchParams(searchParams);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement ce modèle ?')) return;
    await deleteTemplate(id);
  };

  const openCreate = () => {
    searchParams.delete('edit');
    setSearchParams({ ...Object.fromEntries(searchParams), new: '1' });
  };

  const closeCreate = () => {
    searchParams.delete('new');
    setSearchParams(searchParams);
  };

  const isCreating = searchParams.get('new') === '1';

  const formDefaultValues = editingTemplate
    ? {
        nom: editingTemplate.nom,
        description: editingTemplate.description ?? '',
        estPublic: editingTemplate.estPublic,
        typeContenu: editingTemplate.typeContenu ?? 'url',
        taille: editingTemplate.parametresParDefaut?.taille ?? 300,
        correction: editingTemplate.parametresParDefaut?.correction ?? 'M',
        couleur: editingTemplate.parametresParDefaut?.couleur ?? '#000000',
        background: editingTemplate.parametresParDefaut?.background ?? '#FFFFFF',
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Modèles QR</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nouveau
        </button>
      </div>

      {(isCreating || editId) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {editId ? 'Modifier le modèle' : 'Nouveau modèle'}
            </h3>
            <button
              type="button"
              onClick={() => { closeForm(); closeCreate(); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Fermer
            </button>
          </div>
          {formError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}
          {editId && isEditingTemplate ? (
            <div className="py-8 text-center text-gray-600">Chargement du modèle…</div>
          ) : (
            <TemplateForm
              defaultValues={formDefaultValues}
              onSubmit={editId ? handleUpdate : handleCreate}
              onCancel={() => { closeForm(); closeCreate(); }}
              isSubmitting={isSubmitting}
              submitLabel={editId ? 'Enregistrer' : 'Créer'}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder="Rechercher un modèle..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:w-72"
        />

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
        <TemplateList templates={templates} onDelete={handleDelete} />
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
        {total} modèle{total !== 1 ? 's' : ''} au total
      </p>
    </div>
  );
}
