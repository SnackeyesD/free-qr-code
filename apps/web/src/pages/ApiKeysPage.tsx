import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApiKeys } from '@/hooks/useApiKeys';
import type { PermissionCleApi } from '@free-qr/shared-types';

const ALL_PERMISSIONS: PermissionCleApi[] = [
  'qrcodes:read',
  'qrcodes:create',
  'qrcodes:update',
  'qrcodes:delete',
  'stats:read',
  'admin:campaigns',
  'admin:templates',
];

const USER_PERMISSIONS: PermissionCleApi[] = [
  'qrcodes:read',
  'qrcodes:create',
  'qrcodes:update',
  'qrcodes:delete',
  'stats:read',
];

function formatDate(value: Date | string | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: Date | string | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function permissionLabel(permission: PermissionCleApi): string {
  switch (permission) {
    case 'qrcodes:read':
      return 'Lire les QR codes';
    case 'qrcodes:create':
      return 'Créer des QR codes';
    case 'qrcodes:update':
      return 'Modifier des QR codes';
    case 'qrcodes:delete':
      return 'Supprimer des QR codes';
    case 'stats:read':
      return 'Lire les statistiques';
    case 'admin:campaigns':
      return 'Admin : campagnes';
    case 'admin:templates':
      return 'Admin : modèles';
    default:
      return permission;
  }
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { keys, isLoading, error, refetch, createKey, revokeKey } = useApiKeys();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionCleApi[]>([]);
  const [dateExpiration, setDateExpiration] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availablePermissions = useMemo(() => {
    if (user?.role === 'admin') return ALL_PERMISSIONS;
    return USER_PERMISSIONS;
  }, [user?.role]);

  function resetForm() {
    setName('');
    setSelectedPermissions([]);
    setDateExpiration('');
    setFormError(null);
  }

  function handleOpenCreate() {
    resetForm();
    setNewKey(null);
    setCopied(false);
    setIsCreating(true);
  }

  function handleCloseCreate() {
    setIsCreating(false);
    setNewKey(null);
    resetForm();
  }

  function togglePermission(permission: PermissionCleApi) {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Le nom est requis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createKey({
        nom: name.trim(),
        permissions: selectedPermissions.length > 0 ? selectedPermissions : undefined,
        dateExpiration: dateExpiration || undefined,
      });
      setNewKey(created.cle ?? null);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création de la clé');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleRevoke(id: string, keyName: string) {
    if (!confirm(`Révoquer la clé « ${keyName} » ? Cette action est irréversible.`)) return;
    try {
      await revokeKey(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la révocation');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clés API</h2>
          <p className="mt-2 text-gray-600">
            Gérez vos clés d'accès pour l'API Free QR. Passez la clé dans le
            header <code className="font-mono">X-API-Key</code> (ou
            <code className="font-mono"> Authorization: ApiKey &lt;clé&gt;</code>).
            Gardez vos clés secrètes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Créer une clé API
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-2 font-semibold underline hover:text-red-800"
          >
            Réessayer
          </button>
        </div>
      )}

      {isCreating && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Nouvelle clé API</h3>

          {newKey ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
                Copiez la clé ci-dessous maintenant. Elle ne sera plus affichée ensuite.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newKey}
                  className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Terminé
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="key-name" className="block text-sm font-medium text-gray-700">
                  Nom
                </label>
                <input
                  id="key-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Mon intégration mobile"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700">Permissions</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {availablePermissions.map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center gap-2 rounded-md border border-gray-200 p-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{permissionLabel(permission)}</span>
                    </label>
                  ))}
                </div>
                {selectedPermissions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Sans permission, la clé ne pourra appeler aucune route.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="key-expiration" className="block text-sm font-medium text-gray-700">
                  Date d'expiration (optionnelle)
                </label>
                <input
                  id="key-expiration"
                  type="datetime-local"
                  value={dateExpiration}
                  onChange={(e) => setDateExpiration(e.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement…</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">Aucune clé API pour le moment.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Créer une clé API
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Préfixe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Permissions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Créée le
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expiration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Dernière utilisation
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{key.nom}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {key.prefix ? `${key.prefix}…` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {key.permissions.length === 0 ? (
                      <span>Aucune</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.map((p) => (
                          <span
                            key={p}
                            className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(key.dateCreation)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(key.dateExpiration)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(key.derniereUtilisation)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => void handleRevoke(key.id, key.nom)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      Révoquer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
