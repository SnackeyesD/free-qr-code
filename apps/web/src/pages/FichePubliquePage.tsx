import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FichePublique } from '@free-qr/shared-types';
import { FicheRenderer } from '@/components/fiche/FicheRenderer';
import {
  ficheApi,
  ficheErrorMessage,
  ficheErrorStatus,
} from '@/lib/ficheApi';

type Etat = 'chargement' | 'pret' | 'introuvable' | 'archivee' | 'erreur';

const MESSAGES: Record<Exclude<Etat, 'chargement' | 'pret' | 'erreur'>, string> = {
  introuvable: "Cette fiche n'existe pas ou a été supprimée.",
  archivee: 'Cette fiche a été archivée par son propriétaire.',
};

export default function FichePubliquePage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [etat, setEtat] = useState<Etat>('chargement');
  const [fiche, setFiche] = useState<FichePublique | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      document.title = 'Free QR Code';
    };
  }, []);

  useEffect(() => {
    if (!publicId) {
      setEtat('introuvable');
      return;
    }

    let cancelled = false;
    setEtat('chargement');
    setMessage('');

    ficheApi
      .getPublique(publicId)
      .then((data) => {
        if (cancelled) return;
        setFiche(data);
        setEtat('pret');
        document.title = `${data.titre} — Fiche`;
      })
      .catch((err) => {
        if (cancelled) return;
        const status = ficheErrorStatus(err);
        if (status === 410) {
          setEtat('archivee');
        } else if (status === 404) {
          setEtat('introuvable');
        } else {
          setEtat('erreur');
          setMessage(ficheErrorMessage(err, 'Impossible de charger cette fiche.'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <Link to="/" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
            Free QR Code
          </Link>
          {etat === 'pret' && (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Imprimer / PDF
            </button>
          )}
        </div>

        {etat === 'chargement' && (
          <div
            className="flex items-center justify-center rounded-lg bg-white p-12 shadow-sm"
            role="status"
          >
            <p className="text-gray-600">Chargement de la fiche…</p>
          </div>
        )}

        {etat === 'pret' && fiche && (
          <FicheRenderer
            titre={fiche.titre}
            schema={fiche.schema}
            valeurs={fiche.valeurs}
            className="shadow-md print:shadow-none"
          />
        )}

        {(etat === 'introuvable' || etat === 'archivee') && (
          <div className="rounded-lg bg-white p-10 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Fiche indisponible</h1>
            <p className="mt-2 text-sm text-gray-600">{MESSAGES[etat]}</p>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Découvrir Free QR Code
            </Link>
          </div>
        )}

        {etat === 'erreur' && (
          <div className="rounded-lg bg-white p-10 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Fiche indisponible</h1>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Réessayer
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-500 print:hidden">
          Aucun traceur, aucune statistique de consultation, aucun appel à un service tiers.
        </p>
      </div>
    </div>
  );
}
