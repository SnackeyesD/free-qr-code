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

- **Static & dynamic QR codes** — create, edit (destination, design, parameters) and delete
- **Scan analytics** — per-QR statistics, redirect endpoint with scan tracking + IP anonymization (RGPD-friendly)
- **Full auth system** — JWT access + refresh tokens, HttpOnly cookies, multi-session management & revocation, bcrypt hashing
- **Admin area** — email campaigns (pixel-open & click tracking), QR templates library
- **Edge-native** — API runs on Cloudflare Workers (V8 isolate, global latency), images on R2, D1-ready
- **Shared types** — end-to-end type safety between API and web via an internal `@free-qr/shared-types` workspace package
- **Validation everywhere** — Zod schemas shared across client & server
- **Rate limiting, security headers, CORS** — production hardening out of the box

## 📸 Screenshots

<!-- TODO: add screenshots to docs/screenshots/ -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![QR editor](docs/screenshots/editor.png) -->

> Landing page → [free-qr-code-saas.getcongo.com](https://free-qr-code-saas.getcongo.com/) · Register → [/register](https://free-qr-code-saas.getcongo.com/register)

## 🏗 Architecture

```
Browser (React 19 + Vite + Tailwind + React Query)
        │  HTTPS / JSON  (Bearer JWT or HttpOnly cookie)
        ▼
Cloudflare Worker (Hono) ── edge middlewares: rate-limit, CORS, auth, validation (Zod)
        │
        ├── MongoDB Atlas      (users, qrcodes, scans, campaigns, templates, sessions)
        └── Cloudflare R2      (generated QR images)
        └── short links        /q/:alias → 302 redirect + scan event (IP anonymized)
```

Monorepo managed with **pnpm workspaces** — API, web app and shared types versioned together.

## 🧱 Stack

| Layer | Technology |
|---|---|
| API | [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/) (TypeScript) |
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS 3 + react-router 7 |
| Database | Cloudflare D1 (SQLite) with migrations |
| Storage | Cloudflare R2 (`QR_IMAGES` bucket) |
| QR generation | `qrcode` (node-qrcode) |
| Auth | JWT via jose, bcryptjs, HttpOnly cookies, multi-session |
| Shared types | Internal workspace package `@free-qr/shared-types` (Zod-compatible) |
| Validation | [Zod](https://zod.dev/) |

## 📁 Monorepo structure

```text
free-qr-code/
├── apps/
│   ├── api/               # Backend Hono (Cloudflare Worker)
│   │   ├── src/
│   │   │   ├── index.ts             # Entry point, route mounting
│   │   │   ├── routes/              # auth, user, qrcode, stats, admin, tracking, redirect
│   │   │   ├── services/            # Business logic
│   │   │   ├── validators/          # Zod schemas
│   │   │   ├── middlewares/         # Rate limiting, helpers
│   │   │   ├── lib/                 # d1.ts, db.ts, r2.ts, qr-generator.ts
│   │   │   └── types/
│   │   └── wrangler.toml            # Cloudflare Worker config
│   └── web/               # Frontend React + Vite
│       ├── src/
│       │   ├── App.tsx              # Router
│       │   ├── lib/                 # API clients (api.ts, qrApi.ts, adminApi.ts)
│       │   ├── contexts/            # AuthContext
│       │   ├── hooks/               # React Query hooks
│       │   ├── pages/
│       │   └── layouts/             # DashboardLayout
├── packages/
│   └── shared-types/      # Shared Zod-compatible types (api, user, qrcode, stats…)
├── scripts/
│   └── init-db.js         # MongoDB init (collections, indexes, seed users)
├── merise/                # Full design documentation (see below)
├── package.json           # Root scripts + pnpm workspace
└── pnpm-workspace.yaml
```

## 🚀 Getting started

> Prerequisites: [pnpm](https://pnpm.io/) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare account for D1/R2).

```bash
pnpm install                # install all workspace dependencies

pnpm --filter @free-qr/api dev    # API dev server (wrangler)
pnpm --filter @free-qr/web dev    # web dev server (vite)

pnpm build                        # build everything
pnpm test                         # run tests

node scripts/init-db.js          # initialize database + seed
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

Provision Cloudflare resources once (`wrangler d1 create`, `wrangler r2 bucket create`), then set secrets with `wrangler secret put` (JWT secrets, etc.).

### Environment variables — Web (`apps/web/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL used by the frontend |

## 🔌 API surface

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

## 📐 Design documentation (MERISE + UML + OpenAPI)

The `merise/` folder contains the full software design lifecycle — MCD → MLD → MPD, business rules, DFD, UML navigation/sequence diagrams, architecture, OpenAPI contract, security & RGPD analysis, and a test plan. A sample of the discipline applied to this project:

- [`merise/01_MCD.md`](./merise/01_MCD.md) — conceptual data model (10 entities)
- [`merise/10_ARCHITECTURE.md`](./merise/10_ARCHITECTURE.md) — technical architecture
- [`merise/11_API_OPENAPI.yaml`](./merise/11_API_OPENAPI.yaml) — API contract
- [`merise/12_SECURITE_RGPD.md`](./merise/12_SECURITE_RGPD.md) — security & privacy analysis
- [`merise/13_PLAN_TESTS.md`](./merise/13_PLAN_TESTS.md) — test plan

## 🗺 Roadmap

Shipped and running — next iterations:

- [ ] Email verification & password reset flows (collections + tokens already provisioned)
- [ ] Public API keys management (`/api-keys` — types already defined)
- [ ] QR audit log exposure (`journaux_qrcodes` collection provisioned)
- [ ] Billing page
- [ ] Align `design` / `parametres` naming across API schemas

## 👤 Author

**SAYI Gloire** — Full-Stack Software Engineer (React · Node.js · TypeScript) · Telecom VAS & Mobile Money (ex-Huawei)

- GitHub: [@SnackeyesD](https://github.com/SnackeyesD)
- LinkedIn: *add your URL here*
- Email: messiasayi@gmail.com
- Open to remote opportunities 🌍

## 📄 License

Proprietary — all rights reserved. Demo code shared for portfolio purposes.
