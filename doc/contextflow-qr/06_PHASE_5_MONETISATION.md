# Phase 5 — Monétisation (couture, pas paywall)

**Statut : ✅ implémentée (2026-11-12)** — flag `ROUTING_PRO_ONLY`, quotas d'édition, colonnes `plan`/`date_passage_pro`, instrumentation des consultations, métriques admin, gating front. En production : `ROUTING_PRO_ONLY="false"`, donc comportement strictement gratuit.
**Objectif :** préparer le passage au payant **sans construire de paywall maintenant**.
**Décision actée :** le multi-routing reste **gratuit** jusqu'à décision contraire.
**Effort :** ~2 jours.

---

## Principe : poser les coutures, pas les murs

Construire un paywall maintenant, c'est :

- du code qui ne sert à rien tant que c'est gratuit ;
- un risque de frustrer les premiers utilisateurs (les meilleurs ambassadeurs) ;
- une intégration de paiement (Stripe ? Mobile Money ?) qu'on ne veut pas choisir aujourd'hui.

À faire maintenant, en revanche : **les points d'extension**. Un flag, une colonne, des quotas déjà appliqués en mode « illimité ». Le jour de la bascule, on change une variable, pas l'architecture.

---

## 1. Modèle

```sql
-- apps/api/migrations/005_plans.sql
ALTER TABLE utilisateurs ADD COLUMN plan TEXT NOT NULL DEFAULT 'gratuit';  -- 'gratuit' | 'pro'
ALTER TABLE utilisateurs ADD COLUMN date_passage_pro TEXT;
```

```ts
// packages/shared-types/src/utilisateur.ts
export type PlanUtilisateur = "gratuit" | "pro";
```

---

## 2. Feature flag

`apps/api/wrangler.toml` → `[vars]`

```toml
ROUTING_PRO_ONLY = "false"       # basculer à "true" le jour J
ROUTING_LIMITE_VARIANTES = "20"  # appliqué aux comptes gratuits si Pro-only
ROUTING_LIMITE_REGLES = "50"
```

`AppEnv["Bindings"]` : `ROUTING_PRO_ONLY?: string;`.

```ts
// apps/api/src/services/routing/limits.ts
export function limitesRoutage(env: AppEnv["Bindings"], plan: PlanUtilisateur) {
  const proOnly = env.ROUTING_PRO_ONLY === "true";
  if (plan === "pro" || !proOnly) {
    return { plan, proOnly, autorise: true, variantes: null, regles: null };
  }
  // Gratuit sous Pro-only : édition bloquée ; les quotas restent définis pour
  // une future offre gratuite limitée (ROUTING_LIMITE_VARIANTES/REGLES).
  return {
    plan,
    proOnly,
    autorise: false,
    variantes: entierPositif(env.ROUTING_LIMITE_VARIANTES, 1),
    regles: entierPositif(env.ROUTING_LIMITE_REGLES, 0),
  };
}
```

> Aujourd'hui `ROUTING_PRO_ONLY=false` → `autorise: true` et limites infinies pour tout le monde. **Comportement strictement gratuit**, comme décidé.
> Le jour de la bascule : `ROUTING_PRO_ONLY=true` → les comptes gratuits gardent leurs QR mais ne peuvent plus **créer/modifier** de routage (les configs existantes continuent de fonctionner : ne jamais casser un QR déjà imprimé).

**Règle d'or de la bascule :** un QR déjà imprimé continue de fonctionner, quelle que soit la décision commerciale. On bloque la **création**, jamais le **service**.

---

## 3. Application des limites

Un seul point d'entrée, dans `PUT /qrcodes/:id/routage` :

```ts
const limites = limitesRoutage(c.env, planUtilisateur);
if (!limites.autorise) {
  throw new HTTPException(402, {
    message: "Le routage contextuel est réservé au plan Pro",
    // pas de fuite d'info : on renvoie un code stable que le front sait traduire
  });
}
if (config.variantes.length > limites.variantes) { /* 400 explicite */ }
if (config.regles.length > limites.regles) { /* 400 explicite */ }
```

Et dans le front, un hook unique :

```ts
const { peutRouter, raisonLimite } = useLimitesRoutage();
if (!peutRouter) return <UpgradeCta raison={raisonLimite} />;
```

**Aucune limite appliquée au runtime** (`/q/:alias`). Le serveur de redirection ne consulte jamais le plan : c'est plus rapide, et ça garantit qu'une carte bancaire expirée ne casse pas un QR sur un menu de restaurant.

---

## 4. Offre à préparer (pas à implémenter)

| Plan | Prix indicatif | Contenu |
|---|---|---|
| **Gratuit** | 0 | QR statiques illimités, QR dynamiques limités, 1 destination, analytics basique |
| **Pro** | À définir (FCFA + €) | Routage contextuel, analytics par variante, A/B, page hôte, export CSV |
| **Business** | À définir | Multi-utilisateurs, quotas élevés, page hôte avec domaine perso |

**Ne pas** publier cette grille tant que la décision n'est pas prise : une page tarifaire qui promet du gratuit puis facture est le plus sûr moyen de perdre la confiance.

Mettre à jour `PricingPage.tsx` **au moment de la bascule**, pas avant.

---

## 5. Instrumentation (à faire dès maintenant, c'est gratuit)

Sans mesure, la décision de basculer sera prise à l'aveugle. Compter, en base ou en logs :

| Métrique | Pourquoi |
|---|---|
| Nombre de QR avec `regles_routage` non nul | Mesure l'adoption |
| Nombre de QR avec ≥ 2 variantes | Mesure l'usage réel |
| Nombre de comptes distincts ayant configuré du routage | Potentiel de conversion |
| Nombre de consultations de `/qrcodes/:id/routage/stats` | Intérêt pour la feature payante |
| Répartition gratuits / pro (quand ça existera) | Suivi de la bascule |

Un endpoint admin `GET /admin/routing/metrics` suffit (même pattern que `/admin/dashboard`).
Les consultations de stats sont enregistrées dans `routage_consultations_stats` (une ligne =
un compte + un instant) en `waitUntil`, afin que la mesure survive aux logs éphémères des
Workers. Aucun email ni donnée personnelle n'y figure.

---

## 6. Tests

| Cas | Attendu |
|---|---|
| `ROUTING_PRO_ONLY=false` + compte gratuit | `PUT` routage → `200` |
| `ROUTING_PRO_ONLY=true` + compte gratuit | `PUT` → `402` |
| `ROUTING_PRO_ONLY=true` + compte pro | `PUT` → `200` |
| `ROUTING_PRO_ONLY=true` + QR gratuit **déjà routé** | `/q/:alias` **continue de router** |
| Limite de variantes dépassée | `400` avec message explicite |
| Le plan n'est jamais lu au runtime | Aucune requête `utilisateurs` dans `redirect.ts` (revue de code) |

---

## Definition of Done

- [x] `ROUTING_PRO_ONLY=false` en prod → aucun changement de comportement
- [x] Bascule testée en local (`true`) sans casser un QR existant
- [x] Aucune lecture du plan sur `/q/:alias`
- [x] Métriques admin disponibles (`GET /admin/routing/metrics`)
- [x] Aucune mention de prix publiée avant décision

### Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Emplacement du flag | `wrangler.toml` → `[vars]`, lu uniquement dans `limits.ts` | Une variable suffit pour la bascule, aucun redéploiement de code |
| Portée du blocage | `PUT` uniquement (`402`), `GET`/`DELETE` restent permis | Un utilisateur doit toujours pouvoir consulter et désactiver son routage |
| Quotas gratuits | `ROUTING_LIMITE_VARIANTES=20`, `ROUTING_LIMITE_REGLES=50` | Valeurs larges : le jour de la bascule, la limite est un plafond, pas un piège |
| Plan par défaut | `gratuit` (contrainte `CHECK`) | Aucun compte ne peut exister sans plan valide |
| Instrumentation | Table `routage_consultations_stats`, insertion en `waitUntil` | Durable, agrégée, sans donnée personnelle ; ne bloque jamais la réponse |
| Mesure de l'usage | `qrMultiVariantes` calculé en parsant le JSON | Compte l'usage réel, pas seulement la présence d'une config |
| Gating front | `state.limites` transmis par l'API, `fieldset disabled` | Une seule source de vérité ; l'API reste l'arbitre (402) |

### Écarts assumés

| Plan | Implémentation | Raison |
|---|---|---|
| Hook `useLimitesRoutage()` | Lecture directe de `state.limites` dans `RoutingEditor` | Les limites arrivent déjà avec l'état de routage : un hook séparé ferait une requête de plus |
| « Pas de table dédiée » (section 5) | `routage_consultations_stats` | Les logs Workers ne sont pas interrogeables durablement ; la table ne contient que compte + date |
| `variantes: Infinity` / `regles: Infinity` | `null` dans `RoutingLimites` | `null` est sérialisable en JSON et explicite (« illimité ») |
| `UpgradeCta` avec raison détaillée | Bandeau neutre, sans prix ni lien de paiement | Aucune grille tarifaire ne doit être publiée avant décision |
| Limite de variantes testée via `PUT` | Test unitaire de `verifierLimites` | Quand `proOnly=true`, le gratuit reçoit `402` avant les quotas ; les quotas ne sont atteignables que pour un plan autorisé |

### Tests ajoutés (`tests/plans-monetisation.test.ts`)

| Cas | Résultat |
|---|---|
| Migration 005 | `plan='gratuit'` par défaut, `date_passage_pro` NULL, table de consultation présente |
| Flag false + gratuit | `PUT` → `200`, limites illimitées |
| Flag true + gratuit | `PUT` → `402` |
| Flag true + pro | `PUT` → `200` |
| Flag true + QR déjà routé | `/q/:alias` → `302` vers la variante, indépendamment du plan |
| Quota dépassé | `400` explicite (variantes puis règles) |
| Métriques admin | Adoption, multi-variantes, comptes, consultations, plans, sans email |
| Accès non-admin | `403` |

---

## Risques

| Risque | Mitigation |
|---|---|
| Bascule qui casse des QR imprimés | Blocage à la création uniquement, jamais au runtime |
| Prix inadapté au marché (FCFA vs €) | Attendre les données d'usage (section 5) avant de fixer |
| Paiement Mobile Money complexe | Ne pas l'implémenter avant d'avoir 10 clients payants prêts ; commencer par un règlement manuel (WhatsApp/virement) |
| Fuite de la grille tarifaire dans l'UI | Pas de `PricingPage` mise à jour avant la bascule |
