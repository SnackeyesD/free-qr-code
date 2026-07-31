# Free QR Code — Monorepo SaaS de génération & suivi de QR codes

Application SaaS française de création, gestion et tracking de QR codes (statiques & dynamiques). Monorepo géré avec pnpm workspaces.

---

## Stack

| Couche | Technologie |
|--------|-------------|
| API | [Hono](https://hono.dev/) + [Cloudflare Workers](https://workers.cloudflare.com/) |
| Frontend | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) |
| Base de données | [MongoDB](https://www.mongodb.com/) via `mongodb` driver |
| Stockage images | Cloudflare R2 (`QR_IMAGES`) |
| Authentification | JWT access + refresh, cookies HttpOnly |
| Types partagés | Package interne `@free-qr/shared-types` |
| Validation | [Zod](https://zod.dev/) |

---

## Structure du monorepo

```text
free-qr-code/
├── apps/
│   ├── api/               # Backend Hono (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── index.ts             # Point d'entrée + montage des routes
│   │   │   ├── routes/              # Routes Hono
│   │   │   │   ├── auth.ts          # /auth/* (register, login, refresh, logout, sessions, verify-email)
│   │   │   │   ├── user.ts          # /users/me, /users/health
│   │   │   │   ├── qrcode.ts        # /qrcodes/* (CRUD + list paginée)
│   │   │   │   ├── stats.ts         # /qrcodes/:id/stats
│   │   │   │   ├── admin.ts         # /admin/* (campagnes, templates), /tracking/*
│   │   │   │   └── redirect.ts      # /q/:aliasCourt (redirection + scan)
│   │   │   ├── services/            # Logique métier
│   │   │   ├── validators/          # Schémas Zod
│   │   │   ├── middlewares/         # Rate limiting, helpers communs
│   │   │   ├── lib/                 # DB, R2, générateur QR
│   │   │   └── types/               # Types internes
│   │   └── wrangler.toml            # Config Cloudflare Worker
│   └── web/               # Frontend React + Vite
│       ├── src/
│       │   ├── App.tsx              # Router principal
│       │   ├── lib/                 # Clients API (api.ts, qrApi.ts, adminApi.ts)
│       │   ├── contexts/            # AuthContext
│       │   ├── hooks/               # React Query hooks
│       │   ├── pages/               # Pages fonctionnelles & placeholders
│       │   └── layouts/             # DashboardLayout
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── shared-types/      # Types/Interfaces Zod-compatible
│       └── src/
│           ├── index.ts, api.ts, utilisateur.ts, qrcode.ts,
│           ├── statistiques.ts, campagne-email.ts, modele.ts,
│           ├── cle-api.ts, journal-et-tokens.ts
├── scripts/
│   └── init-db.js         # Initialisation MongoDB (collections, index, users seed)
├── merise/                # Documentation MERISE + UML
│   ├── 01_MCD.md          # Modèle Conceptuel de Données
│   ├── 02_MLD.md          # Modèle Logique de Données
│   ├── 03_MPD.md          # Modèle Physique de Données
│   ├── 04_MCT.md          # Modèle des Traitements
│   ├── 05_MOT.md          # Modèle Opérationnel des Traitements
│   ├── 05_REGLES_GESTION.md
│   ├── 06_DFD.md
│   ├── 07_DDC.md
│   ├── 07_UML_FRONTEND_WIREFRAMES.md
│   ├── 08_UML_FRONTEND_SEQUENCES.md
│   ├── 09_UML_FRONTEND_NAVIGATION.md
│   ├── 10_ARCHITECTURE.md
│   ├── 11_API_OPENAPI.yaml
│   ├── 12_SECURITE_RGPD.md
│   └── 13_PLAN_TESTS.md
├── package.json           # Scripts racine + workspace pnpm
├── pnpm-workspace.yaml
└── README.md              # Ce fichier
```

---

## Commandes clés

> Prérequis : [pnpm](https://pnpm.io/) installé, accès MongoDB, variables d'environnement renseignées.

```bash
# Installer toutes les dépendances
pnpm install

# Développement
pnpm dev                 # Lance les watchers API + Web (si configuré dans package.json)
# ou séparément :
pnpm --filter @free-qr/api dev
pnpm --filter @free-qr/web dev

# Build
pnpm build
pnpm --filter @free-qr/api build
pnpm --filter @free-qr/web build

# Tests
pnpm test

# Initialisation de la base de données (MongoDB)
node scripts/init-db.js
```

---

## Variables d'environnement

### API (`apps/api/wrangler.toml` / secrets Cloudflare)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `MONGODB_URI` | URI de connexion MongoDB | `mongodb+srv://...` |
| `JWT_ACCESS_SECRET` | Secret JWT access | `[REDACTED]` |
| `JWT_REFRESH_SECRET` | Secret JWT refresh | `[REDACTED]` |
| `JWT_REFRESH_SALT` | Salt optionnel refresh | `[REDACTED]` |
| `JWT_TRACKING_SECRET` | Secret JWT tracking email | `[REDACTED]` |
| `API_BASE_URL` | URL publique de l'API | `https://api.free-qrcode.app` |
| `CORS_ORIGINS` | Origines CORS autorisées | `https://app.free-qrcode.app,http://localhost:5173` |
| `ACCESS_TOKEN_TTL_SECONDS` | TTL token access | `900` |
| `REFRESH_TOKEN_TTL_DAYS` | TTL refresh token | `7` |
| `RATE_LIMIT_WINDOW_SECONDS` | Fenêtre rate limit | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Requêtes max par fenêtre | `100` |
| `SMTP_API_URL` | URL API d'envoi d'emails (optionnel) | `[REDACTED]` |
| `SMTP_FROM` | Adresse expéditeur | `noreply@free-qrcode.app` |

### Web (`apps/web/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de l'API (frontend) | `http://localhost:8787` |

---

## Routes API implémentées

| Route | Méthode | Description | Auth |
|-------|---------|-------------|------|
| `/auth/register` | `POST` | Inscription | ❌ |
| `/auth/login` | `POST` | Connexion | ❌ |
| `/auth/refresh` | `POST` | Rafraîchissement token | ❌ |
| `/auth/logout` | `POST` | Déconnexion | ✅ |
| `/auth/sessions` | `GET` | Liste des sessions actives | ✅ |
| `/auth/sessions/:tokenHash` | `DELETE` | Révoquer une session | ✅ |
| `/auth/verify-email` | `GET` | Vérification email | ❌ (placeholder) |
| `/users/me` | `GET` | Profil utilisateur connecté | ✅ |
| `/users/health` | `GET` | Healthcheck | ❌ |
| `/qrcodes` | `GET` | Liste paginée des QR codes | ✅ |
| `/qrcodes` | `POST` | Créer un QR code | ✅ |
| `/qrcodes/:id` | `GET` | Détails d'un QR code | ✅ |
| `/qrcodes/:id` | `PATCH` | Modifier un QR code | ✅ |
| `/qrcodes/:id` | `DELETE` | Supprimer un QR code | ✅ |
| `/qrcodes/:id/stats` | `GET` | Statistiques d'un QR code | ✅ |
| `/admin/campaigns` | `GET/POST` | Campagnes email (admin) | ✅ admin |
| `/admin/campaigns/:id` | `GET/PATCH` | Détail/maj campagne | ✅ admin |
| `/admin/campaigns/:id/send` | `POST` | Envoyer une campagne | ✅ admin |
| `/admin/templates` | `GET/POST` | Modèles QR (admin) | ✅ admin |
| `/admin/templates/:id` | `GET/PATCH/DELETE` | Détail/maj/suppression modèle | ✅ admin |
| `/tracking/pixel` | `GET` | Pixel d'ouverture email | ❌ |
| `/tracking/click` | `GET` | Tracking clic email | ❌ |
| `/q/:aliasCourt` | `GET` | Redirection & scan | ❌ |

---

## Documentation MERISE

La documentation d'architecture et de conception est disponible dans le dossier [`merise/`](./merise) :

- [MCD](./merise/01_MCD.md) — Entités : Utilisateur, QRCode, Scan, ModeleQR, CampagneEmail, CampagneUtilisateur, TrackingEmail, CleApi, JournalQRCode, TokenEmail.
- [MLD](./merise/02_MLD.md) — Relations et cardinalités.
- [MPD](./merise/03_MPD.md) — Implémentation MongoDB (collections, champs, index).
- [MCT / MOT](./merise/04_MCT.md) — Traitements CRUD, authentification, statistiques.
- [Architecture](./merise/10_ARCHITECTURE.md) — Vue technique complète.
- [OpenAPI](./merise/11_API_OPENAPI.yaml) — Contrat d'API.
- [Navigation frontend](./merise/09_UML_FRONTEND_NAVIGATION.md)
- [Sécurité & RGPD](./merise/12_SECURITE_RGPD.md)
- [Plan de tests](./merise/13_PLAN_TESTS.md)

---

## Points d'attention / écarts constatés

Lors de la vérification de cohérence globale, les écarts principaux suivants ont été identifiés entre la MERISE, l'API et le frontend :

### 1. Endpoints documentés mais non (ou partiellement) implémentés

- **Vérification d'email** : `GET /auth/verify-email` existe mais renvoie `501 Not Implemented` (placeholder).
- **Clés API** : le MCD/MLD/MPD prévoit `CleApi`, `shared-types` définit les types, mais il n'y a **aucune route** `/api-keys` dans l'API.
- **Journal d'audit QR** : la collection `journaux_qrcodes` est référencée dans `init-db.js` et `getCollections`, mais aucun service ni endpoint n'expose ce journal.
- **Tokens email** : collection `tokens_email` initialisée, mais aucune route ne gère les tokens de vérification / reset.

### 2. Routes frontend sans backend correspondant

- `ApiKeysPage.tsx`, `SettingsPage.tsx`, `SessionsPage.tsx` sont des **placeholders vides** (`// TODO`).
- Le hook `useUsers.ts` consomme `/admin/users`, **route inexistante** dans `admin.ts`.
- Plusieurs pages du plan de navigation (wireframes) n'ont pas encore de page React (`BillingPage`, etc.).

### 3. Divergences de noms / types

- Le MCD parle de `ModeleQR` ; l'API utilise `admin/templates` → cohérent fonctionnellement mais nom différent.
- Le schéma `updateQRCodeSchema` accepte `parametres` alors que le schéma de création accepte `design`. Les deux correspondent à `QRCodeDesign` mais avec des noms différents (inconsistance API).
- La route `GET /qrcodes/:id` retourne `parametres`, pas `design`.

### 4. Champs présents dans shared-types mais non pleinement exploités

- `ApiKey` / `CleApi` : types définis, pas de CRUD backend.
- `JournalQRCode` : type défini, pas d'exploitation.
- `TokenEmail` : type défini, pas d'exploitation.

### 5. Sécurité / RGPD

- Le plan de sécurité mentionne un rate limit avancé et anonymisation IP (faite dans `scan.ts` → ✅).
- Pas de route `/auth/forgot-password` ni `/auth/reset-password` alors que le plan de tests les mentionne indirectement via les tokens email.

---

## Notes

- Le frontend React Query consomme l'API via `api.ts`, `qrApi.ts`, `adminApi.ts` en utilisant `import.meta.env.VITE_API_URL`.
- L'API supporte à la fois l'authentification par header `Authorization: Bearer <token>` et par cookie `accessToken`.
- Le worker est conçu pour Cloudflare Workers ; `wrangler.toml` doit être complété par les secrets Cloudflare (`wrangler secret put`).

---

## Licence

Projet privé — tous droits réservés.
