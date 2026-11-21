# Phase 0 — Socle contexte & dette technique

> **Statut : ✅ implémentée** (11/11/2026). Tests API : 62/62. `ipapi.co` supprimé, `pays_top` corrigé, upsert atomique en place.

**Objectif :** produire un contexte de scan fiable, gratuit et instantané, sans toucher au comportement fonctionnel des QR.
**Effort :** ~1 jour.
**Prérequis :** aucun.
**Bloque :** Phases 1 à 4.

---

## Pourquoi cette phase existe

Le moteur de routage a besoin de savoir *qui scanne, d'où, quand, dans quelle langue*.
Aujourd'hui le code ne le sait qu'à moitié, et le peu qu'il sait lui coûte cher :

| Problème | Fichier | Impact |
|---|---|---|
| `fetch` vers ipapi.co, timeout 1,5 s, **~1 000 req/jour gratuit** | `services/scan.ts:68-90` | Latence sur le redirect + géo perdue silencieusement au-delà du quota |
| `statsRow?.paysTop` lu en camelCase alors que la colonne est `pays_top` | `services/scan.ts:153-157` | `pays_top` / `appareils_top` écrasés à chaque scan |
| Aucune extraction de `Accept-Language` | `services/scan.ts:16-26` | Impossible de router par langue |
| Device déduit du User-Agent seulement au moment de la lecture des stats | `services/scan.ts:37-50` | Pas disponible pour la décision de routage |

---

## Tâche 0.1 — `request.cf` remplace ipapi.co

Sur Cloudflare Workers, chaque requête porte un objet `cf` **calculé par le edge, sans appel réseau** :

```ts
// apps/api/src/services/context.ts (nouveau)
import type { AppContext } from "../types/index.js";

type CfProps = IncomingRequestCfProperties;

export interface ContexteScan {
  maintenant: Date;
  pays?: string;          // cf.country  (ISO-3166 alpha-2, ex. "CG") — fiable
  ville?: string;         // cf.city     — best-effort (fiable EU/US, flou Afrique)
  region?: string;
  fuseauVisiteur?: string;// cf.timezone — informatif, NE PAS utiliser pour les règles
  appareil: "mobile" | "tablet" | "desktop";
  langue?: string;        // langue principale négociée depuis Accept-Language
  asn?: number;
  asOrganisation?: string;
}

export function extraireContexte(c: AppContext): ContexteScan {
  const cf = (c.req.raw as Request & { cf?: CfProps }).cf;
  const ua = c.req.header("User-Agent") ?? "";

  return {
    maintenant: new Date(),
    pays: cf?.country || undefined,
    ville: cf?.city || undefined,
    region: cf?.region || undefined,
    fuseauVisiteur: cf?.timezone || undefined,
    appareil: detecterAppareil(cf, ua),
    langue: languePreferee(c.req.header("Accept-Language")),
    asn: cf?.asn,
    asOrganisation: cf?.asOrganization,
  };
}
```

**Helpers à écrire (purs, testables) :**

```ts
export function detecterAppareil(
  cf: { uaPlatform?: string; clientAccept?: string } | undefined,
  userAgent: string,
): "mobile" | "tablet" | "desktop" {
  if (cf?.uaPlatform === "mobile") return "mobile";
  if (cf?.uaPlatform === "tablet") return "tablet";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/iphone|android|mobile/.test(ua)) return "mobile";
  return "desktop";
}

/** "fr-CG,fr;q=0.9,en;q=0.8" → "fr" */
export function languePreferee(header?: string): string | undefined {
  if (!header) return undefined;
  const premier = header.split(",")[0]?.trim();
  if (!premier) return undefined;
  return premier.split(";")[0]?.split("-")[0]?.toLowerCase();
}

/** Meilleure langue parmi celles disponibles sur le QR, sinon la première */
export function negocierLangue(header: string | undefined, disponibles: string[]): string | undefined {
  if (!header || disponibles.length === 0) return undefined;
  const preferees = header
    .split(",")
    .map((p) => {
      const [code, ...params] = p.trim().split(";");
      const q = params.find((x) => x.trim().startsWith("q="));
      return { code: code.split("-")[0].toLowerCase(), q: q ? parseFloat(q.split("=")[1]) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of preferees) if (disponibles.includes(p.code)) return p.code;
  return undefined;
}
```

> ⚠️ **Ne pas utiliser `cf.timezone` pour décider « midi ».** Un visiteur à Dubaï qui scanne un badge de Brazzaville doit voir le menu de midi de Brazzaville. Le fuseau des règles est celui du QR (Phase 1).

**Nettoyage :** supprimer `lookupGeo()` et son `fetch` (ou la conserver en `@deprecated` le temps d'un commit). Le test `scan-utils` qui mocke ipapi doit être adapté.

**Vérification :** `grep -rn "ipapi.co" apps/` doit ne plus rien retourner.

---

## Tâche 0.2 — Corriger `pays_top` / `appareils_top`

Bug actuel (`services/scan.ts:145-157`) : la requête renvoie `pays_top`, le code lit `statsRow.paysTop` → `undefined` → `{}` →écrase les tops.

**Correctif minimal (recommandé) :**

```ts
const statsRow = await d1First<StatsRow>(
  env,
  `SELECT id, pays_top AS paysTop, appareils_top AS appareilsTop
   FROM statistiques_qrcodes
   WHERE id_qrcode = ? AND date = ?`,
  qrCode.id,
  today,
);
```

**Décision d'architecture à acter :** `getQrCodeStats()` (**scan.ts:307-315**) recalcule déjà `pays` et `appareils` depuis la table `scans`, sans jamais lire les colonnes JSON. Ces colonnes sont donc **redondantes et non fiables**. Deux options :

1. **Conserver + corriger** l'aliasing (1 ligne) → pas de migration, mais on maintient un doublon.
2. **Arrêter de les écrire** et les marquer obsolètes → supprime une écriture JSON par scan (gain de latence), et l'analytics continue de fonctionner depuis `scans`.

**Recommandation : option 2 à terme, option 1 maintenant** (correctif 1 ligne immédiat, suppression des colonnes dans une migration ultérieure quand l'analytics par variante sera en place).

**Race connue :** l'upsert journalier `INSERT ... WHERE NOT EXISTS` peut échouer en concurrence sur `UNIQUE(id_qrcode, date)`. Le remplacer par un vrai upsert atomique :

```sql
INSERT INTO statistiques_qrcodes (id_qrcode, date, nombre_scans, nombre_scans_uniques)
VALUES (?, ?, 1, ?)
ON CONFLICT(id_qrcode, date) DO UPDATE SET
  nombre_scans = nombre_scans + 1,
  nombre_scans_uniques = nombre_scans_uniques + excluded.nombre_scans_uniques,
  updated_at = CURRENT_TIMESTAMP;
```

> Cela suppose que la contrainte `UNIQUE(id_qrcode, date)` existe bien dans `001_initial_schema.sql` — **à vérifier avant d'écrire cette requête**, sinon D1 renverra une erreur.

---

## Tâche 0.3 — Unifier le contexte dans `recordScan`

Au lieu de reconstruire pays/ville/device dans `recordScan`, passer le `ContexteScan` complet :

```ts
// avant
recordScan(env, qrCode, clientInfo)
// après
recordScan(env, qrCode, { ...contexte, adresseIP: ipAnonymisee, userAgent, referer, idVariante })
```

Bénéfices : une seule source de vérité, prête pour la Phase 2 (`id_variante`), et `recordScan` devient testable avec un contexte figé.

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `apps/api/src/services/context.ts` | **Créer** — extraction + helpers purs |
| `apps/api/src/services/scan.ts` | Supprimer `lookupGeo`, utiliser le contexte, corriger l'aliasing, upsert atomique |
| `apps/api/src/routes/redirect.ts` | Construire le contexte avant `recordScan` |
| `apps/api/src/types/index.ts` | `ScanDoc` : prévoir `idVariante?`, `langue?` (Phase 2) |
| `apps/api/tests/scan-utils.test.ts` | Adapter (plus de mock ipapi) |
| `apps/api/tests/context.test.ts` | **Créer** — `detecterAppareil`, `languePreferee`, `negocierLangue` |

---

## Tests à écrire

| Cas | Attendu |
|---|---|
| `Accept-Language: en-US,en;q=0.9,fr;q=0.8` | `langue = "en"` |
| `Accept-Language: fr-CG` | `langue = "fr"` |
| `Accept-Language` absent | `langue = undefined` (et non `"fr"` par défaut) |
| `cf.uaPlatform = "mobile"` | `appareil = "mobile"` même si UA desktop |
| UA iPad | `appareil = "tablet"` |
| `negocierLangue("de-DE,de;q=0.9,en;q=0.5", ["fr","en"])` | `"en"` |
| `negocierLangue(undefined, ["fr"])` | `undefined` |
| Scan d'une IP privée en dev | `pays` absent sans erreur |
| `recordScan` sur une IP déjà vue aujourd'hui | `estUnique = 0`, compteur +1 |
| Deux scans simultanés même jour | Pas d'erreur `UNIQUE constraint` |

---

## Definition of Done

- [ ] `grep -rn "ipapi.co" apps/` → vide
- [ ] `pnpm --filter @free-qr/api type-check` vert
- [ ] `pnpm test` vert (les 42 tests existants + nouveaux)
- [ ] `pnpm deploy:api:dry-run` OK
- [ ] Test manuel : scan d'un QR dynamique depuis un mobile → `scans` contient `pays` **sans** délai perceptible
- [ ] `pays_top` ne repart plus à `{}` après 3 scans

---

## Risques

| Risque | Mitigation |
|---|---|
| `request.cf` absent en dev local (`wrangler dev`) | Tous les champs sont optionnels ; en local `pays` sera `undefined`, comportement déjà géré par les règles (« condition absente = joker ») |
| Ancien cache/isolate servant l'ancien code | Redéployer l'API ; pas de cache de code côté Worker |
| `cf.city` peu fiable en Afrique centrale | Assumé et documenté ; ne jamais en faire une condition bloquante avant la Phase 3 |
