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

        {etat === 'pret' && fiche?.schema.nature === 'carte' && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Enregistrer ce contact
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Fichier vCard (.vcf) compatible avec le carnet d’adresses de
                  votre téléphone.
                </p>
              </div>
              <a
                href={ficheApi.urlVcfPublique(fiche.publicId)}
                download
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" />
                </svg>
                Ajouter à mes contacts
              </a>
            </div>
          </div>
        )}

        {etat === 'chargement' && (
          <div
            className="flex items-center justify-center rounded-lg bg-white p-12 shadow-sm"
            role="status"
          >
            <p className="text-gray-600">Chargement de la fiche…</p>
          </div>
        )}

        {etat === 'pret' && fiche && (
          <>
            <FicheRenderer
              titre={fiche.titre}
              schema={fiche.schema}
              valeurs={fiche.valeurs}
              className="shadow-md print:shadow-none"
            />
            {fiche.schema.nature === 'carte' && (
              <div className="mt-4 text-center print:hidden">
                <a
                  href={ficheApi.urlVcfPublique(fiche.publicId)}
                  download
                  className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
                >
                  Ajouter à mes contacts
                </a>
              </div>
            )}
          </>
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
