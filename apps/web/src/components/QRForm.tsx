import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QRCodeInput } from '@free-qr/shared-types';
import { useQR } from '@/hooks/useQR';
import { useQRCreate } from '@/hooks/useQRCreate';
import { QRPreview, QRDesignPanel } from '@/components/QRPreview';
import {
  useQRForm,
  QR_CONTENT_OPTIONS,
  QR_TYPES,
} from '@/lib/qrForm';

export function QRCreateForm() {
  const navigate = useNavigate();
  const { create, isLoading: isCreating, error, resetError } = useQRCreate();
  const {
    contentType,
    setContentType,
    qrType,
    setQrType,
    values,
    updateValue,
    design,
    setDesignValue,
    alias,
    setAlias,
    encodedContent,
    fields,
    isValid,
  } = useQRForm('url', 'dynamique');

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => resetError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, resetError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const input: QRCodeInput = {
      type: qrType,
      contenu: encodedContent,
      design,
    };

    const created = await create(input);
    if (created) {
      navigate(`/dashboard/qr/${created.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="qr-type" className="block text-sm font-medium text-gray-700">
              Type de QR
            </label>
            <div className="mt-2 flex gap-2">
              {QR_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQrType(option.value)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    qrType === option.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="content-type" className="block text-sm font-medium text-gray-700">
              Contenu
            </label>
            <select
              id="content-type"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as typeof contentType)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              {QR_CONTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={`field-${field.key}`} className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={`field-${field.key}`}
                  value={values[field.key] || ''}
                  onChange={(e) => updateValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              ) : field.type === 'select' ? (
                <select
                  id={`field-${field.key}`}
                  value={values[field.key] || ''}
                  onChange={(e) => updateValue(field.key, e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${field.key}`}
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={(e) => updateValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              )}
            </div>
          ))}

          {qrType === 'dynamique' && (
            <div>
              <label htmlFor="qr-alias" className="block text-sm font-medium text-gray-700">
                Alias court (optionnel)
              </label>
              <input
                id="qr-alias"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="mon-lien"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Design</h3>
            <div className="mt-3">
              <QRDesignPanel design={design} setDesignValue={setDesignValue} />
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Aperçu</h3>
          <div className="flex justify-center">
            <QRPreview content={encodedContent} design={design} size={260} />
          </div>

          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700">Contenu encodé :</p>
            <p className="mt-1 break-all text-xs text-gray-600">{encodedContent || 'Aucun contenu'}</p>
          </div>

          <button
            type="submit"
            disabled={!isValid || isCreating}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isCreating ? 'Création…' : 'Créer le QR code'}
          </button>
        </div>
      </div>
    </form>
  );
}

export function QREditForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { qr, isLoading, error, update, toggleActive } = useQR(id);
  const { design, setDesignValue, encodedContent } = useQRForm();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (error || !qr) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {error || 'QR code introuvable.'}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await update({
      contenu: encodedContent || qr.contenu,
      parametres: design,
    });
    if (result) {
      navigate(`/dashboard/qr/${result.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Type</p>
              <p className="text-sm text-gray-900">{qr.estDynamique ? 'Dynamique' : 'Statique'}</p>
            </div>
            <button
              type="button"
              onClick={() => void toggleActive()}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                qr.estActif
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {qr.estActif ? 'Désactiver' : 'Activer'}
            </button>
          </div>

          <div>
            <QRDesignPanel design={design} setDesignValue={setDesignValue} />
          </div>
        </div>

        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Aperçu</h3>
          <div className="flex justify-center">
            <QRPreview content={qr.contenu} design={design} size={260} />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Enregistrer les modifications
          </button>
        </div>
      </div>
    </form>
  );
}
