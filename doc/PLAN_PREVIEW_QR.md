# Plan — Endpoint preview QR + tests images (F3 + F4)

Branche de travail : `production`. Périmètre strict : **F3** (endpoint `GET /preview/qr`) et **F4** (tests).
Hors scope (déjà fait par ailleurs, ne pas toucher) : F1 (quiet zone, `QUIET_ZONE_MIN`),
F2 (buffers exacts png/pdf), dualité `design`/`parametres`, réconciliation des branches.

## 1. Contexte

- L'aperçu à la création (`QRPreview`, `apps/web/src/components/QRPreview.tsx:23-33`)
  appelle `GET {API_BASE_URL}/preview/qr?content&couleur&background&size&correction`.
- Cet endpoint **n'existe pas** dans l'API → l'`<img>` tombe en `onError` →
  « Aperçu indisponible » à la création. En détail ça passe par l'image stockée,
  d'où l'impression que « ça marche ».
- `urlImagePng` (`QRDetailPage.tsx:144`) n'est fourni par aucun endpoint backend :
  toujours `undefined`, repli silencieux sur `urlImage`. Non adressé ici (nettoyage
  ultérieur éventuel), l'endpoint preview suffit à réparer l'aperçu.

## 2. Conventions relevées (à respecter)

| Sujet | Convention sur `production` |
|---|---|
| Fichiers routes | `export const xxxRoutes = new Hono<AppEnv>()`, imports `.js`, double quotes |
| Validation | `zValidator("query"\|"json"\|"param", schema)` de `@hono/zod-validator` |
| Rate-limit public | `rateLimitMiddleware` de `../middlewares/rate-limit.js` (cf. `routes/qrcode.ts:25`) |
| Schémas QR | `apps/api/src/validators/qrcode.ts` (regex hex `#rrggbb` lignes 18-25, enum correction, `taille` 64-2048) |
| Montage | `app.route("/xxx", xxxRoutes)` dans `src/index.ts` + import style lignes 1-17 |
| Tests | `apps/api/tests/*.test.ts`, helpers `createTestApp`/`createTestEnv`/`makeRequest` de `tests/setup.ts` |

## 3. F3 — `GET /preview/qr` (détail d'implémentation)

### 3.1 `previewQrSchema` dans `apps/api/src/validators/qrcode.ts`

```ts
export const previewQrSchema = z.object({
  content: z.string().min(1).max(4096),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.coerce.number().int().min(64).max(600).default(400),
  correction: z.enum(["L", "M", "Q", "H"]).default("M"),
});
export type PreviewQrInput = z.infer<typeof previewQrSchema>;
```

- Mêmes regex que `designSchema` (cohérence création ↔ aperçu).
- `size` capé à 600 : c'est ce que le front envoie déjà (`Math.min(taille, 600)`),
  et ça borne le coût CPU (anti-abus, route publique).
- `z.coerce` car les query params arrivent en string (même pattern que
  `listQRCodesSchema` lignes 48-53).

### 3.2 Nouveau `apps/api/src/routes/preview.ts`

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { rateLimitMiddleware } from "../middlewares/rate-limit.js";
import { generateQRCodeImage } from "../lib/qr-generator.js";
import { previewQrSchema } from "../validators/qrcode.js";
import type { AppEnv } from "../types/index.js";

export const previewRoutes = new Hono<AppEnv>();

previewRoutes.get(
  "/qr",
  rateLimitMiddleware as unknown as import("hono").MiddlewareHandler<AppEnv>,
  zValidator("query", previewQrSchema),
  async (c) => {
    const q = c.req.valid("query");
    const { buffer, mimeType } = await generateQRCodeImage(q.content, {
      couleur: q.couleur,
      background: q.background,
      taille: q.size,
      correction: q.correction,
      formatImage: "svg", // aperçu vectoriel, fidèle, pas cher (pas de resvg)
    });
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600", // aperçu, pas un asset
      },
    });
  },
);
```

Décisions :
- **Public sans auth** : l'aperçu sert pendant la création ; aucune donnée exposée
  (génération pure). Protégé par rate-limit comme les autres routes publiques.
- **SVG forcé** : pas de param `format` (le front n'en envoie pas) ; le SVG inclut
  déjà la quiet zone F1 → aperçu = réalité.
- `new Response(buffer…)` plutôt que `c.body` (buffers déjà exacts post-F2).

### 3.3 Montage dans `src/index.ts`

```ts
import { previewRoutes } from "./routes/preview.js";
...
app.route("/preview", previewRoutes);
```

### 3.4 Frontend : rien à changer

`QRPreview.tsx:23-33` appelle déjà `?content&couleur&background&size&correction`.
Vérifier en recette que l'aperçu de création s'affiche (fini « indisponible »).

## 4. F4 — `apps/api/tests/qrcode-image.test.ts` (détail des cas)

Style : mêmes imports/helpers que les suites existantes
(`vitest`, `createTestApp`, `createTestEnv`, `makeRequest`).

### 4.1 Marge réelle, même avec `cadre:false` (sans DB, appel direct)

```ts
import { generateQRCodeImage } from "../src/lib/qr-generator.js";

const { buffer } = await generateQRCodeImage("https://youtu.be/abc123", {
  couleur: "#000000",
  background: "#ffffff",
  taille: 400,
  correction: "M",
  // cadre: false  + variante sans `cadre`
});
const svg = Buffer.from(buffer).toString("utf-8");
// 1er module du path : M<col> <row>.5h…
const m = svg.match(/<path stroke="[^"]+" d="M(\d+) ([\d.]+)h/);
expect(m).toBeTruthy();
expect(Number(m[1])).toBeGreaterThanOrEqual(4); // col
expect(Math.floor(Number(m[2]))).toBeGreaterThanOrEqual(4); // row
```

- Méthode validée manuellement sur `5.svg` (col=0/row=0 à l'époque du bug).
- Robuste à la version QR (pas de décodage matrice requis).

### 4.2 Buffers exacts par format (sans DB)

- `png` : 8 premiers octets = signature PNG, 12 derniers = `IEND` + CRC
  (longueur totale == fin du chunk IEND, cf. contrôle manuel sur `5.png`).
- `svg` : commence par `<svg`, décodable UTF-8.
- `pdf` : commence par `%PDF`.

### 4.3 Route preview (via `makeRequest`, sans auth)

- `GET /preview/qr?content=https://example.com&couleur=%23000000&background=%23ffffff&size=400&correction=M`
  → `200`, `Content-Type: image/svg+xml`, corps commençant par `<svg`.
- `GET /preview/qr` (sans `content`) → `400`.
- `GET /preview/qr?content=x&couleur=red` → `400`.

## 5. Ordre d'exécution et critères DONE

1. `previewQrSchema` + type export → `type-check` API vert.
2. `routes/preview.ts` + montage `index.ts` → `type-check` vert.
3. `tests/qrcode-image.test.ts` (4.1 + 4.2 + 4.3) → `vitest run` vert.
4. Suite complète : `pnpm --filter @free-qr/api test` + `type-check` verts (non-régression).
5. Recette terrain (manuelle) : restart `wrangler dev`, création avec `cadre:false` →
   aperçu visible, download png → marge blanche vérifiable, impression + scan OK.

## 6. Risques et replis

- `qrcode@1.5.4` ne change pas (pas de bump de dépendance dans ce plan).
- Si `size` coerce échoue sur valeur non numérique → `400` zod, couvert par 4.3.
- Aucune migration DB, aucun changement de schéma, aucun impact sur les QR existants.

## 7. Suivi d'exécution

- F3 implémenté : `previewQrSchema` (`validators/qrcode.ts`), `routes/preview.ts`
  (public + rate-limit, SVG forcé, cache 1h), montage `/preview` dans `index.ts`.
- F4 implémenté : `tests/qrcode-image.test.ts` (marge ≥ 4 modules y compris
  `cadre:false`, buffers exacts png/svg/pdf, route 200/400/400).
- Découvertes en cours de route (traitées) :
  - `@cf-wasm/resvg` ne charge pas sous vitest (`import 'wbg'` workerd-only) :
    `qrcode.test.ts` existant était cassé à l'import. Ajout d'un alias vitest vers
    `tests/mocks/resvg-workerd.ts` (mini-PNG valide déterministe) ; rendu réel
    toujours vérifié en recette dev.
  - `QRCodeDesign.formatImage` élargi à `"png" | "svg" | "pdf"` (shared-types +
    rebuild `dist`), sinon `type-check` rouge sur download `pdf` (pré-existant).
- État final : `pnpm --filter @free-qr/api test` → 5 fichiers, 31 tests verts ;
  `type-check` API/web/shared-types verts.
- Recette terrain restante (manuelle) : restart `wrangler dev`, création avec
  `cadre:false` → aperçu visible, download png → marge blanche, impression + scan OK.
