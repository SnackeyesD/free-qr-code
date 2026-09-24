# Audit runtime du projet — Free QR Code SaaS

Date : 2026-09-24 — Branche : `fix/audit-api-frontend-j0-j5` (commit `16ce328`).
Méthode : audit **dynamique** (112 appels HTTP réels contre `wrangler dev --local` + D1 locale migrée) + audit statique API/web + rejeu des suites de tests. Détail des exécutions et preuves : `docs/SUIVI_AUDIT_RUNTIME.md`. Toutes les affirmations ci-dessous ont été revérifiées par l'orchestrateur contre le code et les journaux d'exécution.

## 0. Résumé exécutif

Le signalement « des routes sont cassées, notamment l'authentification » est **confirmé, mais pas pour la raison qu'on croit** :

- **La mécanique d'auth fonctionne** en vrai (register, verify-email, login, refresh, logout, sessions, forgot/reset : tous testés OK avec de vrais appels HTTP).
- **MAIS le parcours d'inscription est un cul-de-sac produit** : le token de vérification n'est jamais envoyé (aucun SMTP, aucune route de renvoi), et le login refuse les comptes non vérifiés → **aucun nouvel utilisateur ne peut se connecter**. C'est le « auth cassée » ressenti.
- **Second bug runtime réel** : toute création de QR en PNG (le défaut) et le download PNG renvoient **500** — la lib `qrcode` est résolue en build *browser* par Wrangler, qui n'exporte pas `toBuffer`. Seul le SVG fonctionne.
- Les tests (API 52/52, web 27/27) passent mais sont **entièrement mockés** — ils n'ont détecté ni l'un ni l'autre. Angle mort à traiter.

Bilan runtime : 112 appels, **2 routes KO (même cause racine PNG)**, 4 écarts de statut par design, tout le reste OK. Contrat frontend ↔ API : **zéro divergence restante** (les corrections J0-J5 sont bien effectives).

## 1. P0 — Bloquants produit

### P0-1. Inscription → connexion impossible (le « auth cassée »)

| Étape | Comportement réel | Preuve |
|---|---|---|
| `POST /auth/register` | 201, crée le user `est_verifie=0` + insère un token dans `tokens_email` (UUID **en clair** dans la colonne `token_hash`) | `apps/api/src/routes/auth.ts:131-146` |
| Envoi du token | **Jamais** : aucun appel SMTP, aucun stub, aucune route de renvoi (`grep resend` → vide). Le commentaire `auth.ts:131-133` mentionne un « renvoi / debug » qui n'existe pas | grep `SMTP\|sendMail\|resend` sur `apps/api/src` |
| `POST /auth/login` | 401 `Email not verified` tant que `est_verifie=0` | `auth.ts:174-176` ; reproduit en runtime (Agent C) |
| `POST /auth/verify-email` | Fonctionne (200) **si** on possède le token — uniquement possible en le lisant en base | runtime : token extrait via `wrangler d1 execute` → 200 |

Conséquence : **tout nouvel inscrit est définitivement bloqué** sauf intervention manuelle en base. Le même blocage existe pour `forgot-password` (token créé `auth.ts:331`, jamais envoyé).

### P0-2. Génération QR PNG → 500 systématique

```
POST /qrcodes  {"type":"statique","contenu":"https://example.com","typeContenu":"url"}
→ 500 {"error":{"code":"INTERNAL_ERROR","message":"(0 , import_qrcode.toBuffer) is not a function"}}
```
Reproduit 4× en runtime (création statique, dynamique, download PNG ×2). Cause : `apps/api/src/lib/qr-generator.ts:1` importe `toBuffer` depuis `qrcode` et l'appelle en `:26` ; or le build résolu par Wrangler (`qrcode/lib/browser.js`) n'exporte que `toCanvas`/`toString`/`toDataURL` — vérifié dans le package installé. **Contournement vérifié** : `parametres.formatImage:"svg"` → 201, `download?format=svg` → 200.

## 2. P1 — Sécurité / config

| # | Constat | Preuve |
|---|---|---|
| P1-1 | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` absents de `wrangler.toml [vars]` (qui ne contient que `JWT_TRACKING_SECRET` + `SMTP_FROM`). `services/auth.ts:22-28` fait `TextEncoder().encode(env.JWT_ACCESS_SECRET)` **sans validation** → si la var manque, tous les JWT sont signés avec le secret littéral `"undefined"`. Tokens invalidés dès qu'on pose la var, et inversement | `wrangler.toml:5-7`, `services/auth.ts:22-28` |
| P1-2 | Tokens email stockés **en clair** dans une colonne nommée `token_hash` (register + forgot-password) | `auth.ts:141`, `auth.ts:329` |
| P1-3 | `GET /auth/sessions` expose les `token_hash` bruts des sessions | `auth.ts:249-258` |
| P1-4 | Cookie `Secure` posé si `API_BASE_URL` est absent (`startsWith('http://localhost')` → false → `isSecure=true`) : cookies rejetés par les navigateurs en HTTP non-localhost | `services/auth.ts:111` |
| P1-5 | `POST /admin/campaigns/:id/send` répond 202 `{"sent":2}` mais `sendMailStub` n'envoie rien sans `SMTP_API_URL` (absente partout) : les campagnes « envoyées » ne partent nulle part | `services/admin.ts:436-484`, runtime 202 constaté |
| P1-6 | En cas d'échec du refresh, la file de requêtes en attente (`refreshSubscribers`) n'est jamais rejectée → promesses en suspens jusqu'à la redirection | `apps/web/src/lib/api.ts:55-67` |

## 3. Écarts par design (à documenter, pas des bugs)

- Stats/logs d'un QR d'un autre utilisateur → **404** (pas 403) : filtre ownership dans la requête elle-même (`services/qrcode.ts:223-231`) — pas de fuite d'info.
- `DELETE /admin/users/:id` sur soi-même → **403** (pas 400) (`routes/admin.ts:155-157`).
- `cancel` / `DELETE` d'une campagne déjà envoyée → **400** volontaire (machine à états, `services/admin.ts:275-284`).
- `sendDueCampaigns` (cron 15 min) non testable sans `--test-scheduled` ; non vérifié en runtime.

## 4. Frontend — état réel

- **Aucune divergence de contrat restante** : `qrApi`, `adminApi`, `AuthContext` (dont le fameux `GET /me/me`, correct vu le montage `index.ts:30` + `user.ts:25`), enveloppes, query params — tous alignés sur l'API post-J0-J5. Aucun `fetch()` brut hors `lib/api.ts`.
- **7 pages placeholders** sans appels API, dont 2 alors que les routes existent : `ApiKeysPage` (`GET/POST /api-keys` dispo), `SessionsPage` (`GET /auth/sessions` dispo), plus `SettingsPage`, `TemplatesPage`, `AdminDashboardPage`, `AdminMetricsPage`, `DashboardPage` (compteurs en dur à 0).
- Lint : 0 erreur, 2 warnings `react-refresh` (`TemplateForm.tsx:43`, `AuthContext.tsx:72`). Build OK.

## 5. Angle mort des tests (cause racine du « tout est vert mais ça casse »)

- API 52/52 : better-sqlite3 + migrations réelles, mais env **entièrement mocké** (`tests/setup.ts:13-23`) et `generateQRCodeImage` non exercé contre le vrai bundle Wrangler.
- Web 27/27 : 100 % MSW — valide le contrat *imaginé* par le front, pas l'API réelle.
- Recommandation : ajouter un smoke e2e (wrangler dev + matrice curl, rejouable via les scripts de `~/.hermes/cache/scratch/audit-runtime/`) en CI ou pré-déploiement.

## 6. Recommandations (ordre suggéré)

**P0 :**
1. Débloquer la vérification email — au choix : (a) brancher un vrai mailer (`SMTP_API_URL`, MailChannels/Resend) + route `POST /auth/resend-verification` rate-limitée ; (b) en dev, retourner le token dans la réponse register / l'auto-vérifier derrière un flag ; (c) à défaut, ne plus bloquer le login sur `est_verifie=0` (dégradé explicite). Idem pour `forgot-password`.
2. Réparer le PNG : remplacer `toBuffer` dans `qr-generator.ts:26` par une génération compatible Workers (`toString` SVG systématique + rasterisation, ou lib QR WASM/native Workers). Tant que ce n'est pas fait, forcer `formatImage:"svg"` côté front pour ne pas exposer le 500.

**P1 :**
3. Poser les secrets (`wrangler secret put JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`) + **fail-fast au boot** si absents (plus de `encode(undefined)`).
4. Hacher les `tokens_email` (SHA-256, comme les refresh tokens), masquer `token_hash` dans `/auth/sessions`, corriger la condition du cookie `Secure`.
5. Brancher le mailer des campagnes ou afficher « envoi simulé » dans l'admin.

**P2 :**
6. Documenter les statuts par design (404/403/400 ci-dessus), brancher les placeholders `ApiKeysPage`/`SessionsPage`, rejeter la file de refresh en échec, ajouter le smoke e2e à la CI.

## Annexe — validation

- Tests relancés par l'orchestrateur : API **52/52** (vitest 4.1.10, 36,6 s), web **27/27** (vitest 5.0.1, 11,4 s), type-check API + web exit 0.
- Runtime : migrations 001-003 appliquées sur D1 locale, 112 appels HTTP journalisés (`results.jsonl`/`results2.jsonl`), 4×500 PNG confirmés avec requestIds distincts.
- Aucun code modifié pendant l'audit ; `apps/api/.dev.vars` créé pour le dev local (gitignoré, `.gitignore:33`). Diffs non commités préexistants sur `index.ts`/`auth.ts` = whitespace uniquement, sans effet fonctionnel.
