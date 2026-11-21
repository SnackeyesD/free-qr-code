# Fiches QR — documents structurés et portables

**Date :** 2026-11-12
**Statut :** ✅ implémenté P0–P2 (hébergé) — 2026-11-13, non encore déployé
**Périmètre :** nouveau type de contenu « Fiche » (document à champs libres), rendu par le frontend.

---

## 1. Résumé exécutif

L'utilisateur compose lui-même un **modèle** (liste de champs : nom, type, obligatoire,
options), puis remplit une **fiche** (les valeurs). La fiche est ensuite associée à un QR code.

Le rendu est assuré **exclusivement par le frontend** : l'API ne fabrique jamais de HTML,
elle stocke et sert du JSON. Un même composant React sert l'aperçu du builder et la page
publique, ce qui garantit un rendu identique.

Deux transports sont prévus, dans cet ordre :

1. **Fiche hébergée** (priorité) : le QR pointe vers `/q/:alias`, qui redirige vers
   `FRONTEND_URL/d/<publicId>`. La fiche est modifiable, courte et les scans sont comptés.
2. **Fiche embarquée** (export « portable », phase ultérieure) : le document compressé est
   placé dans le fragment de l'URL (`/d#z=…`). Le QR est autosuffisant, mais il n'est plus
   modifiable et ne produit **aucune statistique**.

Le point structurant : **on ne touche ni à l'enum `type_contenu` ni au runtime `/q/:alias`**.
Une fiche est portée par un QR `url` dont le `contenu` est l'URL de la page de rendu.
Le runtime actuel (redirection 302 vers une URL `http(s)` valide) fait déjà exactement le
travail nécessaire. Le risque pour les QR déjà imprimés est donc nul.

---

## 2. Décisions verrouillées (proposées)

| Sujet | Décision |
|---|---|
| Nom de la fonctionnalité | **Fiches** (documents structurés). On évite « modèles », déjà utilisé pour les presets de design |
| Ordre de livraison | Hébergé d'abord (P0–P2), embarqué ensuite (P3) |
| Type de QR | `type_contenu = 'url'`, `contenu = FRONTEND_URL/d/<publicId>` |
| Runtime `/q/:alias` | **Inchangé** (aucune modification de `redirect.ts`) |
| Enum `type_contenu` | **Inchangé** (pas de reconstruction de la table `qrcodes`) |
| Source de vérité | Modèle réutilisable + snapshot du schéma dans chaque fiche |
| Médias (logo, image) | Hors périmètre v1 ; phase P4 |
| Tarification | Gratuit au lancement ; caps anti-abus uniquement (couture Pro plus tard) |
| Statistiques | Scans comptés par `/q/:alias` ; mode embarqué = aucune statistique, affiché clairement |
| Rendu | Frontend uniquement ; l'API sert du JSON, jamais du HTML |
| HTML / Markdown utilisateur | Interdit en v1 (rendu texte strict) |
| Appels tiers | Aucun (pas de police, carte, analytics ou image externe) |

---

## 3. Concepts

Trois objets distincts, à ne pas confondre :

| Objet | Rôle | Exemple |
|---|---|---|
| **Modèle de fiche** (`fiches_modeles`) | Schéma réutilisable, éditable, versionné | « Fiche contact », « Fiche produit » |
| **Fiche** (`fiches`) | Instance remplie d'un schéma (snapshot) | La fiche de Gloire, avec ses valeurs |
| **QR** (`qrcodes`) | Transport : alias dynamique ou URL embarquée | Le QR imprimé sur un badge |

Une fiche peut exister sans modèle (schéma inline). Un modèle peut servir à plusieurs fiches.
Une fiche peut être liée à plusieurs QR (différents designs), mais un QR ne porte qu'une fiche.

### Cycle de vie

```
Modèle ──(crée)──► Fiche ──(associe)──► QR
   │                  │                  │
   │ version++        │ snapshot figé    │ contenu = URL de rendu
   └─ n'altère pas ───┘                  └─ stable après impression
      les fiches existantes
```

Modifier un modèle **n'altère pas** les fiches déjà créées : chacune conserve son
`schema_snapshot`. Une action explicite « Appliquer le nouveau schéma » pourra être ajoutée
plus tard, avec aperçu des champs ajoutés/supprimés.

---

## 4. Les deux modes de transport

| | **Hébergée** (P0–P2) | **Embarquée** (P3) |
|---|---|---|
| Contenu du QR | `…/q/<alias>` → `…/d/<publicId>` | `…/d#z=<json compressé>` |
| Taille | limitée par la validation (16 Ko) | URL ≤ 1 200 caractères |
| Modifiable après impression | ✅ | ❌ (réimpression nécessaire) |
| Statistiques | ✅ via `/q/:alias` | ❌ (assumé et affiché) |
| Médias | ✅ (P4, stockés chez nous) | ❌ |
| Dépendance serveur | ✅ (D1 + API) | ❌ après le scan |
| Export / import JSON | ✅ | ✅ (le payload est le document) |

**Recommandation :** l'hébergé est le mode par défaut. L'embarqué est un bouton
« Exporter en QR portable », avec jauge de taille, aperçu et avertissement explicite
« aucune statistique pour ce mode ».

---

## 5. Modèle de données

Migration additive `apps/api/migrations/006_fiches.sql`.

```sql
-- Modèles réutilisables
CREATE TABLE IF NOT EXISTS fiches_modeles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id         TEXT UNIQUE NOT NULL,
    id_utilisateur    INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom                TEXT NOT NULL CHECK (length(nom) > 0),
    description        TEXT,
    schema_json        TEXT NOT NULL DEFAULT '{"version":1,"champs":[]}',
    version            INTEGER NOT NULL DEFAULT 1,
    est_public         INTEGER NOT NULL DEFAULT 0 CHECK (est_public IN (0, 1)),
    date_creation      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiches_modeles_utilisateur
    ON fiches_modeles(id_utilisateur, date_creation);

-- Fiches (instances)
CREATE TABLE IF NOT EXISTS fiches (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id         TEXT UNIQUE NOT NULL,
    id_utilisateur    INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    id_modele         INTEGER REFERENCES fiches_modeles(id) ON DELETE SET NULL,
    titre             TEXT NOT NULL CHECK (length(titre) > 0),
    schema_snapshot   TEXT NOT NULL,
    valeurs_json      TEXT NOT NULL DEFAULT '{}',
    version           INTEGER NOT NULL DEFAULT 1,
    est_active        INTEGER NOT NULL DEFAULT 1 CHECK (est_active IN (0, 1)),
    date_creation     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiches_utilisateur
    ON fiches(id_utilisateur, date_creation);
CREATE INDEX IF NOT EXISTS idx_fiches_publiques
    ON fiches(public_id) WHERE est_active = 1;

-- Lien QR → fiche (additif, nullable, sans reconstruction de table)
ALTER TABLE qrcodes ADD COLUMN id_fiche INTEGER REFERENCES fiches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_qrcodes_fiche
    ON qrcodes(id_fiche) WHERE id_fiche IS NOT NULL;
```

Notes :

- `public_id` est un UUID : l'URL publique est non devinable, comme les alias de QR.
- `schema_snapshot` est **toujours** renseigné (modèle ou schéma inline).
- `est_active = 0` = fiche archivée ; la page publique renvoie `410`.
- La suppression d'une fiche liée à un QR est refusée (`409`) : elle casserait un QR imprimé.
  L'archivage est l'alternative douce.
- Aucune donnée personnelle n'est ajoutée dans les tables de statistiques.

---

## 6. Types partagés

Nouveau fichier `packages/shared-types/src/fiche.ts`, exporté depuis `index.ts`.

```ts
export type TypeChampFiche =
  | 'texte'       // une ligne
  | 'texte_long'  // plusieurs lignes, \\n conservés
  | 'email'
  | 'telephone'
  | 'url'         // http(s) uniquement au rendu
  | 'date'        // ISO 8601 (AAAA-MM-JJ)
  | 'nombre'
  | 'liste'       // options imposées
  | 'booleen'
  | 'section';    // titre de groupe, sans valeur

export interface OptionChampFiche {
  valeur: string;
  libelle: string;
}

export interface ChampFiche {
  /** Slug stable : [a-z][a-z0-9_]{0,31}. Immuable après la première sauvegarde. */
  cle: string;
  /** Libellé affiché : 1 à 80 caractères. */
  libelle: string;
  type: TypeChampFiche;
  obligatoire?: boolean;
  aide?: string;
  placeholder?: string;
  /** Requis si type = 'liste'. */
  options?: OptionChampFiche[];
}

export interface SchemaFiche {
  version: 1;
  champs: ChampFiche[]; // 1 à 30 champs
}

export type ValeurFiche = string | number | boolean | null;
export type ValeursFiche = Record<string, ValeurFiche>;

export interface Fiche {
  id: PublicId;              // public_id
  idUtilisateur: PublicId;
  idModele?: PublicId;
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  version: number;
  estActive: boolean;
  dateCreation: Date | string;
  dateModification?: Date | string;
}

/** Payload public : aucune donnée interne (pas d'id numérique, pas d'email du propriétaire). */
export interface FichePublique {
  publicId: string;
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  version: number;
  dateModification?: Date | string;
}
```

Règles de validation (Zod, partagées client/serveur) :

- 1 à 30 champs ; clés uniques ; `cle` conforme au slug.
- `section` ne porte pas de valeur et n'est jamais obligatoire.
- `liste` exige au moins une option, valeurs uniques.
- `date` au format `AAAA-MM-JJ` ; `nombre` fini ; `booleen` booléen.
- `valeurs` ne peut contenir que des clés présentes dans le schéma (les clés inconnues sont ignorées au rendu).
- Taille maximale : 16 Ko pour `schema_json`, 16 Ko pour `valeurs_json`.

---

## 7. API

### Routes authentifiées

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/fiches` | Lister ses fiches (pagination `page`/`limit`) |
| `POST` | `/fiches` | Créer une fiche (modèle ou schéma inline) |
| `GET` | `/fiches/:id` | Détail (propriétaire uniquement) |
| `PATCH` | `/fiches/:id` | Modifier titre / valeurs / schéma inline |
| `DELETE` | `/fiches/:id` | Supprimer (409 si un QR actif y est lié) |
| `GET` | `/fiches/modeles` | Lister ses modèles |
| `POST` | `/fiches/modeles` | Créer un modèle |
| `GET` | `/fiches/modeles/:id` | Détail d'un modèle |
| `PATCH` | `/fiches/modeles/:id` | Modifier (incrémente `version`) |
| `DELETE` | `/fiches/modeles/:id` | Supprimer (les fiches gardent leur snapshot) |

> Attention à l'ordre de déclaration Hono : `/fiches/modeles` doit être enregistré avant
> `/fiches/:id` pour éviter que `modeles` soit interprété comme un identifiant.

### Route publique

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/public/fiches/:publicId` | Payload `FichePublique`, sans authentification |

- `200` : fiche active.
- `404` : identifiant inconnu.
- `410` : fiche archivée.
- `Cache-Control: no-store`.
- Rate-limit via le middleware existant.
- CORS : origine du frontend déjà autorisée par la configuration globale.

### Création du QR associé

On ne fait pas confiance à une URL fournie par le client. `POST /qrcodes` accepte un
`idFiche` optionnel ; le serveur construit lui-même le contenu :

```jsonc
// POST /qrcodes
{
  "type": "dynamique",
  "idFiche": "3f1c…",
  "design": { "couleur": "#241f31" }
}
```

```ts
// service qrcode.ts
if (input.idFiche) {
  const fiche = await chargerFiche(env, input.idFiche, userId); // ownership
  if (!fiche) throw new HTTPException(404, …);
  if (!fiche.estActive) throw new HTTPException(409, …);
  if (!ficheComplete(fiche)) throw new HTTPException(400, …); // champs obligatoires
  type = 'dynamique';
  typeContenu = 'url';
  contenu = `${env.FRONTEND_URL}/d/${fiche.publicId}`;
  idFiche = fiche.id;
}
```

- `PATCH /qrcodes/:id` peut aussi recevoir `idFiche` (recalcule `contenu`).
- Si `FRONTEND_URL` est absent, erreur de configuration explicite (jamais d'URL relative).
- Le schéma `createQRCodeSchema` gagne `idFiche?: UUID`. Quand `idFiche` est fourni :
  `contenu` devient optionnel, `type` vaut `dynamique` par défaut et `typeContenu` est forcé
  à `url` (refine Zod : `contenu` requis si `idFiche` absent).
- `updateQRCodeSchema` gagne `idFiche?: UUID | null`.

### Export / import (P3)

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/fiches/:id/export` | `application/json` : `{ schema, valeurs, version }` |
| `POST` | `/fiches/import` | Valide puis crée une fiche |

---

## 8. Frontend

### Routes

| Route | Page | Accès |
|---|---|---|
| `/dashboard/fiches` | Liste des fiches | authentifié |
| `/dashboard/fiches/new` | Builder (modèle + valeurs) | authentifié |
| `/dashboard/fiches/:id/edit` | Édition | authentifié |
| `/dashboard/fiches/modeles` | Modèles réutilisables | authentifié |
| `/d/:publicId` | Rendu public d'une fiche hébergée | public |
| `/d` | Rendu d'une fiche embarquée (`#z=…`) | public (P3) |

La page publique utilise un layout minimal (pas de header marketing), `noindex, nofollow`,
et un état « Fiche indisponible » propre pour `404`/`410`.

### Composants

| Fichier | Rôle |
|---|---|
| `components/fiche/FicheRenderer.tsx` | Rendu unique : titre, sections, champs, valeurs |
| `components/fiche/FicheBuilder.tsx` | Édition du schéma (ajout, ordre, type, options) |
| `components/fiche/FicheValuesForm.tsx` | Saisie des valeurs selon le schéma |
| `lib/ficheApi.ts` | Appels API (CRUD + public) |
| `lib/ficheCodec.ts` | Encodage/décodage du payload embarqué (P3) |
| `pages/FicheEditPage.tsx` | Builder + valeurs + aperçu |
| `pages/FichePublicPage.tsx` | Chargement et rendu public |

### Rendu

- Champs rendus dans l'ordre du schéma ; les `section` deviennent des `<h2>`.
- Champs facultatifs vides masqués ; champs obligatoires manquants affichés « — »
  (le serveur empêche normalement ce cas).
- `texte_long` avec `white-space: pre-wrap` (les retours à la ligne sont conservés).
- `url` : lien `http(s)` uniquement, `rel="noopener noreferrer nofollow"`, `target="_blank"`.
- `email` : `mailto:` construit à partir de la valeur validée.
- `telephone` : `tel:` après nettoyage (chiffres, `+`, espaces).
- `date` : `Intl.DateTimeFormat` (locale du navigateur), sans appel réseau.
- `booleen` : « Oui » / « Non ».
- Aucun `dangerouslySetInnerHTML`, aucun Markdown, aucun script.
- Accessibilité : `dl`/`dt`/`dd` ou labels explicites, contrastes, navigation clavier.
- Impression : feuille `@media print` pour « Imprimer / Enregistrer en PDF » via le navigateur.

### Aperçu

Le builder affiche `FicheRenderer` en direct. Aucun second rendu « spécial aperçu » :
ce qui est vu est exactement ce qui sera publié.

### Intégration au formulaire QR

- **v1** : bouton « Créer un QR pour cette fiche » depuis la page de la fiche.
- **v1.1** : option « Fiche » dans le formulaire de création de QR (mapping interne vers
  `typeContenu='url'` + `idFiche`).

---

## 9. Sécurité, RGPD, anti-abus

- **XSS** : rendu texte strict ; jamais de HTML utilisateur. Les libellés sont aussi du texte.
- **Injection d'URL** : `http(s)` uniquement, caractères de contrôle refusés (réutiliser
  `apps/api/src/lib/destination.ts`). `javascript:`, `data:`, `file:` rejetés.
- **Injection de header** : aucun contenu de fiche ne finit dans un header HTTP.
- **Énumération** : `public_id` UUID non devinable ; pas d'identifiant séquentiel exposé.
- **Anti-abus** : caps anti-abus (30 champs, 16 Ko, 50 fiches/compte, 20 modèles/compte),
  rate-limit sur la route publique, `noindex`, suppression admin possible.
- **RGPD** : les fiches peuvent contenir des données personnelles ; le propriétaire en est
  responsable. Suppression réelle, aucune statistique de consultation de fiche, aucun appel
  tiers, aucune géolocalisation automatique.
- **Bombes de décompression** (mode embarqué) : plafond du payload décompressé (16 Ko) avant
  validation ; refus au-delà.
- **CSP** : la page publique ne doit contenir aucun script inline ; le rendu est du React
  compilé. À vérifier lors du déploiement statique.

---

## 10. Budget de taille (mode embarqué)

- QR version 40-M : ~2 331 octets utiles, mais on garde une marge de confort.
- Plafond : **URL ≤ 1 200 caractères**, soit ~850 octets compressés (base64url ≈ ×1,33).
- Compression : `CompressionStream('deflate-raw')` natif, puis base64url.
- Format compact, clés courtes :

```json
{"v":1,"t":"Fiche contact","c":[["nom","Nom","texte",1],["email","Email","email",0]],"d":{"nom":"Gloire Messia SAYI","email":"messiasayi@gmail.com"}}
```

- Si la limite est dépassée : message clair, jauge, et proposition de revenir au mode hébergé.
- Si `CompressionStream` est indisponible : mode embarqué désactivé avec explication
  (pas de dépendance de compression supplémentaire).
- Le payload vit dans le **fragment** `#` : il n'est jamais envoyé au serveur ni journalisé.
  Il reste visible dans l'historique du navigateur (à documenter).

---

## 11. Intégration avec l'existant

| Brique | Impact |
|---|---|
| `/q/:alias` | **Aucun** : une fiche hébergée est une URL `http(s)` valide |
| Correctif vCard/texte | **Aucun** : non concerné |
| Routage contextuel | Une variante peut pointer vers `/d/<id>` : les fiches contextuelles fonctionnent sans code |
| `modeles` (presets de design) | **Non réutilisé** : table distincte `fiches_modeles` |
| `qrcodes.id_modele` | Inchangé ; `id_fiche` est une colonne distincte |
| Statistiques | Inchangées : un scan de QR fiche est un scan normal |
| Quotas / plan | Aucun paywall v1 ; caps anti-abus seulement |

---

## 12. Découpage

| Phase | Contenu | Effort | Critère de fin |
|---|---|---|---|
| **P0** | Types partagés, migration `006`, validateurs Zod, services, routes CRUD, tests API | ~2–3 j | CRUD complet, ownership, 409 suppression, tous les cas de test listés couverts |
| **P1** | `FicheRenderer`, `FicheBuilder`, formulaire de valeurs, aperçu temps réel | ~3–4 j | Une fiche se compose et s'affiche à l'identique |
| **P2** | Page publique `/d/:publicId`, endpoint public, création de QR depuis la fiche, stats | ~1–2 j | Scan → fiche rendue, compteur incrémenté |
| **P3** | Export/import JSON, codec embarqué, `/d#z=…`, jauge, mention « sans stats » | ~2–3 j | Aller-retour codec fiable, plafond respecté |
| **P4** | Médias R2, galerie publique de modèles, quotas Pro, impression PDF | ~3–4 j | Selon arbitrage produit |

---

## 13. Tests prévus

### API

- `fiches-schema.test.ts` : clés uniques, types, options de liste, limites 30/16 Ko,
  rejet des clés invalides, `section` sans valeur.
- `fiches-api.test.ts` : CRUD, isolation entre utilisateurs, 404 sur fiche d'autrui,
  409 suppression liée à un QR, 410 archivée, endpoint public sans données internes.
- `fiches-qr.test.ts` : `POST /qrcodes { idFiche }` construit la bonne URL, refuse une fiche
  incomplète, refuse une fiche inactive, `PATCH` recalcule le contenu.
- `fiches-codec.test.ts` (P3) : aller-retour, payload invalide, dépassement de taille,
  protection contre la bombe de décompression.

### Frontend

- Vérification visuelle du rendu (champs vides, long texte, URL, date, booléen, section).
- Test manuel : scan réel d'un QR fiche sur mobile (téléchargement/ouverture de la page).
- Vérification `noindex` et absence d'appel réseau tiers (onglet Réseau).

---

## 14. Non-objectifs

- Pas de HTML, Markdown ou CSS fournis par l'utilisateur.
- Pas de remplacement de la vCard ni des types de contenu existants.
- Pas de carte intégrée, pas de géolocalisation automatique, pas de fingerprinting.
- Pas de statistiques inventées : le mode embarqué n'en produit aucune, et l'UI le dit.
- Pas de modification de l'enum `type_contenu` ni du runtime de redirection.
- Pas de dépendance à un service tiers pour le rendu, les polices ou les images.

---

## 15. Points à valider

| # | Question | Proposition par défaut |
|---|---|---|
| 1 | Priorité | Hébergé (P0–P2) d'abord, embarqué (P3) ensuite |
| 2 | Médias (logo/image) | Hors v1, phase P4 |
| 3 | Tarification | Gratuit au lancement, caps anti-abus seulement |
| 4 | Nom | « Fiches » (table `fiches`, modèles `fiches_modeles`) |
| 5 | Galerie publique de modèles | Hors v1 (colonne `est_public` posée, non exposée) |
| 6 | Impression PDF | Via impression navigateur, pas de génération serveur |

Une fois ces points validés (ou ajustés), l'implémentation démarre par **P0**.

---

## 16. État d'implémentation (2026-11-13)

**Livré — P0 (API) :**

- Migration additive `apps/api/migrations/006_fiches.sql` (tables `fiches`,
  `fiches_modeles`, colonne `qrcodes.id_fiche`). Aucun changement de l'enum
  `type_contenu` ni de `redirect.ts`.
- Types partagés `packages/shared-types/src/fiche.ts`.
- CRUD authentifié `/fiches` et `/fiches/modeles`, validation par type de champ,
  snapshot du schéma, ownership, suppression `409` si un QR est lié.
- Route publique `GET /public/fiches/:publicId` (`404`/`410`, `Cache-Control: no-store`).
- `POST /qrcodes { idFiche }` : URL construite côté serveur, `type_contenu = 'url'`,
  QR dynamique, refus si fiche incomplète ou archivée. `PATCH` peut délier (`null`).
- Tests API : `apps/api/tests/fiches.test.ts` ; suite complète **185 tests verts**.

**Livré — P1/P2 (frontend) :**

- `FicheRenderer` (rendu unique aperçu + public), `FicheBuilder`,
  `FicheValuesForm`, validation client alignée sur l'API.
- Pages `/dashboard/fiches`, `/dashboard/fiches/new`,
  `/dashboard/fiches/:id/edit` et rendu public `/d/:publicId`.
- Création d'un QR depuis la liste des fiches ou l'éditeur (sauvegarde puis
  création, redirection vers le QR).
- Affiche de la fiche liée dans `QRDetailPage` (titre, révision, statut, liens).
- Modèles utilisables comme point de départ ; « enregistrer ce schéma comme
  modèle » depuis l'éditeur. Pas encore de page dédiée `/dashboard/fiches/modeles`.
- `/d/:publicId` : `noindex, nofollow`, `robots.txt` (`Disallow: /d/`), impression
  navigateur, aucun traceur ni appel tiers.

**Reste à faire :**

- P3 (export/import JSON, payload embarqué `#z=…`) et P4 (médias R2).
- Déploiement : appliquer la migration **distante** puis déployer l'API et le web :
  ```bash
  npx wrangler d1 migrations apply free-qr-api-db --remote
  pnpm --filter @free-qr/api deploy
  pnpm --filter @free-qr/web build   # puis publication du dossier dist/
  ```
- Vérifier le fallback SPA de l'hébergement statique pour les liens profonds
  `/d/<uuid>` (un scan ouvre directement cette URL).

