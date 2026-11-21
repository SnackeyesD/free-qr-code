import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  Fiche,
  FicheModele,
  FicheUpdateInput,
  NatureFiche,
  SchemaFiche,
  ValeursFiche,
} from '@free-qr/shared-types';
import { FicheBuilder } from '@/components/fiche/FicheBuilder';
import { FicheRenderer } from '@/components/fiche/FicheRenderer';
import { FicheValuesForm } from '@/components/fiche/FicheValuesForm';
import { ficheApi, ficheErrorMessage } from '@/lib/ficheApi';
import {
  nombreChamps,
  prunerValeurs,
  schemaCarte,
  schemaVide,
  validerSchemaFiche,
} from '@/lib/ficheForm';
import { qrApi } from '@/lib/qrApi';

export default function FicheEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [titre, setTitre] = useState('');
  const [schema, setSchema] = useState<SchemaFiche>(schemaVide);
  const [valeurs, setValeurs] = useState<ValeursFiche>({});
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [modeles, setModeles] = useState<FicheModele[]>([]);
  const [modeleId, setModeleId] = useState('');

  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setFiche(null);
      setTitre('');
      setSchema(schemaVide());
      setValeurs({});
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    ficheApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        setFiche(data);
        setTitre(data.titre);
        setSchema(data.schema);
        setValeurs(data.valeurs);
      })
      .catch((err) => {
        if (!cancelled) setError(ficheErrorMessage(err, 'Fiche introuvable'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!isNew) return;
    let cancelled = false;
    ficheApi
      .listModeles()
      .then((result) => {
        if (!cancelled) setModeles(result.data);
      })
      .catch(() => {
        // Les modèles sont une aide facultative : l'échec ne bloque pas l'édition.
      });
    return () => {
      cancelled = true;
    };
  }, [isNew]);

  const handleSchemaChange = (suivant: SchemaFiche) => {
    setSchema(suivant);
    setSchemaError(null);
    setValeurs((precedentes) => prunerValeurs(suivant, precedentes));
  };

  const choisirModele = async (publicId: string) => {
    setModeleId(publicId);
    if (!publicId) return;
    setError(null);
    try {
      const modele = await ficheApi.getModeleById(publicId);
      setSchema(modele.schema);
      setValeurs({});
      setSchemaError(null);
      if (!titre.trim()) setTitre(modele.nom);
      setNotice(`Schéma « ${modele.nom} » chargé. Vous pouvez le personnaliser.`);
    } catch (err) {
      setError(ficheErrorMessage(err));
    }
  };

  const changerNature = (nature: NatureFiche) => {
    setSchema((actuel) => ({ ...actuel, nature }));
    setSchemaError(null);
  };

  const appliquerChampsCarte = () => {
    const carte = schemaCarte();
    setSchema(carte);
    setValeurs((precedentes) => prunerValeurs(carte, precedentes));
    setSchemaError(null);
    if (!titre.trim()) setTitre('Carte de visite');
    setNotice('Champs de carte de visite ajoutés. Complétez-les ci-dessous.');
  };

  const persist = async (
    extra: Partial<Pick<FicheUpdateInput, 'estActive'>> = {},
  ): Promise<Fiche | null> => {
    const erreurSchema = validerSchemaFiche(schema);
    if (erreurSchema) {
      setSchemaError(erreurSchema);
      setError(null);
      return null;
    }
    if (!titre.trim()) {
      setError('Le titre de la fiche est requis.');
      return null;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (id) {
        const misAJour = await ficheApi.update(id, {
          titre: titre.trim(),
          schema,
          valeurs,
          ...extra,
        });
        setFiche(misAJour);
        setTitre(misAJour.titre);
        setSchema(misAJour.schema);
        setValeurs(misAJour.valeurs);
        return misAJour;
      }

      const creee = await ficheApi.create({
        titre: titre.trim(),
        schema,
        valeurs,
      });
      setFiche(creee);
      setTitre(creee.titre);
      setSchema(creee.schema);
      setValeurs(creee.valeurs);
      navigate(`/dashboard/fiches/${creee.id}/edit`, { replace: true });
      return creee;
    } catch (err) {
      setError(ficheErrorMessage(err));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const enregistree = await persist();
    if (enregistree) {
      setNotice('Fiche enregistrée.');
    }
  };

  const creerQr = async () => {
    if (isSaving || isCreatingQr) return;
    const enregistree = await persist();
    if (!enregistree) return;

    setIsCreatingQr(true);
    setError(null);
    setNotice(null);
    try {
      const qr = await qrApi.create({
        type: 'dynamique',
        idFiche: enregistree.id,
      });
      navigate(`/dashboard/qr/${qr.id}`);
    } catch (err) {
      setError(ficheErrorMessage(err));
    } finally {
      setIsCreatingQr(false);
    }
  };

  const basculerArchive = async () => {
    if (!fiche || isSaving) return;
    const enregistree = await persist({ estActive: !fiche.estActive });
    if (enregistree) {
      setNotice(enregistree.estActive ? 'Fiche réactivée.' : 'Fiche archivée.');
    }
  };

  const supprimer = async () => {
    if (!id || isDeleting) return;
    if (
      !confirm(
        'Supprimer définitivement cette fiche ? Si un QR y est lié, la suppression sera refusée : archivez-la plutôt.',
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await ficheApi.remove(id);
      navigate('/dashboard/fiches');
    } catch (err) {
      setError(ficheErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const enregistrerCommeModele = async () => {
    const erreurSchema = validerSchemaFiche(schema);
    if (erreurSchema) {
      setSchemaError(erreurSchema);
      return;
    }
    const nom = window.prompt(
      'Nom du modèle réutilisable',
      titre.trim() || 'Modèle de fiche',
    );
    if (!nom || !nom.trim()) return;

    setError(null);
    try {
      await ficheApi.createModele({ nom: nom.trim(), schema });
      const result = await ficheApi.listModeles();
      setModeles(result.data);
      setNotice(`Modèle « ${nom.trim()} » enregistré.`);
    } catch (err) {
      setError(ficheErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (id && !fiche && error) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
        <Link
          to="/dashboard/fiches"
          className="inline-flex rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Retour aux fiches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/dashboard/fiches"
            className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
          >
            ← Mes fiches
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            {isNew ? 'Nouvelle fiche' : 'Modifier la fiche'}
          </h2>
          {fiche && (
            <p className="mt-1 text-sm text-gray-600">
              {fiche.estActive ? 'Active' : 'Archivée'} · révision {fiche.version} ·{' '}
              {nombreChamps(fiche.schema)} champ
              {nombreChamps(fiche.schema) !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            form="fiche-form"
            disabled={isSaving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-gray-300"
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {fiche && (
            <>
              <button
                type="button"
                onClick={() => void creerQr()}
                disabled={isCreatingQr || isSaving || !fiche.estActive}
                className="rounded-md bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200 disabled:bg-gray-100 disabled:text-gray-400"
                title={
                  fiche.estActive
                    ? 'Enregistre la fiche puis crée un QR dynamique'
                    : 'Réactivez la fiche pour créer un QR'
                }
              >
                {isCreatingQr ? 'Création du QR…' : 'Créer un QR'}
              </button>
              <a
                href={`/d/${fiche.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Page publique
              </a>
              <button
                type="button"
                onClick={() => void basculerArchive()}
                disabled={isSaving}
                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {fiche.estActive ? 'Archiver' : 'Réactiver'}
              </button>
              <button
                type="button"
                onClick={() => void supprimer()}
                disabled={isDeleting}
                className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700" role="status">
          {notice}
        </div>
      )}
      {schemaError && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          {schemaError}
        </div>
      )}

      <form id="fiche-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Informations</h3>

              <div>
                <label
                  htmlFor="fiche-titre"
                  className="block text-sm font-medium text-gray-700"
                >
                  Titre de la fiche <span className="text-red-500">*</span>
                </label>
                <input
                  id="fiche-titre"
                  type="text"
                  value={titre}
                  maxLength={120}
                  onChange={(event) => setTitre(event.target.value)}
                  placeholder="Ex. Fiche contact — Gloire Messia SAYI"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="fiche-nature"
                  className="block text-sm font-medium text-gray-700"
                >
                  Présentation
                </label>
                <select
                  id="fiche-nature"
                  value={schema.nature ?? 'document'}
                  onChange={(event) =>
                    changerNature(event.target.value as NatureFiche)
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                >
                  <option value="document">Document</option>
                  <option value="carte">Carte de visite</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {schema.nature === 'carte'
                    ? "La page publique affiche une carte de visite et propose « Ajouter à mes contacts » (fichier vCard)."
                    : 'La page publique affiche les champs sous forme de document structuré.'}
                </p>
              </div>

              {schema.nature === 'carte' && schema.champs.length === 0 && (
                <div className="rounded-md border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm text-indigo-900">
                    Partez des champs standards d'une carte de visite : prénom,
                    nom, organisation, téléphone, email, site, adresse et note.
                  </p>
                  <button
                    type="button"
                    onClick={appliquerChampsCarte}
                    className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    Ajouter les champs de carte de visite
                  </button>
                </div>
              )}

              {isNew && modeles.length > 0 && (
                <div>
                  <label
                    htmlFor="fiche-modele"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Partir d'un modèle (facultatif)
                  </label>
                  <select
                    id="fiche-modele"
                    value={modeleId}
                    onChange={(event) => void choisirModele(event.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  >
                    <option value="">Schéma vierge</option>
                    {modeles.map((modele) => (
                      <option key={modele.id} value={modele.id}>
                        {modele.nom}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Le schéma du modèle est copié dans cette fiche : les modifications
                    ultérieures du modèle ne l'altèrent pas.
                  </p>
                </div>
              )}

              {fiche && (
                <p className="text-xs text-gray-500">
                  Créée le{' '}
                  {new Date(fiche.dateCreation).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  . Chaque enregistrement incrémente la révision.
                </p>
              )}
            </section>

            <section className="rounded-lg bg-white p-6 shadow-sm">
              <FicheBuilder schema={schema} onChange={handleSchemaChange} disabled={isSaving} />
              {schema.champs.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => void enregistrerCommeModele()}
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                  >
                    Enregistrer ce schéma comme modèle réutilisable
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Valeurs</h3>
              <p className="mt-1 text-xs text-gray-500">
                Les champs facultatifs laissés vides ne seront pas affichés.
              </p>
              <div className="mt-4">
                <FicheValuesForm
                  schema={schema}
                  valeurs={valeurs}
                  onChange={setValeurs}
                  disabled={isSaving}
                />
              </div>
            </section>
          </div>

          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <h3 className="text-sm font-semibold text-gray-900">Aperçu</h3>
              <p className="mt-1 text-xs text-gray-500">
                Rendu identique à la page publique.
              </p>
              <div className="mt-3">
                <FicheRenderer
                  titre={titre.trim() || 'Fiche sans titre'}
                  schema={schema}
                  valeurs={valeurs}
                />
              </div>
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/dashboard/fiches"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:bg-gray-300"
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer la fiche'}
          </button>
        </div>
      </form>
    </div>
  );
}
