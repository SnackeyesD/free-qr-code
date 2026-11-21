import type {
  ChampFiche,
  SchemaFiche,
  ValeurFiche,
  ValeursFiche,
} from '@free-qr/shared-types';
import { FicheCarteRenderer } from './FicheCarteRenderer';

interface FicheRendererProps {
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  className?: string;
}

interface GroupeChamps {
  titre: string | null;
  champs: ChampFiche[];
}

function estVide(valeur: ValeurFiche | undefined): boolean {
  return (
    valeur === undefined ||
    valeur === null ||
    (typeof valeur === 'string' && valeur.trim().length === 0)
  );
}

function texteValeur(valeur: ValeurFiche | undefined): string {
  if (valeur === undefined || valeur === null) return '';
  return String(valeur);
}

function urlSure(valeur: string): boolean {
  try {
    const url = new URL(valeur);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDate(valeur: string): string {
  const date = new Date(`${valeur}T00:00:00`);
  if (Number.isNaN(date.getTime())) return valeur;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
      date,
    );
  } catch {
    return valeur;
  }
}

function formatNombre(valeur: ValeurFiche): string {
  const nombre = typeof valeur === 'number' ? valeur : Number(valeur);
  if (!Number.isFinite(nombre)) return String(valeur);
  try {
    return new Intl.NumberFormat().format(nombre);
  } catch {
    return String(nombre);
  }
}

function regrouperChamps(schema: SchemaFiche): GroupeChamps[] {
  const groupes: GroupeChamps[] = [];
  let courant: GroupeChamps = { titre: null, champs: [] };

  for (const champ of schema.champs) {
    if (champ.type === 'section') {
      if (courant.titre !== null || courant.champs.length > 0) {
        groupes.push(courant);
      }
      courant = { titre: champ.libelle, champs: [] };
    } else {
      courant.champs.push(champ);
    }
  }

  if (courant.titre !== null || courant.champs.length > 0) {
    groupes.push(courant);
  }
  return groupes;
}

function ValeurAffichee({ champ, valeur }: { champ: ChampFiche; valeur: ValeurFiche }) {
  const texte = texteValeur(valeur);

  switch (champ.type) {
    case 'email':
      return (
        <a
          href={`mailto:${texte}`}
          className="break-all text-indigo-700 underline-offset-2 hover:underline"
        >
          {texte}
        </a>
      );
    case 'telephone': {
      const tel = texte.replace(/[^+0-9]/g, '');
      return (
        <a
          href={`tel:${tel}`}
          className="text-indigo-700 underline-offset-2 hover:underline"
        >
          {texte}
        </a>
      );
    }
    case 'url':
      if (urlSure(texte)) {
        return (
          <a
            href={texte}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all text-indigo-700 underline-offset-2 hover:underline"
          >
            {texte}
          </a>
        );
      }
      return <span className="break-all">{texte}</span>;
    case 'date':
      return <span>{formatDate(texte)}</span>;
    case 'nombre':
      return <span>{formatNombre(valeur)}</span>;
    case 'booleen':
      return <span>{valeur === true ? 'Oui' : 'Non'}</span>;
    case 'liste': {
      const option = champ.options?.find((item) => item.valeur === texte);
      return <span>{option?.libelle ?? texte}</span>;
    }
    case 'texte_long':
      return <span className="whitespace-pre-wrap break-words">{texte}</span>;
    default:
      return <span className="whitespace-pre-wrap break-words">{texte}</span>;
  }
}

/**
 * Rendu unique d'une fiche : utilisé pour l'aperçu du builder et pour la page
 * publique. Aucun HTML utilisateur, aucun Markdown, aucun appel tiers.
 */
export function FicheRenderer({
  titre,
  schema,
  valeurs,
  className = '',
}: FicheRendererProps) {
  if (schema.nature === 'carte') {
    return (
      <FicheCarteRenderer
        titre={titre}
        schema={schema}
        valeurs={valeurs}
        className={className}
      />
    );
  }

  const groupes = regrouperChamps(schema);

  return (
    <article
      className={`rounded-lg bg-white p-6 shadow-sm ${className}`.trim()}
    >
      <h1 className="break-words text-2xl font-bold text-gray-900">{titre}</h1>

      {groupes.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Cette fiche ne contient aucun champ.
        </p>
      ) : (
        groupes.map((groupe, index) => (
          <section key={`${groupe.titre ?? 'groupe'}-${index}`} className="mt-6">
            {groupe.titre && (
              <h2 className="border-b border-gray-100 pb-2 text-lg font-semibold text-gray-900">
                {groupe.titre}
              </h2>
            )}
            {groupe.champs.length > 0 && (
              <dl className="mt-3 space-y-4">
                {groupe.champs.map((champ) => {
                  const valeur = valeurs[champ.cle];
                  const vide = estVide(valeur);
                  if (vide && !champ.obligatoire) return null;

                  return (
                    <div key={champ.cle}>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {champ.libelle}
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {vide ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <ValeurAffichee
                            champ={champ}
                            valeur={valeur as ValeurFiche}
                          />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>
        ))
      )}
    </article>
  );
}
