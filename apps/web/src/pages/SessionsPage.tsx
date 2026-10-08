import { useState } from 'react';
import { useSessions } from '@/hooks/useSessions';

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

function formatUA(userAgent: string | undefined): string {
  if (!userAgent) return 'Inconnu';

  const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Edg|Opera|OPR)\/[\d.]+/);
  const os = userAgent.match(/\(([^)]+)\)/);

  if (browser && os) {
    return `${browser[0]} — ${os[1]}`;
  }
  if (browser) {
    return browser[0];
  }
  if (userAgent.length > 60) {
    return `${userAgent.slice(0, 60)}…`;
  }
  return userAgent;
}

export default function SessionsPage() {
  const {
    sessions,
    isLoading,
    error,
    refetch,
    revokeSession,
    revokeAllOthers,
    isRevoking,
    isRevokingAll,
    isSuccess,
  } = useSessions();
  const [revokingId, setRevokingId] = useState<string | number | null>(null);

  const hasOtherSessions = sessions.some((s) => !s.isCurrent && !s.estRevoke);
  const activeSessions = sessions.filter((s) => !s.estRevoke);

  async function handleRevoke(id: string | number, userAgent: string | undefined) {
    const label = userAgent ? formatUA(userAgent) : 'cette session';
    if (!confirm(`Révoquer la session « ${label} » ? Cette action est irréversible.`)) {
      return;
    }
    setRevokingId(id);
    try {
      await revokeSession(id);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeAllOthers() {
    if (
      !confirm(
        'Révoquer toutes les autres sessions actives ? Les appareils concernés seront déconnectés.',
      )
    ) {
      return;
    }
    await revokeAllOthers();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sessions actives</h2>
          <p className="mt-2 text-gray-600">
            Visualisez et révoquez les sessions connectées à votre compte.
          </p>
        </div>
        {hasOtherSessions && (
          <button
            type="button"
            onClick={() => void handleRevokeAllOthers()}
            disabled={isRevokingAll}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isRevokingAll ? 'Révocation…' : 'Révoquer toutes les autres sessions'}
          </button>
        )}
      </div>

      {isSuccess && !error && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800" role="status">
          Opération effectuée avec succès.
        </div>
      )}

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement des sessions…</p>
        </div>
      ) : activeSessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">Aucune session active pour le moment.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Actualiser
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Appareil / navigateur
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Créée le
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Dernière utilisation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expiration
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {formatUA(session.userAgent)}
                      </span>
                      {session.isCurrent && (
                        <span className="mt-1 inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Session courante
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {session.adresseIP ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(session.dateCreation)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(session.dateDerniereUtilisation)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDateTime(session.dateExpiration)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => void handleRevoke(session.id, session.userAgent)}
                      disabled={isRevoking || revokingId === session.id}
                      className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {revokingId === session.id ? 'Révocation…' : 'Révoquer'}
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
