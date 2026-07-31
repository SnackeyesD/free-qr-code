# 08 — Diagrammes de séquence Frontend / API

## Objectif

Ce document décrit les **diagrammes de séquence UML** entre le **Frontend React**, l’**API Cloudflare Workers**, la base **MongoDB**, le stockage **R2**, le serveur **SMTP** et le service **GeoIP** pour les scénarios principaux du SaaS *Free QR Code*.

Il s’appuie sur les traitements définis dans le **MCT** (`04_MCT.md`) et les pseudocodes du **MLT** (`06_MLT.md`).

---

## Participants / acteurs

| Symbole | Acteur | Rôle |
|---------|--------|------|
| `User` | Utilisateur final | Navigue sur le site et interagit avec le frontend. |
| `Admin` | Administrateur | Gère les campagnes email et les modèles. |
| `FE` | Frontend React + Vite | Interface utilisateur (landing, dashboard, éditeur QR). |
| `AdminFE` | Frontend admin React | Interface de gestion des campagnes et modèles. |
| `API` | Cloudflare Workers | API REST sécurisée (JWT, rate-limit, validations). |
| `DB` | MongoDB Atlas | Persistance des documents (utilisateurs, QR, scans, etc.). |
| `R2` | Cloudflare R2 | Stockage objet des images QR (PNG/SVG). |
| `SMTP` | Serveur SMTP maison | Envoi des emails transactionnels et marketing via Nodemailer. |
| `MailClient` | Client mail | Outlook, Gmail, etc., qui affiche les emails et charge les pixels. |
| `Scanner` | Navigateur / lecteur QR | Effectue un scan ou un GET sur un alias court dynamique. |
| `GeoIP` | Service GeoIP | Résolution pays / ville depuis une IP anonymisée. |

---

## 1. Inscription et confirmation d’email

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB
    participant SMTP as SMTP
    participant MailClient as Client mail

    User->>FE: Saisit email, mot de passe, nom, consentement
    FE->>API: POST /auth/register
    API->>DB: Vérifier unicité de l'email
    DB-->>API: email disponible
    API->>API: Hasher le mot de passe (bcrypt)
    API->>DB: INSERT utilisateurs
    API->>API: Générer token de vérification
    API->>DB: INSERT tokens_email (hash, type=verification)
    API->>SMTP: Envoyer email de confirmation
    SMTP-->>MailClient: Email avec lien de confirmation
    MailClient-->>User: Notification

    User->>FE: Clique sur le lien /verify-email?token=...
    FE->>API: GET /auth/verify-email?token=...
    API->>DB: Rechercher tokenHash + vérifier validité
    DB-->>API: Token OK
    API->>DB: UPDATE utilisateurs.estVerifie = true
    API->>DB: UPDATE tokens_email.estUtilise = true, dateUtilisation
    API-->>FE: 200 + redirection dashboard
    FE-->>User: Compte confirmé
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/auth/register` | `POST` | Création de compte | `{ email, motDePasse, nom, consentementMarketing }` |
| `/auth/verify-email` | `GET` | Confirmation d’email | Query `?token=<token>` |

### Payloads types

**Requête** `POST /auth/register` :
```json
{
  "email": "user@example.com",
  "motDePasse": "Str0ngP@ss!",
  "nom": "Jean Dupont",
  "consentementMarketing": true
}
```

**Réponse** `201 Created` :
```json
{
  "message": "Inscription réussie, vérifiez votre email"
}
```

---

## 2. Connexion et rafraîchissement de token

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB

    User->>FE: Saisit email + mot de passe
    FE->>API: POST /auth/login
    API->>DB: SELECT utilisateurs by email
    DB-->>API: utilisateur (hash, actif, vérifié)
    API->>API: bcrypt.compare(motDePasse, hash)
    API->>DB: INSERT refresh_tokens (hash, userAgent, IP)
    API-->>FE: 200 { accessToken, refreshToken, utilisateur }
    FE->>FE: Stocke accessToken + refreshToken (cookie httpOnly)

    Note over FE,API: Access token expiré (15 min)
    FE->>API: POST /auth/refresh
    API->>DB: SELECT refresh_tokens by hash
    DB-->>API: Session valide non révoquée
    API->>API: Vérifier expiration et statut actif
    API-->>FE: 200 { accessToken }
    FE->>API: Appel authentifié (Bearer accessToken)
    API-->>FE: Réponse protégée
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/auth/login` | `POST` | Authentification | `{ email, motDePasse }` |
| `/auth/refresh` | `POST` | Renouvellement de l’access token | `{ refreshToken }` (ou cookie httpOnly) |

### Payloads types

**Requête** `POST /auth/login` :
```json
{
  "email": "user@example.com",
  "motDePasse": "Str0ngP@ss!"
}
```

**Réponse** `200 OK` :
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "opaque-refresh-token-xyz",
  "utilisateur": {
    "_id": "...",
    "email": "user@example.com",
    "nom": "Jean Dupont",
    "role": "utilisateur"
  }
}
```

---

## 3. Création d’un QR code statique

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB
    participant R2 as Cloudflare R2

    User->>FE: Choisit type, saisit contenu, paramètres graphiques
    FE->>API: POST /qrcodes (estDynamique: false)
    API->>API: validerContenuSelonType(contenu, typeContenu)
    API->>API: Générer image PNG/SVG
    API->>R2: PUT users/{idUtilisateur}/qrcodes/{idQRCode}.png
    R2-->>API: URL publique de l’image
    API->>DB: INSERT qrcodes (contenu, typeContenu, parametres, estDynamique=false, urlImage)
    DB-->>API: Document QR inséré
    API-->>FE: 201 { qrCode, urlImage }
    FE-->>User: Affiche QR + bouton téléchargement
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/qrcodes` | `POST` | Créer un QR code | `{ contenu, typeContenu, parametres, estDynamique }` |

### Payloads types

**Requête** `POST /qrcodes` :
```json
{
  "contenu": "https://exemple.com",
  "typeContenu": "url",
  "estDynamique": false,
  "parametres": {
    "taille": 300,
    "couleur": "#000000",
    "correction": "M",
    "logo": null
  }
}
```

**Réponse** `201 Created` :
```json
{
  "qrCode": {
    "_id": "...",
    "contenu": "https://exemple.com",
    "typeContenu": "url",
    "estDynamique": false,
    "parametres": { "taille": 300, "couleur": "#000000", "correction": "M" },
    "nombreScansTotal": 0,
    "urlImage": "https://qr-saas-images.r2.cloudflarestorage.com/users/.../qr-xxx.png"
  }
}
```

---

## 4. Création d’un QR code dynamique

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB
    participant R2 as Cloudflare R2

    User->>FE: Choisit type, saisit cible, paramètres graphiques
    FE->>API: POST /qrcodes (estDynamique: true)
    API->>API: validerContenuSelonType(contenu, typeContenu)
    API->>API: Générer aliasCourt unique
    API->>API: Construire URL de redirection /q/{aliasCourt}
    API->>API: Générer image encodant l’URL de redirection
    API->>R2: PUT users/{idUtilisateur}/qrcodes/{idQRCode}.png
    R2-->>API: URL publique
    API->>DB: INSERT qrcodes (contenu=cible, aliasCourt, estDynamique=true, urlImage)
    DB-->>API: Document QR inséré
    API-->>FE: 201 { qrCode, urlImage, aliasCourt }
    FE-->>User: Affiche QR dynamique + lien court
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/qrcodes` | `POST` | Créer un QR dynamique | `{ contenu, typeContenu, parametres, estDynamique: true }` |

### Payloads types

**Requête** `POST /qrcodes` (dynamique) :
```json
{
  "contenu": "https://promotion-ete.com",
  "typeContenu": "url",
  "estDynamique": true,
  "parametres": {
    "taille": 400,
    "couleur": "#0A2540",
    "correction": "H"
  }
}
```

**Réponse** `201 Created` :
```json
{
  "qrCode": {
    "_id": "...",
    "contenu": "https://promotion-ete.com",
    "typeContenu": "url",
    "estDynamique": true,
    "aliasCourt": "q/abc123",
    "parametres": { "taille": 400, "couleur": "#0A2540", "correction": "H" },
    "urlImage": "https://qr-saas-images.r2.cloudflarestorage.com/users/.../qr-abc123.png"
  }
}
```

---

## 5. Modification d’un QR code dynamique

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB

    User->>FE: Ouvre l’édition d’un QR dynamique
    FE->>API: GET /qrcodes/{idQRCode}
    API->>DB: SELECT qrcodes by _id
    DB-->>API: QR
    API-->>FE: 200 QR data
    User->>FE: Modifie la cible (nouveau contenu)
    FE->>API: PATCH /qrcodes/{idQRCode}
    API->>DB: SELECT qrcodes by _id (vérifier owner + estDynamique=true)
    DB-->>API: QR dynamique
    API->>API: validerContenuSelonType(nouveauContenu, typeContenu)
    API->>DB: UPDATE qrcodes.contenu = nouveauContenu
    API->>DB: INSERT journaux_qrcodes (action=modification_cible)
    API-->>FE: 200 { message }
    FE-->>User: Cible mise à jour (l’image imprimée reste valide)
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/qrcodes/{id}` | `GET` | Récupérer un QR | Path `id` |
| `/qrcodes/{id}` | `PATCH` | Modifier la cible d’un QR dynamique | `{ contenu }` |

### Payloads types

**Requête** `PATCH /qrcodes/{id}` :
```json
{
  "contenu": "https://promotion-hiver.com"
}
```

**Réponse** `200 OK` :
```json
{
  "message": "QR code dynamique mis à jour"
}
```

---

## 6. Redirection et enregistrement d’un scan

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor Scanner as Navigateur / Scanner
    participant API as API Workers
    participant DB as MongoDB
    participant GeoIP as Service GeoIP

    Scanner->>API: GET /q/{aliasCourt}
    API->>DB: SELECT qrcodes by aliasCourt
    DB-->>API: QR (contenu, estActif, dateExpiration)
    alt QR actif et non expiré
        API-->>Scanner: HTTP 302 Location: contenu
        API->>API: Publier événement scan.received
        rect rgb(230, 245, 255)
            Note over API,GeoIP: Traitement asynchrone du scan
            API->>API: Anonymiser IP (masquer dernier octet)
            API->>GeoIP: lookup(IP)
            GeoIP-->>API: pays, ville
            API->>DB: INSERT scans (IP, userAgent, pays, ville, estUnique)
            API->>DB: UPSERT statistiques_qrcodes (incréments quotidiens)
            API->>DB: UPDATE qrcodes $inc nombreScansTotal
        end
    else QR introuvable, inactif ou expiré
        API-->>Scanner: 404 ou 410
    end
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/q/{aliasCourt}` | `GET` | Redirection d’un QR dynamique | Path `aliasCourt`, headers `User-Agent`, `Referer` |

### Détails du traitement

- L’IP est **anonymisée** avant stockage (`RG05`).
- Le scan est traité de manière **asynchrone** pour ne pas pénaliser la redirection (`T09`).
- Les statistiques sont agrégées quotidiennement via un upsert sur `statistiques_qrcodes`.

---

## 7. Consultation des statistiques d’un QR code

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB

    User->>FE: Sélectionne un QR et une période
    FE->>API: GET /qrcodes/{idQRCode}/stats?period=30
    API->>DB: SELECT qrcodes by _id (vérifier owner)
    DB-->>API: QR
    API->>DB: AGGREGATE statistiques_qrcodes (periode)
    DB-->>API: Agrégats quotidiens
    API->>API: Calculer top pays, top appareils, évolution
    API-->>FE: 200 { stats }
    FE-->>User: Affiche graphiques et tableaux
```

### Endpoints

| Endpoint | Méthode | Description | Paramètres |
|----------|---------|-------------|------------|
| `/qrcodes/{id}/stats` | `GET` | Statistiques d’un QR | `?period=7` (jours) |

### Payloads types

**Réponse** `200 OK` :
```json
{
  "totalScans": 1250,
  "totalScansUniques": 980,
  "evolution": [
    { "date": "2026-07-20", "scans": 45 },
    { "date": "2026-07-21", "scans": 78 }
  ],
  "topPays": [ { "pays": "France", "count": 620 }, { "pays": "Belgique", "count": 120 } ],
  "topAppareils": [ { "appareil": "Mobile", "count": 800 }, { "appareil": "Desktop", "count": 450 } ]
}
```

---

## 8. Envoi de campagne email et tracking

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrateur
    participant AdminFE as Admin Frontend
    participant API as API Workers
    participant DB as MongoDB
    participant SMTP as SMTP
    participant MailClient as Client mail

    Admin->>AdminFE: Rédige campagne (titre, contenu, cible)
    AdminFE->>API: POST /admin/campaigns
    API->>DB: INSERT campagnes_emails (statut=brouillon)
    API-->>AdminFE: 201 { idCampagne }

    Admin->>AdminFE: Clique sur "Envoyer maintenant"
    AdminFE->>API: POST /admin/campaigns/{idCampagne}/send
    API->>DB: SELECT utilisateurs selon cible + consentementMarketing=true
    DB-->>API: Liste des destinataires
    loop Pour chaque destinataire
        API->>API: Générer tokenTracking
        API->>DB: UPSERT campagnes_utilisateurs
        API->>SMTP: Envoyer email avec pixel et liens trackés
        SMTP-->>MailClient: Email reçu
    end
    API->>DB: UPDATE campagnes_emails statut=envoyee, dateEnvoi
    API-->>AdminFE: 200 { nombreDestinataires }

    Note over MailClient,API: Tracking ouverture
    MailClient->>API: GET /tracking/pixel?token=...
    API->>DB: INSERT tracking_emails (type=ouverture)
    API->>DB: INC campagnes_emails.nombreOuvertures
    API->>DB: UPDATE campagnes_utilisateurs.estOuvert=true
    API-->>MailClient: Pixel 1x1 transparent

    Note over MailClient,API: Tracking clic
    MailClient->>API: GET /tracking/click?token=...&url=...
    API->>DB: INSERT tracking_emails (type=clic)
    API->>DB: INC campagnes_emails.nombreClics
    API->>DB: UPDATE campagnes_utilisateurs.estClique=true
    API-->>MailClient: HTTP 302 Location: url
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/admin/campaigns` | `POST` | Créer une campagne | `{ titre, contenu, cible }` |
| `/admin/campaigns/{id}/send` | `POST` | Envoyer la campagne | Path `id` |
| `/tracking/pixel` | `GET` | Pixel d’ouverture | `?token=...` |
| `/tracking/click` | `GET` | Lien tracé | `?token=...&url=...` |

### Payloads types

**Requête** `POST /admin/campaigns` :
```json
{
  "titre": "Nouveautés QR Code",
  "contenu": "<html>...</html>",
  "cible": "actifs"
}
```

**Réponse** `POST /admin/campaigns/{id}/send` :
```json
{
  "nombreDestinataires": 1542
}
```

---

## 9. Gestion des clés API

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB

    User->>FE: Créer une clé API (nom, permissions, expiration)
    FE->>API: POST /api-keys
    API->>API: Générer clé aléatoire (64 caractères)
    API->>API: Hasher la clé (SHA256)
    API->>DB: INSERT cles_api (hash, permissions, dateExpiration)
    DB-->>API: Document clé
    API-->>FE: 201 { cleBrute, nom, permissions, dateExpiration }
    FE-->>User: Affiche la clé en clair une seule fois

    User->>FE: Liste les clés
    FE->>API: GET /api-keys
    API->>DB: SELECT cles_api by idUtilisateur
    DB-->>API: Liste (sans hash complet)
    API-->>FE: 200 liste masquée

    User->>FE: Révoque une clé
    FE->>API: DELETE /api-keys/{idCle}
    API->>DB: DELETE cles_api
    API-->>FE: 204 No Content
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/api-keys` | `POST` | Créer une clé API | `{ nom, permissions, dateExpiration }` |
| `/api-keys` | `GET` | Lister les clés | — |
| `/api-keys/{id}` | `DELETE` | Révoquer une clé | Path `id` |

### Payloads types

**Requête** `POST /api-keys` :
```json
{
  "nom": "Intégration site",
  "permissions": ["qrcodes:read", "qrcodes:create"],
  "dateExpiration": "2027-01-01T00:00:00Z"
}
```

**Réponse** `201 Created` :
```json
{
  "cleBrute": "qr_live_abc123...xyz",
  "nom": "Intégration site",
  "permissions": ["qrcodes:read", "qrcodes:create"],
  "dateExpiration": "2027-01-01T00:00:00Z"
}
```

---

## 10. Révocation de session

### Diagramme de séquence

```mermaid
sequenceDiagram
    autonumber
    actor User as Utilisateur
    participant FE as Frontend
    participant API as API Workers
    participant DB as MongoDB

    User->>FE: Affiche les sessions actives
    FE->>API: GET /auth/sessions
    API->>DB: SELECT refresh_tokens by idUtilisateur
    DB-->>API: Sessions
    API-->>FE: 200 liste

    User->>FE: Clique "Révoquer cette session"
    FE->>API: DELETE /auth/sessions/{tokenHash}
    API->>DB: SELECT refresh_tokens by hash + owner
    DB-->>API: Session
    API->>DB: UPDATE estRevoke=true, dateRevocation
    API-->>FE: 200 { message }
    FE-->>User: Session révoquée
```

### Endpoints

| Endpoint | Méthode | Description | Payload / Paramètres |
|----------|---------|-------------|---------------------|
| `/auth/sessions` | `GET` | Lister les sessions actives | — |
| `/auth/sessions/{tokenHash}` | `DELETE` | Révoquer une session | Path `tokenHash` |

### Payloads types

**Réponse** `DELETE /auth/sessions/{tokenHash}` :
```json
{
  "message": "Session révoquée"
}
```

---

## Tableau récapitulatif des endpoints

| Ressource | Endpoint | Méthode | Description |
|-----------|----------|---------|-------------|
| Authentification | `/auth/register` | `POST` | Inscription |
| Authentification | `/auth/verify-email` | `GET` | Confirmation email |
| Authentification | `/auth/login` | `POST` | Connexion |
| Authentification | `/auth/refresh` | `POST` | Rafraîchir l’access token |
| Authentification | `/auth/sessions` | `GET` | Lister les sessions |
| Authentification | `/auth/sessions/{tokenHash}` | `DELETE` | Révoquer une session |
| QR Code | `/qrcodes` | `POST` | Créer un QR (statique ou dynamique) |
| QR Code | `/qrcodes/{id}` | `GET` | Récupérer un QR |
| QR Code | `/qrcodes/{id}` | `PATCH` | Modifier un QR dynamique |
| QR Code | `/qrcodes/{id}/stats` | `GET` | Statistiques d’un QR |
| Redirection | `/q/{aliasCourt}` | `GET` | Redirection d’un QR dynamique |
| Tracking | `/tracking/pixel` | `GET` | Pixel d’ouverture d’email |
| Tracking | `/tracking/click` | `GET` | Clic tracé sur un email |
| Admin | `/admin/campaigns` | `POST` | Créer une campagne email |
| Admin | `/admin/campaigns/{id}/send` | `POST` | Envoyer une campagne email |
| API Keys | `/api-keys` | `POST` | Créer une clé API |
| API Keys | `/api-keys` | `GET` | Lister les clés API |
| API Keys | `/api-keys/{id}` | `DELETE` | Révoquer une clé API |

---

## Notes de cohérence

- Les noms de collections MongoDB utilisées sont : `utilisateurs`, `tokens_email`, `refresh_tokens`, `qrcodes`, `journaux_qrcodes`, `scans`, `statistiques_qrcodes`, `campagnes_emails`, `campagnes_utilisateurs`, `tracking_emails`, `cles_api`.
- Les URLs des endpoints sont indicatives ; elles doivent être alignées avec la spécification OpenAPI finale du projet.
- Les mots de passe et les clés API sont stockés sous forme de hash ; les tokens de refresh sont également stockés hashés.
