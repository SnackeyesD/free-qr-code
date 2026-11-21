.
├── apps
│   ├── api
│   │   ├── migrations
│   │   │   └── 001_initial_schema.sql
│   │   ├── package.json
│   │   ├── scripts
│   │   │   └── init-db.ts.legacy
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   ├── lib
│   │   │   │   ├── d1.ts
│   │   │   │   ├── db.ts
│   │   │   │   ├── qr-generator.ts
│   │   │   │   └── r2.ts
│   │   │   ├── middlewares
│   │   │   │   ├── common.ts
│   │   │   │   └── rate-limit.ts
│   │   │   ├── routes
│   │   │   │   ├── admin.ts
│   │   │   │   ├── api-keys.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── logs.ts
│   │   │   │   ├── qrcode.ts
│   │   │   │   ├── r2.ts
│   │   │   │   ├── redirect.ts
│   │   │   │   ├── stats.ts
│   │   │   │   └── user.ts
│   │   │   ├── services
│   │   │   │   ├── admin.ts
│   │   │   │   ├── api-keys.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── logs.ts
│   │   │   │   ├── qrcode.ts
│   │   │   │   ├── r2Image.ts
│   │   │   │   └── scan.ts
│   │   │   ├── types
│   │   │   │   └── index.ts
│   │   │   └── validators
│   │   │       ├── admin.ts
│   │   │       ├── qrcode.ts
│   │   │       └── user.ts
│   │   ├── tests
│   │   │   ├── auth.test.ts
│   │   │   ├── qrcode.test.ts
│   │   │   ├── qrcode.test.ts.mongobak
│   │   │   ├── scan-utils.test.ts
│   │   │   ├── setup.ts
│   │   │   └── user.test.ts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.toml
│   └── web
│       ├── dist
│       │   ├── assets
│       │   │   ├── index-BjJ-cPD4.js
│       │   │   ├── index-BjJ-cPD4.js.map
│       │   │   └── index-BjnFUbem.css
│       │   ├── index.html
│       │   └── vite.svg
│       ├── index.html
│       ├── package.json
│       ├── postcss.config.js
│       ├── public
│       │   └── vite.svg
│       ├── src
│       │   ├── App.tsx
│       │   ├── components
│       │   │   ├── CampaignForm.tsx
│       │   │   ├── CampaignList.tsx
│       │   │   ├── QRCodeList.tsx
│       │   │   ├── QRForm.tsx
│       │   │   ├── QRPreview.tsx
│       │   │   ├── TemplateForm.tsx
│       │   │   ├── TemplateList.tsx
│       │   │   └── UserList.tsx
│       │   ├── contexts
│       │   │   └── AuthContext.tsx
│       │   ├── hooks
│       │   │   ├── useApiKeys.ts
│       │   │   ├── useCampaigns.ts
│       │   │   ├── useDashboardStats.ts
│       │   │   ├── useQRCreate.ts
│       │   │   ├── useQRList.ts
│       │   │   ├── useQRStats.ts
│       │   │   ├── useQR.ts
│       │   │   ├── useSessions.ts
│       │   │   ├── useSettings.ts
│       │   │   ├── useTemplates.ts
│       │   │   └── useUsers.ts
│       │   ├── index.css
│       │   ├── layouts
│       │   │   ├── DashboardLayout.tsx
│       │   │   └── PublicLayout.tsx
│       │   ├── lib
│       │   │   ├── adminApi.ts
│       │   │   ├── apiKeysApi.ts
│       │   │   ├── api.ts
│       │   │   ├── dashboardApi.ts
│       │   │   ├── qrApi.ts
│       │   │   ├── qrForm.ts
│       │   │   ├── sessionsApi.ts
│       │   │   └── userApi.ts
│       │   ├── main.tsx
│       │   ├── pages
│       │   │   ├── AdminCampaignCreatePage.tsx
│       │   │   ├── AdminCampaignDetailPage.tsx
│       │   │   ├── AdminCampaignsPage.tsx
│       │   │   ├── AdminDashboardPage.tsx
│       │   │   ├── AdminMetricsPage.tsx
│       │   │   ├── AdminTemplatesPage.tsx
│       │   │   ├── AdminUsersPage.tsx
│       │   │   ├── ApiKeysPage.tsx
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── FeaturesPage.tsx
│       │   │   ├── ForbiddenPage.tsx
│       │   │   ├── ForgotPasswordPage.tsx
│       │   │   ├── LandingPage.tsx
│       │   │   ├── LoginPage.tsx
│       │   │   ├── NotFoundPage.tsx
│       │   │   ├── PricingPage.tsx
│       │   │   ├── PrivacyPage.tsx
│       │   │   ├── QRCreatePage.tsx
│       │   │   ├── QRDetailPage.tsx
│       │   │   ├── QREditPage.tsx
│       │   │   ├── QRListPage.tsx
│       │   │   ├── QRStatsPage.tsx
│       │   │   ├── RegisterPage.tsx
│       │   │   ├── ResetPasswordPage.tsx
│       │   │   ├── ServerErrorPage.tsx
│       │   │   ├── SessionsPage.tsx
│       │   │   ├── SettingsPage.tsx
│       │   │   ├── TemplatesPage.tsx
│       │   │   ├── TermsPage.tsx
│       │   │   ├── UnauthorizedPage.tsx
│       │   │   └── VerifyEmailPage.tsx
│       │   └── vite-env.d.ts
│       ├── tailwind.config.js
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── tsconfig.tsbuildinfo
│       └── vite.config.ts
├── Free_QR_Code_Insomnia.json
├── merise
│   ├── 01_MCD.md
│   ├── 02_MLD.md
│   ├── 03_MPD.md
│   ├── 04_MCT.md
│   ├── 05_MOT.md
│   ├── 06_MLT.md
│   ├── 07_UML_FRONTEND_WIREFRAMES.md
│   ├── 08_UML_FRONTEND_SEQUENCES.md
│   ├── 09_UML_FRONTEND_NAVIGATION.md
│   ├── 10_ARCHITECTURE.md
│   ├── 11_API_OPENAPI.yaml
│   ├── 12_SECURITE_RGPD.md
│   └── 13_PLAN_TESTS.md
├── package.json
├── packages
│   └── shared-types
│       ├── dist
│       │   ├── api.d.ts
│       │   ├── api.js
│       │   ├── campagne-email.d.ts
│       │   ├── campagne-email.js
│       │   ├── cle-api.d.ts
│       │   ├── cle-api.js
│       │   ├── index.d.ts
│       │   ├── index.js
│       │   ├── journal-et-tokens.d.ts
│       │   ├── journal-et-tokens.js
│       │   ├── modele.d.ts
│       │   ├── modele.js
│       │   ├── qrcode.d.ts
│       │   ├── qrcode.js
│       │   ├── statistiques.d.ts
│       │   ├── statistiques.js
│       │   ├── utilisateur.d.ts
│       │   └── utilisateur.js
│       ├── package.json
│       ├── src
│       │   ├── api.ts
│       │   ├── campagne-email.ts
│       │   ├── cle-api.ts
│       │   ├── index.ts
│       │   ├── journal-et-tokens.ts
│       │   ├── modele.ts
│       │   ├── qrcode.ts
│       │   ├── statistiques.ts
│       │   └── utilisateur.ts
│       └── tsconfig.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── scripts
│   ├── init-db.js
│   └── init-db.ts
└── tree_qr-coe.md

29 directories, 171 files
