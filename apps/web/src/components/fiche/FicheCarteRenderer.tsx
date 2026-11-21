import {
  CLES_CARTE,
  type ChampFiche,
  type SchemaFiche,
  type ValeurFiche,
  type ValeursFiche,
} from '@free-qr/shared-types';

interface FicheCarteRendererProps {
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  className?: string;
}

function estVide(valeur: ValeurFiche | undefined): boolean {
  return (
    valeur === undefined ||
    valeur === null ||
    (typeof valeur === 'string' && valeur.trim().length === 0)
  );
}

function texte(valeur: ValeurFiche | undefined): string {
  if (valeur === undefined || valeur === null) return '';
  return String(valeur).trim();
}

function urlSure(valeur: string): boolean {
  try {
    const url = new URL(valeur);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function champParCle(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  cles: readonly string[],
): ChampFiche | null {
  for (const cle of cles) {
    const champ = schema.champs.find(
      (candidat) => candidat.cle === cle && candidat.type !== 'section',
    );
    if (champ && !estVide(valeurs[champ.cle])) return champ;
  }
  return null;
}

function champParType(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  type: ChampFiche['type'],
): ChampFiche | null {
  return (
    schema.champs.find(
      (champ) => champ.type === type && !estVide(valeurs[champ.cle]),
    ) ?? null
  );
}

function trouverChamp(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  cles: readonly string[],
  type?: ChampFiche['type'],
): ChampFiche | null {
  return (
    champParCle(schema, valeurs, cles) ??
    (type ? champParType(schema, valeurs, type) : null)
  );
}

function initiales(prenom: string, nom: string, affichage: string): string {
  const lettres = [prenom, nom]
    .map((partie) => partie.trim().charAt(0))
    .filter(Boolean)
    .join('');
  if (lettres) return lettres.toLocaleUpperCase();
  return affichage.trim().slice(0, 2).toLocaleUpperCase();
}

function valeurLisible(champ: ChampFiche, valeur: ValeurFiche): string {
  if (champ.type === 'booleen') return valeur === true ? 'Oui' : 'Non';
  if (champ.type === 'liste') {
    const option = champ.options?.find((item) => item.valeur === String(valeur));
    return option?.libelle ?? String(valeur);
  }
  if (champ.type === 'date') {
    const date = new Date(`${String(valeur)}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
          date,
        );
      } catch {
        return String(valeur);
      }
    }
  }
  if (champ.type === 'nombre') {
    const nombre = typeof valeur === 'number' ? valeur : Number(valeur);
    if (Number.isFinite(nombre)) {
      try {
        return new Intl.NumberFormat().format(nombre);
      } catch {
        return String(nombre);
      }
    }
  }
  return String(valeur);
}

function Icone({ nom }: { nom: 'mail' | 'telephone' | 'site' | 'adresse' | 'note' }) {
  const chemin = {
    mail: (
      <>
        <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
        <path d="m3 6 7 5 7-5" />
      </>
    ),
    telephone: (
      <path d="M5.3 3.5h2.2l1.1 3-1.5 1.2a11 11 0 0 0 5.2 5.2l1.2-1.5 3 1.1v2.2a1.8 1.8 0 0 1-2 1.8A14.5 14.5 0 0 1 3.5 5.5a1.8 1.8 0 0 1 1.8-2Z" />
    ),
    site: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M3 10h14M10 3c2 2.2 3 4.5 3 7s-1 4.8-3 7c-2-2.2-3-4.5-3-7s1-4.8 3-7Z" />
      </>
    ),
    adresse: (
      <>
        <path d="M10 17s5-4.5 5-8.5a5 5 0 0 0-10 0C5 12.5 10 17 10 17Z" />
        <circle cx="10" cy="8.5" r="1.8" />
      </>
    ),
    note: (
      <>
        <path d="M4 3.5h12v13H4z" />
        <path d="M7 7h6M7 10h6M7 13h4" />
      </>
    ),
  }[nom];

  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      {chemin}
    </svg>
  );
}

function LigneContact({
  icone,
  libelle,
  children,
}: {
  icone: 'mail' | 'telephone' | 'site' | 'adresse' | 'note';
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
        <Icone nom={icone} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {libelle}
        </p>
        <div className="mt-0.5 break-words text-sm text-gray-900">{children}</div>
      </div>
    </li>
  );
}

/**
 * Rendu d'une fiche de nature « carte » : une carte de visite lisible, avec
 * des liens natifs et un bouton d'export vCard géré par la page publique.
 * Les champs hors convention restent affichés sous « Informations ».
 */
export function FicheCarteRenderer({
  titre,
  schema,
  valeurs,
  className = '',
}: FicheCarteRendererProps) {
  const champPrenom = champParCle(schema, valeurs, [CLES_CARTE.prenom]);
  const champNom = champParCle(schema, valeurs, [CLES_CARTE.nom]);
  const champNomComplet = champParCle(schema, valeurs, [
    'nom_complet',
    'nom_affichage',
  ]);
  const champOrganisation = trouverChamp(schema, valeurs, [
    CLES_CARTE.organisation,
    'societe',
    'entreprise',
  ]);
  const champFonction = trouverChamp(schema, valeurs, [
    CLES_CARTE.fonction,
    'poste',
    'titre_poste',
  ]);
  const champEmail = trouverChamp(schema, valeurs, [CLES_CARTE.email], 'email');
  const champTelephone = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.telephone],
    'telephone',
  );
  const champSite = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.site, 'site_web', 'website'],
    'url',
  );
  const champAdresse = champParCle(schema, valeurs, [CLES_CARTE.adresse]);
  const champNote = champParCle(schema, valeurs, [CLES_CARTE.note]);

  const prenom = champPrenom ? texte(valeurs[champPrenom.cle]) : '';
  const nom = champNom ? texte(valeurs[champNom.cle]) : '';
  const nomComplet = champNomComplet
    ? texte(valeurs[champNomComplet.cle])
    : '';
  const affichage =
    [prenom, nom].filter(Boolean).join(' ') || nomComplet || titre;

  const utilises = new Set(
    [
      champPrenom,
      champNom,
      champNomComplet,
      champOrganisation,
      champFonction,
      champEmail,
      champTelephone,
      champSite,
      champAdresse,
      champNote,
    ]
      .filter((champ): champ is ChampFiche => Boolean(champ))
      .map((champ) => champ.cle),
  );

  const restes = schema.champs.filter(
    (champ) =>
      champ.type !== 'section' &&
      !utilises.has(champ.cle) &&
      !estVide(valeurs[champ.cle]),
  );

  const email = champEmail ? texte(valeurs[champEmail.cle]) : '';
  const telephone = champTelephone ? texte(valeurs[champTelephone.cle]) : '';
  const site = champSite ? texte(valeurs[champSite.cle]) : '';
  const adresse = champAdresse ? texte(valeurs[champAdresse.cle]) : '';
  const note = champNote ? texte(valeurs[champNote.cle]) : '';

  const contacts: React.ReactNode[] = [];
  if (telephone) {
    contacts.push(
      <LigneContact key="telephone" icone="telephone" libelle="Téléphone">
        <a
          href={`tel:${telephone.replace(/[^+0-9]/g, '')}`}
          className="font-medium text-indigo-700 underline-offset-2 hover:underline"
        >
          {telephone}
        </a>
      </LigneContact>,
    );
  }
  if (email) {
    contacts.push(
      <LigneContact key="email" icone="mail" libelle="Email">
        <a
          href={`mailto:${email}`}
          className="font-medium break-all text-indigo-700 underline-offset-2 hover:underline"
        >
          {email}
        </a>
      </LigneContact>,
    );
  }
  if (site) {
    contacts.push(
      <LigneContact key="site" icone="site" libelle="Site web">
        {urlSure(site) ? (
          <a
            href={site}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium break-all text-indigo-700 underline-offset-2 hover:underline"
          >
            {site}
          </a>
        ) : (
          <span className="break-all">{site}</span>
        )}
      </LigneContact>,
    );
  }
  if (adresse) {
    contacts.push(
      <LigneContact key="adresse" icone="adresse" libelle="Adresse">
        <span className="whitespace-pre-wrap">{adresse}</span>
      </LigneContact>,
    );
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white shadow-lg ${className}`.trim()}
    >
      <header className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 px-6 pb-7 pt-8 text-white">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-inset ring-white/30"
          >
            {initiales(prenom, nom, affichage)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
              Carte de visite
            </p>
            <h1 className="mt-1 break-words text-2xl font-bold leading-tight">
              {affichage}
            </h1>
            {(champFonction || champOrganisation) && (
              <p className="mt-1 break-words text-sm text-indigo-100">
                {[
                  champFonction
                    ? texte(valeurs[champFonction.cle])
                    : '',
                  champOrganisation
                    ? texte(valeurs[champOrganisation.cle])
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6 px-6 py-6">
        {contacts.length > 0 ? (
          <ul className="space-y-4">{contacts}</ul>
        ) : (
          <p className="text-sm text-gray-500">
            Aucune coordonnée renseignée pour cette carte.
          </p>
        )}

        {note && (
          <section className="rounded-xl bg-gray-50 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Icone nom="note" />
              Note
            </h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
              {note}
            </p>
          </section>
        )}

        {restes.length > 0 && (
          <section>
            <h2 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
              Informations complémentaires
            </h2>
            <dl className="mt-3 space-y-3">
              {restes.map((champ) => (
                <div key={champ.cle} className="grid gap-0.5 sm:grid-cols-[9rem_1fr]">
                  <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {champ.libelle}
                  </dt>
                  <dd className="break-words text-sm text-gray-900">
                    {champ.type === 'texte_long' ? (
                      <span className="whitespace-pre-wrap">
                        {valeurLisible(champ, valeurs[champ.cle] as ValeurFiche)}
                      </span>
                    ) : (
                      valeurLisible(champ, valeurs[champ.cle] as ValeurFiche)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
