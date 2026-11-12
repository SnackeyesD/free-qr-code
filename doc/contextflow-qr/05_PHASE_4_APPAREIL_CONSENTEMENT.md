# Phase 4 — Compteur par appareil & consentement

**Statut : ✅ implémentée (2026-11-12)** — compteur cookie `cfq_c`, interstitiel `/c/:alias`, retrait `/consentement`, preuve hashée en base, conditions `minScansAppareil`/`maxScansAppareil`, 15 tests dédiés.
**Objectif :** tenir la promesse *« après 3 scans sur le même appareil, il se passe autre chose »* — **avec un consentement réel**, pas un cookie posé en douce.
**Effort :** ~3–4 jours.
**Prérequis :** Phase 1 (moteur), Phase 2 (analytics). Optionnellement Phase 3.

---

## Le problème à ne pas rater

La promesse initiale était « 3 scans par la même **personne** ». C'est impossible au scan : pas d'identité, pas de login, et l'IP est inutilisable (CGNAT massif chez MTN/Airtel — des milliers d'abonnés derrière une IP).

On peut compter **par appareil**, via un cookie first-party. Mais :

1. Un cookie non essentiel **exige un consentement préalable** (RGPD / directive ePrivacy).
2. Un `302` ne peut pas afficher de bandeau. **On ne peut donc pas poser le cookie sur la redirection.**

→ Un QR qui utilise une règle « par appareil » doit passer par **une page intermédiaire de consentement**, une seule fois par appareil.

C'est le prix honnête de la feature. Il faut l'assumer et le rendre le moins intrusif possible.

---

## 1. Modèle de données

`apps/api/migrations/004_appareil_consentement.sql`

```sql
-- Compteur de scans par appareil et par QR
CREATE TABLE appareils_qr (
  id_appareil   TEXT NOT NULL,          -- hash du cookie, jamais l'UUID brut
  id_qrcode     INTEGER NOT NULL,
  nombre_scans  INTEGER NOT NULL DEFAULT 0,
  premier_scan  TEXT NOT NULL,
  dernier_scan  TEXT NOT NULL,
  PRIMARY KEY (id_appareil, id_qrcode)
);

CREATE INDEX IF NOT EXISTS idx_appareils_qr_date ON appareils_qr (id_qrcode, dernier_scan);

-- Preuve de consentement (minimisation : uniquement ce qui est nécessaire)
CREATE TABLE consentements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  id_appareil   TEXT NOT NULL,          -- hash
  finalite      TEXT NOT NULL,          -- 'comptage_appareil'
  version_texte TEXT NOT NULL,          -- ex. 'v1-2026-10'
  date_consentement TEXT NOT NULL,
  date_retrait  TEXT
);

CREATE INDEX IF NOT EXISTS idx_consentements_appareil ON consentements (id_appareil, finalite);

-- Traçabilité du scan
ALTER TABLE scans ADD COLUMN id_appareil TEXT;
```

**Pourquoi le hash ?** Le cookie contient un UUID aléatoire (`cfq_did`). La base ne stocke que `sha256(uuid + JWT_TRACKING_SECRET)` tronqué. Si la base fuite, on ne peut pas reconstruire les cookies → pas de ré-identification croisée. Le secret existe déjà (`JWT_TRACKING_SECRET`).

---

## 2. Flux

```
Scan sans cookie
   │
   ├─ La config du QR utilise-t-elle une règle « appareil » ?
   │      NON → redirection normale (comportement Phase 1). Aucun bandeau, aucun cookie.
   │      OUI → évaluation des règles SANS les conditions appareil
   │             → 302 vers /c/:alias  (page de consentement, sur notre domaine)
   │
   ▼
GET /c/:alias
   ├─ Bandeau : « Ce QR mémorise sur cet appareil le nombre de scans pour adapter
   │             le contenu. Aucune donnée personnelle. Refuser ou Accepter. »
   ├─ Accepter → Set-Cookie cfq_did (UUID) + POST /consentements + 302 vers /q/:alias
   └─ Refuser  → 302 vers /q/:alias avec en-tête `DNT` interne → règles appareil ignorées
                  (mémorisé en cookie de refus `cfq_refus=1`, essentiel, pas de bandeau à nouveau)
```

**Points clés :**

- **Le bandeau ne s'affiche que pour les QR qui en ont besoin.** Un QR heure/pays/langue ne génère jamais d'interstitiel. C'est ce qui rend le compromis acceptable.
- **Refus = fonctionnalité dégradée, pas bloquée** : le scan aboutit quand même, sur la variante « sans condition appareil ».
- **Un seul affichage par appareil** : après acceptation ou refus, plus jamais de page intermédiaire.
- **L'interstitiel doit être ultra-léger** : < 10 Ko, rendu en < 100 ms, boutons larges (mobile, debout, réseau 3G).

---

## 3. Cookie

```
Nom     : cfq_did
Valeur  : UUID v4 aléatoire (pas d'information dérivable)
Durée   : 13 mois (recommandation CNIL)
Attributs : Secure; HttpOnly; SameSite=Lax; Path=/
```

> `HttpOnly` = illisible en JS → protège contre le vol par XSS, et empêche tout usage publicitaire. À documenter comme un argument de confiance.

Cookie de refus :

```
Nom : cfq_refus  |  Valeur : 1  |  Durée : 6 mois  |  Même attributs
```

Cookie **strictement nécessaire** (mémoriser un refus), donc pas de consentement requis pour lui.

---

## 4. Intégration dans le résolveur

Ajouter au contexte :

```ts
export interface ContexteScan {
  // …
  scansTotal: number;
  scansAppareil?: number;   // undefined = inconnu (pas de cookie ou refus)
  consentementAppareil?: boolean;
}
```

Conditions :

```ts
minScansAppareil?: number;
maxScansAppareil?: number;
```

**Sémantique stricte :**

| Situation | Comportement |
|---|---|
| `scansAppareil` inconnu (pas de cookie) | La condition **ne matche pas** → on ne devine pas |
| Consentement refusé | Même chose : condition ignorée, variante suivante |
| Consentement accepté, 3ᵉ scan | `minScansAppareil: 3` matche |

Dans `redirect.ts`, si une règle « appareil » est nécessaire et que le consentement manque → rediriger vers `/c/:alias` (une fois).

**Détection « nécessite un consentement » :** parcourir `cfg.regles` et vérifier la présence de `minScansAppareil`/`maxScansAppareil` sur une règle active. Pas besoin de plus.

---

## 5. Incrément du compteur appareil

Dans `recordScan` (déjà en `waitUntil`, non bloquant) :

```sql
INSERT INTO appareils_qr (id_appareil, id_qrcode, nombre_scans, premier_scan, dernier_scan)
VALUES (?, ?, 1, ?, ?)
ON CONFLICT(id_appareil, id_qrcode) DO UPDATE SET
  nombre_scans = nombre_scans + 1,
  dernier_scan = excluded.dernier_scan;
```

Puis, au scan **suivant**, on lit le compteur **avant** la redirection :

```sql
SELECT nombre_scans FROM appareils_qr WHERE id_appareil = ? AND id_qrcode = ?;
```

> ⚠️ Cette lecture ajoute **une requête D1 sur le chemin chaud**, uniquement pour les QR concernés. Mesurer l'impact (cible : p95 < 80 ms sur ces QR). Si nécessaire, mettre le compteur dans le cookie lui-même (`cfq_c={alias}:3`) — zéro requête, mais cookie modifiable par l'utilisateur (acceptable : ce n'est pas un mécanisme de sécurité). **Recommandation : commencer par le cookie** (`cfq_c`), et ne passer à D1 que si le besoin d'exactitude anti-fraude apparaît.
>
> **Choix retenu :** compteur dans le cookie `cfq_c` (`alias:count~alias:count`), aucune lecture D1 sur le chemin chaud. `appareils_qr` est écrit en `waitUntil` pour l'audit et les statistiques.

---

## 6. RGPD / CNIL — checklist

- [ ] Bandeau **avant** tout cookie non essentiel, avec **Refuser** aussi visible qu'**Accepter** (pas de « continuez = acceptez »)
- [ ] Finalité explicite : « compter les scans de cet appareil pour adapter le contenu »
- [ ] Aucune donnée personnelle dans le cookie (UUID aléatoire)
- [ ] Hash en base, pas l'UUID brut
- [ ] Durée 13 mois max, refus mémorisé 6 mois
- [ ] Retrait du consentement possible : page `/consentement` (supprime le cookie + `date_retrait` en base)
- [ ] Politique de confidentialité mise à jour (`PrivacyPage.tsx` + `merise/12_SECURITE_RGPD.md`)
- [ ] Registre des traitements : finalité « comptage d'usage », base légale « consentement »
- [ ] Pas de transfert hors UE pour ce mécanisme (tout est chez Cloudflare — vérifier la localisation D1/R2 et le DPA)
- [ ] **Pas de fingerprinting** (interdit sans consentement explicite, et fragile)
- [ ] `cf.country` : donnée issue de la requête, pas un cookie → pas de consentement requis, mais à mentionner dans la politique

---

## 7. UI

| Élément | Détail |
|---|---|
| Éditeur de règle | Condition « Nombre de scans **sur cet appareil** ≥ … », avec badge ⓘ « nécessite le consentement du visiteur » |
| Aperçu | Avertissement si un QR utilise cette condition : « Ce QR affichera un écran de consentement au premier scan » |
| Page `/c/:alias` | Bandeau court, 2 boutons, lien politique de confidentialité |
| Réglages compte | Interrupteur « Activer le comptage par appareil » (désactivé par défaut) |
| Stats | Les scans sans consentement sont comptés normalement, mais **jamais** attribués à un appareil |

**Ne pas** activer le comptage par appareil par défaut. C'est opt-in, côté propriétaire du QR **et** côté visiteur.

---

## 8. Tests

| Cas | Attendu |
|---|---|
| QR sans règle appareil | Aucun `Set-Cookie`, aucun interstitiel |
| QR avec règle appareil, premier scan | `302` vers `/c/:alias`, pas de cookie posé |
| Acceptation | Cookie `cfq_did` posé (`HttpOnly`, `Secure`, `SameSite=Lax`), 302 vers `/q/:alias` |
| Refus | Cookie `cfq_refus=1`, 302 vers `/q/:alias`, règle appareil ignorée |
| 3ᵉ scan avec consentement | Variante « appel » servie |
| Cookie supprimé puis nouveau scan | Interstitiel de nouveau |
| `maxScansAppareil` atteint | Ne matche plus (retour au défaut) |
| `date_retrait` enregistrée | Le cookie est supprimé, l'appareil n'est plus compté |
| Hash | Deux UUID différents → deux `id_appareil` différents ; même UUID → même hash |
| Base compromise | Aucun UUID brut en base (vérification par requête) |

---

## Definition of Done

- [x] Aucun cookie non essentiel posé sans action explicite
- [x] Bouton « Refuser » aussi visible qu'« Accepter »
- [x] Interstitiel < 10 Ko, testé sur 3G simulée *(HTML inline sans JS ; 0,9 Ko mesuré par test)*
- [x] Retrait du consentement fonctionnel (`/consentement`)
- [x] Politique de confidentialité + `merise/12_SECURITE_RGPD.md` à jour
- [x] Aucun UUID brut en base (vérifié par requête dans les tests)
- [x] p95 `/q/:alias` sur QR concernés mesuré et documenté *(compteur lu dans le cookie, zéro requête D1 ajoutée)*
- [x] Les 120 tests existants + 15 nouveaux verts (135 au total)

### Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Compteur sur le chemin chaud | **Cookie `cfq_c`** (`alias:count`), pas de lecture D1 | Zéro requête ajoutée ; la valeur est modifiable par l'utilisateur, acceptable car elle n'a aucun rôle de sécurité |
| `appareils_qr` | Agrégat d'audit écrit en `waitUntil` | Statistiques et preuve d'usage, jamais bloquant pour la redirection |
| Page de consentement | HTML inline côté API (`/c/:alias`), aucun JS | < 10 Ko, aucun déploiement front, deux formulaires natifs |
| Boucle si cookies bloqués | Paramètre `?cfq_decision=accept\|refus` au retour | Le scan aboutit toujours, même sans cookie |
| Activation | Condition de règle `minScansAppareil`/`maxScansAppareil` | Opt-in par QR, sans interrupteur de compte redondant |
| Refus | Cookie `cfq_refus=1` (6 mois) + règles appareil ignorées | Fonctionnalité dégradée, jamais bloquée |
| Retrait | `date_retrait`, `scans.id_appareil = NULL`, suppression `appareils_qr` | Effacement réel du lien appareil ↔ historique |
| Détection du besoin | Présence d'une condition appareil dans une config active | Simple à expliquer ; le QR entier est concerné |

### Écarts assumés

| Plan | Implémentation | Raison |
|---|---|---|
| Interrupteur « Activer le comptage par appareil » dans les réglages du compte | Absent | Ajouter une condition appareil est déjà un opt-in explicite par QR ; un second interrupteur n'aurait aucun effet supplémentaire |
| `/c/:alias` sur le front | HTML servi par l'API | Même domaine que la redirection, aucun JS, aucune dépendance |
| `scansAppareil` = nombre de scans précédents | Numéro de ce scan (1 = premier) | Rend `minScansAppareil: 3` littéralement égal au 3ᵉ scan, sans décalage |
| Test « interstitiel sur 3G simulée » | Poids HTML mesuré + aucun JS | Pas de navigateur dans la suite API ; le budget < 10 Ko est vérifié |

### Tests ajoutés (`tests/appareil-consent.test.ts`)

| Cas | Résultat |
|---|---|
| QR sans règle appareil | Aucun `Set-Cookie`, aucun interstitiel |
| QR concerné, premier scan | `302 /c/:alias`, pas de cookie |
| Page de consentement | 200 HTML, `noindex`, `no-store`, < 10 Ko |
| Acceptation | `cfq_did` HttpOnly/Secure/SameSite=Lax, preuve hashée, UUID absent de la base |
| 3ᵉ scan | Variante « fidèle » servie, compteur incrémenté |
| Refus | `cfq_refus=1`, règle appareil ignorée, aucun compteur |
| `maxScansAppareil` | Borne exclue, retour au défaut |
| Retrait | `date_retrait`, `appareils_qr` supprimé, `scans.id_appareil` délié |
| Retrait puis nouveau scan | Interstitiel de nouveau |
| Hash / cookie compteur | Déterminisme, parsing tolérant, multi-QR |

---

## Risques

| Risque | Mitigation |
|---|---|
| Interstitiel qui tue la conversion | Uniquement sur les QR qui en ont besoin, un seul affichage, refus non bloquant |
| Requête D1 supplémentaire sur le chemin chaud | Compteur dans le cookie (`cfq_c`) en priorité |
| Interprétation RGPD divergente (Congo vs UE) | Politique alignée sur le standard le plus strict (CNIL), mention explicite |
| Cookie vidé en navigation privée | Assumé : la règle ne s'applique pas, dégradation gracieuse |
| Dérive vers le fingerprinting | Interdit explicitement dans la spec et dans la revue de code |
