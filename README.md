# Free QR Code — SaaS Platform

> A full-stack SaaS for creating, customizing and **tracking** QR codes (static & dynamic) — built as a production-grade monorepo, fully deployed on Cloudflare's edge.

<p align="left">
  <a href="https://free-qr-code-saas.getcongo.com/"><img src="https://img.shields.io/badge/🔗_Live_Demo-free--qr--code--saas.getcongo.com-06b6d4" alt="Live demo"></a>
  <a href="https://free-qr-api.messiasayi.workers.dev/"><img src="https://img.shields.io/badge/API-Workers.dev-ff6c37" alt="API"></a>
  <img src="https://img.shields.io/badge/React_19-TypeScript-61dafb?logo=react" alt="React TypeScript">
  <img src="https://img.shields.io/badge/Hono-Cloudflare_Workers-f38020?logo=cloudflare" alt="Hono Cloudflare">
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/pnpm-workspaces-f69220?logo=pnpm" alt="pnpm">
</p>

**Live demo:** [free-qr-code-saas.getcongo.com](https://free-qr-code-saas.getcongo.com/) · **API:** [free-qr-api.messiasayi.workers.dev](https://free-qr-api.messiasayi.workers.dev/) · Interface: 🇫🇷 French market

---

## ✨ Features

| Couche | Technologie |
|--------|-------------|
| API | [Hono](https://hono.dev/) + [Cloudflare Workers](https://workers.cloudflare.com/) |
| Frontend | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| Base de données | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) — migrations `apps/api/migrations/` (`001` schéma, `002` routage, `003` analytics variantes, `004` appareil & consentement, `005` plans) |
| Stockage images | Cloudflare R2 (`QR_IMAGES`), servi via `/r2` |
| Authentification | JWT access + refresh (cookies HttpOnly + header `Bearer`), clés API à permissions |
| Emails | Worker email externe (Resend) via `EMAIL_WORKER_URL` ou service binding `EMAIL_WORKER` |
| Types partagés | Package interne `@free-qr/shared-types` |
| Validation | [Zod](https://zod.dev/) |
| Appels front | `axios` + hooks maison (`api.ts` + `*Api.ts`, pas de React Query) |

## 📁 Monorepo structure

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
│   │   │   │   ├── routing.ts       # /qrcodes/:id/routage (+ /simuler) — routage contextuel
│   │   │   │   └── redirect.ts      # /q/:aliasCourt (redirection routée + comptage scan)
│   │   │   ├── services/            # Logique métier (auth, qrcode, scan, api-keys,
│   │   │   │                        #   dashboard, admin, email, r2Image)
│   │   │   │   ├── context.ts       # Contexte de scan (request.cf, langue, appareil)
│   │   │   │   └── routing/         # config.ts (parsing), resolve.ts (moteur pur),
│   │   │   │                        #   service.ts (CRUD + simulateur)
│   │   │   ├── validators/          # Schémas Zod (qrcode, routing, user, admin)
│   │   │   ├── middlewares/         # common (CORS, request-id, erreurs),
│   │   │   │                        #   rate-limit, api-key-auth (JWT ou clé + permissions)
│   │   │   ├── lib/                 # db/d1 (helpers D1), qr-generator, r2
│   │   │   └── types/               # AppEnv, docs internes (UserDoc, QRCodeDoc…)
│   │   ├── tests/                   # Vitest (better-sqlite3) : auth, user, qrcode,
│   │   │                            #   qrcode-image, scan-utils, scan-record, context,
│   │   │                            #   api-keys, routing (resolve / api / redirect),
│   │   │                            #   appareil-consent (phase 4)
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql  # Schéma D1 (12 tables + vues)
│   │   │   ├── 002_routing.sql         # Colonnes regles_routage + fuseau
│   │   │   ├── 003_routing_analytics.sql # scans.id_variante + langue + index
│   │   │   ├── 004_appareil_consentement.sql # appareils_qr + consentements + scans.id_appareil
│   │   │   └── 005_plans.sql           # plan utilisateur + consultations stats routage
│   │   └── wrangler.toml            # Config Cloudflare Worker (+ [[services]] email)
│   └── web/               # Frontend React + Vite
│       ├── src/
│       │   ├── App.tsx              # Router principal (public / dashboard / admin)
│       │   ├── lib/                 # api.ts (axios + refresh auto), qrApi.ts,
│       │   │                        #   userApi.ts, qrPreview.ts, apiKeysApi.ts,
│       │   │                        #   dashboardApi.ts, adminApi.ts, sessionsApi.ts, qrForm.ts
│       │   ├── contexts/            # AuthContext
│       │   ├── hooks/               # useQR, useQRList, useQRCreate, useQRStats,
│       │   │                        #   useSettings, useSessions, useApiKeys, useRouting,
│       │   │                        #   useDashboardStats, useCampaigns, useTemplates,
│       │   │                        #   useUsers, useReveal
│       │   ├── components/          # Logo, QRCodeList, QRForm, QRPreview, HeroShowcase,
│       │   │                        #   routing/ (RoutingEditor, ConditionFields,
│       │   │                        #   RoutingSimulator), CampaignForm/List, TemplateForm…
│       │   ├── pages/               # Landing, auth (login/register/forgot/reset/verify),
│       │   │                        #   dashboard QR (list/create/detail/edit/stats/routage),
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

## 🚀 Getting started

## Commandes clés

> Prérequis : [pnpm](https://pnpm.io/) installé, compte Cloudflare + `wrangler` authentifié pour le déploiement.

```bash
pnpm install                # install all workspace dependencies

# Développement (API + Web en parallèle)
pnpm dev
# ou séparément :
pnpm --filter @free-qr/api dev    # wrangler dev (D1 local, .dev.vars)
pnpm --filter @free-qr/web dev    # vite (port 5173)

# Vérifications
pnpm type-check
pnpm lint
pnpm test                          # vitest API (109 tests)

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

### Environment variables — API (`apps/api/wrangler.toml` / Cloudflare secrets)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_TRACKING_SECRET` | JWT secrets |
| `API_BASE_URL` | Public API URL |
| `CORS_ORIGINS` | Allowed origins |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_DAYS` | Token TTLs |
| `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX_REQUESTS` | Rate limiting |
| `SMTP_API_URL` / `SMTP_FROM` | Transactional email (optional) |

### API — `[vars]` dans `wrangler.toml` (non sensible, versionné)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `API_BASE_URL` | URL publique de l'API | `https://free-qr-api.<compte>.workers.dev` |
| `CORS_ORIGINS` | Origines CORS autorisées (séparées par virgule) | `https://app.example.com,http://localhost:5173` |
| `FRONTEND_URL` | URL publique du front (liens reset/verify dans les emails) | `https://app.example.com` |
| `SMTP_FROM` | Adresse expéditeur | `noreply@free-qrcode.app` |
| `ROUTING_PRO_ONLY` | `"true"` = édition du routage réservée au plan Pro (jamais lu sur `/q/:alias`) | `"false"` |
| `ROUTING_LIMITE_VARIANTES` | Quota de variantes pour un compte gratuit si Pro-only | `20` |
| `ROUTING_LIMITE_REGLES` | Quota de règles pour un compte gratuit si Pro-only | `50` |

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

25+ endpoints, all validated with Zod:

| Route | Method | Description | Auth |
|---|---|---|---|
| `/auth/register` `/auth/login` `/auth/refresh` | `POST` | Signup / login / token refresh | ❌ |
| `/auth/logout` `/auth/sessions` | `GET/POST/DELETE` | Logout, list & revoke sessions | ✅ |
| `/users/me` `/users/health` | `GET` | Profile / healthcheck | ✅/❌ |
| `/qrcodes` | `GET/POST` | Paginated list / create | ✅ |
| `/qrcodes/:id` | `GET/PATCH/DELETE` | Read / update / delete | ✅ |
| `/qrcodes/:id/stats` | `GET` | Scan statistics | ✅ |
| `/admin/campaigns` `/admin/templates` | CRUD + `/send` | Email campaigns, QR templates | ✅ admin |
| `/tracking/pixel` `/tracking/click` | `GET` | Email open/click tracking | ❌ |
| `/q/:shortAlias` | `GET` | Public short link → 302 + scan event | ❌ |

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
| `/qrcodes/:id/routage` | `GET` | Config de routage contextuel (`null` si désactivé) | ✅ / clé `qrcodes:read` |
| `/qrcodes/:id/routage` | `PUT` | Enregistrer le routage (validation stricte, QR dynamique requis) | ✅ / clé `qrcodes:update` |
| `/qrcodes/:id/routage` | `DELETE` | Désactiver le routage (contenu du QR inchangé) | ✅ / clé `qrcodes:update` |
| `/qrcodes/:id/routage/simuler` | `POST` | Simuler la destination + trace d'évaluation des règles | ✅ / clé `qrcodes:read` |
| `/qrcodes/:id/routage/stats` | `GET` | Scans par variante (`?from=&to=`, libellés, parts, langues, pays) | ✅ / clé `stats:read` |
| `/qrcodes/:id/routage/stats.csv` | `GET` | Export CSV des scans par variante | ✅ / clé `stats:read` |
| `/q/:alias` | `GET` | Redirection dynamique (routage + fallback) | ❌ |
| `/c/:alias` | `GET` | Page de consentement au comptage par appareil (HTML) | ❌ |
| `/c/:alias/accepter` \| `/refuser` | `POST` | Choix de consentement (cookies `cfq_did` / `cfq_refus`) | ❌ |
| `/consentement` | `GET/POST` | Consultation et retrait du consentement | ❌ |
| `/api-keys` | `GET/POST` | Lister / créer (id = `public_id`, secret affiché 1 fois) | ✅ (JWT) |
| `/api-keys/:id` | `GET/DELETE` | Détail / révoquer (par `public_id`) | ✅ (JWT) |
| `/dashboard` | `GET` | Stats agrégées + tops/récents | ✅ |
| `/admin/dashboard` | `GET` | Métriques globales | ✅ admin |
| `/admin/routing/metrics` | `GET` | Adoption du routage, usage multi-variantes, consultations stats, plans | ✅ admin |
| `/admin/campaigns` | `GET/POST` | Campagnes email | ✅ admin |
| `/admin/campaigns/:id` | `GET/PATCH` | Détail / maj campagne | ✅ admin |
| `/admin/campaigns/:id/send` | `POST` | Envoyer (via `SMTP_API_URL`) | ✅ admin |
| `/admin/templates` | `GET/POST` | Modèles QR | ✅ admin |
| `/admin/templates/:id` | `GET/PATCH/DELETE` | Détail / maj / suppression | ✅ admin |
| `/tracking/pixel`, `/tracking/click` | `GET` | Ouverture / clic email | ❌ |
| `/logs` | `GET/POST` | Journal applicatif | ✅ |
| `/preview/qr` | `GET` | Aperçu SVG public (`?content&couleur&background&size&correction`) | ❌ (rate-limit) |
| `/r2/users/:userId/qrcodes/:filename` | `GET` | Images QR stockées (cache 1 an, sans middleware d'auth) | ❌ |
| `/q/:aliasCourt` | `GET` | Résolution d'un QR dynamique : redirection 302 (URL/URI) ou contenu servi (vCard `.vcf`, texte `text/plain`) + comptage scan (404 si inactif, 410 si expiré) | ❌ |

---

## Comptage des scans

Seuls les **QR dynamiques** sont comptés (redirection serveur via `/q/:alias`). Les statiques encodent le contenu en dur et ne touchent jamais l'API → **compteur non affiché** côté front (`Non suivi`).

Par scan : IP anonymisée (/24), unicité journalière par IP, géolocalisation fournie par Cloudflare (`request.cf` : pays fiable, ville best-effort — **aucun appel réseau ni quota tiers**), agregat jour dans `statistiques_qrcodes` + `nombre_scans_total` incrémenté. Enregistrement en `waitUntil` (non-bloquant).

---

## Routage contextuel (ContextFlow QR)

Un QR dynamique peut servir **plusieurs destinations** selon le contexte du scan : heure/jour (dans le fuseau du QR), pays, langue du navigateur, appareil, nombre de scans. La configuration vit en JSON sur la ligne `qrcodes` (`regles_routage`) : **aucune requête supplémentaire** sur le chemin chaud.

| Notion | Détail |
|--------|--------|
| **Variante** | Une destination (`id` stable et immuable, libellé, URL http(s)) |
| **Règle** | Conditions (ET) + `priorite` croissante + `varianteId` ; première correspondance gagnante |
| **Défaut** | Variante servie quand aucune règle ne correspond |
| **Fallback** | Config absente/corrompue → contenu natif du QR (vCard servie en `.vcf`, texte en `text/plain`) ; variante non `http(s)` ignorée ; jamais de 5xx sur `/q/:alias` |
| **Fuseau** | Celui du QR (`Africa/Brazzaville` par défaut), **jamais** celui du visiteur |

Conditions supportées : `jours` (1–7), `heureMin`/`heureMax` (passage minuit géré), `pays` (ISO-2), `langues` (ISO-639-1), `appareil` (`mobile`/`tablet`/`desktop`), `minScansTotal`/`maxScansTotal`, `dates`, `villes`, `abTest` (tirage pondéré déterministe), `minScansAppareil`/`maxScansAppareil` (avec consentement).

Contraintes validées à l'écriture : QR dynamique requis, ≥ 2 variantes si `actif`, priorités uniques, `defaut` existant, URL des **variantes** http(s) uniquement (`javascript:` rejeté), fuseau IANA valide.

Le **contenu natif** d'un QR dynamique n'est pas limité aux URL : vCard, texte, WiFi, email, téléphone, SMS, géolocalisation et PDF sont acceptés. Il est validé selon son type (URL http(s), vCard complète, URI `mailto:`/`tel:`/`sms:`/`geo:`) puis servi au scan : vCard en fichier `.vcf` (`text/vcard`, `Content-Disposition: attachment`), texte/WiFi en `text/plain`, URL/URI en redirection `302`. Aucun contenu brut n'est jamais injecté dans un header `Location`.

Correctif détaillé (incident `Invalid header value` sur `/q/oz4a205`) : [`doc/contextflow-qr/07_CORRECTIF_CONTENU_DYNAMIQUE.md`](./doc/contextflow-qr/07_CORRECTIF_CONTENU_DYNAMIQUE.md).

Le moteur (`services/routing/resolve.ts`) est une **fonction pure** : `maintenant` injecté, zéro I/O, testé sur les fuseaux et le passage à minuit. L'écran `/dashboard/qr/:id/routage` inclut un **simulateur** qui affiche la destination servie et la trace de chaque règle.

**Analytics par variante** : chaque scan enregistre `id_variante` et la langue négociée ; `GET /qrcodes/:id/routage/stats` agrège `scans` par destination (scans, uniques, part, top langues/pays) et signale les **variantes mortes** (aucun scan sur 7 jours alors que le QR en reçoit). Export CSV inclus. Le tableau affiche des **scans**, jamais des « conversions » : aucune donnée de conversion n'existe avant la page hôte (Phase 3).

**Compteur par appareil (opt-in)** : une règle `minScansAppareil`/`maxScansAppareil` compte les visites du **même appareil**, jamais de la même personne. Le premier scan affiche une page de consentement (`/c/:alias`, HTML < 10 Ko, sans JS) ; l'acceptation pose un cookie `cfq_did` (UUID aléatoire, `HttpOnly`, `Secure`, `SameSite=Lax`, 13 mois) et le compteur vit dans `cfq_c` (aucune requête D1 sur le chemin chaud). Le refus (`cfq_refus=1`, 6 mois) laisse le QR fonctionner et ignore les règles appareil. La base ne stocke qu'un hash SHA-256 tronqué ; le retrait est disponible sur `/consentement`. Aucun fingerprinting.

**Monétisation (couture, pas paywall)** : `ROUTING_PRO_ONLY="false"` en production → routage gratuit et illimité pour tous. Le jour de la bascule, `ROUTING_PRO_ONLY="true"` réserve l'**édition** aux comptes `plan='pro'` (`402`), avec des quotas pour les comptes gratuits. Le runtime `/q/:alias` ne lit **jamais** le plan : un QR déjà imprimé continue de router. `GET /admin/routing/metrics` expose l'adoption, l'usage multi-variantes, les consultations de stats et la répartition des plans, sans donnée personnelle.

Plan complet (6 phases) : [`doc/contextflow-qr/`](./doc/contextflow-qr/README.md).

The `merise/` folder contains the full software design lifecycle — MCD → MLD → MPD, business rules, DFD, UML navigation/sequence diagrams, architecture, OpenAPI contract, security & RGPD analysis, and a test plan. A sample of the discipline applied to this project:

- [`merise/01_MCD.md`](./merise/01_MCD.md) — conceptual data model (10 entities)
- [`merise/10_ARCHITECTURE.md`](./merise/10_ARCHITECTURE.md) — technical architecture
- [`merise/11_API_OPENAPI.yaml`](./merise/11_API_OPENAPI.yaml) — API contract
- [`merise/12_SECURITE_RGPD.md`](./merise/12_SECURITE_RGPD.md) — security & privacy analysis
- [`merise/13_PLAN_TESTS.md`](./merise/13_PLAN_TESTS.md) — test plan

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

**ContextFlow QR** (routage contextuel : heure, pays, langue, appareil) : plan complet en 6 phases dans [`doc/contextflow-qr/`](./doc/contextflow-qr/README.md).

---

## Points d'attention / écarts connus

- **Dualité `design` / `parametres`** : la création accepte `design`, la modification et la lecture exposent `parametres` (même objet `QRCodeDesign`). À unifier côté API.
- **Journal d'audit** : table `journaux_qrcodes` migrée mais aucun endpoint ne l'expose.
- **Images R2 signées** : `GET /r2/users/:userId/qrcodes/:filename` exige une URL signée (`?exp=&sig=`, HMAC-SHA256, TTL 7 jours, re-signée à chaque lecture d'un QR). Clé : `R2_SIGNING_SECRET` (secret Cloudflare), repli sur `JWT_ACCESS_SECRET`. Les URLs directes `R2_PUBLIC_URL` (hors worker) ne sont pas signables — à éviter si la confidentialité des images compte.
- **Consentement marketing optionnel** à l'inscription (`RegisterPage`) : conforme RGPD, modifiable à tout moment dans Paramètres.
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
