// lib/vcard.ts
// Génère une vCard 3.0 à partir des valeurs structurées d'une fiche « carte ».
// Aucun parseur vCard : les valeurs ont déjà été validées par type de champ.

import {
  CLES_CARTE,
  type ChampFiche,
  type FichePublique,
  type SchemaFiche,
  type ValeurFiche,
  type ValeursFiche,
} from "@free-qr/shared-types";

export interface VCardGeneree {
  contenu: string;
  nomFichier: string;
}

type FicheCarte = Pick<FichePublique, "titre" | "schema" | "valeurs">;

function estVide(valeur: ValeurFiche | undefined): boolean {
  return (
    valeur === undefined ||
    valeur === null ||
    (typeof valeur === "string" && valeur.trim().length === 0)
  );
}

function texteValeur(valeur: ValeurFiche | undefined): string {
  if (valeur === undefined || valeur === null) return "";
  return String(valeur).trim();
}

/** Échappement RFC 6350 : antislash, saut de ligne, point-virgule, virgule. */
export function echapperVCard(valeur: string): string {
  return valeur
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function champParCle(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  cles: readonly string[],
): ChampFiche | null {
  for (const cle of cles) {
    const champ = schema.champs.find(
      (candidat) => candidat.cle === cle && candidat.type !== "section",
    );
    if (champ && !estVide(valeurs[champ.cle])) return champ;
  }
  return null;
}

function champParType(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  type: ChampFiche["type"],
): ChampFiche | null {
  return (
    schema.champs.find(
      (champ) =>
        champ.type === type &&
        !estVide(valeurs[champ.cle]),
    ) ?? null
  );
}

function trouverChamp(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
  cles: readonly string[],
  type?: ChampFiche["type"],
): ChampFiche | null {
  return champParCle(schema, valeurs, cles) ?? (type ? champParType(schema, valeurs, type) : null);
}

/** Valeur lisible pour la note vCard (liste = libellé, booléen = Oui/Non). */
function valeurNote(champ: ChampFiche, valeur: ValeurFiche): string {
  if (champ.type === "booleen") return valeur === true ? "Oui" : "Non";
  if (champ.type === "liste") {
    const option = champ.options?.find((item) => item.valeur === String(valeur));
    return option?.libelle ?? String(valeur);
  }
  return texteValeur(valeur);
}

/** Pliage des lignes à 75 octets, comme attendu par les lecteurs vCard. */
export function plierLigneVCard(ligne: string): string {
  const encodeur = new TextEncoder();
  const morceaux: string[] = [];
  let courant = "";
  let taille = 0;

  for (const caractere of ligne) {
    const octets = encodeur.encode(caractere).length;
    if (taille + octets > 75 && courant.length > 0) {
      morceaux.push(courant);
      courant = ` ${caractere}`;
      taille = 1 + octets;
    } else {
      courant += caractere;
      taille += octets;
    }
  }
  morceaux.push(courant);
  return morceaux.join("\r\n");
}

function nomFichier(titre: string, prenom: string, nom: string): string {
  const base = [prenom, nom].filter(Boolean).join("-") || titre;
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "contact"}.vcf`;
}

export function genererVCard(fiche: FicheCarte): VCardGeneree {
  const { schema, valeurs, titre } = fiche;

  const champPrenom = champParCle(schema, valeurs, [CLES_CARTE.prenom]);
  const champNom = champParCle(schema, valeurs, [CLES_CARTE.nom]);
  const champNomComplet = champParCle(schema, valeurs, [
    "nom_complet",
    "nom_affichage",
  ]);
  const champOrganisation = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.organisation, "societe", "entreprise"],
  );
  const champFonction = trouverChamp(schema, valeurs, [
    CLES_CARTE.fonction,
    "poste",
    "titre_poste",
  ]);
  const champEmail = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.email],
    "email",
  );
  const champTelephone = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.telephone],
    "telephone",
  );
  const champSite = trouverChamp(
    schema,
    valeurs,
    [CLES_CARTE.site, "site_web", "website"],
    "url",
  );
  const champAdresse = champParCle(schema, valeurs, [CLES_CARTE.adresse]);
  const champNote = champParCle(schema, valeurs, [CLES_CARTE.note]);

  const prenom = champPrenom ? texteValeur(valeurs[champPrenom.cle]) : "";
  const nom = champNom ? texteValeur(valeurs[champNom.cle]) : "";
  const nomComplet = champNomComplet
    ? texteValeur(valeurs[champNomComplet.cle])
    : "";

  const affichage =
    [prenom, nom].filter(Boolean).join(" ") || nomComplet || titre;

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
      champ.type !== "section" &&
      !utilises.has(champ.cle) &&
      !estVide(valeurs[champ.cle]),
  );

  const noteInitiale = champNote ? texteValeur(valeurs[champNote.cle]) : "";
  const noteRestes = restes.map(
    (champ) =>
      `${champ.libelle} : ${valeurNote(champ, valeurs[champ.cle] as ValeurFiche)}`,
  );
  const note = [noteInitiale, ...noteRestes].filter(Boolean).join("\n");

  const lignes: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${echapperVCard(nom)};${echapperVCard(prenom)};;;`,
    `FN:${echapperVCard(affichage)}`,
  ];

  if (champOrganisation) {
    lignes.push(
      `ORG:${echapperVCard(texteValeur(valeurs[champOrganisation.cle]))}`,
    );
  }
  if (champFonction) {
    lignes.push(
      `TITLE:${echapperVCard(texteValeur(valeurs[champFonction.cle]))}`,
    );
  }
  if (champTelephone) {
    lignes.push(
      `TEL;TYPE=CELL:${echapperVCard(texteValeur(valeurs[champTelephone.cle]))}`,
    );
  }
  if (champEmail) {
    lignes.push(
      `EMAIL;TYPE=INTERNET:${echapperVCard(texteValeur(valeurs[champEmail.cle]))}`,
    );
  }
  if (champSite) {
    lignes.push(
      `URL:${echapperVCard(texteValeur(valeurs[champSite.cle]))}`,
    );
  }
  if (champAdresse) {
    lignes.push(
      `ADR;TYPE=WORK:;;${echapperVCard(texteValeur(valeurs[champAdresse.cle]))};;;;`,
    );
  }
  if (note) {
    lignes.push(`NOTE:${echapperVCard(note)}`);
  }

  lignes.push("END:VCARD");

  return {
    contenu: `${lignes.map(plierLigneVCard).join("\r\n")}\r\n`,
    nomFichier: nomFichier(titre, prenom, nom),
  };
}
