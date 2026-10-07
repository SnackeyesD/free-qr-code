# Free QR Code — Monorepo SaaS de génération & suivi de QR codes

Application SaaS française de création, gestion et tracking de QR codes (statiques & dynamiques). Monorepo géré avec pnpm workspaces.

---

## Stack

| Couche | Technologie |
|--------|-------------|
| API | [Hono](https://hono.dev/) + [Cloudflare Workers](https://workers.cloudflare.com/) |
| Frontend | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| Base de données | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) — voir `apps/api/migrations/001_initial_schema.sql` |
| Stockage images | Cloudflare R2 (`QR_IMAGES`), servi via `/r2` |
| Authentification | JWT access + refresh (cookies HttpOnly + header `Bearer`), clés API à permissions |
| Emails | Worker email externe (Resend) via `EMAIL_WORKER_URL` ou service binding `EMAIL_WORKER` |
| Types partagés | Package interne `@free-qr/shared-types` |
| Validation | [Zod](https://zod.dev/) |
| Appels front | `axios` + hooks maison (`api.ts` + `*Api.ts`, pas de React Query) |

---

## Structure du monorepo

```text
free-qr-code/
├── apps/
│   ├── api/               # Backend Hono (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── index.ts             # Point d'entrée + montage des routes
│   │   │   ├── routes/              # Routes Hono
│   │   │   │   ├── auth.ts          # /auth/* (register, login, refresh, logout,
│   │   │   │   │                      verify-email, forgot-password, reset-password)
│   │   │   │   ├── user.ts          # /me, /me/health, /me/sessions* (profil + mot de passe)
│   │   │   │   ├── qrcode.ts        # /qrcodes/* (CRUD + download, JWT ou clé API)
│   │   │   │   ├── stats.ts         # /qrcodes/:id/stats (permission stats:read)
│   │   │   │   ├── api-keys.ts      # /api-keys/* (CRUD, JWT uniquement)
│   │   │   │   ├── dashboard.ts     # /dashboard, /admin/dashboard (stats agrégées)
│   │   │   │   ├── admin.ts         # /admin/* (campagnes, templates), /tracking/*
│   │   │   │   ├── logs.ts          # /logs (journal applicatif)
│   │   │   │   ├── preview.ts       # /preview/qr (aperçu SVG public, sans auth)
│   │   │   │   ├── r2.ts            # /r2/users/:userId/qrcodes/:filename (images)
│   │   │   │   └── redirect.ts      # /q/:aliasCourt (redirection + comptage scan)
│   │   │   ├── services/            # Logique métier (auth, qrcode, scan, api-keys,
│   │   │   │                        #   dashboard, admin, email, r2Image)
│   │   │   ├── validators/          # Schémas Zod (qrcode, user, admin)
│   │   │   ├── middlewares/         # common (CORS, request-id, erreurs),
│   │   │   │                        #   rate-limit, api-key-auth (JWT ou clé + permissions)
│   │   │   ├── lib/                 # db/d1 (helpers D1), qr-generator, r2
│   │   │   └── types/               # AppEnv, docs internes (UserDoc, QRCodeDoc…)
│   │   ├── tests/                   # Vitest (better-sqlite3) : auth, user, qrcode,
│   │   │                            #   qrcode-image, scan-utils, api-keys
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql  # Schéma D1 (12 tables + vues)
│   │   └── wrangler.toml            # Config Cloudflare Worker (+ [[services]] email)
│   └── web/               # Frontend React + Vite
│       ├── src/
│       │   ├── App.tsx              # Router principal (public / dashboard / admin)
│       │   ├── lib/                 # api.ts (axios + refresh auto), qrApi.ts,
│       │   │                        #   userApi.ts, qrPreview.ts, apiKeysApi.ts,
│       │   │                        #   dashboardApi.ts, adminApi.ts, sessionsApi.ts, qrForm.ts
│       │   ├── contexts/            # AuthContext
│       │   ├── hooks/               # useQR, useQRList, useQRCreate, useQRStats,
│       │   │                        #   useSettings, useSessions, useApiKeys,
│       │   │                        #   useDashboardStats, useCampaigns, useTemplates,
│       │   │                        #   useUsers, useReveal
│       │   ├── components/          # Logo, QRCodeList, QRForm, QRPreview, HeroShowcase,
│       │   │                        #   CampaignForm/List, TemplateForm/List, UserList…
│       │   ├── pages/               # Landing, auth (login/register/forgot/reset/verify),
│       │   │                        #   dashboard QR (list/create/detail/edit/stats),
│       │   │                        #   templates, api-keys, settings, sessions, admin…
│       │   └── layouts/             # PublicLayout, DashboardLayout (+ AdminGuard)
│       ├── public/                  # logo.svg, robots.txt, sitemap.xml
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── shared-types/      # Types/Interfaces partagés web ↔ api
│       └── src/
│           ├── index.ts, api.ts, utilisateur.ts, qrcode.ts,
│           ├── statistiques.ts, campagne-email.ts, modele.ts,
│           ├── cle-api.ts, journal-et-tokens.ts
├── scripts/
│   ├── init-db.js         # Init base locale (legacy Mongo, voir migrations D1)
│   └── init-db.ts
├── doc/                   # Plans d'implémentation (preview QR, landing, emails…)
├── merise/                # Documentation MERISE / UML (13 fichiers, voir ci-dessous)
├── package.json           # Scripts racine + workspace pnpm
├── pnpm-workspace.yaml
└── README.md              # Ce fichier
```

---

## Commandes clés

> Prérequis : [pnpm](https://pnpm.io/) installé, compte Cloudflare + `wrangler` authentifié pour le déploiement.

```bash
# Installer toutes les dépendances
pnpm install

# Développement (API + Web en parallèle)
pnpm dev
# ou séparément :
pnpm --filter @free-qr/api dev    # wrangler dev (D1 local, .dev.vars)
pnpm --filter @free-qr/web dev    # vite (port 5173)

# Vérifications
pnpm type-check
pnpm lint
pnpm test                          # vitest API (42 tests)

# Build
pnpm build
pnpm --filter @free-qr/api build   # tsc --noEmit
pnpm --filter @free-qr/web build   # tsc + vite build → dist/

# Déploiement API
pnpm --filter @free-qr/api deploy           # wrangler deploy
pnpm deploy:api:dry-run                     # wrangler deploy --dry-run (valide bindings)

# Base D1 distante
npx wrangler d1 migrations apply free-qr-api-db --remote
```

---

## Variables d'environnement

### API — `[vars]` dans `wrangler.toml` (non sensible, versionné)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `API_BASE_URL` | URL publique de l'API | `https://free-qr-api.<compte>.workers.dev` |
| `CORS_ORIGINS` | Origines CORS autorisées (séparées par virgule) | `https://app.example.com,http://localhost:5173` |
| `FRONTEND_URL` | URL publique du front (liens reset/verify dans les emails) | `https://app.example.com` |
| `SMTP_FROM` | Adresse expéditeur | `noreply@free-qrcode.app` |

### API — secrets Cloudflare (`wrangler secret put …`, jamais versionnés)

| Variable | Description |
|----------|-------------|
| `JWT_ACCESS_SECRET` | Secret JWT access (HS256, ≥ 32 octets) |
| `JWT_REFRESH_SECRET` | Secret JWT refresh |
| `JWT_REFRESH_SALT` | Salt optionnel refresh |
| `JWT_TRACKING_SECRET` | Secret JWT tracking email |
| `EMAIL_WORKER_URL` | URL du worker email (fallback local ; prod = service binding) |
| `SMTP_API_URL` | Endpoint d'envoi générique (campagnes admin) |
| `ACCESS_TOKEN_TTL_SECONDS` | TTL token access (`900`) |
| `REFRESH_TOKEN_TTL_DAYS` | TTL refresh token (`7`) |
| `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX_REQUESTS` | Rate limiting (`60` / `100`) |

### API — dev local (`apps/api/.dev.vars`, gitignoré)

Mêmes noms qu'en prod avec valeurs locales (`http://localhost:8787`, `http://localhost:5173`, `http://localhost:8788` pour le worker email…).

### Web (au build Vite)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL de l'API (utilisée par `lib/api.ts` et `lib/qrPreview.ts`) | `http://localhost:8787` |

> ⚠️ `VITE_API_URL` (sans `_BASE`) n'est **pas** lu par le code : toujours poser `VITE_API_BASE_URL`.

---

## Authentification

| Mode | Usage | Détails |
|------|-------|---------|
| JWT | Sessions web | Access court (15 min) + refresh 7j révocable (`/me/sessions`), header `Bearer` ou cookie `accessToken` |
| Clé API | Intégrations tierces | `X-API-Key` ou `Authorization: ApiKey <clé>`, secret jamais ré-affiché, révocable, expirable |

Permissions des clés : `qrcodes:read` (GET + download), `qrcodes:create` (POST), `qrcodes:update` (PATCH), `qrcodes:delete` (DELETE), `stats:read` (stats), `admin:campaigns`, `admin:templates` (non branchées : `/admin/*` reste JWT + rôle admin). Sans permission → 403 partout ; JWT garde plein accès à ses propres ressources.

Mot de passe : changement connecté via `PATCH /me` (`motDePasseActuel` + `nouveauMotDePasse`, bcrypt coût 12) ; oublié via `POST /auth/forgot-password` (réponse 200 anti-énumération, token `reinitialisation` 1h) puis `POST /auth/reset-password` (révoque toutes les sessions).

---

## Routes API implémentées

Montées dans `apps/api/src/index.ts`. Auth = JWT par défaut, sauf mention.

| Route | Méthode | Description | Auth |
|-------|---------|-------------|------|
| `/health`, `/` | `GET` | Healthcheck / ping service | ❌ |
| `/auth/register` | `POST` | Inscription (email de vérification 24h) | ❌ |
| `/auth/login` | `POST` | Connexion (compte vérifié et actif requis) | ❌ |
| `/auth/refresh` | `POST` | Rotation refresh token (cookie) | ❌ (cookie) |
| `/auth/logout` | `POST` | Déconnexion (révoque la session) | ✅ |
| `/auth/verify-email` | `POST` | Vérification email (`{token}`) | ❌ |
| `/auth/forgot-password` | `POST` | Demande de lien reset (toujours 200) | ❌ |
| `/auth/reset-password` | `POST` | Reset (`{token, motDePasse ≥ 8}`, révoque sessions) | ❌ |
| `/me` | `GET` | Profil connecté | ✅ |
| `/me` | `PATCH` | Profil + changement mot de passe | ✅ |
| `/me/health` | `GET` | Healthcheck avec `API_BASE_URL` | ❌ |
| `/me/sessions` | `GET` | Sessions actives | ✅ |
| `/me/sessions/:id` | `DELETE` | Révoquer une session | ✅ |
| `/me/sessions` | `DELETE` | Révoquer les autres sessions | ✅ |
| `/qrcodes` | `GET` | Liste paginée (`page`, `limit`, `type`, `search`) | ✅ / clé `qrcodes:read` |
| `/qrcodes` | `POST` | Créer (`type`, `contenu`, `typeContenu?`, `design?`) | ✅ / clé `qrcodes:create` |
| `/qrcodes/:id` | `GET` | Détails | ✅ / clé `qrcodes:read` |
| `/qrcodes/:id` | `PATCH` | Modifier (`contenu?`, `estActif?`, `parametres?`) | ✅ / clé `qrcodes:update` |
| `/qrcodes/:id` | `DELETE` | Supprimer | ✅ / clé `qrcodes:delete` |
| `/qrcodes/:id/download` | `GET` | Export PNG/SVG/PDF (`?format=`) | ✅ / clé `qrcodes:read` |
| `/qrcodes/:id/stats` | `GET` | Stats (`?from=&to=`, totaux + évolution + pays/appareils) | ✅ / clé `stats:read` |
| `/api-keys` | `GET/POST` | Lister / créer (id = `public_id`, secret affiché 1 fois) | ✅ (JWT) |
| `/api-keys/:id` | `GET/DELETE` | Détail / révoquer (par `public_id`) | ✅ (JWT) |
| `/dashboard` | `GET` | Stats agrégées + tops/récents | ✅ |
| `/admin/dashboard` | `GET` | Métriques globales | ✅ admin |
| `/admin/campaigns` | `GET/POST` | Campagnes email | ✅ admin |
| `/admin/campaigns/:id` | `GET/PATCH` | Détail / maj campagne | ✅ admin |
| `/admin/campaigns/:id/send` | `POST` | Envoyer (via `SMTP_API_URL`) | ✅ admin |
| `/admin/templates` | `GET/POST` | Modèles QR | ✅ admin |
| `/admin/templates/:id` | `GET/PATCH/DELETE` | Détail / maj / suppression | ✅ admin |
| `/tracking/pixel`, `/tracking/click` | `GET` | Ouverture / clic email | ❌ |
| `/logs` | `GET/POST` | Journal applicatif | ✅ |
| `/preview/qr` | `GET` | Aperçu SVG public (`?content&couleur&background&size&correction`) | ❌ (rate-limit) |
| `/r2/users/:userId/qrcodes/:filename` | `GET` | Images QR stockées (cache 1 an, sans middleware d'auth) | ❌ |
| `/q/:aliasCourt` | `GET` | Redirection 302 + comptage scan (QR dynamiques, 404 si inactif, 410 si expiré) | ❌ |

---

## Comptage des scans

Seuls les **QR dynamiques** sont comptés (redirection serveur via `/q/:alias`). Les statiques encodent le contenu en dur et ne touchent jamais l'API → **compteur non affiché** côté front (`Non suivi`).

Par scan : IP anonymisée (/24), unicité journalière par IP, géoloc best-effort (ipapi.co, timeout 1.5s), agregat jour dans `statistiques_qrcodes` + `nombre_scans_total` incrémenté. Enregistrement en `waitUntil` (non-bloquant).

---

## Documentation MERISE

Conception dans [`merise/`](./merise) (SQLite/D1, plus MongoDB) :

- [MCD](./merise/01_MCD.md) — Utilisateur, QRCode, Scan, ModeleQR, CampagneEmail, CampagneUtilisateur, TrackingEmail, CleApi, JournalQRCode, TokenEmail.
- [MLD](./merise/02_MLD.md) — Relations et cardinalités.
- [MPD](./merise/03_MPD.md) — Implémentation (collections → tables D1, champs, index).
- [MCT](./merise/04_MCT.md) / [MOT](./merise/05_MOT.md) — Traitements (CRUD, auth, stats).
- [MLT](./merise/06_MLT.md), [Wireframes](./merise/07_UML_FRONTEND_WIREFRAMES.md), [Séquences](./merise/08_UML_FRONTEND_SEQUENCES.md), [Navigation](./merise/09_UML_FRONTEND_NAVIGATION.md).
- [Architecture](./merise/10_ARCHITECTURE.md) — Vue technique complète.
- [OpenAPI](./merise/11_API_OPENAPI.yaml) — Contrat d'API (auth, QR, clés, reset…).
- [Sécurité & RGPD](./merise/12_SECURITE_RGPD.md), [Plan de tests](./merise/13_PLAN_TESTS.md).

Plans d'implémentation opérationnels dans [`doc/`](./doc) (preview QR, landing, emails, animations…).

---

## Points d'attention / écarts connus

- **Dualité `design` / `parametres`** : la création accepte `design`, la modification et la lecture exposent `parametres` (même objet `QRCodeDesign`). À unifier côté API.
- **Journal d'audit** : table `journaux_qrcodes` migrée mais aucun endpoint ne l'expose.
- **Images R2 sans auth** : `GET /r2/users/:userId/qrcodes/:filename` n'a aucun middleware — toute image est téléchargeable par URL directe. Assumer (URLs non listables) ou protéger.
- **Consentement marketing obligatoire** à l'inscription côté front (`RegisterPage`) : à rendre optionnel (RGPD).
- **Emails** : compte Resend en test tant que le domaine d'envoi n'est pas vérifié (seul l'email propriétaire reçoit) ; worker email externe requis (`/api/sendVerification`, `/api/sendReset`).
- **SEO** : pré-rendu statique des pages publiques recommandé (SPA sur hébergement mutualisé) ; `robots.txt` + `sitemap.xml` déjà dans `public/`.

---

## Notes

- Le front consomme l'API via `VITE_API_BASE_URL`, avec refresh silencieux du token (intercepteur 401 → `/auth/refresh` → retry).
- Les aperçus QR du front passent par `GET /preview/qr` (aucune dépendance tierce type qrserver).
- Déploiement : `wrangler deploy` (API), build Vite + hébergement statique du `dist/` (front). Domaine front = `FRONTEND_URL` = `CORS_ORIGINS`.

---

## Licence

Projet privé — tous droits réservés.
