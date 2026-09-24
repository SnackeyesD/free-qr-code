# Suivi — Audit runtime du projet free-qr-code — 2026-09-24

Orchestrateur : kimi-k3 (coordination + vérification uniquement).
Exécutants : sous-agents `kimi-k2.7-code` via `delegate_task`.
Branche : `fix/audit-api-frontend-j0-j5`. Diff en cours au lancement : whitespace-only sur `apps/api/src/index.ts` et `apps/api/src/routes/auth.ts` (aucun changement fonctionnel).

Contexte : `docs/AUDIT_API_FRONTEND.md` (statique, 2026-09-22) + `docs/PLAN_CORRECTION.md` (J0-J5 marqués ✅, API 52/52, web 27/27 — tests unitaires mockés uniquement). L'utilisateur signale des routes cassées en vrai, notamment l'authentification → audit **dynamique** requis.

## Dashboard (orchestrateur uniquement)

| Mission | Périmètre | Statut agent | Vérif. orchestrateur | Verdict |
|---|---|---|---|---|
| A | API : inventaire routes + code auth + `test`/`type-check`/`build` | ✅ TERMINÉ | ✅ (test relancé : 52/52 ; greps JWT/SMTP/migrations confirmés) | Fiable |
| B | Web : routes/pages + clients API vs contrat + `test`/`type-check`/`lint`/`build` | ✅ TERMINÉ | ✅ (sortie réelle vitest 27/27 vue ; claims auth recoupés avec A et code) | Fiable |
| C | Runtime e2e : `wrangler dev --local` + vrais appels HTTP sur tous les parcours | ✅ TERMINÉ | ✅ (112 appels relus dans results*.jsonl ; 4×500 `toBuffer` confirmés ; cause vérifiée dans `qrcode/lib/browser.js` — pas de `toBuffer`) | Fiable |

Synthèse finale : `docs/AUDIT_RUNTIME_2026-09-24.md`. Aucun agent n'a touché au code source (git status vérifié : seuls les diffs whitespace préexistants + ce fichier).

Règles communes aux agents :
- **Audit = lecture seule.** Aucune modification de code source. Aucun commit (l'orchestrateur committe).
- Exception mission C : création de `apps/api/.dev.vars` (fichier local non commité) autorisée si nécessaire au boot.
- Écrire **uniquement** dans sa propre section ci-dessous, en **append-only**, en français.
- Champs fixes à remplir : statut final, date/heure de fin, fichiers touchés (normalement aucun), commandes exécutées + résultats réels (résumé avec chiffres), routes cassées trouvées (pour chacune : route, preuve `fichier:ligne` ou commande curl + statut HTTP réel + corps de réponse), problèmes rencontrés, décisions prises.
- Toute accusation de route cassée doit être adossée à une preuve rejouable (commande exacte).

---

## Section Agent A — API statique + tests unitaires

**Statut final : ✅ TERMINÉ** — date/heure de fin : 2026-09-24 19:44 WAT.
**Fichiers touchés : aucun** (lecture seule strictement respectée ; aucun commit). Note : `apps/api/.dev.vars` existe déjà et **prédate** ma mission (19:41, agent C probablement) — je ne l'ai ni créé ni modifié.

### 1. Commandes exécutées + résultats réels (depuis la racine du repo, branche `fix/audit-api-frontend-j0-j5`)

| Commande | Résultat réel |
|---|---|
| `pnpm --filter api test` | **52/52 tests passés, 9/9 fichiers** (vitest 4.1.10, durée 42,75 s). Zéro échec, zéro skip. |
| `pnpm --filter api type-check` | `tsc --noEmit` → **exit 0**, aucune erreur. |
| `pnpm --filter api build` | **⚠️ Le script `build` est littéralement `tsc --noEmit`** (`apps/api/package.json` ligne 7) — identique à `type-check`. Il ne produit **aucun artefact** ; le déploiement se fait via `wrangler dev/deploy src/index.ts` (esbuild de Wrangler, non vérifié ici). |

Réserve méthodologique : les tests (`apps/api/tests/setup.ts` lignes 13-23) tournent sur **better-sqlite3 + migrations réelles 001-003** avec un env **entièrement mocké** (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, API_BASE_URL, CORS_ORIGINS, TTL… tous fournis). Les 52/52 prouvent la cohérence code↔schéma SQLite, **pas** la santé de l'auth sous wrangler avec la config réelle de `wrangler.toml`.

### 2. Inventaire des routes montées (source : `apps/api/src/index.ts`)

Racine : `GET /`, `GET /health` (index.ts:23-24). Middlewares globaux : requestId, CORS, errorHandler (index.ts:18-21).

| Route | Méthode + path complet | Middlewares | Validator | Risques runtime |
|---|---|---|---|---|
| auth | `POST /auth/register` | rate-limit | `registerSchema` (auth.ts:21) | voir §3 — **flux de vérification email inutilisable** |
| auth | `POST /auth/login` | rate-limit | `loginSchema` (auth.ts:28) | bloque si `est_verifie=0` (auth.ts:174-176) |
| auth | `POST /auth/refresh` | rate-limit | — | rotation OK (auth.ts:215) |
| auth | `POST /auth/logout` | authMiddleware | — | |
| auth | `GET /auth/sessions` | authMiddleware | — | expose `token_hash` brut (auth.ts:249-258) |
| auth | `DELETE /auth/sessions/:tokenHash` | authMiddleware | — | |
| auth | `POST /auth/verify-email` | — | `verifyEmailSchema` | voir §3 — token **non haché** en base |
| auth | `POST /auth/forgot-password` | rate-limit | `forgotPasswordSchema` | **aucun email envoyé** (voir §3) |
| auth | `POST /auth/reset-password` | rate-limit | `resetPasswordSchema` | |
| qrcodes | `GET/POST /qrcodes`, `GET/PATCH/DELETE /qrcodes/:id`, `GET /qrcodes/:id/download` | rate-limit + auth sur `*` (qrcode.ts:18-19) | validators/qrcode.ts | `API_BASE_URL` absent → fallback codé en dur `https://api.free-qrcode.app` (qrcode.ts:64) |
| stats | `GET /qrcodes/:id/stats` | auth | `statsQuerySchema` (stats.ts:11) | |
| redirect | `GET /q/:aliasCourt` | aucun | — | scan via `waitUntil` non bloquant (redirect.ts:26) |
| me | `GET /me/me` (= `/me/me` !), `GET /me/health` | auth sur `/me` seul (user.ts:25) | — | **chemin douteux** : monté sous `/me` (index.ts:30) + route interne `/me` → URL finale `/me/me`, et `/me/health` (sans auth) expose `API_BASE_URL` |
| admin | CRUD `/admin/campaigns*`, `/admin/templates*`, `/admin/users*` | auth + requireAdmin sur `*` (admin.ts:40-41) | validators/admin.js | |
| tracking | `GET /tracking/pixel`, `GET /tracking/click` | aucun | — | anti-open-redirect présent (admin.ts:183-192) |
| api-keys | `GET/POST /api-keys`, `GET/DELETE /api-keys/:id` | auth | inline (api-keys.ts:13-27) | |
| logs | `GET/POST /logs` | auth | inline (logs.ts:13-31) | |
| r2 | `GET /r2/:key` | aucun | — | 404 si binding `QR_IMAGES` absent (r2.ts:12) |
| cron | `scheduled` toutes les 15 min | — | — | `sendDueCampaigns` ; SMTP non configuré → échec loggué seulement (admin.ts:484) |

### 3. Deep-dive authentification (priorité utilisateur)

**Variables d'environnement lues par le code** (grep `c.env|env.` sur `src/`) : `DB`, `QR_IMAGES`, `API_BASE_URL`, `CORS_ORIGINS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_KV`, `JWT_TRACKING_SECRET`, `SMTP_API_URL`, `SMTP_FROM`, `R2_PUBLIC_URL`.

**`wrangler.toml` `[vars]` (lignes 5-7) ne contient QUE `JWT_TRACKING_SECRET` et `SMTP_FROM`.** Manquent au déploiement : `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_BASE_URL`, `CORS_ORIGINS`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `RATE_LIMIT_*`, `SMTP_API_URL`, `R2_PUBLIC_URL`. En local, `apps/api/.dev.vars` (gitignored, .gitignore:33) comble tout sauf `SMTP_API_URL` et `R2_PUBLIC_URL` (les deux optionnels en code).

**⚠️ Comportement si `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` sont absents** (`apps/api/src/services/auth.ts:22-28`) :
```ts
return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
```
Aucun crash, aucune validation : `encode(undefined)` produit la chaîne littérale `"undefined"` comme clé HS256. **L'API signe et vérifie alors tous ses JWT avec le secret `undefined`** — l'auth « fonctionne » mais est cryptographiquement nulle, et tout token émis sans la var devient invalide dès qu'on ajoute la var (et inversement). C'est un suspect majeur pour des ruptures d'auth entre environnements.

**register** (`auth.ts:92-164`) :
- Crée bien une ligne dans `tokens_email` (auth.ts:134-146) — mais `token_hash` reçoit `crypto.randomUUID()` **en clair** (auth.ts:141), pas un hash.
- **Aucun email envoyé** : aucun appel SMTP, aucun stub. Commentaire auth.ts:131-133 : « Sans SMTP configuré, l'utilisateur le récupère via un renvoi / debug » — **aucune route de renvoi n'existe** (grep `resend` : rien). L'utilisateur qui s'inscrit ne peut jamais obtenir son token de vérification par l'application.
- Réponse 201 avec accessToken + cookies posés ; `estVerifie: false` retourné (auth.ts:156).

**login** (`auth.ts:166-196`) : 401 `Invalid credentials` (auth.ts:170), 401 `Email not verified` si `est_verifie=0` (auth.ts:174-176), 401 `Account disabled` si `est_actif=0` (auth.ts:177-179). Combiné au point register → **tout nouvel inscrit est définitivement bloqué hors debug DB**. C'est la cause la plus plausible du signalement « l'authentification est cassée en vrai ».
Réponse : `{ accessToken, expiresAt, user }`, cookies HttpOnly posés (auth.ts:190-195).

**verify-email** (`auth.ts:275-311`) : recherche `WHERE token_hash = ? AND type='verification' AND est_utilise=0` (auth.ts:278) — cohérent avec l'insert en clair ci-dessus (fonctionnel mais stocke des tokens bruts, colonne nommée `token_hash`, UNIQUE). Marque `est_utilise=1`, vérifie l'expiration (24 h, auth.ts:143), émet une nouvelle paire de tokens + cookies.

**forgot-password / reset-password** (`auth.ts:313-361`) : existent. `forgot-password` crée un token `reinitialisation` TTL 1 h (auth.ts:331), **mais ne l'envoie par aucun canal** — même blocage que register (token injoignable). Réponse uniforme `{success:true}` (anti-énumération, auth.ts:316-336). `reset-password` : one-shot via `est_utilise` (auth.ts:354), vérifie TTL (auth.ts:349), **révoque toutes les sessions** (auth.ts:356-359).

**refresh / logout / sessions** : rotation stricte (ancien refresh révoqué auth.ts:215, nouveau inséré auth.ts:219-224) ; `jti` présent dans le JWT mais **jamais stocké/contrôlé en base** (seul `token_hash` l'est) — contrôle de révocation OK car hash du token complet. Cookie refresh `Path=/auth/refresh` (services/auth.ts:115) : le chemin de la requête `/auth/refresh` le matche. Flag `Secure` déduit de `API_BASE_URL?.startsWith('http://localhost')` (services/auth.ts:111) — **si `API_BASE_URL` est absent, `isSecure=true` et le cookie Secure est posé même sur du HTTP non-localhost** (les navigateurs le rejetteraient). `logout` (auth.ts:232-244) révoque le refresh courant + purge les cookies ; `GET /auth/sessions` expose les `token_hash` (auth.ts:254).

### 4. Cohérence migrations ↔ code

Migrations 001 (schéma complet) + 002 (`campagnes_emails.date_creation`) + 003 (`nom`, `corps_texte`, CHECK `cible` étendu à `'consentants'`, rebuild FK) — toutes les colonnes/tables référencées par les requêtes du code sont présentes (revue des INSERT/UPDATE : `qrcodes`, `scans`, `statistiques_qrcodes`, `cles_api`, `journaux_qrcodes`, `tokens_email` (`date_utilisation` ✓ 001:l.215), `refresh_tokens` (`date_revocation` ✓ 001:l.238), `campagnes_emails`, `campagnes_utilisateurs`, `tracking_emails`, `modeles`, `utilisateurs`). **Aucune colonne manquante détectée.** Remarque mineure : `TokenEmailRow` (lib/d1.ts:33-41) déclare un champ `token` inexistant en base (nommage, non utilisé en requête).

### Routes/flux cassés ou suspects (avec preuves)

1. **Inscription → login impossible sans intervention DB** : register n'envoie aucun email et aucune route de renvoi n'existe (preuve : `auth.ts:131-146` insère le token sans l'envoyer ; grep `resend` vide ; login bloque à `auth.ts:174-176`).
2. **Secrets JWT absents de `wrangler.toml`** (preuve : `wrangler.toml:5-7` vs `services/auth.ts:22-28`) → signature avec le secret littéral `"undefined"` en prod si les secrets ne sont pas posés autrement ; tokens invalides dès ajout ultérieur des vars.
3. **`GET /me/me`** : double segment (preuve : `index.ts:30` + `user.ts:25`) — le client web qui appellerait `/me` obtiendrait 404 (à recouper avec l'audit B).
4. **Cookie `Secure` si `API_BASE_URL` absent** (preuve : `services/auth.ts:111`) — casse les cookies en HTTP non-localhost.
5. **`GET /auth/sessions` fuit les `token_hash`** (preuve : `auth.ts:249-258`) — exposition inutile.
6. **Tokens email stockés en clair dans une colonne `token_hash`** (preuve : `auth.ts:141`, `auth.ts:329`).
7. `sameSite` calculé mais constant (`services/auth.ts:112`) — inoffensif, code mort.

### Problèmes rencontrés
- Aucun bloquant. Les 3 commandes tournent ; `build` n'étant qu'un alias de type-check, je n'ai pas pu valider le bundle Wrangler (hors périmètre statique, réservé à l'agent C).
- `git status` montre des modifs non commitées sur `index.ts` et `auth.ts` (whitespace-only selon l'orchestrateur) — non touchées.

### Décisions
- Aucune modification de code (règle lecture seule) ; les points 1-6 sont des constats à transmettre à l'orchestrateur pour le plan de correction (J-onwards). Point prioritaire : pipeline d'envoi email (ou auto-vérification en dev) + présence des secrets JWT dans la config déployée.

---

## Section Agent B — Web statique + tests unitaires

**Statut final : ✅ TERMINÉ** — Date/heure de fin : 2026-09-24 19:44 WAT
**Fichiers touchés : aucun** (lecture seule respectée ; seul ce fichier de suivi a été complété, dans ma section).

### 1. Commandes exécutées (depuis la racine du repo) — résultats réels

| Commande | Résultat réel |
|---|---|
| `pnpm --filter @free-qr/web test` | ✅ **8 fichiers / 27 tests passés, 0 échoué** (vitest v5.0.1, durée ~11,5 s). Avertissement jsdom unique : `Not implemented: navigation to another Document`. Fichiers testés : `AuthContext.test.tsx`, `useQRStats.test.tsx`, `useUsers.test.tsx`, `adminApi.contract.test.ts`, `api.refresh.test.ts`, `qrApi.contract.test.ts`, `QRStatsPage.test.tsx`, `VerifyEmailPage.test.tsx` — tous mockés (MSW), aucun appel réseau réel. |
| `pnpm --filter @free-qr/web type-check` | ✅ `tsc -b --noEmit` — **0 erreur**, exit 0. |
| `pnpm --filter @free-qr/web lint` | ✅ exit 0 — **0 erreur, 2 warnings** (≤ max-warnings 5) : `components/TemplateForm.tsx:43:17` et `contexts/AuthContext.tsx:72:17`, tous deux `react-refresh/only-export-components`. |
| `pnpm --filter @free-qr/web build` | ✅ `tsc -b && vite build` — **160 modules transformés, build en 6,42 s** (dist JS 470,16 kB / gzip 135,77 kB). 1 warning de chunking : `qrApi.ts` importé dynamiquement par `QRListPage.tsx` mais statiquement par les hooks (inoffensif). |

### 2. Table de routage (source : `apps/web/src/App.tsx`)

Toutes les 30 pages importées existent physiquement (vérifié par `ls`/`wc -l`). Guards : `DashboardLayout` redirige vers `/login` si `!user` (`DashboardLayout.tsx:34-36`) ; `AdminGuard` redirige vers `/403` si `role !== 'admin'` (`DashboardLayout.tsx:126-128`).

| Route | Page | Placeholder ? | Appels API |
|---|---|---|---|
| `/` | LandingPage | Non (statique) | Aucun |
| `/features`, `/pricing` | FeaturesPage, PricingPage | Non / quasi (texte statique) | Aucun |
| `/login` | LoginPage | Non | `POST /auth/login` via AuthContext — cohérent |
| `/register` | RegisterPage | Non | `POST /auth/register` — **parcours bloqué, voir §4** |
| `/forgot-password` | ForgotPasswordPage | Non | `POST /auth/forgot-password` — cohérent |
| `/reset-password/:token` | ResetPasswordPage | Non | `POST /auth/reset-password {token, motDePasse}` — cohérent avec schéma API |
| `/verify-email` | VerifyEmailPage | Non | `POST /auth/verify-email {token}` — méthode/body cohérents avec `verifyEmailSchema` |
| `/legal/privacy`, `/legal/terms` | PrivacyPage, TermsPage | Non | Aucun |
| `/dashboard` | DashboardPage | **Oui** (compteurs codés en dur à 0, aucun appel API) | Aucun |
| `/dashboard/qr` | QRListPage | Non | `qrApi.list` → `GET /qrcodes?page&limit&search&type` |
| `/dashboard/qr/new` | QRCreatePage | Non (formulaire) | `qrApi.create` → `POST /qrcodes` |
| `/dashboard/qr/:id` | QRDetailPage | Non | `qrApi.getById` → `GET /qrcodes/:id` |
| `/dashboard/qr/:id/edit` | QREditPage | Non (formulaire) | `qrApi.update` → `PATCH /qrcodes/:id` |
| `/dashboard/qr/:id/stats` | QRStatsPage | Non | `qrApi.stats` → `GET /qrcodes/:id/stats?from&to` |
| `/dashboard/templates` | TemplatesPage | **Oui** (« galerie affichée ici ») | Aucun |
| `/dashboard/api-keys` | ApiKeysPage | **Oui** | Aucun (alors que `GET/POST /api-keys` existe côté API) |
| `/dashboard/settings` | SettingsPage | **Oui** | Aucun |
| `/dashboard/settings/sessions` | SessionsPage | **Oui** | Aucun (alors que `GET /auth/sessions` existe) |
| `/admin` (+ campaigns, campaigns/new, campaigns/:id, templates, users, metrics) | 7 pages admin | AdminDashboardPage et AdminMetricsPage = **placeholders** ; campaigns/templates/users = réelles | `adminApi` → routes `/admin/*` toutes cohérentes |
| `/401`, `/403`, `/500`, `/404`, `*` | pages d'erreur | Non | Aucun |

**Conclusion routing : aucune route ne pointe vers une page manquante** (les 30 imports d'`App.tsx` résolvent). 7 pages sont des placeholders sans appels API : TemplatesPage, ApiKeysPage, SettingsPage, SessionsPage, AdminDashboardPage, AdminMetricsPage, et partiellement DashboardPage.

### 3. Contrat frontend ↔ API (vérifié ligne par ligne contre `apps/api/src/routes/` + validateurs)

- **`lib/qrApi.ts`** : `GET/POST /qrcodes`, `GET/PATCH/DELETE /qrcodes/:id`, `GET /qrcodes/:id/download?format`, `GET /qrcodes/:id/stats?from&to` — tous présents (`qrcode.ts:21-57`, `stats.ts:16`). Query params conformes aux schémas (`listQRCodesSchema`, `downloadQRCodeSchema`, `statsQuerySchema` : `from/to` au format `\d{4}-\d{2}-\d{2}` — `useQRStats.rangeForPeriod` produit bien ce format, `useQRStats.ts:13-17`). ✅
- **`lib/adminApi.ts`** : 14 appels vers `/admin/campaigns*`, `/admin/templates*`, `/admin/users*` — tous présents (`admin.ts:43-157`). Filtres (page/limit/statut/search/role) conformes à `listCampaignsSchema`/`listTemplatesSchema`/`listUsersSchema` (`validators/admin.ts`). ✅
- **`AuthContext.tsx`** : login/logout/register cohérents. **Point d'attention confirmé : `AuthContext.tsx:35` appelle `GET /me/me`** — c'est correct car l'API monte `userRoutes` sous `/me` avec une route interne `/me` (`index.ts:30` + `user.ts:25`), le « vrai » path est donc bien `/me/me` (convention déjà documentée AUDIT §1). ✅ Pas de `/me` simple.
- Enveloppes de réponse : `AuthResponse {accessToken, expiresAt, user}` correspond exactement aux réponses API (`auth.ts:192-196`, `toPublicUser` dans `services/auth.ts:158-167`). `PaginatedResult<T>` utilisé partout côté web — cohérent avec les listes API. ✅
- L'ancienne divergence « `fetch('/admin/templates/:id')` direct dans AdminTemplatesPage » (AUDIT §91) est **corrigée** : plus aucun `api.*`/`fetch` direct dans cette page (grep vérifié). ✅
- **Divergences restantes : aucune** sur les méthodes/paths/params/bodies inventoriés ci-dessus.

### 4. Focus auth — la vraie rupture : inscription → vérification → login

1. **AuthContext `GET /me/me`** : cohérent avec l'API (cf. §3). Au 401 (refresh échoué), l'intercepteur supprime le token et redirige `/login`. ✅
2. **LoginPage** : body `{email, motDePasse}` conforme à `loginSchema` (`auth.ts:28-31`). ✅
3. **RegisterPage** : body `{nom, email, motDePasse, consentementMarketing}` conforme à `registerSchema` (`auth.ts:21-26`). L'API crée bien un jeton dans `tokens_email` (type `verification`, 24 h) — l'ancien bug « aucun code n'insère » est corrigé. ❌ **MAIS** : le jeton inséré est un `crypto.randomUUID()` (`auth.ts:121-135`) **jamais renvoyé au frontend, jamais envoyé par email** (aucun SMTP, aucun service mail dans `apps/api/src`). Or `POST /auth/login` refuse les comptes `est_verifie=0` avec 401 `Email not verified` (`auth.ts:178-180`), et **aucune route de renvoi de vérification n'existe** (`grep -rn "resend" src/` → vide ; routes auth = register/login/refresh/logout/sessions/verify-email/forgot-password/reset-password uniquement). **Résultat : tout utilisateur nouvellement inscrit est structurellement incapable de se connecter.** C'est très probablement le « auth cassée » signalé par l'utilisateur. Preuves : `apps/api/src/routes/auth.ts:115-136` (jeton aléatoire non exposé), `:178-180` (login bloqué), absence de route resend.
4. **VerifyEmailPage** : `POST /auth/verify-email {token}` — méthode et body corrects (schéma `verifyEmailSchema` attend `{token}`, `auth.ts:33-35` ; le code query bien `token_hash`, bug interne de l'audit 09-22 corrigé). Elle fonctionnerait **si** l'utilisateur possédait un jeton — ce qui n'arrive jamais via le parcours normal (point 3).
5. **ForgotPasswordPage / ResetPasswordPage** : cohérents (`{email}` / `{token, motDePasse}` ; 200 uniforme anti-énumération côté API). ✅
6. **Gestion 401 / refresh dans `lib/api.ts`** : file d'attente (`refreshSubscribers`) + verrou `isRefreshing` + flag `_retry` correctement positionné **avant** la mise en file (`api.ts:64-67`), ce qui élimine la boucle infinie. Le refresh passe par axios brut hors intercepteur (`api.ts:26`) donc un 401 de `/auth/refresh` ne relance pas de refresh. **Défaut résiduel mineur** : en cas d'échec du refresh, les requêtes déjà mises en file ne sont jamais rejectées (`api.ts:55-61` vide la file sans rejeter les promesses en attente) → elles restent en suspens jusqu'à la redirection `window.location.href = '/login'`. Pas de boucle, mais des promesses qui ne settle jamais.

### 5. `fetch(` brut hors `lib/`

`grep -rn "fetch(" apps/web/src` : **aucun appel `fetch` réseau** — seuls des `refetch()` (react-query-like dans les hooks/pages). Tout le trafic passe par l'instance axios de `lib/api.ts` (baseURL, Bearer, `withCredentials`). ✅ Aucun bypass.

### 6. Problèmes rencontrés

- Aucun bloquant. Deux runs du test en arrière-plan ont été lancés par précaution puis tués ; les résultats rapportés proviennent du run principal en avant-plan (identiques : 27/27).

### 7. Décisions

- Les 27/27 tests passent mais **tous sont mockés** : ils valident le contrat tel que le frontend l'imagine, pas la compatibilité réelle avec l'API — d'où l'écart entre « tests verts » et « auth cassée en vrai ».
- Priorité de correction recommandée : (1) exposer le jeton de vérification (réponse register, ou endpoint de renvoi/debug en dev) ou ne pas bloquer le login non vérifié ; (2) éventuellement rejecter la file de refresh en échec ; (3) brancher les placeholders ApiKeysPage/SessionsPage qui ont leurs routes API disponibles.

---

## Section Agent C — Runtime e2e (wrangler dev + curl)

**Statut final : ✅ TERMINÉ** — date/heure de fin : 2026-09-24 19:52 WAT.
**Fichiers touchés :**
- `apps/api/.dev.vars` — **créé** (secrets de dev locaux, gitignoré via `.gitignore:33`, non commité, laissé en place) : `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `API_BASE_URL=http://localhost:8787`, `CORS_ORIGINS`, TTL access/refresh, `RATE_LIMIT_*`.
- Aucun fichier source modifié, aucun commit. Scripts + journaux dans `/home/snackeyes/.hermes/cache/scratch/audit-runtime/` (`audit.sh`, `audit2.sh`, `results.jsonl`, `results2.jsonl`, `wrangler.log`, cookie jars et tokens sous `tokens/` — jamais affichés à l'écran).

### 1. Commandes clés + résultats réels

| Étape | Commande | Résultat réel |
|---|---|---|
| Migrations D1 locales | `cd apps/api && pnpm exec wrangler d1 migrations apply free-qr-api-db --local` | 001 ✅, 002 ✅, 003 ✅ (« 22 commands executed successfully ») |
| Boot API | `pnpm exec wrangler dev src/index.ts --local --port 8787` | `[wrangler:inf] Ready on http://localhost:8787` ; `GET /health` → 200. Arrêt propre en fin de mission (`pkill`), port reverifié fermé. |
| Audit e2e | `bash audit.sh` puis `bash audit2.sh` (curl réels, JSONL horodaté) | **68 + 44 appels HTTP** enregistrés (commande, statut, corps tronqué 500 chars) dans `results.jsonl` / `results2.jsonl`. |
| Vérif. DB locale | `pnpm exec wrangler d1 execute free-qr-api-db --local --command "SELECT …" --json` | `tokens_email` bien créé au register ; extraction du token de vérif, puis de réinitialisation, rejouée dans les POST suivants. |

### 2. Tableau des parcours (statut HTTP réel → verdict)

| Parcours | Résultat | Verdict |
|---|---|---|
| `GET /`, `GET /health`, `GET /me/health` | 200 / 200 / 200 | ✅ |
| `POST /auth/register` (payload valide) | 201 + ligne `tokens_email` créée en DB | ✅ |
| `POST /auth/verify-email` token bidon | 400 | ✅ (négatif) |
| `POST /auth/verify-email` token DB | 200 + nouveau token | ✅ |
| `POST /auth/login` **avant** vérif | 401 `Email not verified` | ✅ (garde active) |
| `POST /auth/login` après vérif | 200 | ✅ |
| `POST /auth/login` mauvais mot de passe | 401 `Invalid credentials` | ✅ (négatif) |
| `GET /me/me` Bearer / sans token | 200 / 401 | ✅ |
| `POST /auth/refresh` avec cookie jar | 200 (rotation) | ✅ |
| `GET /auth/sessions` + `DELETE /auth/sessions/:tokenHash` | 200 + 200 (révocation visible au re-GET) | ✅ |
| `POST /auth/logout` | 200 | ✅ |
| `POST /auth/forgot-password` → token DB → `POST /auth/reset-password` → login nouveau mdp | 200 → 200 → 200 | ✅ |
| `POST /qrcodes` **format PNG (défaut)** | **500** | ❌ **KO — bug réel** |
| `POST /qrcodes` avec `parametres.formatImage="svg"` | 201 (QR créé, alias `q9vad3a`) | ✅ (contournement) |
| `GET /qrcodes` (liste, `?search=`, `?type=`) | 200 / 200 / 200 | ✅ |
| `GET/PATCH/DELETE /qrcodes/:id` | 200 / 200 / 204 | ✅ |
| `GET /qrcodes/:id/download?format=png` | **500** | ❌ **KO — même cause** |
| `GET /qrcodes/:id/download?format=svg` | 200 | ✅ |
| `GET /qrcodes/:id/stats` (+ `?from&to`, après scan) | 200 / 200 / 200 | ✅ |
| `GET /q/:aliasCourt` dynamique | 302 vers la cible + scan compté (stats passent de 0 à 1) | ✅ |
| Stats du QR d'un autre user (token B) | **404** (et non 403) | ⚠️ écart acceptable (voir §3) |
| `GET/POST/DELETE /api-keys` | 200 / 201 / 200 | ✅ |
| `GET/POST /logs?idQRCode=` (+ accès autrui) | 200 / 201 / 403 | ✅ |
| `GET /tracking/pixel` sans `t` / avec `t` | 400 / 200 GIF | ✅ |
| `GET /tracking/click?t=&u=https://…` | 302 | ✅ |
| `OPTIONS /auth/login` (preflight CORS) | 204 + headers CORS | ✅ |
| Admin : `GET/POST /admin/campaigns`, `GET/PATCH /:id`, `POST /:id/send` | 200 / 201 / 200 / 200 / **202** `{"sent":2,"status":"envoyee"}` | ✅ (send = stub sans SMTP, voir §3) |
| Admin : `POST /:id/cancel` et `DELETE /:id` **après envoi** | 400 / 400 | ✅ volontaire (machine à états) |
| Admin : `GET/POST/PATCH/DELETE /admin/templates` (+ GET :id) | 200 / 201 / 200 / 204 | ✅ |
| Admin : `GET/PATCH /admin/users`, `GET /admin/users/:id` | 200 / 200 / 200 | ✅ |
| Admin : `DELETE /admin/users/:id` sur soi-même | 403 (non 400) | ⚠️ écart mineur (route protégée, voir §3) |
| Refus non-admin sur `/admin/*` (token B) | 403 | ✅ (négatif) |

**Bilan : 2 KO réels (même cause racine), 2 écarts de statut par design, tout le reste OK.** L'affirmation « l'authentification est cassée en vrai » est **infirmée** côté mécanique d'auth : register, vérif email, garde login, refresh, sessions, logout, forgot/reset passent tous avec de vrais appels HTTP. La vraie rupture produit confirmée par l'agent A (token de vérification jamais envoyé/exposé, aucune route de renvoi) se manifeste bien en runtime : `POST /auth/login` avant vérification → 401, et sans extraction DB le parcours serait un cul-de-sac. L'autre cassure runtime est **la génération d'image QR PNG (500 sur tout `POST /qrcodes` par défaut)** — c'est elle qui rend « les routes cassées en vrai ».

### 3. KO — preuves rejouables + causes

**KO-1 — `POST /qrcodes` (défaut PNG) et `GET /qrcodes/:id/download?format=png` → 500**
Preuve rejouable (après boot wrangler + login d'un user vérifié, token dans `$TOK`) :
```bash
curl -s -w '\n%{http_code}' -X POST http://localhost:8787/qrcodes \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"type":"statique","contenu":"https://example.com","typeContenu":"url"}'
```
Statut réel : **500** — corps : `{"error":{"code":"INTERNAL_ERROR","message":"(0 , import_qrcode.toBuffer) is not a function"},"requestId":"…"}` (constaté 4× : création statique, création dynamique, download PNG, re-création statique).
Cause : `apps/api/src/lib/qr-generator.ts:1` importe `toBuffer` depuis `qrcode` et `:26` l'appelle. Sous `wrangler dev`, le bundler résout `qrcode` via son champ `browser` (`node_modules/qrcode/package.json:17`) dont le build n'exporte que `toCanvas/toString/toDataURL` — `toBuffer` (API Node) est `undefined` dans workerd. Toute création de QR en PNG échoue donc en vrai alors que les tests mockés (`generateQRCodeImage` stubbé) passent. Contournement vérifié : `parametres.formatImage:"svg"` → 201 (le chemin `toString` existe dans le build browser) et `download?format=svg` → 200.

**Écarts par design (non corrigés, à documenter) :**
- Stats/logs d'un QR d'un autre user → **404** et non 403 : `resolveQRCodeRow` filtre `WHERE … AND id_utilisateur = ?` et lève 404 « QR code not found » (`apps/api/src/services/qrcode.ts:223-231`) — pas de fuite d'info, statut différent de la spec seulement.
- `DELETE /admin/users/:id` sur soi-même → **403** « Cannot delete your own account » (`apps/api/src/routes/admin.ts:155-157`) au lieu du 400 supposé.
- `cancel`/`delete` d'une campagne déjà envoyée → **400** volontaire (`apps/api/src/services/admin.ts:275-284`).
- `POST /admin/campaigns/:id/send` répond **202 `{"sent":2}`** sans `SMTP_API_URL` configuré : `sendMailStub` (`services/admin.ts:436+`) marque les destinataires comme envoyés sans aucun envoi réel — les campagnes « envoyées » ne partent nulle part tant que le stub n'est pas branché.

### 4. Problèmes rencontrés (honnêteté)

- Premier run d'audit : extraction du token de réinitialisation vide → chaîne reset/login en 400/401 en cascade. Cause : **mon script** interrogeait `ORDER BY date_creation` sur `tokens_email` (colonne inexistante ; la bonne est `created_at`, migration 001:l.217). Corrigé et re-joué : forgot/reset/login passent 200/200/200. Aucun des KO rapportés ne dépend de cette erreur de script (le 500 `toBuffer` et ses preuves ont été reproduits isolément après coup).
- `jq` 1.6 : mot-clé réservé `label` et pas de shorthand `{label:$x}` — script corrigé (`$lbl`, clés entre guillemets).
- Miniflare n'exécute pas le cron automatiquement (`--test-scheduled` requis) : `sendDueCampaigns` non testé en runtime, seul `POST /:id/send` direct l'a été.
- R2 local émulé silencieusement : `urlImage` renvoyée en `http://localhost:8787/r2/...` ; le GET de l'image stockée n'a pas été audité (hors matrice).

### 5. Décisions

- `.dev.vars` laissé en place (gitignoré, secrets de dev uniquement). Aucune modification de code source, aucun commit — les diffs `index.ts`/`auth.ts` vus au `git status` datent du 22/09 et ne proviennent pas de cette mission.
- Recommandations pour le plan de correction : (1) remplacer `toBuffer` par une génération PNG compatible Workers (ex. via `toString` SVG + rendu, ou lib QR Workers-native) dans `apps/api/src/lib/qr-generator.ts:26` — **bloquant** car toute création de QR par défaut échoue en prod ; (2) exposer le token de vérification (ou route de renvoi / auto-vérification en dev) pour débloquer le parcours inscription ; (3) documenter les statuts 404/403 par design ci-dessus ; (4) brancher un vrai mailer ou rendre explicite le stub de campagne.
