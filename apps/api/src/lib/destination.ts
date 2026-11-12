// lib/destination.ts
// Validation des valeurs qui finissent dans un header HTTP (`Location`,
// `Content-Disposition`). Un header n'accepte aucun caractere de controle
// (CR, LF, NUL) : on les refuse AVANT de construire la reponse.

/** C0 (dont \n, \r, \t), DEL. Volontairement large : aucune URL valide n'en contient. */
const CARACTERES_CONTROLE = /[\u0000-\u001F\u007F]/;

/**
 * Vrai si la valeur est une URL http(s) absolue, sans caractere de controle.
 * `new URL` retire les tabulations/retours a la ligne avant de parser : le
 * controle explicite ci-dessus est donc indispensable.
 */
export function estUrlHttpSure(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || valeur.length === 0) return false;
  if (CARACTERES_CONTROLE.test(valeur)) return false;
  if (!/^https?:\/\//i.test(valeur)) return false;

  try {
    const url = new URL(valeur);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Vrai si la valeur commence par l'un des schemas autorises (mailto:, tel:,
 * sms:, geo:) et ne contient aucun caractere de controle.
 */
export function estUriSure(
  valeur: unknown,
  schemas: readonly string[],
): valeur is string {
  if (typeof valeur !== "string" || valeur.length === 0) return false;
  if (CARACTERES_CONTROLE.test(valeur)) return false;
  const minuscule = valeur.toLowerCase();
  return schemas.some((schema) => minuscule.startsWith(schema));
}

/**
 * Normalise une URL http(s) : ajoute `https://` si le schema manque, puis
 * valide. Retourne `null` si la valeur ne peut pas etre une URL http(s) sure.
 */
export function normaliserUrlHttp(valeur: string): string | null {
  const trimmed = valeur.trim();
  if (trimmed.length === 0) return null;
  const candidat = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return estUrlHttpSure(candidat) ? candidat : null;
}
