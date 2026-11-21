// routes/consent.ts
// Page intermediaire de consentement (phase 4).
//
// Un 302 ne peut pas afficher de bandeau : les QR qui utilisent une condition
// « appareil » passent donc par cette page, une seule fois par appareil.
// Le HTML est volontairement inline : aucune dependance, aucun JS, < 10 Ko.
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { rateLimitMiddleware } from '../middlewares/rate-limit.js';
import { resolveQrCodeByAlias, type QRCodeRoutable } from '../services/scan.js';
import {
  COOKIE_APPAREIL,
  COOKIE_COMPTEUR,
  COOKIE_REFUS,
  DUREE_APPAREIL_SECONDES,
  DUREE_REFUS_SECONDES,
  configNecessiteConsentement,
  enregistrerConsentement,
  estUuidValide,
  hashAppareil,
  retirerConsentement,
} from '../services/appareil.js';
import type { AppEnv } from '../types/index.js';
import type { AppContext } from '../types/index.js';

function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function optionsCookie(maxAge: number) {
  return {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax' as const,
    maxAge,
  };
}

/** Refuse les POST d'une autre origine (formulaires natifs, pas de CSRF token). */
function origineAutorisee(c: AppContext): boolean {
  const origine = c.req.header('Origin');
  if (!origine) return true; // clients natifs / tests
  try {
    return new URL(origine).origin === new URL(c.req.url).origin;
  } catch {
    return false;
  }
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f8fafc;color:#111827;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.5}
main{width:100%;max-width:440px;background:#fff;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
h1{margin:0 0 8px;font-size:1.35rem}
p{margin:0 0 16px;color:#374151}
.actions{display:flex;flex-direction:column;gap:10px;margin:20px 0 14px}
button{width:100%;padding:15px 18px;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;border:1px solid transparent}
.accepter{background:#4f46e5;color:#fff}
.refuser{background:#fff;color:#111827;border-color:#9ca3af}
a{color:#4f46e5;font-size:.85rem}
small{display:block;margin-top:12px;color:#6b7280;font-size:.78rem}
`;

function gabarit(titre: string, contenu: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${echapperHtml(titre)}</title>
<style>${STYLE}</style>
</head>
<body><main>${contenu}</main></body>
</html>`;
}

function lienConfidentialite(env: AppEnv['Bindings']): string {
  const base = String(env.FRONTEND_URL ?? '').replace(/\/$/, '');
  if (!base) return '';
  return `<a href="${echapperHtml(base)}/legal/privacy">Politique de confidentialité</a>`;
}

function pageConsentement(
  aliasCourt: string,
  env: AppEnv['Bindings'],
): string {
  const alias = encodeURIComponent(aliasCourt);
  return gabarit(
    'Comptage des scans',
    `<h1>Adapter le contenu à vos visites</h1>
<p>Ce QR mémorise sur cet appareil le nombre de scans pour adapter le contenu. Aucune donnée personnelle n'est conservée : seul un identifiant aléatoire, chiffré en base, est utilisé.</p>
<div class="actions">
<form method="post" action="/c/${alias}/accepter"><button class="accepter" type="submit">Accepter</button></form>
<form method="post" action="/c/${alias}/refuser"><button class="refuser" type="submit">Refuser</button></form>
</div>
<p><small>Vous pouvez refuser : le QR fonctionnera normalement, sans mémorisation. Vous pourrez retirer votre consentement à tout moment depuis <a href="/consentement">cette page</a>. ${lienConfidentialite(env)}</small></p>`,
  );
}

function pageRetrait(
  env: AppEnv['Bindings'],
  consentementActif: boolean,
  retire: boolean,
): string {
  const confirmation = retire
    ? `<p role="status"><strong>Consentement retiré.</strong> Le compteur de cet appareil a été supprimé.</p>`
    : '';
  const corps = consentementActif
    ? `<p>Un consentement de comptage par appareil est actif sur cet appareil. Vous pouvez le retirer maintenant : le compteur et le lien avec vos scans seront supprimés.</p>
<form method="post" action="/consentement/retirer"><button class="refuser" type="submit">Retirer mon consentement</button></form>`
    : `<p>Aucun consentement de comptage par appareil n'est actif sur cet appareil.</p>`;

  return gabarit(
    'Mon consentement',
    `<h1>Comptage par appareil</h1>
${confirmation}
${corps}
<p><small>${lienConfidentialite(env)}</small></p>`,
  );
}

async function chargerQr(
  env: AppEnv['Bindings'],
  aliasCourt: string,
): Promise<QRCodeRoutable> {
  const qrCode = await resolveQrCodeByAlias(env, aliasCourt);
  if (!qrCode) throw new HTTPException(404, { message: 'QR code not found' });
  if (!qrCode.estActif) throw new HTTPException(404, { message: 'QR code inactive' });
  if (qrCode.dateExpiration && new Date(qrCode.dateExpiration) < new Date()) {
    throw new HTTPException(410, { message: 'QR code expired' });
  }
  return qrCode;
}

export const consentRoutes = new Hono<AppEnv>();

type AppMiddleware = import('hono').MiddlewareHandler<AppEnv>;
/** Un POST de consentement cree une ligne : on limite les abus par IP. */
const limiteur = rateLimitMiddleware as unknown as AppMiddleware;

consentRoutes.get('/:aliasCourt', async (c) => {
  const aliasCourt = c.req.param('aliasCourt');
  const qrCode = await chargerQr(c.env, aliasCourt);

  // Pas de regle appareil : aucun interstitiel, jamais.
  if (!configNecessiteConsentement(qrCode.configRoutage)) {
    return c.redirect(`/q/${aliasCourt}`, 302);
  }

  // Choix deja memorise : on ne reaffiche pas le bandeau.
  if (
    estUuidValide(getCookie(c, COOKIE_APPAREIL)) ||
    getCookie(c, COOKIE_REFUS) === '1'
  ) {
    return c.redirect(`/q/${aliasCourt}`, 302);
  }

  c.header('Cache-Control', 'no-store');
  return c.html(pageConsentement(aliasCourt, c.env));
});

consentRoutes.post('/:aliasCourt/accepter', limiteur, async (c) => {
  if (!origineAutorisee(c)) {
    throw new HTTPException(403, { message: 'Origine non autorisee' });
  }

  const aliasCourt = c.req.param('aliasCourt');
  await chargerQr(c.env, aliasCourt);

  const idAppareil = crypto.randomUUID();
  const idAppareilHash = await hashAppareil(
    idAppareil,
    c.env.JWT_TRACKING_SECRET,
  );
  await enregistrerConsentement(c.env, idAppareilHash, new Date().toISOString());

  deleteCookie(c, COOKIE_REFUS, { path: '/' });
  setCookie(
    c,
    COOKIE_APPAREIL,
    idAppareil,
    optionsCookie(DUREE_APPAREIL_SECONDES),
  );

  // `cfq_decision` evite une boucle si le navigateur refuse les cookies.
  return c.redirect(`/q/${aliasCourt}?cfq_decision=accept`, 302);
});

consentRoutes.post('/:aliasCourt/refuser', limiteur, async (c) => {
  if (!origineAutorisee(c)) {
    throw new HTTPException(403, { message: 'Origine non autorisee' });
  }

  const aliasCourt = c.req.param('aliasCourt');
  await chargerQr(c.env, aliasCourt);

  // Refuser apres avoir accepte vaut retrait : on delie l'historique.
  const cookieAppareil = getCookie(c, COOKIE_APPAREIL);
  if (estUuidValide(cookieAppareil)) {
    const idAppareilHash = await hashAppareil(
      cookieAppareil,
      c.env.JWT_TRACKING_SECRET,
    );
    await retirerConsentement(c.env, idAppareilHash, new Date().toISOString());
    deleteCookie(c, COOKIE_APPAREIL, { path: '/' });
  }
  if (getCookie(c, COOKIE_COMPTEUR) !== undefined) {
    deleteCookie(c, COOKIE_COMPTEUR, { path: '/' });
  }
  setCookie(c, COOKIE_REFUS, '1', optionsCookie(DUREE_REFUS_SECONDES));

  return c.redirect(`/q/${aliasCourt}?cfq_decision=refus`, 302);
});

export const consentementRoutes = new Hono<AppEnv>();

consentementRoutes.get('/', async (c) => {
  const consentementActif = estUuidValide(getCookie(c, COOKIE_APPAREIL));
  const retire = c.req.query('retire') === '1';
  c.header('Cache-Control', 'no-store');
  return c.html(pageRetrait(c.env, consentementActif, retire));
});

consentementRoutes.post('/retirer', limiteur, async (c) => {
  if (!origineAutorisee(c)) {
    throw new HTTPException(403, { message: 'Origine non autorisee' });
  }

  const cookieAppareil = getCookie(c, COOKIE_APPAREIL);
  if (estUuidValide(cookieAppareil)) {
    const idAppareilHash = await hashAppareil(
      cookieAppareil,
      c.env.JWT_TRACKING_SECRET,
    );
    await retirerConsentement(c.env, idAppareilHash, new Date().toISOString());
  }

  deleteCookie(c, COOKIE_APPAREIL, { path: '/' });
  deleteCookie(c, COOKIE_COMPTEUR, { path: '/' });
  deleteCookie(c, COOKIE_REFUS, { path: '/' });

  return c.redirect('/consentement?retire=1', 302);
});
