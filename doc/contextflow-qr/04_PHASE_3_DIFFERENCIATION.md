# Phase 3 — Différenciation

**Statut : 🟡 partiellement implémentée (2026-11-12)** — A/B pondéré déterministe, conditions `dates`/`villes`, quota de scans exposé, option B (`?cfq=<variante>`). Météo et page hôte (option A) différées : décision produit en attente.
**Objectif :** les features qu'aucun concurrent ne fait bien, et qui transforment « joli routage » en « outil de conversion ».
**Effort :** ~5–8 jours (dont ~3–4 pour la page hôte, la seule grosse brique).
**Prérequis :** Phases 1 et 2 livrées.

---

## Sommaire

1. A/B testing pondéré
2. Quotas de scans (`minScansTotal` / `maxScansTotal` — déjà dans le moteur, exposition UI)
3. Météo **cachée** (jamais en direct)
4. Conditions `dates` et `villes`
5. **Page hôte** (`/p/:alias`) : la vraie conversion — *décision à prendre avant de commencer*

---

## 1. A/B testing pondéré

### Concept

Deux variantes sans condition, réparties selon un `poids`. Utile pour tester deux formulations de profil, deux accroches, deux CTA.

```json
{
  "variantes": [
    { "id": "v_a", "libelle": "Accroche A", "contenu": "https://…", "poids": 70 },
    { "id": "v_b", "libelle": "Accroche B", "contenu": "https://…", "poids": 30 }
  ],
  "regles": [
    { "id": "r_ab", "priorite": 50, "varianteId": "v_a|v_b", "conditions": { "abTest": true } }
  ]
}
```

### Schéma à ajouter

```ts
// RoutingConditions
abTest?: boolean;              // marque une règle de tirage pondéré
```

```ts
// RoutingRegle
varianteId: string | string[]; // tableau = tirage pondéré entre ces variantes
```

### Implémentation : tirage **déterministe**, pas aléatoire

Un `Math.random()` par scan rend l'expérience instable (le même visiteur voit A puis B) et fausse l'analyse.

**Répartition par appareil** : hash de l'identifiant d'appareil (Phase 4) ou, à défaut, de `IP anonymisée + User-Agent + alias` :

```ts
export function tirerVariante(
  variantes: RoutingVariante[],
  graine: string,
): RoutingVariante {
  const total = variantes.reduce((s, v) => s + (v.poids ?? 1), 0);
  const h = hashStable(graine);           // FNV-1a 32 bits, déterministe
  let curseur = h % total;
  for (const v of variantes) {
    curseur -= v.poids ?? 1;
    if (curseur < 0) return v;
  }
  return variantes[variantes.length - 1];
}

export function hashStable(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
```

> Avant la Phase 4 (pas de cookie), la graine IP+UA donne une répartition acceptable. Après la Phase 4, utiliser `cfq_did` : même visiteur = même variante, durablement.

### UI

- Case à cocher « Tester deux destinations » dans l'éditeur → sélection de 2 variantes + curseur de répartition (50/50 à 90/10).
- Colonne « Répartition » dans le tableau de stats (Phase 2) : montrer l'**attendu vs réalisé** (ex. 70/30 demandé, 68/32 observé) pour prouver que ça fonctionne.

### Garde-fous

- Interdire `abTest` sur une règle sans tableau `varianteId`.
- Interdire les poids dans une règle non-`abTest` (sinon ambiguïté).
- Le tableau de stats doit afficher un avertissement si **< 30 scans** : « échantillon trop faible pour conclure ».

---

## 2. Quotas de scans (déjà dans le moteur)

`minScansTotal` / `maxScansTotal` sont implémentés en Phase 1 mais **pas exposés** dans l'UI. Les exposer :

> *« Les 100 premiers scans → offre découverte. Au-delà → offre classique. »*

**Limite technique à assumer :** `nombre_scans_total` est incrémenté en `waitUntil` → la valeur lue peut être en retard de quelques unités sur les scans simultanés. Acceptable (ce n'est pas un compteur de facturation). Documenter.

---

## 3. Météo cachée

### Pourquoi c'est un piège

Un appel à une API météo dans `/q/:alias` = +100 à 400 ms, une dépendance tierce dans le chemin critique, un quota à gérer, et un point de panne le jour où l'API tombe. **Interdit en direct.**

### Implémentation correcte

```
clé = meteo:{pays}:{ville}:{YYYYMMDDHH}
TTL = 30 min
source = Open-Meteo (gratuit, sans clé)
```

```ts
export async function meteoCache(env: AppEnv["Bindings"], pays: string, ville: string): Promise<string | null> {
  const cle = `meteo:${pays}:${ville}:${new Date().toISOString().slice(0, 13)}`;
  const cache = caches.default;           // Cache API : aucun binding à provisionner
  const requete = new Request(`https://cache-interne.local/${encodeURIComponent(cle)}`);

  const hit = await cache.match(requete);
  if (hit) return hit.text();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 800);   // timeout agressif
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=weather_code`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const cat = categoriserMeteo((await r.json()).current.weather_code);
    const reponse = new Response(cat, { headers: { "Cache-Control": "max-age=1800" } });
    await cache.put(requete, reponse.clone());
    return cat;
  } catch {
    return null;                          // météo indisponible → la règle ne matche pas
  } finally {
    clearTimeout(t);
  }
}
```

**Règles :**

- La météo est **best-effort** : `null` → la condition ne matche pas → variante suivante. Jamais d'erreur.
- Elle n'est **jamais attendue** de façon bloquante au-delà de 800 ms ; idéalement précalculée en tâche de fond (`waitUntil`) pour les villes des QR actifs et jamais dans le chemin du redirect.
- **Ne pas activer la météo tant que `waitUntil` n'est pas en place** sur le précalcul.
- Lat/lon : prendre celles de `cf.latitude`/`cf.longitude` — **non, piège**. C'est la position du visiteur. Pour la météo pertinente (celle du commerce), il faut la position **du QR**, configurée par l'utilisateur (ville → coordonnées, table statique ou géocodage ponctuel à la saisie).

---

## 4. Conditions `dates` et `villes`

```ts
dates?: { debut: string; fin: string };   // ISO 8601, bornes incluses
villes?: string[];                        // cf.city — best-effort, afficher un avertissement UI
```

**Avertissement UI obligatoire sur `villes` :**

> « La ville est estimée à partir de l'opérateur réseau. En Afrique centrale, elle est souvent absente ou imprécise. Privilégiez le pays. »

Ne pas vendre une précision qu'on n'a pas.

---

## 5. Page hôte `/p/:alias` — la seule vraie conversion

### Le constat

Tant que le QR redirige vers un site externe, on ne sait **rien** de ce qui se passe après. « 412 scans » ne dit pas « 412 personnes ont vu mon profil » ni « 12 m'ont contacté ».

Les concurrents ne le font pas (ou mal) parce qu'ils sont des redirecteurs. **Héberger la page de destination, c'est devenir la plateforme.**

### Proposition

Un mini-site public, généré depuis la config du QR, servi par le même Worker :

```
GET /p/:alias
  → sélection de la variante (même résolveur)
  → rendu d'une page HTML (profil / vCard / menu / offre)
  → tracking : vue, clic WhatsApp, clic email, téléchargement .vcf, formulaire
  → conversion réelle visible dans les stats
```

### Contenu de la page (v1)

- Nom, titre, entreprise, photo/logo
- Liens (portfolio, LinkedIn, site)
- Boutons d'action : **WhatsApp** (critique pour la cible), email, téléphone
- Téléchargement `.vcf` (généré à la volée : `text/vcard`)
- **Aucun formulaire serveur en v1** (pas de spam, pas de stockage de données personnelles) → CTA WhatsApp/email
- Bandeau de consentement (réutilisé en Phase 4)

### Impact technique

| Élément | Impact |
|---|---|
| Rendu HTML côté Worker | Nouveau module `services/routing/page.ts` + template. Pas de framework : template literal HTML échappé. |
| Sécurité | **Échappement systématique** de tous les champs utilisateur (XSS). `Content-Security-Policy` stricte. |
| Performance | Page < 15 Ko, inline CSS, zéro JS (ou 1 Ko max). Core Web Vitals excellents. |
| SEO | `noindex` par défaut (pages personnelles), sauf si l'utilisateur active « profil public indexable ». |
| Multi-tenant | URL publique `free-qr-code-saas.getcongo.com/p/:alias` → risque d'abus (phishing). Prévoir **modération** : signalement, rate-limit, blocage de domaine. |
| Stockage | La config de page vit dans `qrcodes.parametres.page` (JSON) ou une colonne dédiée `page_contenu`. |

### Décision à prendre **avant** d'implémenter

| Option | Avantage | Coût |
|---|---|---|
| **A. Page hôte complète** | Conversion réelle, différenciation forte, rétention | 3–4 j + modération + support |
| **B. Redirection + paramètre `?cfq=v_en`** | 30 min de dev, le client lit le paramètre | Conversion non mesurable côté plateforme |
| **C. Redirection + pixel de conversion** | Léger | Le client doit installer un script ; friction |

**Recommandation : B maintenant, A plus tard** — mais **A est la vraie feature**. Ne pas lancer A sans avoir résolu la modération : une plateforme qui héberge des pages publiques attire le phishing, et un domaine blacklisté tue tout le produit, y compris les QR des clients légitimes.

Si A est retenu : commencer par un **pilote fermé** (10 comptes, page profil uniquement, pas de lien libre), mesurer, puis ouvrir.

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `apps/api/src/services/routing/resolve.ts` | Tirage pondéré, `dates`, `villes` |
| `apps/api/src/services/routing/meteo.ts` | **Créer** (cache + catégorisation) |
| `apps/api/src/routes/page.ts` | **Créer** si option A |
| `apps/api/src/validators/routing.ts` | `abTest`, `dates`, `villes`, météo |
| `packages/shared-types/src/routing.ts` | Types étendus |
| `apps/web/src/components/routing/*` | UI A/B, quotas, avertissements |
| `apps/web/src/pages/PublicProfilePage.tsx` | **Créer** si option A |

---

## Tests

| Cas | Attendu |
|---|---|
| `poids 70/30`, 10 000 graines distinctes | Répartition dans [67 %, 73 %] |
| Même graine deux fois | **Même variante** |
| `abTest` sur une seule variante | `400` à la sauvegarde |
| Météo indisponible (fetch échoue) | Règle ignorée, variante suivante |
| Météo en cache | **Aucun appel réseau** (vérifier avec un mock `fetch`) |
| `dates` hors bornes | Pas de match |
| `villes` avec `cf.city` absent | Pas de match (pas de défaut silencieux) |
| Page hôte avec un libellé `<script>alert(1)</script>` | HTML échappé, pas d'exécution |
| `/p/:alias` sur QR statique | `404` |

---

## Definition of Done

- [x] A/B : répartition vérifiée statistiquement (70/30 sur 10 000 graines, bornes 67–73 %), déterminisme prouvé par test
- [ ] Météo : timeout 800 ms max, cache 30 min, zéro appel en cas de hit *(différée — voir décisions)*
- [x] Aucune règle ville/date ne provoque de 5xx (fallback et « on ne devine pas » testés)
- [x] Avertissements UI affichés sur villes et échantillons faibles
- [ ] (Option A) XSS testé, CSP en place, `noindex` par défaut, procédure de signalement documentée *(non retenue à ce stade)*

### Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Page hôte | **Option B** : paramètre `?cfq=<idVariante>` ajouté à la redirection | Aucun stockage de données personnelles, aucun risque de phishing, livrable immédiatement |
| Page hôte (option A) | Différée | Nécessite modération + support + CSP ; à rouvrir en pilote fermé |
| Météo | Différée | Introduirait un `fetch` et une I/O dans le résolveur pur (ou un précalcul massif) ; bénéfice produit non démontré pour la cible networking |
| `villes` | Implémentée avec avertissement UI | `cf.city` reste best-effort ; jamais bloquant |
| Quotas de scans | Déjà exposés dans `ConditionFields` (Phase 1) | Aucun code supplémentaire |

### Écarts assumés

| Plan | Implémentation | Raison |
|---|---|---|
| `varianteId: string \| string[]` + `abTest` | Idem, validé strictement (tableau ⇔ `abTest`) | Un tableau sans marqueur serait ambigu |
| Attendu vs réalisé dans les stats | Avertissement « échantillon < 30 scans » seulement | L'attendu par variante n'est pas calculable quand plusieurs règles A/B coexistent |
| `dates` (bornes incluses) | Idem, ISO 8601 avec fuseau | |
| `villes` comparaison exacte | Casse et accents normalisés | Tolérance sans deviner |

---

## Risques

| Risque | Mitigation |
|---|---|
| Météo = latence + panne tierce | Cache 30 min + précalcul `waitUntil` + timeout 800 ms + best-effort |
| A/B mal compris → conclusions fausses | Avertissement < 30 scans, affichage attendu/réalisé |
| Page hôte utilisée pour du phishing | Option A en pilote fermé, modération, rate-limit, blocage |
| `villes` vendu comme précis | Avertissement UI explicite, priorité au pays |
