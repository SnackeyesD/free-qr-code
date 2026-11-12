import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  anonymizeIp,
  extractClientInfo,
  recordScan,
  resolveQrCodeByAlias,
} from '../services/scan.js';
import { extraireContexte } from '../services/context.js';
import { resoudreVariante } from '../services/routing/resolve.js';
import { construireReponseContenu } from '../services/contenu-dynamique.js';
import { estUrlHttpSure } from '../lib/destination.js';
import {
  COOKIE_APPAREIL,
  COOKIE_COMPTEUR,
  COOKIE_REFUS,
  DUREE_APPAREIL_SECONDES,
  configNecessiteConsentement,
  estUuidValide,
  hashAppareil,
  incrementerCompteur,
  lireCompteur,
} from '../services/appareil.js';
import type { AppEnv } from '../types/index.js';

export const redirectRoutes = new Hono<AppEnv>();

/**
 * Ajoute `?cfq=<idVariante>` a la destination, sans toucher au reste de l'URL
 * (pas de normalisation par `new URL`, qui reecrirait le chemin). Permet au
 * client de mesurer lui-meme une conversion reelle (phase 3, option B).
 */
export function ajouterParametreSuivi(url: string, idVariante: string): string {
  const indexHash = url.indexOf('#');
  const base = indexHash >= 0 ? url.slice(0, indexHash) : url;
  const hash = indexHash >= 0 ? url.slice(indexHash) : '';
  const separateur = base.includes('?') ? '&' : '?';
  return `${base}${separateur}cfq=${encodeURIComponent(idVariante)}${hash}`;
}

/** Attributs communs : aucun cookie lisible en JS, jamais envoye en cross-site. */
function optionsCookie(maxAge: number) {
  return {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax' as const,
    maxAge,
  };
}

redirectRoutes.get('/:aliasCourt', async (c) => {
  const aliasCourt = c.req.param('aliasCourt');
  const qrCode = await resolveQrCodeByAlias(c.env, aliasCourt);

  if (!qrCode) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }

  if (!qrCode.estActif) {
    throw new HTTPException(404, { message: 'QR code inactive' });
  }

  if (qrCode.dateExpiration && new Date(qrCode.dateExpiration) < new Date()) {
    throw new HTTPException(410, { message: 'QR code expired' });
  }

  const necessiteConsentement = configNecessiteConsentement(qrCode.configRoutage);
  const decision = c.req.query('cfq_decision');
  const cookieAppareil = getCookie(c, COOKIE_APPAREIL);
  const appareilConnu = estUuidValide(cookieAppareil);
  const refusMemorise = getCookie(c, COOKIE_REFUS) === '1';

  // Acceptation explicite : on ne conserve pas l'ancien refus.
  if (decision === 'accept' && refusMemorise) {
    deleteCookie(c, COOKIE_REFUS, { path: '/' });
  }

  const consentement = appareilConnu || decision === 'accept';

  // Interstitiel uniquement quand le QR en a besoin et qu'aucun choix n'est
  // encore memorise. Un refus est un choix : on ne reaffiche jamais le bandeau.
  if (
    necessiteConsentement &&
    !consentement &&
    !refusMemorise &&
    decision !== 'refus'
  ) {
    return c.redirect(`/c/${aliasCourt}`, 302);
  }

  // Le comptage n'est actif que pour les QR concernes ET avec consentement.
  const comptageActif = necessiteConsentement && consentement;
  let idAppareilClair: string | null = null;
  let scansAppareil: number | undefined;

  if (comptageActif) {
    // Si le cookie n'a pas pu etre pose, on utilise un identifiant ephemere :
    // le scan aboutit, sans boucle de consentement.
    idAppareilClair = appareilConnu ? cookieAppareil : crypto.randomUUID();
    scansAppareil =
      lireCompteur(getCookie(c, COOKIE_COMPTEUR), aliasCourt) + 1;
  }

  // Contexte calcule localement depuis request.cf : aucun appel reseau.
  const clientInfo = extractClientInfo(c);
  const contexte = extraireContexte(c, qrCode.nombreScansTotal);
  contexte.scansAppareil = scansAppareil;
  contexte.consentementAppareil = comptageActif;
  // Graine stable du tirage A/B : meme IP (/24) + meme appareil = meme variante.
  contexte.graine = `${anonymizeIp(clientInfo.ip)}|${clientInfo.userAgent}|${aliasCourt}`;

  // Une variante de routage n'est retenue que si sa cible est une URL http(s)
  // sure. Sinon on retombe sur le contenu natif du QR (vCard, texte, etc.).
  let destinationVariante: string | null = null;
  let idVariante: string | null = null;
  try {
    const resolution = resoudreVariante(qrCode.configRoutage, contexte);
    if (resolution.variante) {
      if (estUrlHttpSure(resolution.variante.contenu)) {
        destinationVariante = ajouterParametreSuivi(
          resolution.variante.contenu,
          resolution.variante.id,
        );
        idVariante = resolution.variante.id;
      } else {
        console.error(
          'Routage: variante non http(s), fallback sur le contenu du QR',
          resolution.variante.id,
        );
      }
    }
  } catch (err) {
    console.error('Routage: echec de resolution, fallback sur le contenu par defaut', err);
  }

  // Construit la reponse AVANT d'enregistrer le scan : un contenu inutilisable
  // (URL invalide) ne doit pas etre compte comme un scan reussi.
  const reponse = destinationVariante
    ? ({ type: 'redirect', destination: destinationVariante } as const)
    : construireReponseContenu(qrCode.typeContenu, qrCode.contenu);

  const idAppareil =
    comptageActif && idAppareilClair
      ? await hashAppareil(idAppareilClair, c.env.JWT_TRACKING_SECRET)
      : null;

  // Enregistrement asynchrone du scan sans bloquer la redirection.
  c.executionCtx.waitUntil(
    recordScan(c.env, qrCode, clientInfo, contexte, idVariante, idAppareil),
  );

  if (comptageActif && idAppareilClair) {
    setCookie(
      c,
      COOKIE_COMPTEUR,
      incrementerCompteur(getCookie(c, COOKIE_COMPTEUR), aliasCourt),
      optionsCookie(DUREE_APPAREIL_SECONDES),
    );
    if (!appareilConnu) {
      setCookie(
        c,
        COOKIE_APPAREIL,
        idAppareilClair,
        optionsCookie(DUREE_APPAREIL_SECONDES),
      );
    }
  }

  if (reponse.type === 'redirect') {
    return c.redirect(reponse.destination, 302);
  }

  c.header('Content-Type', reponse.contentType);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'no-store');
  if (reponse.nomFichier) {
    c.header(
      'Content-Disposition',
      `attachment; filename="${reponse.nomFichier}"`,
    );
  }
  return c.body(reponse.corps, 200);
});
