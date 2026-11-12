// services/contenu-dynamique.ts
// Un QR dynamique n'est pas forcement une redirection : il peut contenir une
// vCard, du texte, un WiFi, etc. On decide donc du format de reponse selon
// `type_contenu` au lieu de mettre le contenu brut dans un header `Location`.

import { HTTPException } from "hono/http-exception";
import { encodeQRContent } from "../lib/qr-generator.js";
import {
  estUriSure,
  estUrlHttpSure,
  normaliserUrlHttp,
} from "../lib/destination.js";
import type { TypeContenuQR } from "../types/index.js";

export type ReponseContenu =
  | { type: "redirect"; destination: string }
  | {
      type: "corps";
      corps: string;
      contentType: string;
      nomFichier?: string;
    };

const SCHEMAS: Partial<Record<TypeContenuQR, readonly string[]>> = {
  email: ["mailto:"],
  telephone: ["tel:"],
  sms: ["sms:", "smsto:"],
  geo: ["geo:"],
};

/** Une vCard doit etre un document complet, pas un fragment. */
export function estVCardValide(contenu: string): boolean {
  const trimmed = contenu.trim();
  return /^BEGIN:VCARD/i.test(trimmed) && /END:VCARD$/i.test(trimmed);
}

/** Normalise les fins de ligne en CRLF (RFC 6350) pour le fichier .vcf. */
export function normaliserVCard(contenu: string): string {
  const lignes = contenu.replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
  return `${lignes.replace(/\n/g, "\r\n")}\r\n`;
}

/**
 * Nom de fichier sur (sans accents ni caracteres speciaux) derive de `FN:`.
 * Evite toute injection dans `Content-Disposition`.
 */
export function nomFichierVCard(contenu: string): string {
  const match = /^FN:(.+)$/m.exec(contenu);
  const nom = match?.[1]?.trim();
  if (!nom) return "contact.vcf";

  const slug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug.length > 0 ? `${slug}.vcf` : "contact.vcf";
}

/**
 * Valide et normalise le contenu d'un QR dynamique a l'ecriture.
 * Chaque type garde ses propres regles : on n'interdit PAS les vCard, texte,
 * WiFi, etc. On refuse seulement un contenu inutilisable pour son type.
 */
export function preparerContenuDynamique(
  type: TypeContenuQR,
  contenu: string,
): string {
  const encode = encodeQRContent(type, contenu);

  switch (type) {
    case "url":
    case "pdf": {
      const url = normaliserUrlHttp(encode);
      if (!url) {
        throw new HTTPException(400, {
          message: "URL http(s) invalide pour ce QR dynamique",
        });
      }
      return url;
    }
    case "vcard": {
      if (!estVCardValide(encode)) {
        throw new HTTPException(400, {
          message: "vCard invalide : BEGIN:VCARD et END:VCARD sont requis",
        });
      }
      return encode;
    }
    case "email":
    case "telephone":
    case "sms":
    case "geo": {
      const schemas = SCHEMAS[type] ?? [];
      if (!estUriSure(encode, schemas)) {
        throw new HTTPException(400, {
          message: `Contenu ${type} invalide`,
        });
      }
      return encode;
    }
    case "wifi": {
      if (!/^WIFI:/i.test(encode)) {
        throw new HTTPException(400, {
          message: "Configuration WiFi invalide",
        });
      }
      return encode;
    }
    case "texte":
    default:
      return encode;
  }
}

/**
 * Construit la reponse a servir pour le contenu d'un QR dynamique.
 * - URL/PDF/email/tel/sms/geo : redirection (valeur validee, jamais de \n) ;
 * - vCard : fichier .vcf telechargeable ;
 * - texte/WiFi : corps text/plain (pas de header `Location`).
 */
export function construireReponseContenu(
  type: TypeContenuQR,
  contenu: string,
): ReponseContenu {
  switch (type) {
    case "vcard":
      return {
        type: "corps",
        corps: normaliserVCard(contenu),
        contentType: "text/vcard; charset=utf-8",
        nomFichier: nomFichierVCard(contenu),
      };
    case "texte":
    case "wifi":
      return {
        type: "corps",
        corps: contenu,
        contentType: "text/plain; charset=utf-8",
      };
    case "url":
    case "pdf": {
      const url = normaliserUrlHttp(contenu);
      if (!url) {
        throw new HTTPException(404, {
          message: "QR code destination invalide",
        });
      }
      return { type: "redirect", destination: url };
    }
    case "email":
    case "telephone":
    case "sms":
    case "geo": {
      const schemas = SCHEMAS[type] ?? [];
      const valeur = encodeQRContent(type, contenu);
      if (!estUriSure(valeur, schemas)) {
        throw new HTTPException(404, {
          message: "QR code destination invalide",
        });
      }
      return { type: "redirect", destination: valeur };
    }
    default:
      // Type inconnu (donnee ancienne/corrompue) : on sert le texte brut
      // plutot que de fabriquer un header `Location` invalide.
      return {
        type: "corps",
        corps: contenu,
        contentType: "text/plain; charset=utf-8",
      };
  }
}
