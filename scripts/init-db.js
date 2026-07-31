import { MongoClient } from 'mongodb';

/**
 * Fichier : scripts/init-db.js
 * Crée les collections et index MongoDB Atlas pour le SaaS Free QR Code.
 * Usage : MONGODB_URI=<uri> [MONGODB_DB_NAME=...] node scripts/init-db.js
 */

/**
 * @param {string} uri
 * @param {string} dbName
 */
export async function initDb(uri, dbName) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Collection utilisateurs
  await db.createCollection('utilisateurs', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'email',
          'motDePasse',
          'nom',
          'estVerifie',
          'consentementMarketing',
          'dateInscription',
          'estActif',
          'role',
        ],
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
          role: { enum: ['utilisateur', 'admin'] },
        },
      },
    },
  });
  await db.collection('utilisateurs').createIndex({ email: 1 }, { unique: true });

  // Collection qrcodes
  await db.createCollection('qrcodes', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'idUtilisateur',
          'contenu',
          'typeContenu',
          'estDynamique',
          'parametres',
          'estActif',
          'dateCreation',
          'nombreScansTotal',
        ],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          contenu: { bsonType: 'string' },
          typeContenu: {
            enum: ['url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf'],
          },
          estDynamique: { bsonType: 'bool' },
          aliasCourt: { bsonType: 'string' },
          parametres: { bsonType: 'object' },
          estActif: { bsonType: 'bool' },
          dateCreation: { bsonType: 'date' },
          dateExpiration: { bsonType: 'date' },
          nombreScansTotal: { bsonType: 'int', minimum: 0 },
          urlImage: { bsonType: 'string' },
          idModele: { bsonType: 'objectId' },
        },
      },
    },
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
          estUnique: { bsonType: 'bool' },
        },
      },
    },
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
          typeContenu: {
            enum: ['url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf'],
          },
          parametresParDefaut: { bsonType: 'object' },
          estPublic: { bsonType: 'bool' },
          dateCreation: { bsonType: 'date' },
        },
      },
    },
  });
  await db.collection('modeles').createIndex({ estPublic: 1, typeContenu: 1 });

  // Collection campagnes_emails
  await db.createCollection('campagnes_emails', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'idUtilisateur',
          'titre',
          'contenu',
          'cible',
          'statut',
          'nombreOuvertures',
          'nombreClics',
        ],
        properties: {
          idUtilisateur: { bsonType: 'objectId' },
          titre: { bsonType: 'string' },
          contenu: { bsonType: 'string' },
          cible: { enum: ['tous', 'actifs', 'inactifs', 'non_verifies'] },
          statut: { enum: ['brouillon', 'programmee', 'envoyee', 'annulee'] },
          dateEnvoi: { bsonType: 'date' },
          nombreOuvertures: { bsonType: 'int', minimum: 0 },
          nombreClics: { bsonType: 'int', minimum: 0 },
        },
      },
    },
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
          estClique: { bsonType: 'bool' },
        },
      },
    },
  });
  await db
    .collection('campagnes_utilisateurs')
    .createIndex({ idCampagne: 1, idUtilisateur: 1 }, { unique: true });
  await db
    .collection('campagnes_utilisateurs')
    .createIndex({ idUtilisateur: 1, dateEnvoiUtilisateur: -1 });

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
          appareilsTop: { bsonType: 'array' },
        },
      },
    },
  });
  await db
    .collection('statistiques_qrcodes')
    .createIndex({ idQRCode: 1, date: -1 }, { unique: true });

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
          derniereUtilisation: { bsonType: 'date' },
        },
      },
    },
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
          date: { bsonType: 'date' },
        },
      },
    },
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
          estUtilise: { bsonType: 'bool' },
        },
      },
    },
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
          estRevoke: { bsonType: 'bool' },
        },
      },
    },
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
          dateEvenement: { bsonType: 'date' },
        },
      },
    },
  });
  await db.collection('tracking_emails').createIndex({ idCampagne: 1, type: 1, dateEvenement: -1 });
  await db.collection('tracking_emails').createIndex({ idUtilisateur: 1, dateEvenement: -1 });
  await db.collection('tracking_emails').createIndex({ tokenTracking: 1 });

  await client.close();
}

// Exécution directe
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'qrcode_saas';
  if (!uri) {
    console.error('MONGODB_URI manquant');
    process.exit(1);
  }
  initDb(uri, dbName)
    .then(() => console.log('Base initialisée'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
