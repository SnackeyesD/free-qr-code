# Galerie de modèles QR publics

**Date :** 2026-11-21
**Statut :** ✅ implémenté, non encore déployé
**Périmètre :** galerie `/dashboard/templates`, endpoint public en lecture seule, préremplissage de la création de QR.

---

## 1. Objectif

`/dashboard/templates` n'était qu'un placeholder. La page devient une vraie galerie de
**presets de design** : l'utilisateur parcourt des modèles publics, en choisit un, puis
arrive sur le formulaire de création avec le **type de contenu** et le **design** déjà
remplis.

Un modèle ne contient **aucun contenu utilisateur** et ne crée aucun QR à lui seul. Le
contenu (URL, texte, Wi-Fi, vCard…) reste saisi par l'utilisateur, qui peut modifier le
type et tous les réglages avant validation.

---

## 2. Décisions

| Sujet | Décision |
|---|---|
| Table | `modeles` existante, colonne `est_public` |
| Modèles privés | Jamais exposés par la galerie |
| Identifiant exposé | `public_id` uniquement (pas l'id interne ni le propriétaire) |
| Contenu | Aucun contenu prérempli : le modèle ne porte que le design |
| Accès | Utilisateur connecté, sans rôle admin ; rate-limit par utilisateur |
| Runtime `/q/:alias` | Inchangé |
| Enum `type_contenu` | Inchangé |
| Rendu | Design uniquement ; aperçu via `/preview/qr` |
| Données de démonstration | 8 presets réels insérés par migration, sans statistique inventée |
| Tarification | Gratuit ; aucun quota payant introduit |

---

## 3. API

| Route | Méthode | Description | Auth |
|---|---|---|---|
| `/templates/publics` | `GET` | Liste des modèles `est_public = 1` (`{ data, total }`, max 200) | ✅ JWT |
| `/templates/publics/:publicId` | `GET` | Détail d'un modèle public par `public_id` | ✅ JWT |

Réponses : `ModeleQR` **sans** `idUtilisateur`; `id` contient le `public_id`.

- Un modèle privé ou inconnu renvoie `404`.
- Aucune route admin n'est exposée au public.
- `Cache-Control` n'est pas forcé : une modification admin est visible au prochain appel.
- Rate-limit : middleware existant, clé `user:<id>` après authentification.

---

## 4. Base de données

Migration [`007_modeles_publics.sql`](../../apps/api/migrations/007_modeles_publics.sql) :

- 8 modèles `est_public = 1`, `id_utilisateur = NULL` ;
- `INSERT OR IGNORE` sur des `public_id` stables ;
- chaque `parametres_par_defaut` est un `QRCodeDesign` valide (couleurs hex, taille,
  correction, cadre) ;
- les types couvrent `url`, `wifi`, `vcard`, `pdf`, `geo` et `texte`.

Aucun contenu d'exemple n'est stocké : les aperçus utilisent un contenu neutre côté
frontend (`lib/qrPreview.ts`).

---

## 5. Frontend

### Galerie — `TemplatesPage`

- chargement, erreur avec bouton « Réessayer », état vide distinct selon les filtres ;
- recherche par nom/description (insensible aux accents) et filtre par type de contenu ;
- cartes avec aperçu QR réel, type, description, palette et niveau de correction ;
- bouton **« Utiliser ce modèle »**.

### Préremplissage — `QRCreatePage` / `QRCreateForm`

Le bouton navigue vers :

```
/dashboard/qr/new?modele=<public_id>
```

La page charge le modèle public, puis monte le formulaire avec :

- `typeContenu` du modèle ;
- `design` fusionné avec `DEFAULT_DESIGN` ;
- aucun contenu.

Un bandeau indique le modèle appliqué et permet de le retirer. Si le modèle n'existe plus,
un avertissement s'affiche et le formulaire reste utilisable avec les valeurs par défaut.

Le hook `useQRForm` accepte désormais un design initial optionnel ; le reste du formulaire
est inchangé.

---

## 6. Anti-abus et limites

- Lecture seule ; aucune écriture depuis la galerie.
- Authentification obligatoire + rate-limit.
- Maximum 200 modèles retournés.
- Aucun appel réseau tiers, aucun HTML utilisateur, aucune statistique inventée.
- Les modèles privés restent réservés à l'admin (`/admin/templates`).

---

## 7. Vérifications

- Tests API : `apps/api/tests/templates-publics.test.ts` (auth, filtrage public/privé,
  absence de `idUtilisateur`, détail, 404).
- Type-check API et web, lint web, build Vite.
- Migration 007 appliquée en local D1 et vérifiée par requête SQL.

---

## 8. Déploiement

```bash
npx wrangler d1 migrations apply free-qr-api-db --remote
pnpm --filter api deploy
pnpm --filter web build
# publier apps/web/dist
```

Les migrations 006 (fiches) et 007 (modèles publics) sont à appliquer avant le déploiement
de l'API et du frontend correspondants.
