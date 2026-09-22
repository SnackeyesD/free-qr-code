# Audit API ↔ Frontend — Free QR Code SaaS

Date : 2026-09-22 — Inspection statique du code (sans exécution).
Périmètre : `apps/api/src/*`, `apps/web/src/lib/*`, `apps/web/src/hooks/*`, `apps/web/src/contexts/*`, `apps/web/src/pages/*`, `migrations/001_initial_schema.sql`, `wrangler.toml`.

## 0. Résumé exécutif

Le backend (Hono + D1 + R2) est **plus complet que ce que dit le README** (`/api-keys` et `/logs` existent), mais le frontend appelle **7 routes inexistantes** et **4 routes avec un contrat faux** (méthode, path ou query params). Les parcours auth-verify, forgot/reset-password, stats QR, admin-users et une partie campagnes sont donc **cassés en l'état**, même si l'API et l'UI semblent individuellement cohérentes.

P0 (bloquant) : `GET /me`, `GET /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /qrcodes/:id/stats?periode=`, `GET /qrcodes/:id/stats/daily`, `GET /qrcodes/:id/scans`, `GET/PATCH/DELETE /admin/users*`, `DELETE /admin/campaigns/:id`, `POST /admin/campaigns/:id/cancel`, colonne `tokens_email.token` inexistante, IDs string vs numériques.

## 1. Inventaire API réelle

Montage dans `apps/api/src/index.ts:23-31` :

| # | Méthode + Path | Fichier | Auth | Validator / notes |
|---|---|---|---|---|
| 1 | `GET /`, `GET /health` | `src/index.ts:20-21` | non | healthcheck |
| 2 | `POST /auth/register` | `src/routes/auth.ts:81` | rate-limit | `registerSchema` : email, motDePasse≥8, nom, consentementMarketing:boolean. Réponse 201 `{accessToken, expiresAt, user}` — pas `expiresIn`. Crée refresh_token + cookies |
| 3 | `POST /auth/login` | `src/routes/auth.ts:139` | rate-limit | Bloque si `est_verifie=0` → 401 `Email not verified`, si `est_actif=0` → 401. Réponse `{accessToken, expiresAt, user}` |
| 4 | `POST /auth/refresh` | `src/routes/auth.ts:171` | cookie `refreshToken` path `/auth/refresh` | Rotation : révoque l'ancien hash, crée une paire. Réponse `{accessToken, expiresAt}` — **pas de `user`** |
| 5 | `POST /auth/logout` | `src/routes/auth.ts:205` | `authMiddleware` | Révoque par `(token_hash, id_utilisateur)`, clear cookies |
| 6 | `GET /auth/sessions` | `src/routes/auth.ts:219` | auth | Retourne **tableau brut** `[{tokenHash, dateCreation, userAgent, estRevoke}]`, pas de pagination |
| 7 | `DELETE /auth/sessions/:tokenHash` | `src/routes/auth.ts:235` | auth | 404 si 0 row modifiée |
| 8 | `POST /auth/verify-email` | `src/routes/auth.ts:248` | non | Body JSON `{token}` via `verifyEmailSchema`. **Bug interne :** query `WHERE token = ?` alors que la migration expose `token_hash` (`migrations/001_initial_schema.sql:212`, `src/lib/d1.ts:24`). Toujours 400 |
| 9 | `GET /me/me` | `src/routes/user.ts:25` | auth | `SELECT * WHERE id = Number(userId)`. Retour `toPublicUser` |
| 10 | `GET /me/health` | `src/routes/user.ts:34` | non | `{ok, env: API_BASE_URL}` |
| 11 | `GET /qrcodes?page&limit&type&search` | `src/routes/qrcode.ts:21` | rate-limit + auth | `listQRCodesSchema` (`src/validators/qrcode.ts:40`) : page/limit coerce, type `statique|dynamique`, search≤200 |
| 12 | `POST /qrcodes` | `src/routes/qrcode.ts:28` | rate-limit + auth | `createQRCodeSchema` : `{type, contenu 1-4096, typeContenu?, design?}`. Design par défaut `{taille:512, correction:M, cadre:true}` (`src/services/qrcode.ts:88-93`). Dynamique → alias 7 chars + `qrContent = baseUrl/q/alias`, statique → contenu encodé |
| 13 | `GET /qrcodes/:id` | `src/routes/qrcode.ts:35` | rate-limit + auth | `:id` transmis tel quel au service (résolution numérique interne). Pas de validator |
| 14 | `PATCH /qrcodes/:id` | `src/routes/qrcode.ts:42` | rate-limit + auth | `updateQRCodeSchema` (`src/validators/qrcode.ts:34`) : `{contenu?, estActif?, parametres?}` — **note : `design` à la création vs `parametres` à l'update** |
| 15 | `DELETE /qrcodes/:id` | `src/routes/qrcode.ts:50` | rate-limit + auth | 204 + cleanup R2 |
| 16 | `GET /qrcodes/:id/download?format=` | `src/routes/qrcode.ts:57` | rate-limit + auth | `downloadQRCodeSchema` : `png|svg` default png. **Pas de `pdf`**. Régénère via `generateQRCodeImage`, `Content-Disposition: attachment; qr-{id}.{ext}`, cache 1 an |
| 17 | `GET /qrcodes/:id/stats?from&to` | `src/routes/stats.ts:18` | auth | `:id` doit matcher `/^\d+$/` sinon 400. Query `from/to = YYYY-MM-DD` uniquement. Ownership `String(row.idUtilisateur) !== userId` → 403. Délègue à `getQrCodeStats` |
| 18 | `GET /q/:aliasCourt` | `src/routes/redirect.ts:8` | non | 404 si inconnu/inactif, 410 si expiré. `executionCtx.waitUntil(recordScan(...))` puis 302 vers `contenu` |
| 19 | `GET /admin/campaigns` | `src/routes/admin.ts:36` | auth + admin | `listCampaigns` : `LIMIT 100` + count, retour `{data, total}` (`src/services/admin.ts:93-110`) |
| 20 | `POST /admin/campaigns` | `src/routes/admin.ts:41` | auth + admin | `createCampaignSchema` : `{nom, sujet, corpsHtml 1-50000, corpsTexte?, cible?}`. **Stockage :** `titre=sujet.trim()`, `contenu=corpsHtml`, `nom` et `corpsTexte` **jetés** (`src/services/admin.ts:136-147`). Lecture inverse : `nom=titre, sujet=titre, corpsHtml=contenu` (`src/services/admin.ts:63-78`) |
| 21 | `GET /admin/campaigns/:id` | `src/routes/admin.ts:48` | auth + admin | 404 si absente |
| 22 | `PATCH /admin/campaigns/:id` | `src/routes/admin.ts:54` | auth + admin | Bloqué si `statut=envoyee` → 400 |
| 23 | `POST /admin/campaigns/:id/send` | `src/routes/admin.ts:61` | auth + admin | Body `{scheduledAt? datetime}`. 202. Pas de `DELETE`, pas de `/cancel` |
| 24 | `GET /admin/templates` | `src/routes/admin.ts:69` | auth + admin | `listTemplates` → `{data, total}` (`src/services/admin.ts:457`) — pagination gérée côté service, pas de query validator |
| 25 | `POST /admin/templates` | `src/routes/admin.ts:74` | auth + admin | `createTemplateSchema` : `{nom, description?, typeContenu?, parametresParDefaut?, estPublic?}`. **Pas de `type/contenu/categorie`** |
| 26 | `GET /admin/templates/:id`, `PATCH`, `DELETE` | `src/routes/admin.ts:81-94` | auth + admin | CRUD complet. DELETE → 204 |
| 27 | `GET /tracking/pixel?t=` | `src/routes/admin.ts:102` | non | Retourne GIF 1x1 `image/gif`. 400 si `t` manquant |
| 28 | `GET /tracking/click?t=&u=` | `src/routes/admin.ts:113` | non | 302 vers `u` (sans validation d'URL — open-redirect à durcir). 400 si param manquant |
| 29 | `GET /api-keys/` | `src/routes/api-keys.ts:29` | auth | Retour `{data: keys}` — enveloppe objet, pas tableau brut |
| 30 | `POST /api-keys/` | `src/routes/api-keys.ts:35` | auth | `{nom 1-100, permissions[]?, dateExpiration? datetime}`. Retour clé complète 201 (secret visible une seule fois) |
| 31 | `GET /api-keys/:id`, `DELETE /api-keys/:id` | `src/routes/api-keys.ts:46-59` | auth | `:id` numérique, 400 si NaN, 404 si non possédée. DELETE → `{success:true}` (pas 204) |
| 32 | `GET /logs?idQRCode=&limit&offset` | `src/routes/logs.ts:33` | auth | `idQRCode` requis `/^\d+$/`, ownership check `assertQRCodeOwner` → 403 |
| 33 | `POST /logs` | `src/routes/logs.ts:41` | auth | `{idQRCode:int+, action: modification_cible|activation|desactivation|suppression, ancienneValeur?, nouvelleValeur?}` → 201 |

Middlewares transverses : `requestIdMiddleware` + `corsMiddleware` + `errorHandler` (`src/middlewares/common.ts:15-48`, format `{error:{code,message}, requestId}`), `rateLimitMiddleware` in-memory + KV optionnel (`src/middlewares/rate-limit.ts:68-75`, 429 `Too many requests`, défaut 100 req/60s), `authMiddleware` Bearer puis cookie `accessToken` (`src/services/auth.ts:125-142`), `requireAdmin` rôle `admin` sinon 403.

Cookies (`src/services/auth.ts:110-123`) : `accessToken` HttpOnly Path `/`, `refreshToken` HttpOnly Path `/auth/refresh`, `Secure` hors localhost, `SameSite=Lax`. TTL lus depuis `ACCESS_TOKEN_TTL_SECONDS` (défaut 900s) et `REFRESH_TOKEN_TTL_DAYS` (défaut 7j).

Scan (`src/services/scan.ts`) : anonymisation IP dernier octet → 0, geo `ipapi.co` avec timeout 1.5s et skip IP privée, `estUnique` = premier scan du jour par (qr, ip), agrégats `statistiques_qrcodes` (`pays_top`, `appareils_top` JSON).

## 2. Inventaire frontend (ce qui appelle l'API)

### 2.1 Client HTTP

`apps/web/src/lib/api.ts:1-76` : axios `baseURL = VITE_API_BASE_URL || http://localhost:8787`, `withCredentials:true`. Intercepteur request ajoute `Authorization: Bearer <localStorage.accessToken>`. Intercepteur 401 : un seul refresh concurrent (`isRefreshing` + file `refreshSubscribers`), `POST ${API_BASE_URL}/auth/refresh` en axios brut (`api.ts:26`), stocke le nouveau token, rejoue la requête. Échec → purge token + `window.location.href='/login'`. Angle mort : si 2 requêtes 401 arrivent pendant `isRefreshing`, la 2e s'abonne mais `originalRequest._retry` n'est pas positionné pour elle (rejet en boucle possible si le token rejoué est encore 401).

`apps/web/src/contexts/AuthContext.tsx:27-62` : au mount, si `localStorage.accessToken` → `GET /me` (voir §4.1), sinon stop. `login` → `POST /auth/login` attend `{accessToken, expiresIn, user}` — l'API renvoie `expiresAt`, `expiresIn` sera `undefined` (non bloquant mais incohérent). `register` → `POST /auth/register` sans auto-login. `logout` → `POST /auth/logout` puis purge + `navigate('/login')`.

### 2.2 `qrApi` — `apps/web/src/lib/qrApi.ts:19-74`

| Fonction | Appel | Statut |
|---|---|---|
| `list` | `GET /qrcodes?page&limit&search&type` | OK (noms alignés avec `listQRCodesSchema`) |
| `getById` | `GET /qrcodes/:id` | OK si `:id` numérique, KO si `public_id` UUID (voir §4.5) |
| `create` | `POST /qrcodes` | OK. `QRCreateForm` (`components/QRForm.tsx:43-47`) envoie `{type, contenu: encodedContent, design}` — le champ `alias` du formulaire (`useQRForm`) n'est jamais envoyé (API le génère, donc OK mais UI trompeuse) |
| `update` | `PATCH /qrcodes/:id` | OK si `{contenu, estActif, parametres}`. À vérifier : `QREditForm` doit envoyer `parametres`, pas `design` |
| `remove` | `DELETE /qrcodes/:id` | OK (204) |
| `downloadImage` | `GET /qrcodes/:id/download?format=` avec `format png|svg|pdf` | **KO pour `pdf`** : validator refuse `pdf`. `QRDetailPage` propose png/svg/pdf → le bouton pdf fera 400 |
| `stats` | `GET /qrcodes/:id/stats?periode=7j` | **KO** : API attend `?from=YYYY-MM-DD&to=YYYY-MM-DD`, pas `periode` |
| `dailyStats` | `GET /qrcodes/:id/stats/daily?start&end` | **KO 404** : route inexistante |
| `recentScans` | `GET /qrcodes/:id/scans?limit=` | **KO 404** : route inexistante |

`useQRStats` (`hooks/useQRStats.ts:29-33`) fait `Promise.all([stats, dailyStats, recentScans])` : 2 appels sur 3 échouent systématiquement → `QRStatsPage` toujours en erreur/chargement partiel.

### 2.3 `adminApi` — `apps/web/src/lib/adminApi.ts:37-130`

| Fonction | Appel | Statut |
|---|---|---|
| `campaigns.list/getById/create/update/send` | `GET/POST /admin/campaigns*`, `PATCH`, `POST …/send` | OK (paths exacts). `list` envoie `?page&limit&statut&search` mais `listCampaigns` ignore tout et retourne les 100 dernières — filtres inopérants, pas d'erreur |
| `campaigns.remove` | `DELETE /admin/campaigns/:id` | **KO 404** : pas de DELETE côté API |
| `campaigns.cancel` | `POST /admin/campaigns/:id/cancel` | **KO 404** : pas de route cancel |
| `templates.list/getById/create/update/remove` | `/admin/templates*` | Paths OK. `list` envoie `page/limit/search` ignorés côté API (retour `{data,total}` global). `create/update` : le frontend envoie `{nom, type, contenu, estPublic, categorie, typeContenu, parametresParDefaut}` (`pages/AdminTemplatesPage.tsx:34-42, 59-67`) — l'API ne connaît que `{nom, description, typeContenu, parametresParDefaut, estPublic}` : `type/contenu/categorie` sont rejetés (zod strip ou erreur selon config) et `description` n'est jamais envoyée |
| `users.list/update/remove` | `GET/PATCH/DELETE /admin/users*` | **KO 404** : aucune route `/admin/users` dans `routes/admin.ts`. `AdminUsersPage` + `useUsers` + lien `DashboardLayout.tsx:18` sont donc morts |
| `handleUpdate` template | `fetch('/admin/templates/:id')` direct (`pages/AdminTemplatesPage.tsx:56-68`) | **KO** : bypass axios (pas de baseURL, pas de Bearer, pas de cookies). En prod → 404/CORS/401. Utiliser `adminApi.templates.update` |

### 2.4 Pages auth

| Page | Appel | Statut |
|---|---|---|
| `VerifyEmailPage.tsx:16` | `GET /auth/verify-email?token=` | **KO** : API = `POST /auth/verify-email` body `{token}`. 404 méthode + de toute façon bug colonne §5.1 |
| `ForgotPasswordPage.tsx:26` | `POST /auth/forgot-password` | **KO 404** : route inexistante (grep API = 0 match) |
| `ResetPasswordPage.tsx:34` | `POST /auth/reset-password {token, motDePasse}` | **KO 404** : route inexistante. De plus la route front est `/reset-password/:token` (`App.tsx`) mais le token n'est pas validé côté API |
| `LoginPage / RegisterPage` | `POST /auth/login`, `POST /auth/register` | OK (schémas alignés : email/motDePasse/nom/consentementMarketing) |

Aucun appel frontend vers `/api-keys`, `/logs`, `/tracking/*`, `/q/:alias` (normal : tracking et redirect sont publics/hors SPA), ni vers `/auth/sessions` (page `SessionsPage` placeholder).

## 3. Auth & session — séquence réelle

1. `POST /auth/register` → crée user `est_verifie=0`, crée refresh_token, pose 2 cookies, renvoie accessToken. Le frontend **ne connecte pas** (pas de `setUser`) → l'utilisateur doit se loguer, mais `POST /auth/login` **refuse les non-vérifiés** (`auth.ts:147-149`) alors que **rien n'envoie l'email de vérification** (pas de SMTP branché, `sendMailStub` log console). Risque de compte coincé : inscrit mais jamais vérifiable sauf `POST /auth/verify-email` manuel avec un `tokens_email` créé nulle part (aucune route ne l'insère).
2. Refresh : cookie `refreshToken` path `/auth/refresh` — le `fetch` brut d'axios l'envoie correctement, mais un appel `fetch()` manuel hors axios (cf. templates) ne l'envoie pas.
3. `GET /auth/sessions` retourne un tableau brut ; le frontend n'a ni page ni hook pour l'exploiter (`SessionsPage` placeholder).

## 4. Matrice des ruptures (P0 → P2)

### P0 — parcours cassés

| # | Frontend | API réelle | Effet | Fichiers |
|---|---|---|---|---|
| P0-1 | `GET /me` | `GET /me/me` | `AuthProvider` échoue au reload → logout apparent | `AuthContext.tsx:35` vs `user.ts:25`, `index.ts:27` |
| P0-2 | `GET /auth/verify-email?token=` | `POST /auth/verify-email {token}` | Vérification email impossible | `VerifyEmailPage.tsx:16` vs `auth.ts:248` |
| P0-3 | `POST /auth/forgot-password`, `POST /auth/reset-password` | inexistantes | Mot de passe oublié mort | `ForgotPasswordPage.tsx:26`, `ResetPasswordPage.tsx:34` |
| P0-4 | `GET /qrcodes/:id/stats?periode=` | `GET /qrcodes/:id/stats?from&to` | Stats 400 (zod query strict) | `qrApi.ts:57-60` vs `stats.ts:13-18` |
| P0-5 | `GET /qrcodes/:id/stats/daily`, `GET /qrcodes/:id/scans` | inexistantes | `useQRStats` échoue toujours (Promise.all) | `qrApi.ts:62-74`, `useQRStats.ts:29-33` |
| P0-6 | `GET/PATCH/DELETE /admin/users` | inexistantes | Page Utilisateurs admin morte | `adminApi.ts:110-129`, `AdminUsersPage`, `DashboardLayout.tsx:18` |
| P0-7 | `DELETE /admin/campaigns/:id`, `POST …/cancel` | inexistantes | Boutons Supprimer/Annuler campagnes → 404 | `adminApi.ts:65-75` |
| P0-8 | `download format=pdf` | `png\|svg` uniquement | Bouton PDF → 400 | `qrApi.ts:50`, `validators/qrcode.ts:47-49` |

### P1 — contrats divergents (réponse 200 mais données fausses/incomplètes)

| # | Écart | Détail |
|---|---|---|
| P1-1 | IDs numériques vs `PublicId` string | API : `Number(id)`, regex `/^\d+$/` (`stats.ts:20`, `api-keys.ts:48`, `logs.ts:28`), `toPublicQR` renvoie `id: String(row.id)` (`qrcode.ts:48`). Frontend route avec `created.id` (numérique stringifié, OK) mais tout lien basé sur `public_id` UUID → 400. Migration prévoit les deux (`id` + `public_id`), l'API n'accepte que l'un |
| P1-2 | `design` vs `parametres` | Création `design`, update `parametres` (`validators/qrcode.ts:27-38`). `shared-types QRCodeUpdateInput` utilise `parametres` (cohérent update) mais le formulaire d'édition doit mapper `design → parametres` explicitement |
| P1-3 | Campagne `nom/sujet/corpsHtml` vs `titre/contenu` | Validator demande `nom+sujet+corpsHtml`, table `campagnes_emails` n'a que `titre+contenu` (`migrations:117`), service mappe `titre=sujet`, `contenu=corpsHtml`, jette `nom`/`corpsTexte` (`admin.ts:136-160`). `nom` distinct du sujet impossible sans migration |
| P1-4 | `cible=consentants` | Accepté par `validators/admin.ts:5-11` mais refusé par `CHECK (cible IN ('tous','actifs','inactifs','non_verifies'))` (`migrations:117`) → 500/SQLite CHECK au `send`/`create` avec `consentants` |
| P1-5 | Templates : champs fantômes | Frontend envoie `type/contenu/categorie`, API attend `description`. `description` perdue, `type/contenu/categorie` ignorés/rejetés. `ModeleQRInput` shared-types contient les deux mondes |
| P1-6 | Pagination/filtres ignorés | `GET /admin/campaigns?page&statut&search` et `GET /admin/templates?page&search` : paramètres acceptés côté front mais ignorés côté service (retour global ≤100). `useTemplates`/`useCampaigns` paginent sur un total global → pages vides |
| P1-7 | Enveloppes incohérentes | `/auth/sessions` → tableau brut, `/api-keys/` → `{data}`, `/admin/*` → `{data,total}`, `/logs` → `{data,total?}` à vérifier. Chaque hook doit mapper au cas par cas |
| P1-8 | `expiresIn` vs `expiresAt` | `AuthContext` type `AuthResponse {expiresIn}` mais API renvoie `expiresAt` (`auth.ts:122,165,200`). Non bloquant (champ inutilisé) mais à aligner |
| P1-9 | `fetch` brut templates | `AdminTemplatesPage.tsx:56` bypass `api` : pas de baseURL (`/admin/...` relatif au front :5173), pas d'auth, pas de refresh. Échec garanti hors `wrangler dev` proxy |

### P2 — robustesse / sécurité / config

- **CORS** (`common.ts:5-13`) : `CORS_ORIGINS.split(',')` — crash si var absente (pas de `?? ''`). Whitelist localhost seulement si une origine localhost est déjà autorisée. `Allow-Headers` inclut `Authorization, Content-Type, X-Request-ID` : OK pour axios.
- **Rate-limit** (`rate-limit.ts`) : in-memory `Map` par isolate Workers — non partagé en prod sans `RATE_LIMIT_KV` (non bindé dans `wrangler.toml`). Clé `user:id` ou `ip` + fenêtre ; 429 sans `Retry-After`.
- **Cookies** : `Path=/auth/refresh` pour le refresh — tout `fetch` manuel vers `/auth/refresh` avec path différent n'envoie pas le cookie. `Secure` conditionné à `API_BASE_URL` : en preview `https://*.workers.dev` OK, en `http://<ip>` non-secure OK.
- **R2** : `QR_IMAGES` optionnel (`qrcode.ts` : upload si bucket présent). `R2_PUBLIC_URL` ou fallback `${API_BASE_URL}/r2/...` — mais aucune route `/r2/*` n'existe dans `index.ts` → URL fallback 404.
- **Tracking click** : `c.redirect(url, 302)` sans allowlist (`admin.ts:113-123`) — open-redirect. À restreindre ou signer.
- **GeoIP** : `fetch ipapi.co` timeout 1.5s, échec silencieux `{}` — OK en dégradé, mais sans cache KV cela ralentit chaque premier scan.
- **Env** : `database_id = "<your-d1-database-id>"` placeholder (`wrangler.toml:16`), `JWT_TRACKING_SECRET` = `dev-tracking-secret-change-me`, `JWT_ACCESS/REFRESH_SECRET`, `CORS_ORIGINS`, `API_BASE_URL` absents du toml (secrets à poser). Frontend lit `VITE_API_BASE_URL`, README documente `VITE_API_URL` — variable README fausse.
- **List QR search** : `search` en `LIKE %...%` sur `contenu` — pas d'échappement `%/_` explicite, full-scan sans index texte (OK à petite échelle).

## 5. Bugs internes API (même sans frontend)

| # | Bug | Preuve |
|---|---|---|
| 5.1 | `POST /auth/verify-email` query une colonne inexistante | `auth.ts:251` : `WHERE token = ?` vs migration `token_hash TEXT UNIQUE` (`migrations:212`), type `TokenEmailRow {token_hash}` (`lib/d1.ts:24`). De plus aucun code n'insère dans `tokens_email` (register n'en crée pas) → vérification structurellement impossible |
| 5.2 | `CHECK cible` vs validator | `migrations:117` 4 valeurs vs `validators/admin.ts:5-11` 5 valeurs (`consentants`). Insertion `consentants` → `D1_ERROR: CHECK constraint failed` remonté en 500 via `errorHandler` |
| 5.3 | `mapUser` expose `motDePasse` en interne | `user.ts:7-21` inclut `motDePasse: row.mot_de_passe` dans l'objet mappé (heureusement `toPublicUser` le filtre avant réponse). À nettoyer pour éviter toute fuite future |
| 5.4 | `GET /qrcodes/:id` sans validator | `:id` non validé (contrairement à stats). `public_id` UUID accepté ou non selon le service — comportement à uniformiser (accepter les deux ou documenter) |
| 5.5 | `sendCampaign` programmé vs immédiat | `sendCampaignSchema.scheduledAt` optionnel ; si futur → statut `programmee` sans cron pour l'envoyer plus tard (pas de scheduled worker). La campagne reste `programmee` indéfiniment |

## 6. Points positifs (à préserver)

- Contrats `create/list QR`, `login/register`, `admin campaigns send`, `templates CRUD`, `redirect /q/:alias` bien alignés quand le frontend utilise le bon path.
- Auth Bearer + cookie fallback (`auth.ts:125-142`), rotation refresh avec révocation, sessions listables/révocables.
- Anonymisation IP, validation zod systématique en écriture, request-id + handler d'erreur uniforme, R2 avec cache long, scan non-bloquant via `waitUntil`.
- Types partagés `shared-types` couvrent les 12 tables (paires Public/Internal) — base saine pour générer le contrat OpenAPI.

## 7. Recommandations (ordre suggéré)

**P0 — réparer les parcours :**
1. Choisir le contrat stats : soit ajouter `?periode=24h|7j|30j|90j|1an` + routes `…/stats/daily` et `…/scans` côté API, soit migrer `qrApi.stats/dailyStats/recentScans` + `useQRStats` vers `?from&to` et n'utiliser que `GET …/stats`. Ne pas laisser `Promise.all` sur des 404.
2. Aligner auth : `AuthContext` → `GET /me/me` ; `VerifyEmailPage` → `POST /auth/verify-email {token}` ; implémenter `forgot/reset-password` ou retirer les pages + liens.
3. Admin : implémenter `GET/PATCH/DELETE /admin/users` (ou retirer page + nav + `adminApi.users`), implémenter `DELETE /admin/campaigns/:id` + `POST …/cancel` (ou retirer boutons), remplacer le `fetch` brut templates par `adminApi`.
4. Corriger `tokens_email.token` → `token_hash` + créer le token à l'inscription (ou supprimer la vérification bloquante au login si le flux email n'est pas prêt).
5. Décider IDs : accepter `id` numérique **et** `public_id` UUID en lecture (`GET /qrcodes/:id`, `stats`, `api-keys`, `logs`), ou exposer clairement l'un et migrer le frontend.

**P1 — contrats :**
6. Unifier `design`/`parametres` (un seul nom), `expiresIn`/`expiresAt`, enveloppes (`{data,total}` partout ou tableau partout documenté).
7. Campagnes : ajouter colonnes `nom/sujet/corps_texte` ou supprimer du validator ; ajouter `consentants` au CHECK D1 (migration 002).
8. Templates : envoyer `description` depuis le front, cesser `type/contenu/categorie` (ou ajouter colonnes + migration).
9. Implémenter pagination/filtres serveur pour `/admin/campaigns` et `/admin/templates` (ou passer en client-side assumé et retirer les query params).
10. Retirer `pdf` du front ou ajouter le rendu PDF côté API (actuellement `qrcode` lib ne sort que png/svg).

**P2 — durcissement :**
11. `CORS_ORIGINS ?? ''`, `Retry-After` sur 429, binder `RATE_LIMIT_KV` en prod, route `/r2/*` ou `R2_PUBLIC_URL` obligatoire, allowlist tracking click, cron `scheduled` pour campagnes `programmee`, `wrangler.toml` : vrai `database_id` + secrets hors repo, README : `VITE_API_BASE_URL`, D1 (pas Mongo), vrais paths `/me/me`, `POST /auth/verify-email`.

## Annexe — fichiers audités

API : `src/index.ts`, `src/routes/auth.ts`, `src/routes/user.ts`, `src/routes/qrcode.ts`, `src/routes/stats.ts`, `src/routes/redirect.ts`, `src/routes/admin.ts`, `src/routes/api-keys.ts`, `src/routes/logs.ts`, `src/validators/qrcode.ts`, `src/validators/admin.ts`, `src/services/auth.ts`, `src/services/qrcode.ts` (1-120), `src/services/admin.ts` (1-200, 457), `src/middlewares/common.ts`, `src/middlewares/rate-limit.ts`, `migrations/001_initial_schema.sql` (1-80, 117, 212), `src/lib/d1.ts:24`, `wrangler.toml`.
Frontend : `src/lib/api.ts`, `src/lib/qrApi.ts`, `src/lib/adminApi.ts`, `src/contexts/AuthContext.tsx`, `src/hooks/useQRStats.ts`, `src/hooks/useTemplates.ts` (1-70), `src/components/QRForm.tsx` (1-80), `src/pages/VerifyEmailPage.tsx`, `src/pages/ForgotPasswordPage.tsx`, `src/pages/ResetPasswordPage.tsx`, `src/pages/AdminTemplatesPage.tsx`, `src/layouts/DashboardLayout.tsx:18`.
