# Plan de correction — API ↔ Frontend + Vitest Web (mock API)

Référence : `docs/AUDIT_API_FRONTEND.md` (P0/P1/P2). Objectif : parcours verts + non-régression par tests.
Principe : **contrat d'abord** (décider le contrat cible), **tester le contrat** (vitest + mock), **corriger**, **verrouiller**.

## Phase 0 — Vitest côté web + mock API (prérequis)

État actuel : `apps/web/package.json:12` → `"test": "echo 'tests not configured yet'"`. API a déjà vitest (`apps/api/vitest.config.ts`, `tests/setup.ts` D1 via better-sqlite3).

### 0.1 Installer

```bash
pnpm --filter @free-qr/web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw axios-mock-adapter
```

Choix : **MSW** pour mocker au niveau réseau (teste `lib/api.ts` + intercepteurs + refresh), **axios-mock-adapter** en complément pour tests unitaires purs de `qrApi/adminApi`. `jsdom` pour composants/hooks.

### 0.2 Config

- `apps/web/vitest.config.ts` (new) : `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `alias @ → ./src`, `include: ['src/**/*.test.{ts,tsx}']`.
- `apps/web/src/test/setup.ts` (new) : `import '@testing-library/jest-dom'`, `server.listen()/resetHandlers()/close()` MSW, `localStorage.clear()` + `vi.restoreAllMocks()` en `afterEach`.
- `apps/web/src/test/handlers.ts` (new) : handlers MSW miroir du contrat cible §1 (`POST /auth/login`, `GET /me/me`, `GET /qrcodes`, etc.), réponses issues de `src/test/fixtures.ts`.
- `apps/web/src/test/fixtures.ts` (new) : `fakeQR()`, `fakeCampaign()`, `fakeTemplate()`, `fakeUser()` typés `shared-types`.
- Scripts `apps/web/package.json` : `"test": "vitest run"`, `"test:watch": "vitest"`.
- Root `package.json:19` : `test` couvre déjà `./apps/*` + `./packages/*` via filter — rien à changer.

### 0.3 Premiers tests verts (avant corrections)

1. `src/lib/__tests__/api.refresh.test.ts` : mock `POST /auth/refresh` → vérifie rejouage Bearer + purge + redirect `/login` en échec.
2. `src/lib/__tests__/qrApi.contract.test.ts` : MSW strict — assert path/méthode/query (`/qrcodes/:id/stats?from&to`, pas `periode`).
3. `src/lib/__tests__/adminApi.contract.test.ts` : assert 404 actuels documentés comme `todo` → deviennent verts après Phase 3.
4. `src/contexts/__tests__/AuthContext.test.tsx` : login stocke token + setUser ; mount appelle `GET /me/me` (pas `/me`).

Critère DONE Phase 0 : `pnpm --filter @free-qr/web test` passe, même avec `test.todo` pour les P0.

## Phase 1 — P0 Auth (P0-1/2/3 + bug 5.1)

Décision contrat (à figer) : `GET /me/me`, `POST /auth/verify-email {token}`, `POST /auth/forgot-password {email}` + `POST /auth/reset-password {token, motDePasse}` (nouveau), ou suppression pages.

1. API :
   - `auth.ts:251` : `WHERE token` → `WHERE token_hash`, + créer le token à l'inscription (`INSERT tokens_email type=verification`) sinon vérification impossible.
   - Migration `002_auth_tokens.sql` : index/colonnes manquantes si besoin ; décider si `est_verifie` bloque toujours le login (si oui, brancher envoi email réel ou lien dev loggé).
   - Ajouter `forgot/reset-password` (hash bcrypt + `tokens_email type=reinitialisation`, TTL 1h, one-shot) **ou** assumer suppression.
   - Tests API : `tests/auth-verify.test.ts`, `tests/auth-password-reset.test.ts` (register → verify → login OK ; token rejoué → 400 ; expiré → 400).
2. Frontend :
   - `AuthContext.tsx:35` : `GET /me` → `GET /me/me`. Type `AuthResponse {expiresAt}` (pas `expiresIn`).
   - `VerifyEmailPage.tsx:16` : `GET ?token` → `POST /auth/verify-email {token}`.
   - Garder ou supprimer Forgot/Reset selon décision API.
   - Tests web : `AuthContext` + pages auth avec MSW (succès/erreur/loading).

DONE : register → verify → login → refresh → logout verts des deux côtés.

## Phase 2 — P0 Stats QR (P0-4/5/8, P1-2)

Décision contrat : **recommandé B** (moins de code) — frontend s'aligne sur `GET /qrcodes/:id/stats?from&to`. Option A (ajouter `periode|daily|scans` côté API) seulement si `QRStatsPage` a besoin du granular.

1. Frontend :
   - `qrApi.stats(id, {from, to})` → `?from&to`. Supprimer `dailyStats`/`recentScans` ou les rebrancher sur la seule réponse `GET …/stats` (étendre `getQrCodeStats` pour inclure `evolution + recentScans` si besoin UI).
   - `useQRStats.ts:29` : un seul appel (plus de `Promise.all` sur 404). `period '7j'` → calcul `from/to` local.
   - `downloadImage` : retirer `pdf` du type + UI, ou ajouter rendu PDF API.
   - `QRForm` : envoyer `parametres` à l'update (mapper `design → parametres`), documenter que `alias` est serveur-généré.
   - Tests : `qrApi.contract` (query from/to, pdf rejeté), `useQRStats` (1 appel, erreur 403/404 mappée), `QRStatsPage` (counters + graphique avec fixture).
2. API (si option A) : `statsQuerySchema` + `periode`, routes `…/stats/daily`, `…/scans` avec pagination. Sinon rien.

DONE : `QRStatsPage` affiche données mockées puis réelles sans erreur.

## Phase 3 — P0 Admin (P0-6/7, P1-5/6, P1-9)

1. Décision : implémenter `GET/PATCH/DELETE /admin/users` (list paginée + filtre role/search, garde admin) **ou** supprimer `adminApi.users` + `AdminUsersPage` + nav `DashboardLayout.tsx:18`.
2. Campagnes : implémenter `DELETE /admin/campaigns/:id` (brouillon uniquement) + `POST …/cancel` (brouillon/programmee → annulee) **ou** retirer boutons front. Implémenter pagination/filtres serveur (`page/limit/statut/search`) dans `listCampaigns`/`listTemplates` pour rendre `useCampaigns`/`useTemplates` réels.
3. Templates : front envoie `description` (plus `type/contenu/categorie`), `AdminTemplatesPage.tsx:56` : `fetch` brut → `adminApi.templates.update`. Aligner `ModeleQRInput` shared-types sur le validator (retirer `type/contenu/categorie` ou ajouter migration).
4. Tests API : `tests/admin-users.test.ts` (403 non-admin, 200 admin, pagination), `tests/admin-campaigns.test.ts` (CRUD + send + cancel + delete brouillon vs envoyee 400), `tests/admin-templates.test.ts`.
5. Tests web : `adminApi.contract` (paths, 404 avant fix en todo), `useCampaigns/useTemplates/useUsers` + pages (list/create/update/delete/send/cancel avec MSW).

DONE : pages Admin CRUD vertes, plus aucun `fetch` brut (grep `fetch(` dans `src/` = 0 hors tests).

## Phase 4 — P1 Contrats & IDs (P1-1/3/4/7/8)

1. IDs : accepter `id` numérique **et** `public_id` UUID en lecture (`GET /qrcodes/:id`, `stats`, `api-keys/:id`, `logs`) — helper `resolveQRCodeId(env, idOrPublicId)` + tests. Ou documenter `id` numérique partout et convertir le front (moins bon : UUID exposé en migration).
2. Campagnes : migration `003_campagnes.sql` — ajouter `nom`, `sujet`, `corps_texte` séparés **ou** supprimer `nom/corpsTexte` du validator + shared-types. Ajouter `'consentants'` au `CHECK cible` (migration 002/003) — corrige le 500 actuel.
3. Enveloppes : standardiser `{data, total}` vs tableau brut (`/auth/sessions` tableau, `/api-keys/` `{data}`) + typer chaque hook. Unifier `expiresAt`.
4. `design`/`parametres` : un seul nom dans validators + shared-types + formulaires.
5. Tests : contrat OpenAPI snapshot (`merise/11_API_OPENAPI.yaml` régénéré depuis zod), test `shared-types` ↔ D1 (fixtures → insert → lecture → `toPublic*`).

DONE : `pnpm type-check` + `test` verts api + web, plus de CHECK 500, IDs documentés.

## Phase 5 — P2 Durcissement + README resync

- `common.ts` : `CORS_ORIGINS ?? ''`, `Retry-After` sur 429, binder `RATE_LIMIT_KV` en prod (`wrangler.toml`), route `/r2/*` ou `R2_PUBLIC_URL` obligatoire, allowlist `tracking/click`, cron `scheduled` pour campagnes `programmee`, vrais secrets + `database_id`.
- Intercepteur `api.ts` : positionner `_retry` aussi pour requêtes en file d'attente.
- README : `VITE_API_BASE_URL`, D1 (pas Mongo), `GET /me/me`, `POST /auth/verify-email`, `/api-keys`, `/logs`, commandes `wrangler dev` / `vite`.
- Tests : CORS sans var, 429 + Retry-After, redirect tracking signé, R2 fallback.

## Ordre d'exécution + jalons

| Jalon | Contenu | Commande de validation |
|---|---|---|
| J0 | Phase 0 vitest web + MSW | `pnpm --filter @free-qr/web test` vert (todos OK) |
| J1 | Auth P0 | `pnpm --filter @free-qr/api test` + web auth verts |
| J2 | Stats QR | `QRStatsPage` + `qrApi.contract` verts, plus de `periode/daily/scans` 404 |
| J3 | Admin | CRUD campagnes/templates/users verts, grep `fetch(` = 0 |
| J4 | Contrats P1 | type-check + tests api/web verts, migrations 002/003 appliquées |
| J5 | P2 + README | audit relancé, README aligné |

Chaque phase : 1) écrire le test contrat (rouge), 2) corriger, 3) vert + `type-check`, 4) MAJ `docs/AUDIT_API_FRONTEND.md` (ligne barrée / statut).

## Suivi (sept. 2026)

| Jalon | Statut | Résultat |
|---|---|---|
| J0 vitest web + MSW | ✅ | 4 fichiers, contrats mockés, `src/test/{base,setup,handlers,fixtures}` |
| J1 Auth P0 | ✅ | `GET /me/me`, `POST verify-email` + `token_hash`, forgot/reset-password, API 30/30 |
| J2 Stats QR | ✅ | `?from&to`, 1 seul appel, `evolution`, pdf/alias fantômes retirés |
| J3 Admin | ✅ | `/admin/users` CRUD, campagnes delete/cancel, pagination/filtres, migration 002 (`date_creation`) |
| J4 Contrats P1 | ✅ | IDs numériques+UUID, `parametres` unique, migration 003 (nom/corps_texte/`consentants` + rebuild pivots), `TEST_API_BASE` env-proof |
| J5 P2 + README | ✅ | CORS guard, `Retry-After`, tracking http(s), `/r2/*`, cron `sendDueCampaigns`, fix `_retry`, README resynchronisé |

État final : **API 52/52, web 27/27**, `type-check` propres, zéro `it.fails` restant.
