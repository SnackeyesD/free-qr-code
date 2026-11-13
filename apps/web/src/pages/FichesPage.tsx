import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Fiche } from '@free-qr/shared-types';
import { useFiches } from '@/hooks/useFiches';
import { ficheApi, ficheErrorMessage } from '@/lib/ficheApi';
import { nombreChamps } from '@/lib/ficheForm';
import { qrApi } from '@/lib/qrApi';

function formatDate(value: Date | string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

export default function FichesPage() {
  const navigate = useNavigate();
  const {
    fiches,
    total,
    page,
    setPage,
    limit,
    setLimit,
    search,
    setSearch,
    isLoading,
    error,
    refetch,
  } = useFiches();

  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const creerQr = async (fiche: Fiche) => {
    setBusyId(fiche.id);
    setActionError(null);
    setNotice(null);
    try {
      const qr = await qrApi.create({ type: 'dynamique', idFiche: fiche.id });
      navigate(`/dashboard/qr/${qr.id}`);
    } catch (err) {
      setActionError(ficheErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const supprimer = async (fiche: Fiche) => {
    if (
      !confirm(
        `Supprimer définitivement la fiche « ${fiche.titre} » ? Cette action est irréversible.`,
      )
    ) {
      return;
    }

    setBusyId(fiche.id);
    setActionError(null);
    setNotice(null);
    try {
      await ficheApi.remove(fiche.id);
      setNotice('Fiche supprimée.');
      await refetch();
    } catch (err) {
      setActionError(ficheErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const copierLien = async (fiche: Fiche) => {
    const url = `${window.location.origin}/d/${fiche.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Lien public copié.');
      setActionError(null);
    } catch {
      setActionError("Impossible de copier le lien. Copiez-le depuis la page publique.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mes fiches</h2>
          <p className="mt-1 text-sm text-gray-600">
            Composez un document à champs libres, puis associez-lui un QR code dynamique.
          </p>
        </div>
        <Link
          to="/dashboard/fiches/new"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nouvelle fiche
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher une fiche..."
          aria-label="Rechercher une fiche"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:w-72"
        />

        <select
          value={limit}
          onChange={(event) => {
            setLimit(Number(event.target.value));
            setPage(1);
          }}
          aria-label="Fiches par page"
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
      {actionError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {actionError}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700" role="status">
          {notice}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement…</p>
        </div>
      ) : fiches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <h3 className="text-base font-semibold text-gray-900">Aucune fiche</h3>
          <p className="mt-2 text-sm text-gray-600">
            Une fiche peut contenir des coordonnées, une offre, des horaires ou tout autre
            document structuré.
          </p>
          <Link
            to="/dashboard/fiches/new"
            className="mt-4 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Créer ma première fiche
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {fiches.map((fiche) => (
            <li
              key={fiche.id}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-base font-semibold text-gray-900">
                  <Link
                    to={`/dashboard/fiches/${fiche.id}/edit`}
                    className="hover:text-indigo-700"
                  >
                    {fiche.titre}
                  </Link>
                </h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    fiche.estActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {fiche.estActive ? 'Active' : 'Archivée'}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                {nombreChamps(fiche.schema)} champ
                {nombreChamps(fiche.schema) !== 1 ? 's' : ''} · révision {fiche.version} ·
                modifiée le {formatDate(fiche.dateModification ?? fiche.dateCreation)}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void creerQr(fiche)}
                  disabled={!fiche.estActive || busyId === fiche.id}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300"
                  title={
                    fiche.estActive
                      ? 'Créer un QR dynamique pour cette fiche'
                      : 'Réactivez la fiche pour créer un QR'
                  }
                >
                  {busyId === fiche.id ? 'Création…' : 'Créer un QR'}
                </button>
                <Link
                  to={`/dashboard/fiches/${fiche.id}/edit`}
                  className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Modifier
                </Link>
                {fiche.estActive && (
                  <>
                    <a
                      href={`/d/${fiche.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      Page publique
                    </a>
                    <button
                      type="button"
                      onClick={() => void copierLien(fiche)}
                      className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      Copier le lien
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void supprimer(fiche)}
                  disabled={busyId === fiche.id}
                  className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {total} fiche{total !== 1 ? 's' : ''} au total
      </p>
    </div>
  );
}
