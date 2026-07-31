# MPD — Modèle Physique de Données

## Contexte

Le MPD fournit les schémas physiques et scripts exécutables pour MongoDB, en cohérence avec le MLD. Cloudflare Workers (via `wrangler`) accèdera à MongoDB Atlas via le driver MongoDB compatible edge (`mongodb` v6+ ou `mongoose` si bundlé).

---

## Choix techniques physiques

| Choix | Justification |
|-------|---------------|
| SGBD | MongoDB Atlas (gratuit M0) |
| Driver | `mongodb` natif (plus léger pour Workers) |
| ID | `ObjectId` généré par MongoDB |
| Stockage fichiers | Cloudflare R2 (compatible S3, coût faible) |
| Backup | Snapshots automatiques Atlas + export JSON périodique |
| TTL | Index TTL sur `scans` pour archivage automatique après 365 jours |

---

## Script de création des collections et index (MongoDB shell / Node.js)

```javascript
// Fichier : scripts/init-db.js
const { MongoClient } = require('mongodb');

async function initDb(uri, dbName) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Collection utilisateurs
  await db.createCollection('utilisateurs', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'motDePasse', 'nom', 'estVerifie', 'consentementMarketing', 'dateInscription', 'estActif', 'role'],
        properties: {
          email: { bsonType: 'string', pattern: '^\\S+@\\S+\\.\\S+$' },
          motDePasse: { bsonType: 'string' },
          nom: { bsonType: 'string', minLength: 1 },
          estVerifie: { bsonType: 'bool' },
          consentementMarketing: { bsonType: 'bool' },
          dateConsentementMarketing: { bsonType: 'date' },
          dateInscription: { bsonType: 'date' },
          dateDerniereConnexion: { bsonType: 'date' },
          preferences: { bsonType: 'object' },
          estActif: { bsonType: 'bool' },
          role: { enum: ['utilisateur', 'admin'] }
        }
      }
    }
  });
  await db.collection('utilisateurs').createIndex({ email: 1 }, { unique: true });

  // Collection qrcodes
  await db.createCollection('qrcodes', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idUtilisateur', 'contenu', 'typeContenu', 'estDynamique', 'parametres', 'estActif', 'dateCreation', 'nombreScansTotal'],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          contenu: { bsonType: 'string' },
          typeContenu: { enum: ['url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf'] },
          estDynamique: { bsonType: 'bool' },
          aliasCourt: { bsonType: 'string' },
          parametres: { bsonType: 'object' },
          estActif: { bsonType: 'bool' },
          dateCreation: { bsonType: 'date' },
          dateExpiration: { bsonType: 'date' },
          nombreScansTotal: { bsonType: 'int', minimum: 0 },
          urlImage: { bsonType: 'string' },
          idModele: { bsonType: 'objectId' }
        }
      }
    }
  });
  await db.collection('qrcodes').createIndex({ idUtilisateur: 1, dateCreation: -1 });
  await db.collection('qrcodes').createIndex({ aliasCourt: 1 }, { unique: true, sparse: true });
  await db.collection('qrcodes').createIndex({ estDynamique: 1, aliasCourt: 1 });

  // Collection scans
  await db.createCollection('scans', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idQRCode', 'adresseIP', 'dateScan', 'estUnique'],
        properties: {
          idQRCode: { bsonType: 'objectId' },
          adresseIP: { bsonType: 'string' },
          userAgent: { bsonType: 'string' },
          pays: { bsonType: 'string' },
          ville: { bsonType: 'string' },
          referer: { bsonType: 'string' },
          dateScan: { bsonType: 'date' },
          estUnique: { bsonType: 'bool' }
        }
      }
    }
  });
  await db.collection('scans').createIndex({ idQRCode: 1, dateScan: -1 });
  await db.collection('scans').createIndex({ idQRCode: 1, estUnique: 1, dateScan: -1 });
  await db.collection('scans').createIndex({ dateScan: 1 }, { expireAfterSeconds: 31536000 });

  // Collection modeles
  await db.createCollection('modeles', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['nom', 'typeContenu', 'parametresParDefaut', 'estPublic', 'dateCreation'],
        properties: {
          idUtilisateur: { bsonType: ['objectId', 'null'] },
          nom: { bsonType: 'string' },
          description: { bsonType: 'string' },
          typeContenu: { enum: ['url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf'] },
          parametresParDefaut: { bsonType: 'object' },
          estPublic: { bsonType: 'bool' },
          dateCreation: { bsonType: 'date' }
        }
      }
    }
  });
  await db.collection('modeles').createIndex({ estPublic: 1, typeContenu: 1 });

  // Collection campagnes_emails
  await db.createCollection('campagnes_emails', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idUtilisateur', 'titre', 'contenu', 'cible', 'statut', 'nombreOuvertures', 'nombreClics'],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          titre: { bsonType: 'string' },
          contenu: { bsonType: 'string' },
          cible: { enum: ['tous', 'actifs', 'inactifs', 'non_verifies'] },
          statut: { enum: ['brouillon', 'programmee', 'envoyee', 'annulee'] },
          dateEnvoi: { bsonType: 'date' },
          nombreOuvertures: { bsonType: 'int', minimum: 0 },
          nombreClics: { bsonType: 'int', minimum: 0 }
        }
      }
    }
  });
  await db.collection('campagnes_emails').createIndex({ idUtilisateur: 1, dateEnvoi: -1 });
  await db.collection('campagnes_emails').createIndex({ statut: 1, dateEnvoi: 1 });

  // Collection campagnes_utilisateurs
  await db.createCollection('campagnes_utilisateurs', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idCampagne', 'idUtilisateur'],
        properties: {
          idCampagne: { bsonType: 'objectId' },
          idUtilisateur: { bsonType: 'objectId' },
          dateEnvoiUtilisateur: { bsonType: 'date' },
          estOuvert: { bsonType: 'bool' },
          estClique: { bsonType: 'bool' }
        }
      }
    }
  });
  await db.collection('campagnes_utilisateurs').createIndex({ idCampagne: 1, idUtilisateur: 1 }, { unique: true });
  await db.collection('campagnes_utilisateurs').createIndex({ idUtilisateur: 1, dateEnvoiUtilisateur: -1 });

  // Collection statistiques_qrcodes
  await db.createCollection('statistiques_qrcodes', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idQRCode', 'date', 'nombreScans', 'nombreScansUniques'],
        properties: {
          idQRCode: { bsonType: 'objectId' },
          date: { bsonType: 'date' },
          nombreScans: { bsonType: 'int', minimum: 0 },
          nombreScansUniques: { bsonType: 'int', minimum: 0 },
          paysTop: { bsonType: 'array' },
          appareilsTop: { bsonType: 'array' }
        }
      }
    }
  });
  await db.collection('statistiques_qrcodes').createIndex({ idQRCode: 1, date: -1 }, { unique: true });

  // Collection cles_api
  await db.createCollection('cles_api', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idUtilisateur', 'nom', 'cle', 'permissions', 'dateCreation'],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          nom: { bsonType: 'string' },
          cle: { bsonType: 'string' },
          permissions: { bsonType: 'array' },
          dateCreation: { bsonType: 'date' },
          dateExpiration: { bsonType: 'date' },
          derniereUtilisation: { bsonType: 'date' }
        }
      }
    }
  });
  await db.collection('cles_api').createIndex({ idUtilisateur: 1 });
  await db.collection('cles_api').createIndex({ cle: 1 }, { unique: true });

  // Collection journaux_qrcodes
  await db.createCollection('journaux_qrcodes', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idQRCode', 'idUtilisateur', 'action', 'date'],
        properties: {
          idQRCode: { bsonType: 'objectId' },
          idUtilisateur: { bsonType: 'objectId' },
          action: { enum: ['modification_cible', 'activation', 'desactivation', 'suppression'] },
          ancienneValeur: { bsonType: 'object' },
          nouvelleValeur: { bsonType: 'object' },
          date: { bsonType: 'date' }
        }
      }
    }
  });
  await db.collection('journaux_qrcodes').createIndex({ idQRCode: 1, date: -1 });
  await db.collection('journaux_qrcodes').createIndex({ idUtilisateur: 1, date: -1 });

  // Collection tokens_email
  await db.createCollection('tokens_email', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idUtilisateur', 'tokenHash', 'type', 'dateExpiration', 'estUtilise'],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          tokenHash: { bsonType: 'string' },
          type: { enum: ['verification', 'reinitialisation'] },
          dateExpiration: { bsonType: 'date' },
          dateUtilisation: { bsonType: 'date' },
          estUtilise: { bsonType: 'bool' }
        }
      }
    }
  });
  await db.collection('tokens_email').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('tokens_email').createIndex({ idUtilisateur: 1, type: 1, estUtilise: 1 });
  await db.collection('tokens_email').createIndex({ dateExpiration: 1 }, { expireAfterSeconds: 0 });

  // Collection refresh_tokens
  await db.createCollection('refresh_tokens', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idUtilisateur', 'tokenHash', 'dateCreation', 'dateExpiration', 'estRevoke'],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          tokenHash: { bsonType: 'string' },
          userAgent: { bsonType: 'string' },
          adresseIP: { bsonType: 'string' },
          dateCreation: { bsonType: 'date' },
          dateExpiration: { bsonType: 'date' },
          dateRevocation: { bsonType: 'date' },
          estRevoke: { bsonType: 'bool' }
        }
      }
    }
  });
  await db.collection('refresh_tokens').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('refresh_tokens').createIndex({ idUtilisateur: 1, dateCreation: -1 });
  await db.collection('refresh_tokens').createIndex({ dateExpiration: 1 }, { expireAfterSeconds: 0 });

  // Collection tracking_emails
  await db.createCollection('tracking_emails', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['idCampagne', 'idUtilisateur', 'type', 'tokenTracking', 'dateEvenement'],
        properties: {
          idCampagne: { bsonType: 'objectId' },
          idUtilisateur: { bsonType: 'objectId' },
          type: { enum: ['ouverture', 'clic'] },
          tokenTracking: { bsonType: 'string' },
          urlCible: { bsonType: 'string' },
          userAgent: { bsonType: 'string' },
          adresseIP: { bsonType: 'string' },
          dateEvenement: { bsonType: 'date' }
        }
      }
    }
  });
  await db.collection('tracking_emails').createIndex({ idCampagne: 1, type: 1, dateEvenement: -1 });
  await db.collection('tracking_emails').createIndex({ idUtilisateur: 1, dateEvenement: -1 });
  await db.collection('tracking_emails').createIndex({ tokenTracking: 1 });

  await client.close();
}

module.exports = { initDb };

// Exécution directe
if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'qrcode_saas';
  if (!uri) throw new Error('MONGODB_URI manquant');
  initDb(uri, dbName).then(() => console.log('Base initialisée')).catch(console.error);
}
```

---

## Données de test (seed)

```javascript
// Fichier : scripts/seed-db.js
const { MongoClient, ObjectId } = require('mongodb');

async function seedDb(uri, dbName) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const idUtilisateur = new ObjectId();

  await db.collection('utilisateurs').insertOne({
    _id: idUtilisateur,
    email: 'demo@example.com',
    motDePasse: '$2b$10$...hash...',
    nom: 'Utilisateur Demo',
    estVerifie: true,
    consentementMarketing: true,
    dateConsentementMarketing: new Date(),
    dateInscription: new Date(),
    dateDerniereConnexion: new Date(),
    preferences: { langue: 'fr', theme: 'clair' },
    estActif: true,
    role: 'utilisateur'
  });

  await db.collection('qrcodes').insertOne({
    idUtilisateur,
    contenu: 'https://demo.example.com',
    typeContenu: 'url',
    estDynamique: false,
    parametres: { taille: 300, couleur: '#000000', correction: 'M' },
    estActif: true,
    dateCreation: new Date(),
    nombreScansTotal: 0,
    urlImage: 'https://r2.example.com/qr-demo.png'
  });

  await client.close();
}

module.exports = { seedDb };
```

---

## Schéma d'accès aux données pour Cloudflare Workers

Exemple de helper minimal utilisé dans un Worker :

```typescript
// backend/src/lib/db.ts
import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI!;
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  cachedDb = cachedClient.db(process.env.MONGODB_DB_NAME);
  return cachedDb;
}

export const collections = {
  utilisateurs: () => getDb().then(db => db.collection('utilisateurs')),
  qrcodes: () => getDb().then(db => db.collection('qrcodes')),
  scans: () => getDb().then(db => db.collection('scans')),
  modeles: () => getDb().then(db => db.collection('modeles')),
  campagnesEmails: () => getDb().then(db => db.collection('campagnes_emails')),
  campagnesUtilisateurs: () => getDb().then(db => db.collection('campagnes_utilisateurs')),
  statistiquesQrCodes: () => getDb().then(db => db.collection('statistiques_qrcodes')),
  clesApi: () => getDb().then(db => db.collection('cles_api')),
  journauxQrcodes: () => getDb().then(db => db.collection('journaux_qrcodes')),
  tokensEmail: () => getDb().then(db => db.collection('tokens_email')),
  refreshTokens: () => getDb().then(db => db.collection('refresh_tokens')),
  trackingEmails: () => getDb().then(db => db.collection('tracking_emails'))
};
```

---

## Stockage des images QR

Les images PNG/SVG sont générées côté backend puis stockées dans **Cloudflare R2** :

| Champ | Exemple |
|-------|---------|
| Bucket | `qr-saas-images` |
| Chemin | `users/{idUtilisateur}/qrcodes/{idQRCode}.{png\|svg}` |
| URL publique | `https://qr-saas-images.r2.cloudflarestorage.com/users/.../qr-xxx.png` |
| Cache | Headers `Cache-Control: public, max-age=31536000` |

Le champ `urlImage` dans `qrcodes` stocke l'URL publique ou signée.

---

## Notes de performance

- Les requêtes paginées utilisent des index couvrants (`idUtilisateur + dateCreation` pour la liste des QR).
- `scans` possède un index TTL de 365 jours pour éviter une croissance infinie.
- `statistiques_qrcodes` est mise à jour par un upsert quotidien pour limiter les écritures.
- Les QR dynamiques sont résolus par `aliasCourt` via un index unique sparse.

---

## Contraintes côté application

MongoDB ne garantit pas nativement certaines règles métier. Elles sont implémentées dans le backend :

| Contrainte | Implémentation |
|------------|----------------|
| Email unique | Index unique + gestion d'erreur `DuplicateKey` |
| `aliasCourt` unique | Index unique sparse + vérification avant insertion |
| `estActif` implique `estVerifie` | Vérification dans le service d'authentification |
| `dateExpiration > dateCreation` | Validation schema Zod/Joi avant écriture |
| Envoi campagne uniquement aux consentants | Filtre `consentementMarketing: true` |
| Expiration clé API | Vérification `dateExpiration` à chaque utilisation |
