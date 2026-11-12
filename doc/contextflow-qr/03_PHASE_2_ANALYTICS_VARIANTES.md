# Phase 2 — Analytics par variante

**Statut : ✅ implémentée (2026-11-11)** — migration `003`, agrégation SQL, route JSON + CSV, tableau comparatif et alertes. Application remote de la migration reportée au déploiement final.
**Objectif :** savoir **quelle destination convertit**, pas seulement combien de fois un QR a été scanné.
**Effort :** ~2–3 jours.
**Prérequis :** Phase 1 en production avec au moins un QR routé.

---

## Le problème

Aujourd'hui `GET /qrcodes/:id/stats` renvoie des totaux par jour, plus les tops pays/appareils.
Avec le routage, ces chiffres deviennent **trompeurs** : 400 scans sur un QR à 3 variantes, ça ne dit pas si le menu du midi fonctionne.

C'est **la feature qui justifie l'abonnement**. Sans elle, le routage n'est qu'un gadget.

---

## 1. Migration

`apps/api/migrations/003_routing_analytics.sql`

```sql
ALTER TABLE scans ADD COLUMN id_variante TEXT;   -- id stable du JSON (ex. "v_en"), NULL si pas de routage
ALTER TABLE scans ADD COLUMN langue TEXT;        -- langue négociée au scan ("fr", "en"…)

CREATE INDEX IF NOT EXISTS idx_scans_variante ON scans (id_qrcode, id_variante);
CREATE INDEX IF NOT EXISTS idx_scans_date_variante ON scans (id_qrcode, date_scan, id_variante);
```

> `id_variante` en `TEXT` et non une FK : la config vit dans du JSON. Assumer — et documenter que renommer un `id` de variante casse l'historique (l'UI doit **interdire** l'édition d'un `id` après création ; on édite le libellé, pas l'identifiant).

---

## 2. Enregistrement

`recordScan` reçoit déjà `idVariante` (Phase 1). Compléter l'`INSERT` :

```sql
INSERT INTO scans (public_id, id_qrcode, adresse_ip, user_agent, pays, ville, langue, referer, date_scan, est_unique, id_variante)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

`ScanDoc` : ajouter `idVariante?: string | null; langue?: string;`.

> **Ne pas** ajouter de compteur dénormalisé par variante (type `nombre_scans_variante`). On agrège depuis `scans` à la lecture : une source de vérité, pas de désynchronisation. Le volume actuel (quelques milliers de lignes) le permet largement.

---

## 3. API

`GET /qrcodes/:id/routage/stats?from=&to=`

`apps/api/src/services/routing/stats.ts`

```ts
export interface VarianteStat {
  varianteId: string | null;     // null = scans sans routage (config absente/inactive)
  libelle: string;               // résolu depuis la config actuelle, sinon "Sans routage"
  scans: number;
  scansUniques: number;
  part: number;                  // 0..1
  langues: Record<string, number>;
  pays: Record<string, number>;
}

export interface RoutingStatsResult {
  periode: { from?: string; to?: string };
  totalScans: number;
  variantes: VarianteStat[];     // triées par scans décroissants
}
```

**Requête d'agrégation (une seule passe) :**

```sql
SELECT
  s.id_variante                                   AS varianteId,
  COUNT(*)                                        AS scans,
  SUM(CASE WHEN s.est_unique = 1 THEN 1 ELSE 0 END) AS scansUniques
FROM scans s
WHERE s.id_qrcode = ?
  AND s.date_scan >= ?
  AND s.date_scan <= ?
GROUP BY s.id_variante
ORDER BY scans DESC;
```

Puis une seconde requête pour `langues`/`pays` par variante (ou une seule avec `GROUP BY id_variante, langue, pays` et agrégation en JS — préférable pour limiter les allers-retours) :

```sql
SELECT id_variante AS varianteId, langue, pays, COUNT(*) AS n
FROM scans
WHERE id_qrcode = ? AND date_scan >= ? AND date_scan <= ?
GROUP BY id_variante, langue, pays;
```

**Points d'attention :**

- Les scans antérieurs à la Phase 2 ont `id_variante = NULL` → regroupés sous « Sans routage ». C'est normal, l'UI doit l'expliquer en infobulle.
- Une variante supprimée de la config mais présente dans l'historique doit **rester affichée** avec son `id` brut (et un badge « supprimée »). Ne jamais masquer des données.
- **Ne pas** réutiliser la requête existante `getQrCodeStats` qui charge **tous** les scans en mémoire : elle devient un problème de perf à mesure que le volume monte. La nouvelle route utilise `GROUP BY`.

---

## 4. Front

### Fichiers

| Fichier | Rôle |
|---|---|
| `apps/web/src/components/routing/VarianteStatsTable.tsx` | Tableau comparatif |
| `apps/web/src/components/routing/VarianteSparkline.tsx` | Courbe par variante (réutiliser le composant de `QRStatsPage`) |
| `apps/web/src/lib/routingApi.ts` | `getRoutingStats` |
| `apps/web/src/hooks/useRoutingStats.ts` | Chargement + période |

### Écran

Dans l'onglet « Routage » de `QRDetailPage`, sous le simulateur :

| Destination | Scans | Uniques | Part | Langues | Top pays |
|---|---|---|---|---|---|
| Portfolio EN | 412 | 388 | 61 % | en 98 %, fr 2 % | DE, US |
| Portfolio FR | 233 | 221 | 34 % | fr 100 % | CG, FR |
| Prise de contact | 31 | 29 | 5 % | fr 71 % | FR |
| *Sans routage* | 12 | 12 | — | — | — |

**Ce qui rend cet écran utile (et pas juste joli) :**

1. **Barre de part** visuelle par ligne (pas un camembert : illisible sur mobile).
2. **Comparaison de période** : deux sélecteurs (période A / période B) pour répondre à « la règle EN marche-t-elle mieux depuis que je l'ai ajoutée ? ».
3. **Alerte « variante morte »** : une variante active avec **0 scan sur 7 jours** alors que le QR a du trafic → suggestion (« ta règle EN ne se déclenche jamais : vérifie que tu n'as pas mis `langues: ["eng"]` au lieu de `["en"]` »). C'est ce genre de détail qui fidélise.
4. **Export CSV** : `GET /qrcodes/:id/routage/stats.csv` (mêmes filtres), pour les utilisateurs qui veulent leur tableau Excel.

### Honnêteté à préserver

Le tableau affiche **scans**, pas **conversions**. La conversion réelle n'existe qu'avec la page hôte (Phase 3) ou un paramètre de tracking (`?cfq=v_en`) que le client devra lire lui-même. **Ne jamais intituler la colonne « Conversion »** avant d'avoir une vraie donnée de conversion. Un libellé mensonger coûte plus cher qu'une feature manquante.

---

## 5. Tests

| Cas | Attendu |
|---|---|
| 3 scans EN + 1 scan FR + 2 sans variante | 3 lignes, parts 50 % / 16,7 % / 33,3 % |
| Variante supprimée de la config mais présente en base | Ligne affichée avec `libelle` = id brut |
| Aucun scan sur la période | `variantes: []`, `totalScans: 0`, HTTP 200 |
| `from` > `to` | `400` |
| QR d'un autre utilisateur | `404` |
| QR sans routage | Tous les scans sous « Sans routage », pas d'erreur |
| 10 000 scans sur la période | Réponse < 300 ms (vérifier le plan de requête, index utilisé) |

---

## Definition of Done

- [ ] Migration `003` appliquée local + remote
      *(local : oui — jouée par le setup de tests ; remote : reporté au déploiement final)*
- [x] `scans.id_variante` rempli sur les nouveaux scans (couvert par `routing-stats.test.ts` + `routing-redirect.test.ts`)
- [x] Tableau affiché et cohérent avec une requête SQL manuelle
- [x] Export CSV téléchargeable (`GET /qrcodes/:id/routage/stats.csv`)
- [x] Alertes « variante morte » testées (au moins le cas 0 scan)
- [x] Aucune colonne intitulée « conversion » sans donnée de conversion
- [x] `type-check` + tests verts (109 tests API)

### Écarts assumés par rapport au plan

| Plan | Implémentation | Raison |
|---|---|---|
| `VarianteSparkline.tsx` | Non implémenté | Le tableau + barre de part suffisent ; la courbe par variante n'apporte rien tant que le volume est faible |
| Comparaison de période A/B | Un seul sélecteur de période | Évite une UI lourde ; l'API accepte déjà `from`/`to` pour deux appels successifs |
| `libelle` = id brut si supprimée | Idem + badge « supprimée » | On ne masque jamais l'historique |
| CSV via `<a href>` | Téléchargement axios + blob | Le JWT est en `localStorage` : un lien nu renverrait 401 |

---

## Risques

| Risque | Mitigation |
|---|---|
| Volume de `scans` qui explose → agrégation lente | Index `(id_qrcode, date_scan, id_variante)` ; si > 500 k lignes, passer à une table de rollup quotidien (`stats_variantes_jour`) |
| `id_variante` renommé → historique orphelin | Interdire l'édition des `id` dans l'UI et dans la validation Zod (l'`id` est immuable une fois créé) |
| L'utilisateur confond « scans » et « conversions » | Libellés explicites + infobulle + pas de colonne conversion |
