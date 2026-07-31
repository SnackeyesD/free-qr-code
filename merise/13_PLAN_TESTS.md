# Plan de tests — Free QR Code SaaS

## 1. Objectifs et périmètre

Ce document définit la stratégie de tests du projet **Free QR Code SaaS**, un service de génération de QR codes dynamiques et statiques avec authentification, statistiques de scans, campagnes email et API.

Il couvre les tests à réaliser sur :
- le backend API (Cloudflare Workers + MongoDB + R2) ;
- le frontend React + Vite ;
- les flux inter-services (Worker ↔ MongoDB ↔ R2 ↔ SMTP ↔ GeoIP) ;
- les traitements métier décrits dans le MCT (`04_MCT.md`, T01–T18).

Le plan s'appuie sur les documents existants : MCD, MLD, MPD, MCT, MOT, MLT, wireframes, séquences, navigation, architecture et spécification OpenAPI.

---

## 2. Stratégie de tests

### 2.1 Approche globale

- **Tests en continu** : exécutés à chaque push via CI/CD GitHub Actions.
- **Tests automatisés prioritaires** : unitaires, intégration API et E2E critiques.
- **Tests exploratoires manuels** pour les parcours complexes et l'UX.
- **Tests de sécurité et de performance** intégrés à la pipeline avant staging et production.
- **Testabilité par traitement** : chaque traitement MCT dispose d'au moins un scénario de test.

### 2.2 Niveaux de tests

| Niveau | Objectif | Couverture |
|--------|----------|------------|
| Tests unitaires | Valider les fonctions isolées (validation, hashing, calculs, DTO) | Services, helpers, hooks, composants purs |
| Tests d'intégration | Valider la communication entre couches (API ↔ base, API ↔ R2) | Routes Workers, repositories, middlewares |
| Tests E2E (end-to-end) | Valider les parcours utilisateur complets | Frontend + backend déployés en environnement de test |
| Tests de sécurité | Détecter les vulnérabilités et contrôler l'autorisation | Auth, injections, XSS, CSRF, rate limiting |
| Tests de performance | Mesurer la latence et la résilience | Génération QR, redirection scan, login |
| Tests d'accessibilité | Vérifier la conformité WCAG 2.1 AA | Formulaires, navigation clavier, lecteurs d'écran |
| Tests de compatibilité | Valider les navigateurs et appareils | Chrome, Firefox, Safari, Edge, mobile |

### 2.3 Cycle de tests dans la CI/CD

```text
Push branche feature
  ├── Lint + TypeScript check
  ├── Tests unitaires (Vitest)
  ├── Tests d'intégration API (Vitest + MongoDB Memory Server / testcontainers)
  ├── Build frontend + backend
  ├── Déploiement preview (Cloudflare Pages + Workers preview)
  └── Tests E2E (Playwright) sur preview
Merge develop
  ├── Tests E2E complémentaires staging
  ├── Tests de sécurité (npm audit, SAST basique)
  ├── Tests de performance smoke (k6 / Artillery)
  └── Déploiement staging
Merge main
  ├── Tests de non-régression complets
  ├── Tests de performance approfondis
  └── Déploiement production
```

---

## 3. Types de tests et outils proposés

### 3.1 Tests unitaires

- **Outils** : [Vitest](https://vitest.dev/) (frontend + backend), [React Testing Library](https://testing-library.com/react) pour les composants React.
- **Cible** : pure functions, validateurs Zod, helpers de date, hash, parsing, hooks personnalisés.
- **Exemples de sujets** :
  - `validerContenuSelonType` (URL, email, téléphone, vCard, Wi-Fi, geo).
  - `genererAliasUnique` et la gestion des collisions.
  - Masquage d'IP et extraction de la famille d'appareil.
  - Formatage des statistiques et agrégations.
  - Validation des schémas OpenAPI côté backend.

### 3.2 Tests d'intégration

- **Outils** : Vitest, [supertest](https://github.com/ladjs/supertest) ou [Miniflare](https://miniflare.dev/) pour simuler les Workers, [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server) ou [testcontainers](https://testcontainers.com/).
- **Cible** : routes API, middlewares d'authentification, repositories, upload R2 simulé, envoi d'email mocké.
- **Exemples** :
  - Inscription complète et confirmation d'email.
  - Connexion, refresh token et révocation de session.
  - Création de QR code statique et dynamique.
  - Modification d'un QR dynamique avec vérification de propriété.
  - Redirection `/q/{aliasCourt}` avec enregistrement asynchrone du scan.
  - Export de statistiques en CSV/JSON/XLSX.

### 3.3 Tests E2E (End-to-End)

- **Outils** : [Playwright](https://playwright.dev/).
- **Cible** : parcours utilisateurs complets sur un environnement déployé (preview ou staging).
- **Parcours critiques** :
  - Inscription → confirmation email → connexion → tableau de bord.
  - Création d'un QR statique → téléchargement PNG → vérification du fichier.
  - Création d'un QR dynamique → modification de la cible → scan simulé → statistiques mises à jour.
  - Génération de QR dynamique → désactivation → scan retournant 404.
  - Connexion avec refresh automatique → révocation de session → 401 forcé.

### 3.4 Tests de sécurité

- **Outils** : [npm audit](https://docs.npmjs.com/cli/v10/commands/npm-audit), [OWASP ZAP](https://www.zaproxy.org/) (scan passif), tests manuels d'autorisation.
- **Cible** :
  - Authentification JWT et refresh token (expiration, révocation, reuse detection).
  - Vérification des propriétaires sur les ressources (`idUtilisateur`).
  - Rate limiting par IP et par compte.
  - Validation stricte Zod (injection NoSQL, XSS, types incorrects).
  - Protection contre les open redirects sur `/q/{aliasCourt}` et le tracking.
  - Hash des mots de passe (bcrypt), hash des clés API et tokens.
  - Anonymisation des IPs avant stockage.
  - CORS et CSP correctement configurés.

### 3.5 Tests de performance

- **Outils** : [k6](https://k6.io/) ou [Artillery](https://www.artillery.io/).
- **Cible** :
  - Temps de génération d'un QR < 500 ms (P95).
  - Temps de redirection `/q/{aliasCourt}` < 100 ms (P95).
  - Temps de connexion et de chargement du dashboard < 2 s.
  - Résistance à 100 req/s sur la redirection scan et 10 req/s sur la génération QR.

### 3.6 Tests d'accessibilité

- **Outils** : [axe-core](https://github.com/dequelabs/axe-core) (via Playwright), [Lighthouse](https://developer.chrome.com/docs/lighthouse), tests manuels au clavier.
- **Cible** : conformité WCAG 2.1 AA sur les pages publiques et protégées.
- **Vérifications** :
  - Contraste suffisant.
  - `aria-label` sur les icônes et boutons.
  - Ordre de tabulation logique.
  - Messages d'erreur associés aux champs via `aria-describedby`.
  - Titres de page uniques par route.
  - Skeletons et états de chargement accessibles.

### 3.7 Tests de compatibilité

- **Outils** : Playwright ( Chromium, Firefox, WebKit ), navigateurs mobiles émulés.
- **Cible** : Chrome, Firefox, Safari, Edge, mobile iOS/Android.
- **Vérifications** : responsive des wireframes, téléchargements d'images, redirections, formulaires.

### 3.8 Tests de données et de migration

- **Outils** : scripts de seed, tests de cohérence MongoDB, vérifications d'index.
- **Cible** :
  - Conformité des schémas MongoDB avec les validateurs `$jsonSchema` du MPD.
  - Cohérence des index (unicité, sparse, TTL).
  - Données de seed exploitables pour les tests.

---

## 4. Environnements de test

| Environnement | Infrastructure | Données | Utilisation |
|---------------|--------------|---------|-------------|
| Local | Wrangler dev + MongoDB local/Docker + R2 mock/MinIO | Seed initial, reset à chaque test | Développement et tests unitaires |
| CI | Miniflare + MongoDB Memory Server + mocks R2/SMTP/GeoIP | Créées à la volée | Tests automatisés sur chaque push |
| Preview | Cloudflare Pages + Workers preview + MongoDB Atlas staging | Seed partagé, isolé par branche | Tests E2E Playwright |
| Staging | Cloudflare Pages + Workers + MongoDB Atlas staging | Données de test stables, anonymisées | Tests E2E, sécurité, performance |
| Production | Cloudflare Pages + Workers + MongoDB Atlas production | Données réelles | Smoke tests post-déploiement, monitoring |

---

## 5. Données de test

### 5.1 Jeux de données principaux

| Rôle | Données | Cas particuliers |
|------|---------|------------------|
| Visiteur | Email inexistant, mot de passe conforme | Email déjà utilisé, mot de passe faible, consentement non coché |
| Utilisateur vérifié | Email confirmé, compte actif, plusieurs QR codes | Compte désactivé, email non vérifié, QR expiré, QR inactif |
| Utilisateur avec QR dynamique | QR dynamique avec alias court, scans existants | Tentative de modification par un autre utilisateur |
| Administrateur | Rôle `admin`, campagnes email existantes | Tentative d'accès admin par un utilisateur standard |
| Scanneur | User-agent mobile/desktop, IP variées | IP à anonymiser, referer absent |

### 5.2 Seed de test

Un fichier `scripts/seed-test.js` doit créer les entités suivantes avant les tests d'intégration/E2E :

- 1 administrateur (`role: admin`).
- 3 utilisateurs vérifiés, dont 1 avec `consentementMarketing: false`.
- 1 utilisateur non vérifié.
- 1 utilisateur désactivé.
- 10 QR codes (5 statiques, 5 dynamiques) répartis sur 2 utilisateurs.
- 50 scans répartis sur 5 jours pour 2 QR codes.
- 1 campagne email en brouillon et 1 envoyée.
- 2 clés API (1 active, 1 expirée).
- 2 modèles publics et 1 modèle privé.

### 5.3 Mocks externes

| Service | Mock | Implémentation |
|---------|------|----------------|
| SMTP | [Mailpit](https://github.com/axllent/mailpit) ou [Ethereal](https://ethereal.email/) | Capturer les emails et extraire les tokens de confirmation |
| R2 | [MinIO](https://min.io/) ou mock S3 local | Vérifier l'upload et le téléchargement des images |
| GeoIP | Stub retournant un pays/ville fixe | Tester l'enregistrement du scan sans appel réseau |
| Service QR | Librairie `qrcode` Node.js | Générer et vérifier les images PNG/SVG |

---

## 6. Périmètre de tests par traitement MCT

### 6.1 Matrice de couverture T01–T18

| Traitement | Description | Tests unitaires | Tests intégration | Tests E2E | Tests sécurité | Tests perf |
|------------|-------------|-----------------|-------------------|-----------|----------------|------------|
| **T01** | S'inscrire | Validation email, force mot de passe, consentement | Inscription complète, email envoyé, token stocké | Parcours inscription → email → confirmation | Email existant, injection NoSQL, mot de passe faible | — |
| **T02** | Confirmer son email | Validation du token, expiration | Confirmation, token marqué utilisé, `estVerifie` mis à jour | Lien de confirmation invalide/expiré | Token déjà utilisé, brute-force token | — |
| **T03** | Se connecter | Comparaison bcrypt, génération JWT | Connexion OK, refresh token stocké, compte désactivé | Connexion depuis `/login` → dashboard | Identifiants invalides, email non vérifié, brute-force | Temps de connexion |
| **T16** | Rafraîchir l'access token | Vérification du hash refresh | Refresh valide, refresh révoqué/expiré | Intercepteur 401 frontend | Refresh token volé, reuse | — |
| **T17** | Révoquer une session | Vérification propriétaire | Révocation session, déconnexion | Révoquer session dans `/settings/sessions` | Révocation d'une session d'un autre | — |
| **T04** | Générer un QR code | Validation contenu par type, génération image, alias unique | Création statique, création dynamique, upload R2 | Créer QR depuis `/dashboard/qr/new` | Type invalide, alias collision, injection dans `parametres` | Temps génération |
| **T05** | Modifier un QR dynamique | Vérification propriétaire, `estDynamique` | Modification cible, journal créé | Modifier cible depuis `/dashboard/qr/:id/edit` | Modification QR statique, QR d'un autre | — |
| **T06** | Lister ses QR codes | Filtres, pagination, recherche | Liste paginée, filtre par type/statut | Liste sur `/dashboard/qr` | Accès à la liste d'un autre utilisateur | — |
| **T07** | Désactiver / supprimer un QR code | Vérification propriétaire | Désactivation, suppression + image R2 | Désactiver/supprimer depuis la liste | Action sur QR d'un autre | — |
| **T08** | Rediriger un QR dynamique | Recherche alias, vérification actif/expiré | 302 vers cible, 404 si inactif, 410 si expiré | Scan simulé d'un QR dynamique | Alias inexistant, open redirect | Latence redirection |
| **T09** | Enregistrer un scan | Anonymisation IP, détection unicité, upsert stats | Scan enregistré, stats agrégées, `nombreScansTotal` incrémenté | Stats mises à jour après scan | IP non anonymisée, scan QR inactif | Volume scans |
| **T10** | Consulter les statistiques | Agrégation par période, top pays/appareils | Stats 7j/30j/1an, top pays, top appareils | Page `/dashboard/qr/:id/stats` | Accès aux stats d'un autre | — |
| **T11** | Créer une campagne email | Vérification admin, lien de désinscription | Création campagne en brouillon | Page `/admin/campaigns/new` | Accès non-admin, XSS dans contenu | — |
| **T12** | Programmer / envoyer une campagne email | Filtrage consentement, rate limit, tracking | Envoi campagne, `campagnes_utilisateurs` créés | Bouton "Envoyer maintenant" | Envoi sans consentement, spam | Volume d'envoi |
| **T18** | Enregistrer un événement de tracking email | Décodage token, pixel/clic | Ouverture incrémentée, clic incrémenté | Campagne affiche taux d'ouverture | Token falsifié, tracking multiple | — |
| **T13** | Gérer les modèles de QR | Validation paramètres, visibilité publique | CRUD modèle, liste publique | Page `/admin/templates` | Modification par non-admin | — |
| **T14** | Gérer les clés API | Génération clé, hash, permissions, expiration | Création, vérification, révocation clé | Page `/dashboard/api-keys` | Clé d'un autre utilisateur, permission insuffisante | — |
| **T15** | Exporter les statistiques | Génération CSV/JSON/XLSX | Export dans les 3 formats | Bouton export sur page stats | Accès au QR d'un autre | Taille fichier |

### 6.2 Scénarios détaillés par traitement

#### T01 — S'inscrire

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Inscription valide | Email, mot de passe fort, nom, consentement coché | 1. POST `/auth/register` 2. Vérification email envoyé 3. Vérification token `tokens_email` | 201, compte créé avec `estVerifie: false`, email reçu |
| Email déjà utilisé | Email existant | POST `/auth/register` | 409, message générique ou spécifique selon politique |
| Mot de passe faible | Mot de passe court/simple | POST `/auth/register` | 422, indication des exigences |
| Consentement non coché | Formulaire valide sans consentement | POST `/auth/register` | 422, blocage explicite |
| Format email invalide | Email sans @ | POST `/auth/register` | 422, erreur de validation |
| Injection NoSQL | `email: {$ne: null}` | POST `/auth/register` | 422, rejeté par Zod |

#### T02 — Confirmer son email

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Token valide | Token de confirmation | GET `/auth/verify-email?token=...` | 200, `estVerifie: true`, token marqué utilisé |
| Token expiré | Token avec `dateExpiration` passée | GET `/auth/verify-email?token=...` | 400, email non confirmé |
| Token déjà utilisé | Token consommé | GET `/auth/verify-email?token=...` | 400, message explicite |
| Token invalide | Chaîne aléatoire | GET `/auth/verify-email?token=...` | 400, rejeté |

#### T03 — Se connecter

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Connexion valide | Email + mot de passe corrects | POST `/auth/login` | 200, JWT access + refresh token, `dateDerniereConnexion` mise à jour |
| Mot de passe incorrect | Bon email, mauvais mot de passe | POST `/auth/login` | 401, message générique |
| Compte non vérifié | Email non confirmé | POST `/auth/login` | 401 ou 403, invitation à confirmer |
| Compte désactivé | Utilisateur avec `estActif: false` | POST `/auth/login` | 403, message compte désactivé |
| Email inexistant | Email non enregistré | POST `/auth/login` | 401, message générique |
| Brute-force | 10 tentatives échouées | POST `/auth/login` | 429, rate limit déclenché |

#### T04 — Générer un QR code

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| QR statique URL | `typeContenu: url`, contenu valide | POST `/qrcodes` | 201, image uploadée sur R2, `estDynamique: false` |
| QR dynamique URL | `estDynamique: true` | POST `/qrcodes` | 201, `aliasCourt` généré, URL de redirection encodée |
| QR Wi-Fi valide | Format `WIFI:S:...` | POST `/qrcodes` | 201, contenu encodé correctement |
| QR vCard valide | Format vCard | POST `/qrcodes` | 201, contenu encodé correctement |
| Type de contenu invalide | Type non supporté | POST `/qrcodes` | 422, rejeté |
| Contenu invalide pour le type | URL mal formée avec `typeContenu: url` | POST `/qrcodes` | 422, rejeté |
| Alias court déjà existant | Collision forcée | POST `/qrcodes` | 500 après 10 tentatives ou alias différent généré |
| Injection dans `parametres` | Objet JSON malveillant | POST `/qrcodes` | 422, rejeté par Zod |

#### T05 — Modifier un QR code dynamique

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Modification valide | Nouvelle URL cible | PATCH `/qrcodes/{id}` | 200, `contenu` mis à jour, journal créé |
| Modification QR statique | `estDynamique: false` | PATCH `/qrcodes/{id}` | 400, rejeté |
| QR d'un autre utilisateur | `idQRCode` d'un autre compte | PATCH `/qrcodes/{id}` | 403, accès refusé |
| Nouveau contenu invalide | URL mal formée | PATCH `/qrcodes/{id}` | 422, rejeté |
| QR inexistant | Mauvais `id` | PATCH `/qrcodes/{id}` | 404 |

#### T06 — Lister ses QR codes

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Liste par défaut | Utilisateur avec QR | GET `/qrcodes` | 200, liste paginée, uniquement ses QR |
| Filtre par type | `?type=url` | GET `/qrcodes` | 200, uniquement QR de type URL |
| Filtre par statut | `?status=actif` | GET `/qrcodes` | 200, QR actifs uniquement |
| Recherche textuelle | `?search=site` | GET `/qrcodes` | 200, QR correspondant au contenu/alias |
| Pagination | `?page=2&limit=5` | GET `/qrcodes` | 200, page 2 avec 5 résultats max |
| Accès non authentifié | Aucun token | GET `/qrcodes` | 401 |

#### T07 — Désactiver / supprimer un QR code

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Désactivation | `idQRCode` propriétaire | PATCH `estActif: false` | 200, `estActif: false`, scan retourne 404 |
| Suppression physique | `idQRCode` propriétaire | DELETE `/qrcodes/{id}` | 204, document supprimé, image R2 supprimée |
| Suppression QR d'un autre | `idQRCode` d'un autre | DELETE `/qrcodes/{id}` | 403 |
| QR inexistant | Mauvais `id` | DELETE `/qrcodes/{id}` | 404 |

#### T08 — Rediriger un QR dynamique

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| QR actif | `aliasCourt` existant | GET `/q/{aliasCourt}` | 302, `Location: contenu` |
| QR inactif | `aliasCourt` désactivé | GET `/q/{aliasCourt}` | 404 |
| QR expiré | `dateExpiration` passée | GET `/q/{aliasCourt}` | 410 |
| Alias inexistant | Chaîne aléatoire | GET `/q/{aliasCourt}` | 404 |
| Open redirect | Cible contenant URL externe | GET `/q/{aliasCourt}` | 302 seulement vers la cible autorisée, pas de manipulation |
| Latence | 100 requêtes | GET `/q/{aliasCourt}` | P95 < 100 ms |

#### T09 — Enregistrer un scan

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Scan unique | IP A, premier scan du jour | GET `/q/{aliasCourt}` | Document `scans` inséré, `estUnique: true`, stats incrémentées |
| Scan non unique | IP A, second scan du jour | GET `/q/{aliasCourt}` | `estUnique: false`, `nombreScans` incrémenté, `nombreScansUniques` inchangé |
| Anonymisation IP | IP `192.168.1.42` | GET `/q/{aliasCourt}` | IP stockée `192.168.1.x` |
| Scan QR inactif | `aliasCourt` désactivé | GET `/q/{aliasCourt}` | 404, aucun scan enregistré |
| QR inexistant | Alias invalide | GET `/q/{aliasCourt}` | 404, aucun scan enregistré |

#### T10 — Consulter les statistiques d'un QR code

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Stats 7 jours | `?period=7` | GET `/qrcodes/{id}/stats` | 200, total scans, uniques, évolution quotidienne |
| Stats 30 jours | `?period=30` | GET `/qrcodes/{id}/stats` | 200, agrégats sur 30 jours |
| Top pays | Scans avec pays variés | GET `/qrcodes/{id}/stats` | Top pays correctement ordonné |
| Top appareils | User-agents variés | GET `/qrcodes/{id}/stats` | Top appareils correctement ordonné |
| QR d'un autre | `id` d'un autre utilisateur | GET `/qrcodes/{id}/stats` | 403 |

#### T11 — Créer une campagne email

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Campagne valide | Titre, contenu HTML, cible, lien de désinscription | POST `/admin/campaigns` | 201, statut `brouillon` |
| Sans lien de désinscription | Contenu sans unsubscribe | POST `/admin/campaigns` | 400, rejeté |
| Contenu XSS | `<script>alert('xss')</script>` | POST `/admin/campaigns` | Contenu échappé/sanitisé, script inactif |
| Non-admin | Utilisateur standard | POST `/admin/campaigns` | 403 |

#### T12 — Programmer / envoyer une campagne email

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Envoi immédiat | Campagne en brouillon | POST `/admin/campaigns/{id}/send` | 202, emails envoyés, statut `envoyee`, `campagnes_utilisateurs` créés |
| Envoi programmé | Date future | POST `/admin/campaigns/{id}/send` | 202, statut `programmee`, envoi différé |
| Cible respectant le consentement | Campagne cible `tous` | Envoi | Seuls les utilisateurs `consentementMarketing: true` reçoivent l'email |
| Rate limit SMTP | 1000 emails | Envoi | Envoi étalé, pas de dépassement du rate limit |
| Campagne déjà envoyée | `statut: envoyee` | POST `/admin/campaigns/{id}/send` | 400, rejeté |

#### T13 — Gérer les modèles de QR

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Créer un modèle public | Nom, type, paramètres, `estPublic: true` | POST `/admin/templates` | 201, visible dans la galerie |
| Créer un modèle privé | `estPublic: false` | POST `/admin/templates` | 201, non visible publiquement |
| Liste modèles publics | Utilisateur standard | GET `/dashboard/templates` | 200, uniquement modèles publics |
| Modification par non-admin | Utilisateur standard | POST `/admin/templates` | 403 |

#### T14 — Gérer les clés API

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Créer une clé API | Nom, permissions, date d'expiration | POST `/api-keys` | 201, clé brute affichée une seule fois, hash stocké |
| Utiliser une clé API valide | Clé avec bonne permission | Requête authentifiée par clé | 200, accès autorisé |
| Utiliser une clé expirée | Clé avec `dateExpiration` passée | Requête authentifiée par clé | 401 |
| Permission insuffisante | Clé `qrcodes:read` sur POST `/qrcodes` | Requête | 403 |
| Révocation | DELETE `/api-keys/{id}` | Suppression | 204, clé inactive |
| Révocation clé d'un autre | `id` d'une clé d'un autre utilisateur | DELETE `/api-keys/{id}` | 403 |

#### T15 — Exporter les statistiques

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Export CSV | `?format=csv` | GET `/qrcodes/{id}/export` | 200, fichier CSV valide avec en-têtes |
| Export JSON | `?format=json` | GET `/qrcodes/{id}/export` | 200, JSON structuré |
| Export XLSX | `?format=xlsx` | GET `/qrcodes/{id}/export` | 200, fichier XLSX lisible |
| Format invalide | `?format=pdf` | GET `/qrcodes/{id}/export` | 400 |
| QR d'un autre | `id` d'un autre utilisateur | GET `/qrcodes/{id}/export` | 403 |

#### T16 — Rafraîchir l'access token

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Refresh valide | Refresh token non expiré | POST `/auth/refresh` | 200, nouvel access token |
| Refresh expiré | Token expiré | POST `/auth/refresh` | 401, redirection login |
| Refresh révoqué | Session révoquée | POST `/auth/refresh` | 401 |
| Refresh token volé | Token d'une autre session | POST `/auth/refresh` | 401 ou 403 selon implémentation |

#### T17 — Révoquer une session

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Révocation propre | Token hash de la session courante | DELETE `/auth/sessions/{tokenHash}` | 200, session marquée `estRevoke: true` |
| Révocation d'une autre session | Autre token de l'utilisateur | DELETE `/auth/sessions/{tokenHash}` | 200, session révoquée |
| Révocation session d'un autre | Token d'un autre utilisateur | DELETE `/auth/sessions/{tokenHash}` | 403 |
| Déconnexion | Bouton déconnexion | POST `/auth/logout` | 200, refresh courant révoqué, tokens client effacés |

#### T18 — Enregistrer un événement de tracking email

| Scénario | Entrées | Étapes | Résultat attendu |
|----------|---------|--------|------------------|
| Ouverture d'email | Pixel chargé | GET `/tracking/pixel?t=...` | 200 GIF 1x1, `nombreOuvertures` incrémenté, `estOuvert: true` |
| Clic sur lien | Lien tracké | GET `/tracking/click?t=...&url=...` | 302 vers URL, `nombreClics` incrémenté, `estClique: true` |
| Token de tracking invalide | Chaîne aléatoire | GET `/tracking/pixel?t=...` | 200 GIF silencieux (pas de fuite) |
| Ouverture multiple | Pixel rechargé | GET `/tracking/pixel?t=...` | Compteur incrémenté selon règle métier (unique ou total) |
| Open redirect clic | `url` malveillante | GET `/tracking/click?t=...&url=...` | 302 uniquement vers URL autorisée, rejet si domaine interdit |

---

## 7. Matrices de tests détaillées

### 7.1 Matrice API — Authentification

| ID | Scénario | Préconditions | Action | Résultat attendu | Priorité |
|----|----------|---------------|--------|------------------|----------|
| AUTH-01 | Inscription valide | Aucune | POST `/auth/register` avec données valides | 201, email envoyé, utilisateur en base `estVerifie: false` | Haute |
| AUTH-02 | Email déjà utilisé | Utilisateur existant | POST `/auth/register` avec le même email | 409 | Haute |
| AUTH-03 | Mot de passe faible | Aucune | POST `/auth/register` avec mot de passe `1234` | 422 | Haute |
| AUTH-04 | Consentement manquant | Aucune | POST `/auth/register` sans `consentementMarketing` | 422 | Haute |
| AUTH-05 | Confirmation email valide | Utilisateur inscrit | GET `/auth/verify-email?token=...` | 200, `estVerifie: true` | Haute |
| AUTH-06 | Token de confirmation expiré | Token expiré en base | GET `/auth/verify-email?token=...` | 400 | Moyenne |
| AUTH-07 | Token de confirmation déjà utilisé | Token consommé | GET `/auth/verify-email?token=...` | 400 | Moyenne |
| AUTH-08 | Connexion valide | Utilisateur vérifié | POST `/auth/login` | 200, access + refresh tokens | Haute |
| AUTH-09 | Connexion avec mauvais mot de passe | Utilisateur vérifié | POST `/auth/login` mot de passe incorrect | 401, message générique | Haute |
| AUTH-10 | Connexion compte non vérifié | Utilisateur non vérifié | POST `/auth/login` | 401 ou 403, invitation à confirmer | Haute |
| AUTH-11 | Connexion compte désactivé | Utilisateur `estActif: false` | POST `/auth/login` | 403 | Haute |
| AUTH-12 | Rafraîchissement token valide | Refresh token actif | POST `/auth/refresh` | 200, nouvel access token | Haute |
| AUTH-13 | Rafraîchissement token révoqué | Session révoquée | POST `/auth/refresh` | 401 | Haute |
| AUTH-14 | Révocation session | Utilisateur connecté avec 2 sessions | DELETE `/auth/sessions/{tokenHash}` | 200, session révoquée | Moyenne |
| AUTH-15 | Rate limit login | 10 échecs en 1 minute | POST `/auth/login` | 429 | Moyenne |

### 7.2 Matrice API — QR codes

| ID | Scénario | Préconditions | Action | Résultat attendu | Priorité |
|----|----------|---------------|--------|------------------|----------|
| QR-01 | Créer QR statique URL | Utilisateur connecté | POST `/qrcodes` avec `estDynamique: false` | 201, image sur R2, document en base | Haute |
| QR-02 | Créer QR dynamique | Utilisateur connecté | POST `/qrcodes` avec `estDynamique: true` | 201, `aliasCourt` généré | Haute |
| QR-03 | Créer QR Wi-Fi | Utilisateur connecté | POST `/qrcodes` type `wifi` | 201, contenu encodé | Moyenne |
| QR-04 | Contenu invalide | Utilisateur connecté | POST `/qrcodes` avec URL invalide | 422 | Haute |
| QR-05 | Modifier QR dynamique | QR dynamique propriétaire | PATCH `/qrcodes/{id}` avec nouvelle URL | 200, journal créé | Haute |
| QR-06 | Modifier QR statique | QR statique propriétaire | PATCH `/qrcodes/{id}` | 400 | Haute |
| QR-07 | Modifier QR d'un autre | QR d'un autre utilisateur | PATCH `/qrcodes/{id}` | 403 | Haute |
| QR-08 | Désactiver QR | QR propriétaire | PATCH `estActif: false` | 200, scan retourne 404 | Haute |
| QR-09 | Supprimer QR | QR propriétaire | DELETE `/qrcodes/{id}` | 204, image R2 supprimée | Haute |
| QR-10 | Lister QR avec filtres | Utilisateur avec plusieurs QR | GET `/qrcodes?type=url&status=actif` | 200, filtres appliqués | Moyenne |
| QR-11 | Redirection QR dynamique actif | QR dynamique actif | GET `/q/{aliasCourt}` | 302 vers cible | Haute |
| QR-12 | Redirection QR inactif | QR désactivé | GET `/q/{aliasCourt}` | 404 | Haute |
| QR-13 | Redirection QR expiré | QR avec date expiration passée | GET `/q/{aliasCourt}` | 410 | Haute |

### 7.3 Matrice API — Statistiques, campagnes et tracking

| ID | Scénario | Préconditions | Action | Résultat attendu | Priorité |
|----|----------|---------------|--------|------------------|----------|
| STATS-01 | Consulter stats 7j | QR avec scans | GET `/qrcodes/{id}/stats?period=7` | 200, données agrégées | Haute |
| STATS-02 | Export CSV | QR avec scans | GET `/qrcodes/{id}/export?format=csv` | 200, fichier CSV | Moyenne |
| STATS-03 | Stats QR d'un autre | QR d'un autre | GET `/qrcodes/{id}/stats` | 403 | Haute |
| CAMP-01 | Créer campagne admin | Admin connecté | POST `/admin/campaigns` | 201, statut `brouillon` | Haute |
| CAMP-02 | Créer campagne sans lien de désinscription | Admin connecté | POST `/admin/campaigns` sans unsubscribe | 400 | Haute |
| CAMP-03 | Créer campagne non-admin | Utilisateur standard | POST `/admin/campaigns` | 403 | Haute |
| CAMP-04 | Envoyer campagne | Campagne en brouillon, admin | POST `/admin/campaigns/{id}/send` | 202, emails envoyés aux consentants | Haute |
| CAMP-05 | Cible non-consentants | Utilisateurs avec `consentementMarketing: false` | Envoi campagne | Non reçus | Haute |
| TRACK-01 | Pixel d'ouverture | Email reçu | GET `/tracking/pixel?t=...` | 200 GIF, ouverture comptabilisée | Haute |
| TRACK-02 | Clic tracké | Email reçu | GET `/tracking/click?t=...&url=...` | 302 vers URL, clic comptabilisé | Haute |
| TRACK-03 | Token tracking invalide | Chaîne aléatoire | GET `/tracking/pixel?t=...` | 200 GIF silencieux | Moyenne |

### 7.4 Matrice Frontend — Parcours utilisateurs

| ID | Scénario | Étapes | Résultat attendu | Priorité |
|----|----------|--------|------------------|----------|
| FE-01 | Inscription complète | Landing → Register → email → Verify → Login → Dashboard | Compte confirmé, connecté, dashboard affiché | Haute |
| FE-02 | Connexion | Login → Dashboard | Tokens stockés, dashboard affiché | Haute |
| FE-03 | Créer QR statique | Dashboard → Créer QR → saisie URL → générer → aperçu | QR affiché, bouton téléchargement actif | Haute |
| FE-04 | Créer QR dynamique | Créer QR → activer dynamique → générer → modifier cible | Cible modifiée, image inchangée | Haute |
| FE-05 | Désactiver QR | Liste QR → menu actions → désactiver | Statut inactif, scan retourne 404 | Haute |
| FE-06 | Consulter statistiques | QR → Stats → sélectionner période | Graphique et tops affichés | Haute |
| FE-07 | Exporter stats | QR → Stats → exporter CSV | Fichier téléchargé, contenu correct | Moyenne |
| FE-08 | Gérer clés API | Settings → Clés API → créer → copier → révoquer | Clé affichée une fois, puis révoquée | Moyenne |
| FE-09 | Révoquer session | Settings → Sessions → révoquer | Session déconnectée | Moyenne |
| FE-10 | Admin créer campagne | Admin → Campagnes → Nouvelle → envoyer | Campagne envoyée, métriques visibles | Moyenne |
| FE-11 | Responsive dashboard | Redimensionner mobile | Layout colonne unique, cartes empilées | Moyenne |
| FE-12 | Accessibilité login | Navigation clavier, lecteur d'écran | Focus visible, labels associés, messages annoncés | Haute |

---

## 8. Critères d'acceptation globaux

### 8.1 Critères fonctionnels

- Tous les scénarios de priorité **Haute** des matrices 7.1 à 7.4 doivent passer avec succès.
- Chaque traitement MCT (T01–T18) dispose d'au moins 2 scénarios de test (1 nominal, 1 d'erreur).
- Les règles de gestion RG01–RG10 et les CIF01–CIF06 sont couvertes par au moins un test.
- Les retours API respectent les codes HTTP et les payloads définis dans l'OpenAPI (`11_API_OPENAPI.yaml`).

### 8.2 Critères de qualité technique

- Couverture de tests unitaires ≥ 70 % sur les services et helpers critiques.
- Couverture de tests E2E sur les 5 parcours critiques : inscription, connexion, création QR, modification QR dynamique, scan + stats.
- Aucune vulnérabilité critique ou haute non corrigée (npm audit + OWASP ZAP).
- Temps de réponse P95 respectés : génération QR < 500 ms, redirection < 100 ms, login < 2 s.
- Score Lighthouse accessibilité ≥ 90 sur les pages publiques et les pages protégées principales.
- Taux de réussite des tests E2E ≥ 95 % sur 3 exécutions consécutives.

### 8.3 Critères de conformité

- Consentement marketing traçable et testable (RG08).
- IPs anonymisées dans tous les tests de scan (RG05).
- Lien de désinscription obligatoire dans les campagnes (T11).
- Accès aux ressources strictement limité au propriétaire ou à un admin (RG02, RG06).

---

## 9. Planification et responsabilités

### 9.1 Phases de test

| Phase | Livrable | Durée estimée | Responsable |
|-------|----------|---------------|-------------|
| Phase 1 — Tests unitaires | Couverture services/helpers + hooks | 1 semaine | Développeurs backend/frontend |
| Phase 2 — Tests d'intégration API | Routes + middlewares + repositories mockés | 1 semaine | Développeurs backend |
| Phase 3 — Tests E2E | Parcours Playwright sur preview | 1 semaine | QA / développeurs frontend |
| Phase 4 — Tests de sécurité | Audit, tests d'autorisation, rate limit | 3 jours | QA / référent sécurité |
| Phase 5 — Tests de performance | Scénarios k6 sur staging | 2 jours | QA / DevOps |
| Phase 6 — Tests d'accessibilité | axe-core + Lighthouse + manuel | 2 jours | QA / référent a11y |
| Phase 7 — Tests de non-régression | Suite complète avant production | 2 jours | QA |

### 9.2 Rythme de tests

- **À chaque push** : lint, type-check, tests unitaires, tests d'intégration.
- **À chaque pull request vers `develop`** : tests E2E smoke (10 scénarios critiques).
- **À chaque merge vers `staging`** : tests E2E complets, tests sécurité, tests performance smoke.
- **Avant merge vers `main`** : tests de non-régression complets, audit sécurité, performance approfondie.
- **Post-déploiement production** : smoke tests manuels ou automatisés sur les flux critiques.

---

## 10. Gestion des anomalies

### 10.1 Classification

| Sévérité | Description | Action attendue |
|----------|-------------|-----------------|
| Bloquant | Empêche le déploiement ou un parcours critique | Corrigé avant merge |
| Majeur | Fonctionnalité dégradée mais contournable | Corrigé avant staging |
| Mineur | Problème d'UX, wording, cosmétique | Planifié dans le sprint suivant |
| Faible | Optimisation ou dette technique | Backlog |

### 10.2 Processus

1. Détection via CI, tests manuels ou monitoring.
2. Création d'un ticket avec étapes de reproduction, captures, logs.
3. Analyse et reproduction locale.
4. Correction + ajout ou mise à jour d'un test automatisé pour éviter la régression.
5. Revue de code et re-exécution de la suite de tests.
6. Clôture du ticket après validation en staging.

---

## 11. Évolution du plan de tests

Ce plan est vivant. Il doit être mis à jour lors des évolutions suivantes du projet :

- Ajout de nouveaux types de QR (ex. : crypto, événement).
- Ajout de l'application mobile (Expo).
- Mise en place de queues d'envoi d'email (Cloudflare Queue).
- Ajout de la facturation ou de limitations de quota.
- Changement de fournisseur GeoIP ou SMTP.
- Évolution des exigences RGPD ou de conformité.

---

## 12. Références

- `01_MCD.md` — Modèle Conceptuel de Données
- `02_MLD.md` — Modèle Logique de Données
- `03_MPD.md` — Modèle Physique de Données
- `04_MCT.md` — Modèle Conceptuel de Traitements (T01–T18)
- `05_MOT.md` — Modèle Organisationnel de Traitements
- `06_MLT.md` — Modèle Logique de Traitements
- `07_UML_FRONTEND_WIREFRAMES.md` — Maquettes frontend
- `08_UML_FRONTEND_SEQUENCES.md` — Séquences frontend/API
- `09_UML_FRONTEND_NAVIGATION.md` — Navigation applicative
- `10_ARCHITECTURE.md` — Architecture technique
- `11_API_OPENAPI.yaml` — Spécification API REST
