import type {
  ChampFiche,
  SchemaFiche,
  ValeursFiche,
} from '@free-qr/shared-types';

export const MAX_CHAMPS_FICHE = 30;

export function schemaVide(): SchemaFiche {
  return { version: 1, champs: [] };
}

/**
 * Champs proposés pour une carte de visite. Les clés correspondent aux
 * conventions reconnues par l'export vCard côté API.
 */
export const CHAMPS_CARTE: readonly ChampFiche[] = [
  { cle: 'prenom', libelle: 'Prénom', type: 'texte', obligatoire: true },
  { cle: 'nom', libelle: 'Nom', type: 'texte', obligatoire: true },
  { cle: 'organisation', libelle: 'Organisation', type: 'texte' },
  { cle: 'fonction', libelle: 'Fonction', type: 'texte' },
  { cle: 'telephone', libelle: 'Téléphone', type: 'telephone' },
  { cle: 'email', libelle: 'Email', type: 'email' },
  { cle: 'site', libelle: 'Site web', type: 'url' },
  { cle: 'adresse', libelle: 'Adresse', type: 'texte' },
  { cle: 'note', libelle: 'Note', type: 'texte_long' },
];

export function schemaCarte(): SchemaFiche {
  return {
    version: 1,
    nature: 'carte',
    champs: CHAMPS_CARTE.map((champ) => ({ ...champ })),
  };
}

export function nombreChamps(schema: SchemaFiche): number {
  return schema.champs.filter((champ) => champ.type !== 'section').length;
}

export function prunerValeurs(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
): ValeursFiche {
  const cles = new Set(
    schema.champs
      .filter((champ) => champ.type !== 'section')
      .map((champ) => champ.cle),
  );
  const resultat: ValeursFiche = {};
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (cles.has(cle)) resultat[cle] = valeur;
  }
  return resultat;
}

/**
 * Validation côté client, alignée sur les règles de l'API. L'API reste la
 * source de vérité : ceci sert à guider l'utilisateur avant l'enregistrement.
 */
export function validerSchemaFiche(schema: SchemaFiche): string | null {
  if (schema.champs.length === 0) {
    return 'Ajoutez au moins un champ pour enregistrer la fiche.';
  }
  if (schema.champs.length > MAX_CHAMPS_FICHE) {
    return `Une fiche ne peut pas dépasser ${MAX_CHAMPS_FICHE} champs.`;
  }

  const cles = new Set<string>();
  for (const champ of schema.champs) {
    if (!champ.libelle.trim()) {
      return 'Chaque champ doit avoir un libellé.';
    }
    if (champ.libelle.length > 80) {
      return `Le libellé « ${champ.libelle.slice(0, 30)}… » dépasse 80 caractères.`;
    }
    if (cles.has(champ.cle)) {
      return 'Deux champs partagent la même clé interne. Supprimez et recréez le champ en double.';
    }
    cles.add(champ.cle);

    if (champ.type === 'liste') {
      const options = champ.options ?? [];
      if (options.length === 0) {
        return `Le champ « ${champ.libelle} » doit proposer au moins une option.`;
      }
      if (options.some((option) => !option.valeur.trim() || !option.libelle.trim())) {
        return `Toutes les options de « ${champ.libelle} » doivent avoir une valeur et un libellé.`;
      }
      if (new Set(options.map((option) => option.valeur)).size !== options.length) {
        return `Les valeurs des options de « ${champ.libelle} » doivent être uniques.`;
      }
    }
  }

  return null;
}
