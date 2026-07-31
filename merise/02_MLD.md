# MLD — Modèle Logique de Données

## Contexte

Transformation du MCD en modèle logique adapté à MongoDB. MongoDB est un SGBD orienté documents : les relations sont gérées par référencement (`ObjectId`) ou embarquement (sous-documents) selon les règles d'accès.

---

## Règles de transformation MCD → MLD

| Règle | Description | Application dans ce modèle |
|-------|-------------|----------------------------|
| R1 | Chaque entité devient une collection. | `utilisateurs`, `qrcodes`, `scans`, `modeles`, `campagnes_emails`, `statistiques_qrcodes`, `cles_api`. |
| R2 | L'identifiant entité devient la clé primaire `_id`. | Chaque collection possède un `_id` de type `ObjectId`. |
| R3 | Les attributs simples deviennent des champs. | Champs primitifs conservés. |
| R4 | Association 1,n côté 1 : ajouter une clé étrangère côté n. | `qrcodes.idUtilisateur`, `cles_api.idUtilisateur`, `campagnes_emails.idUtilisateur`. |
| R5 | Association n,n : créer une collection d'association. | `campagnes_utilisateurs` (campagnes ↔ utilisateurs). |
| R6 | Association 1,1 / 0,1 : clé étrangère côté optionnel ou dupliquée selon le sens de lecture. | Non utilisée ici (toutes les relations sont 1,n ou n,n). |
| R7 | Attributs portés migrent avec la FK ou dans la table d'association. | `dateEnvoiUtilisateur`, `estOuvert`, `estClique` dans `campagnes_utilisateurs`. |

---

## Collections et schémas logiques

### 1. Collection `utilisateurs`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `email` | String | Unique, requis, index | Email de connexion |
| `motDePasse` | String | Requis | Hash bcrypt |
| `nom` | String | Requis | Nom d'affichage |
| `estVerifie` | Boolean | Requis, défaut false | Email confirmé |
| `consentementMarketing` | Boolean | Requis, défaut false | Accepte les emails marketing |
| `dateConsentementMarketing` | Date | Optionnel | Date du consentement RGPD |
| `dateInscription` | Date | Requis | Date de création |
| `dateDerniereConnexion` | Date | Optionnel | Dernière connexion |
| `preferences` | Object | Optionnel | Langue, thème, notifications |
| `estActif` | Boolean | Requis, défaut true | Compte actif |
| `role` | String | Requis, enum `utilisateur`, `admin` | Rôle |

**Index :**
```json
{ "email": 1 }
```

---

### 2. Collection `qrcodes`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Propriétaire |
| `contenu` | String | Requis | Données encodées ou URL finale |
| `typeContenu` | String | Requis, enum | Type de QR |
| `estDynamique` | Boolean | Requis, défaut false | QR dynamique ou statique |
| `aliasCourt` | String | Unique sparse, index | Slug de redirection (QR dynamique uniquement) |
| `parametres` | Object | Requis | Taille, couleurs, correction, logo |
| `estActif` | Boolean | Requis, défaut true | QR actif |
| `dateCreation` | Date | Requis | Date de génération |
| `dateExpiration` | Date | Optionnel | Date de péremption |
| `nombreScansTotal` | Number | Défaut 0 | Compteur agrégé |
| `urlImage` | String | Optionnel | Chemin de l'image générée (R2 / S3 compatible) |
| `idModele` | ObjectId | FK → `modeles._id`, optionnel | Modèle source |

**Index :**
```json
{ "idUtilisateur": 1, "dateCreation": -1 }
{ "aliasCourt": 1 }
{ "estDynamique": 1, "aliasCourt": 1 }
```

---

### 3. Collection `scans`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idQRCode` | ObjectId | FK → `qrcodes._id`, index | QR scanné |
| `adresseIP` | String | Requis, index | IP anonymisée (ex: `192.168.x.x`) |
| `userAgent` | String | Optionnel | Navigateur / appareil |
| `pays` | String | Optionnel | Pays déduit |
| `ville` | String | Optionnel | Ville déduite |
| `referer` | String | Optionnel | Site référant |
| `dateScan` | Date | Requis | Horodatage |
| `estUnique` | Boolean | Requis | Premier scan du jour pour cette IP |

**Index :**
```json
{ "idQRCode": 1, "dateScan": -1 }
{ "idQRCode": 1, "estUnique": 1, "dateScan": -1 }
{ "dateScan": 1 }
```

---

### 4. Collection `modeles`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, optionnel | Créateur (null si modèle système) |
| `nom` | String | Requis | Nom du modèle |
| `description` | String | Optionnel | Description |
| `typeContenu` | String | Requis, enum | Type de QR supporté |
| `parametresParDefaut` | Object | Requis | Configuration graphique |
| `estPublic` | Boolean | Requis, défaut false | Visible publiquement |
| `dateCreation` | Date | Requis | Date de création |

**Index :**
```json
{ "estPublic": 1, "typeContenu": 1 }
```

---

### 5. Collection `campagnes_emails`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Créateur de la campagne |
| `titre` | String | Requis | Sujet de l'email |
| `contenu` | String | Requis | Corps HTML/texte |
| `cible` | String | Requis, enum `tous`, `actifs`, `inactifs`, `non_verifies` | Audience |
| `statut` | String | Requis, enum `brouillon`, `programmee`, `envoyee`, `annulee` | Statut |
| `dateEnvoi` | Date | Optionnel | Date programmée ou réelle |
| `nombreOuvertures` | Number | Défaut 0 | Total ouvertures |
| `nombreClics` | Number | Défaut 0 | Total clics |

**Index :**
```json
{ "idUtilisateur": 1, "dateEnvoi": -1 }
{ "statut": 1, "dateEnvoi": 1 }
```

---

### 6. Collection `campagnes_utilisateurs`

Collection d'association entre `campagnes_emails` et `utilisateurs`.

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idCampagne` | ObjectId | FK → `campagnes_emails._id`, index | Campagne |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Destinataire |
| `dateEnvoiUtilisateur` | Date | Optionnel | Date d'envoi réel à cet utilisateur |
| `estOuvert` | Boolean | Défaut false | Email ouvert |
| `estClique` | Boolean | Défaut false | Lien cliqué |

**Index :**
```json
{ "idCampagne": 1, "idUtilisateur": 1 }
{ "idUtilisateur": 1, "dateEnvoiUtilisateur": -1 }
```

---

### 7. Collection `statistiques_qrcodes`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idQRCode` | ObjectId | FK → `qrcodes._id`, index | QR concerné |
| `date` | Date | Requis, index | Jour concerné |
| `nombreScans` | Number | Défaut 0 | Nombre de scans |
| `nombreScansUniques` | Number | Défaut 0 | Scans uniques |
| `paysTop` | Array of Objects | Optionnel | Top pays |
| `appareilsTop` | Array of Objects | Optionnel | Top appareils |

**Index :**
```json
{ "idQRCode": 1, "date": -1 }
{ "idQRCode": 1, "date": 1 }
```

---

### 8. Collection `cles_api`

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Propriétaire |
| `nom` | String | Requis | Libellé |
| `cle` | String | Requis, unique, index | Token de clé API |
| `permissions` | Array of String | Requis | Scopes (`qrcodes:read`, `qrcodes:create`, etc.) |
| `dateCreation` | Date | Requis | Date de création |
| `dateExpiration` | Date | Optionnel | Expiration |
| `derniereUtilisation` | Date | Optionnel | Dernière utilisation |

**Index :**
```json
{ "idUtilisateur": 1 }
{ "cle": 1 }
```

---

### 9. Collection `journaux_qrcodes`

Journal des modifications des QR codes dynamiques. Permet d'auditer les changements de cible.

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idQRCode` | ObjectId | FK → `qrcodes._id`, index | QR modifié |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Auteur de la modification |
| `action` | String | Requis, enum | Type d'action (`modification_cible`, `activation`, `desactivation`, `suppression`) |
| `ancienneValeur` | Object | Optionnel | Snapshot partiel avant modification |
| `nouvelleValeur` | Object | Optionnel | Snapshot partiel après modification |
| `date` | Date | Requis | Horodatage |

**Index :**
```json
{ "idQRCode": 1, "date": -1 }
{ "idUtilisateur": 1, "date": -1 }
```

---

### 10. Collection `tokens_email`

Tokens de vérification d'email et de réinitialisation de mot de passe.

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Utilisateur concerné |
| `tokenHash` | String | Requis, unique, index | Hash du token (le token brut n'est pas stocké) |
| `type` | String | Requis, enum `verification`, `reinitialisation` | Usage du token |
| `dateExpiration` | Date | Requis | Date d'expiration |
| `dateUtilisation` | Date | Optionnel | Date de consommation |
| `estUtilise` | Boolean | Défaut false | Token déjà consommé |

**Index :**
```json
{ "tokenHash": 1 }
{ "idUtilisateur": 1, "type": 1, "estUtilise": 1 }
{ "dateExpiration": 1 }
```

---

### 11. Collection `refresh_tokens`

Sessions de connexion des utilisateurs. Permet la révocation côté serveur.

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Propriétaire |
| `tokenHash` | String | Requis, unique, index | Hash du refresh token |
| `userAgent` | String | Optionnel | Navigateur/appareil |
| `adresseIP` | String | Optionnel | IP de création (anonymisée) |
| `dateCreation` | Date | Requis | Date d'émission |
| `dateExpiration` | Date | Requis | Date d'expiration |
| `dateRevocation` | Date | Optionnel | Date de révocation |
| `estRevoke` | Boolean | Défaut false | Token révoqué |

**Index :**
```json
{ "tokenHash": 1 }
{ "idUtilisateur": 1, "dateCreation": -1 }
{ "dateExpiration": 1 }
```

---

### 12. Collection `tracking_emails`

Tracking des ouvertures et clics des emails de campagne.

| Champ | Type MongoDB | Contrainte | Description |
|-------|--------------|------------|-------------|
| `_id` | ObjectId | PK | Identifiant unique |
| `idCampagne` | ObjectId | FK → `campagnes_emails._id`, index | Campagne concernée |
| `idUtilisateur` | ObjectId | FK → `utilisateurs._id`, index | Destinataire |
| `type` | String | Requis, enum `ouverture`, `clic` | Type d'événement |
| `tokenTracking` | String | Requis, index | Token présent dans le pixel/lien |
| `urlCible` | String | Optionnel | URL cliquée (si type = clic) |
| `userAgent` | String | Optionnel | Navigateur |
| `adresseIP` | String | Optionnel | IP anonymisée |
| `dateEvenement` | Date | Requis | Horodatage |

**Index :**
```json
{ "idCampagne": 1, "type": 1, "dateEvenement": -1 }
{ "idUtilisateur": 1, "dateEvenement": -1 }
{ "tokenTracking": 1 }
```

---

## Matrice des clés

| Collection | Clé primaire | Clés étrangères | Index secondaires |
|------------|--------------|-----------------|-------------------|
| `utilisateurs` | `_id` | — | `email` (unique) |
| `qrcodes` | `_id` | `idUtilisateur` → `utilisateurs`, `idModele` → `modeles` | `idUtilisateur + dateCreation`, `aliasCourt` (unique sparse) |
| `scans` | `_id` | `idQRCode` → `qrcodes` | `idQRCode + dateScan`, `idQRCode + estUnique + dateScan` |
| `modeles` | `_id` | `idUtilisateur` → `utilisateurs` (optionnel) | `estPublic + typeContenu` |
| `campagnes_emails` | `_id` | `idUtilisateur` → `utilisateurs` | `idUtilisateur + dateEnvoi`, `statut + dateEnvoi` |
| `campagnes_utilisateurs` | `_id` | `idCampagne`, `idUtilisateur` | composite unique `(idCampagne, idUtilisateur)` |
| `statistiques_qrcodes` | `_id` | `idQRCode` → `qrcodes` | `idQRCode + date` (unique) |
| `cles_api` | `_id` | `idUtilisateur` → `utilisateurs` | `cle` (unique) |
| `journaux_qrcodes` | `_id` | `idQRCode` → `qrcodes`, `idUtilisateur` → `utilisateurs` | `idQRCode + date`, `idUtilisateur + date` |
| `tokens_email` | `_id` | `idUtilisateur` → `utilisateurs` | `tokenHash` (unique), `idUtilisateur + type + estUtilise`, `dateExpiration` |
| `refresh_tokens` | `_id` | `idUtilisateur` → `utilisateurs` | `tokenHash` (unique), `idUtilisateur + dateCreation`, `dateExpiration` |
| `tracking_emails` | `_id` | `idCampagne` → `campagnes_emails`, `idUtilisateur` → `utilisateurs` | `idCampagne + type + dateEvenement`, `idUtilisateur + dateEvenement`, `tokenTracking` |

---

## Schéma relationnel équivalent (notation SQL-like)

```sql
utilisateurs(
    _id ObjectId PK,
    email VARCHAR UNIQUE NOT NULL,
    motDePasse VARCHAR NOT NULL,
    nom VARCHAR NOT NULL,
    estVerifie BOOLEAN DEFAULT FALSE,
    consentementMarketing BOOLEAN DEFAULT FALSE,
    dateConsentementMarketing TIMESTAMP,
    dateInscription TIMESTAMP DEFAULT NOW(),
    dateDerniereConnexion TIMESTAMP,
    preferences JSON,
    estActif BOOLEAN DEFAULT TRUE,
    role VARCHAR CHECK(role IN ('utilisateur','admin'))
)

qrcodes(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    contenu TEXT NOT NULL,
    typeContenu VARCHAR NOT NULL,
    estDynamique BOOLEAN DEFAULT FALSE,
    aliasCourt VARCHAR UNIQUE,
    parametres JSON NOT NULL,
    estActif BOOLEAN DEFAULT TRUE,
    dateCreation TIMESTAMP DEFAULT NOW(),
    dateExpiration TIMESTAMP,
    nombreScansTotal INT DEFAULT 0,
    urlImage VARCHAR,
    idModele ObjectId FK REFERENCES modeles
)

scans(
    _id ObjectId PK,
    idQRCode ObjectId FK REFERENCES qrcodes,
    adresseIP VARCHAR NOT NULL,
    userAgent VARCHAR,
    pays VARCHAR,
    ville VARCHAR,
    referer VARCHAR,
    dateScan TIMESTAMP DEFAULT NOW(),
    estUnique BOOLEAN NOT NULL
)

modeles(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    nom VARCHAR NOT NULL,
    description VARCHAR,
    typeContenu VARCHAR NOT NULL,
    parametresParDefaut JSON NOT NULL,
    estPublic BOOLEAN DEFAULT FALSE,
    dateCreation TIMESTAMP DEFAULT NOW()
)

campagnes_emails(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    titre VARCHAR NOT NULL,
    contenu TEXT NOT NULL,
    cible VARCHAR NOT NULL,
    statut VARCHAR NOT NULL,
    dateEnvoi TIMESTAMP,
    nombreOuvertures INT DEFAULT 0,
    nombreClics INT DEFAULT 0
)

campagnes_utilisateurs(
    _id ObjectId PK,
    idCampagne ObjectId FK REFERENCES campagnes_emails,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    dateEnvoiUtilisateur TIMESTAMP,
    estOuvert BOOLEAN DEFAULT FALSE,
    estClique BOOLEAN DEFAULT FALSE,
    UNIQUE(idCampagne, idUtilisateur)
)

statistiques_qrcodes(
    _id ObjectId PK,
    idQRCode ObjectId FK REFERENCES qrcodes,
    date DATE NOT NULL,
    nombreScans INT DEFAULT 0,
    nombreScansUniques INT DEFAULT 0,
    paysTop JSON,
    appareilsTop JSON,
    UNIQUE(idQRCode, date)
)

cles_api(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    nom VARCHAR NOT NULL,
    cle VARCHAR UNIQUE NOT NULL,
    permissions JSON NOT NULL,
    dateCreation TIMESTAMP DEFAULT NOW(),
    dateExpiration TIMESTAMP,
    derniereUtilisation TIMESTAMP
)

journaux_qrcodes(
    _id ObjectId PK,
    idQRCode ObjectId FK REFERENCES qrcodes,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    action VARCHAR NOT NULL,
    ancienneValeur JSON,
    nouvelleValeur JSON,
    date TIMESTAMP DEFAULT NOW()
)

tokens_email(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    tokenHash VARCHAR UNIQUE NOT NULL,
    type VARCHAR NOT NULL,
    dateExpiration TIMESTAMP NOT NULL,
    dateUtilisation TIMESTAMP,
    estUtilise BOOLEAN DEFAULT FALSE
)

refresh_tokens(
    _id ObjectId PK,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    tokenHash VARCHAR UNIQUE NOT NULL,
    userAgent VARCHAR,
    adresseIP VARCHAR,
    dateCreation TIMESTAMP DEFAULT NOW(),
    dateExpiration TIMESTAMP NOT NULL,
    dateRevocation TIMESTAMP,
    estRevoke BOOLEAN DEFAULT FALSE
)

tracking_emails(
    _id ObjectId PK,
    idCampagne ObjectId FK REFERENCES campagnes_emails,
    idUtilisateur ObjectId FK REFERENCES utilisateurs,
    type VARCHAR NOT NULL,
    tokenTracking VARCHAR NOT NULL,
    urlCible VARCHAR,
    userAgent VARCHAR,
    adresseIP VARCHAR,
    dateEvenement TIMESTAMP DEFAULT NOW()
)
```

---

## Choix d'embarquement vs référencement

| Relation | Choix | Justification |
|----------|-------|---------------|
| `qrcodes.idUtilisateur` | Référence | Un utilisateur a potentiellement beaucoup de QR codes. |
| `qrcodes.idModele` | Référence | Les modèles sont réutilisables par plusieurs QR. |
| `qrcodes.parametres` | Embarqué | Données graphiques toujours lues avec le QR. |
| `scans.idQRCode` | Référence | Très volumineux ; jamais modifiés. |
| `statistiques_qrcodes.idQRCode` | Référence | Agrégats journaliers indépendants. |
| `campagnes_utilisateurs` | Collection d'association | Relation n,n avec attributs propres. |
| `cles_api.idUtilisateur` | Référence | Clés multiples par utilisateur. |
| `modeles.idUtilisateur` | Référence | Modèles système sans créateur. |
| `journaux_qrcodes.idQRCode` / `idUtilisateur` | Référence | Journal volumineux, jamais modifié après insertion. |
| `tokens_email.idUtilisateur` | Référence | Tokens uniques, consultés par hash. |
| `refresh_tokens.idUtilisateur` | Référence | Plusieurs sessions par utilisateur, révocation fréquente. |
| `tracking_emails.idCampagne` / `idUtilisateur` | Référence | Événements immuables, très volumineux. |

---

## Vérification de la BCNF

Toutes les collections respectent la BCNF :

- Aucun attribut non-clé ne dépend d'une partie de la clé.
- Aucun attribut non-clé ne dépend d'un autre attribut non-clé.
- Les attributs dérivés (`nombreScansTotal`) sont maintenus cohérents par le processus d'agrégation, pas par contrainte relationnelle.

---

## Contraintes d'intégrité fonctionnelle conservées

| Code MCD | Traduction MLD |
|----------|----------------|
| CIF01 | Vérifiée en application (`estActif = true` implique `estVerifie = true`). |
| CIF02 | Index unique sparse sur `aliasCourt` + vérification application si `estDynamique = true`. |
| CIF03 | Vérifiée à la création et à la mise à jour. |
| CIF04 | Clé étrangère `idQRCode` avec suppression en cascade optionnelle. |
| CIF05 | Vérifiée au moment du passage au statut `envoyee`. |
| CIF06 | Filtre systématique `consentementMarketing = true` lors de la génération de la liste d'envoi. |
