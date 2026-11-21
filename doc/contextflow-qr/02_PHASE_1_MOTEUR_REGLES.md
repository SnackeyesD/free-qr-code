# Phase 1 — Moteur de règles (MVP vendable)

**Statut : ✅ implémentée (2026-11-11)** — backend, front, tests et documentation. Seule l'application de la migration `002` en remote reste à faire au déploiement final.
**Objectif :** un QR dynamique peut router vers plusieurs destinations selon **heure/jour, pays, langue, appareil, nombre de scans**, avec un éditeur simple et un simulateur.
**Effort :** ~5–7 jours.
**Prérequis :** Phase 0 terminée.

---

## Périmètre

✅ Inclus : config JSON, validation Zod, résolveur pur, intégration `/q/:alias`, routes CRUD + simulateur, éditeur front, fallback.
❌ Exclu : analytics par variante (Phase 2), A/B pondéré & météo (Phase 3), compteur par appareil (Phase 4).

**Règle de survie :** un QR sans `regles_routage` doit continuer à rediriger vers `qrcode.contenu`, à l'octet près.

---

## 1. Migration D1

`apps/api/migrations/002_routing.sql`

```sql
-- Config de routage (JSON validé côté application)
ALTER TABLE qrcodes ADD COLUMN regles_routage TEXT;

-- Fuseau de référence des règles horaires (par QR, pas par visiteur)
ALTER TABLE qrcodes ADD COLUMN fuseau TEXT NOT NULL DEFAULT 'Africa/Brazzaville';
```

Application :

```bash
npx wrangler d1 migrations apply free-qr-api-db --remote
```

> D1 ne sait pas ajouter une colonne `NOT NULL` avec défaut sur une table non vide ? Si la migration échoue, retirer `NOT NULL` et gérer le défaut côté code (`?? 'Africa/Brazzaville'`).

---

## 2. Types partagés

`packages/shared-types/src/routing.ts` (nouveau), exporté depuis `index.ts`.

```ts
export type TypeSortie = "url";

export interface RoutingVariante {
  id: string;              // 8–12 chars, stable, généré côté serveur
  libelle: string;
  typeSortie: TypeSortie;  // Phase 1 : url uniquement
  contenu: string;
  poids?: number;          // réservé Phase 3 (A/B)
}

export interface RoutingConditions {
  jours?: number[];            // 1=lundi … 7=dimanche
  heureMin?: string;           // "11:30"
  heureMax?: string;           // "15:00" (passage minuit supporté)
  pays?: string[];             // ISO-2 majuscules : ["CG","FR"]
  langues?: string[];          // ISO-639-1 minuscules : ["fr","en"]
  appareil?: Array<"mobile" | "tablet" | "desktop">;
  minScansTotal?: number;
  maxScansTotal?: number;
}

export interface RoutingRegle {
  id: string;
  priorite: number;            // 10, 20, 30… (laisser des trous pour insérer)
  varianteId: string;
  conditions: RoutingConditions;
}

export interface RoutingConfig {
  version: 1;
  actif: boolean;
  fuseau: string;
  defaut: string;              // varianteId
  variantes: RoutingVariante[];
  regles: RoutingRegle[];
}

export interface RoutingSimulationInput {
  pays?: string;
  langue?: string;
  appareil?: "mobile" | "tablet" | "desktop";
  date?: string;               // ISO, défaut = maintenant
}

export interface RoutingSimulationResult {
  varianteId: string;
  libelle: string;
  contenu: string;
  regleId: string | null;      // null = variante par défaut
  raison: string;              // "règle r_en (langue=en)" | "défaut" | "config inactive"
  contexte: RoutingSimulationInput;
}
```

`packages/shared-types/src/qrcode.ts` : ajouter `reglesRoutage?: RoutingConfig | null; fuseau?: string;` à `QRCode` et `QRCodeInternal`.

---

## 3. Validation Zod

`apps/api/src/validators/routing.ts`

```ts
import { z } from "zod";

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

const varianteSchema = z.object({
  id: z.string().min(4).max(16),
  libelle: z.string().min(1).max(60),
  typeSortie: z.literal("url"),
  contenu: z.string().url().max(2048),
  poids: z.number().int().min(1).max(100).optional(),
});

const conditionsSchema = z
  .object({
    jours: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
    heureMin: z.string().regex(HEURE).optional(),
    heureMax: z.string().regex(HEURE).optional(),
    pays: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(50).optional(),
    langues: z.array(z.string().regex(/^[a-z]{2}$/)).min(1).max(10).optional(),
    appareil: z.array(z.enum(["mobile", "tablet", "desktop"])).min(1).optional(),
    minScansTotal: z.number().int().min(0).optional(),
    maxScansTotal: z.number().int().min(1).optional(),
  })
  .refine((c) => Object.keys(c).length > 0, "Une règle doit avoir au moins une condition")
  .refine(
    (c) => !(c.heureMin && !c.heureMax) && !(c.heureMax && !c.heureMin),
    "heureMin et heureMax vont ensemble",
  );

export const routingConfigSchema = z
  .object({
    version: z.literal(1),
    actif: z.boolean(),
    fuseau: z.string().min(1).max(64),
    defaut: z.string(),
    variantes: z.array(varianteSchema).min(1).max(20),
    regles: z.array(
      z.object({
        id: z.string().min(4).max(16),
        priorite: z.number().int().min(1).max(9999),
        varianteId: z.string(),
        conditions: conditionsSchema,
      }),
    ).max(50),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.variantes.map((v) => v.id));
    if (ids.size !== cfg.variantes.length) {
      ctx.addIssue({ code: "custom", message: "Identifiants de variantes dupliqués" });
    }
    if (!ids.has(cfg.defaut)) {
      ctx.addIssue({ code: "custom", message: "La variante par défaut est introuvable" });
    }
    for (const r of cfg.regles) {
      if (!ids.has(r.varianteId)) {
        ctx.addIssue({ code: "custom", message: `Règle ${r.id} → variante inconnue ${r.varianteId}` });
      }
    }
    const prios = cfg.regles.map((r) => r.priorite);
    if (new Set(prios).size !== prios.length) {
      ctx.addIssue({ code: "custom", message: "Priorités dupliquées (l'ordre serait ambigu)" });
    }
  });

export type RoutingConfigInput = z.infer<typeof routingConfigSchema>;
```

> **Pourquoi interdire les priorités dupliquées ?** L'ordre d'évaluation doit être **déterministe**. Deux règles à `priorite: 10` = bug de conception, pas un cas limite.

---

## 4. Le résolveur (cœur du produit)

`apps/api/src/services/routing/resolve.ts` — **fonction pure, zéro I/O, zéro `new Date()` interne**.

```ts
import type { RoutingConfig, RoutingVariante } from "@free-qr/shared-types";
import type { ContexteScan } from "../context.js";

export interface Resolution {
  variante: RoutingVariante;
  regleId: string | null;
  raison: string;
}

/** Renvoie le jour (1-7) et les minutes depuis minuit, dans le fuseau demandé. */
export function heureLocale(date: Date, fuseau: string): { jour: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuseau,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const jours: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const jour = jours[parts.weekday ?? "Mon"] ?? 1;
  const minutes = parseInt(parts.hour ?? "0", 10) * 60 + parseInt(parts.minute ?? "0", 10);
  return { jour, minutes };
}

function dansPlage(minutes: number, min: string, max: string): boolean {
  const toMin = (h: string) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(3, 5), 10);
  const a = toMin(min);
  const b = toMin(max);
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b; // passage minuit
}

export function resoudreVariante(cfg: RoutingConfig | null | undefined, ctx: ContexteScan): Resolution {
  // Aucune config → l'appelant retombe sur qrcode.contenu
  if (!cfg || !cfg.actif) {
    return { variante: null as never, regleId: null, raison: "config absente ou inactive" };
  }

  const defaut = cfg.variantes.find((v) => v.id === cfg.defaut);
  if (!defaut) {
    return { variante: null as never, regleId: null, raison: "variante par défaut introuvable" };
  }

  const { jour, minutes } = heureLocale(ctx.maintenant, cfg.fuseau);
  const regles = [...cfg.regles].sort((a, b) => a.priorite - b.priorite);

  for (const regle of regles) {
    const c = regle.conditions;
    if (c.jours && !c.jours.includes(jour)) continue;
    if (c.heureMin && c.heureMax && !dansPlage(minutes, c.heureMin, c.heureMax)) continue;
    if (c.pays && (!ctx.pays || !c.pays.includes(ctx.pays))) continue;
    if (c.langues && (!ctx.langue || !c.langues.includes(ctx.langue))) continue;
    if (c.appareil && !c.appareil.includes(ctx.appareil)) continue;
    if (c.minScansTotal !== undefined && ctx.scansTotal < c.minScansTotal) continue;
    if (c.maxScansTotal !== undefined && ctx.scansTotal >= c.maxScansTotal) continue;

    const variante = cfg.variantes.find((v) => v.id === regle.varianteId);
    if (!variante) continue; // config incohérente → on ignore la règle, jamais d'exception

    return { variante, regleId: regle.id, raison: `règle ${regle.id}` };
  }

  return { variante: defaut, regleId: null, raison: "défaut" };
}
```

`ContexteScan` doit gagner `scansTotal: number` (Phase 1) — alimenté par `qrCode.nombreScansTotal`.

> **Priorité des conditions vs ordre des règles :** on évalue dans l'ordre de `priorite`. Le cas d'usage networking typique :
> `10 : langues:["en"]` (le plus spécifique) → `20 : pays:["FR","BE","CH"]` → `30 : jours:[6,7]` → défaut.
> L'UI doit afficher cet ordre visuellement (drag & drop ou champ numérique).

---

## 5. Intégration dans `/q/:alias`

`apps/api/src/routes/redirect.ts`

```ts
import { resoudreVariante } from "../services/routing/resolve.js";
import { extraireContexte } from "../services/context.js";

redirectRoutes.get("/:aliasCourt", async (c) => {
  const qrCode = await resolveQrCodeByAlias(c.env, c.req.param("aliasCourt"));

  if (!qrCode) throw new HTTPException(404, { message: "QR code not found" });
  if (!qrCode.estActif) throw new HTTPException(404, { message: "QR code inactive" });
  if (qrCode.dateExpiration && new Date(qrCode.dateExpiration) < new Date()) {
    throw new HTTPException(410, { message: "QR code expired" });
  }

  const contexte = extraireContexte(c, qrCode.nombreScansTotal);

  // Fallback dur : toute anomalie de config → contenu d'origine
  let destination = qrCode.contenu;
  let idVariante: string | null = null;
  try {
    const resolution = resoudreVariante(qrCode.reglesRoutage, contexte);
    if (resolution.variante) {
      destination = resolution.variante.contenu;
      idVariante = resolution.variante.id;
    }
  } catch (err) {
    console.error("Routage: échec de résolution, fallback contenu par défaut", err);
  }

  c.executionCtx.waitUntil(recordScan(c.env, qrCode, { ...contexte, idVariante }));

  return c.redirect(destination, 302);
});
```

`resolveQrCodeByAlias` : ajouter `regles_routage AS reglesRoutage, fuseau` au `SELECT` et désérialiser avec un `safeParse` (une config corrompue → `null`, jamais une exception).

```ts
function parseRouting(raw: unknown): RoutingConfig | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return routingConfigSchema.safeParse(parsed).success ? parsed : null;
  } catch {
    return null;
  }
}
```

> ⚠️ **Ne pas valider avec Zod sur chaque scan** : c'est trop coûteux. On valide **à l'écriture** (routes), et à la lecture on se contente d'un `JSON.parse` + accès défensifs (le résolveur ne jette jamais). `parseRouting` avec `safeParse` est acceptable en fréquence faible mais pas sur le chemin chaud : préférer `JSON.parse` seul + `try/catch`.

---

## 6. Routes API

`apps/api/src/routes/routing.ts` (nouveau), monté dans `index.ts` :

```ts
app.route("/qrcodes", routingRoutes); // GET/PUT /qrcodes/:id/routage, POST .../simuler
```

| Route | Méthode | Permission | Description |
|---|---|---|---|
| `/qrcodes/:id/routage` | `GET` | `qrcodes:read` | Config actuelle (ou `null`) |
| `/qrcodes/:id/routage` | `PUT` | `qrcodes:update` | Remplace la config (validation Zod complète) |
| `/qrcodes/:id/routage` | `DELETE` | `qrcodes:update` | Désactive le routage (`regles_routage = NULL`) |
| `/qrcodes/:id/routage/simuler` | `POST` | `qrcodes:read` | Évalue une config avec un contexte simulé |

**Règles métier à appliquer côté service :**

1. **Routage réservé aux QR dynamiques.** `est_dynamique = 0` → `400 { error: "Le routage nécessite un QR dynamique" }`.
2. **Au moins 2 variantes** pour activer (`actif: true` avec 1 variante = config inutile → `400`). Une seule variante est autorisée en `actif: false` (brouillon).
3. **Toute écriture invalide le cache front** (React Query / état local) et met à jour `updated_at` du QR.
4. **Isolation multi-tenant** : toutes les requêtes passent par `id_utilisateur = ?` (même pattern que `services/qrcode.ts`), sinon fuite de config entre comptes.
5. **`contenu` du QR n'est pas modifié** par le routage : il reste le fallback et ce que renvoie `GET /qrcodes/:id`.

**Simulateur** (même logique que le runtime, sans accès réseau) :

```ts
// POST /qrcodes/:id/routage/simuler
// body: { config?: RoutingConfig, contexte: RoutingSimulationInput }
// → { ...resultat, trace: [{ regleId, match: false, motif: "langue=fr ≠ en" }] }
```

La `trace` n'est pas obligatoire pour le MVP mais **c'est elle qui rend l'UI compréhensible** (« pourquoi ma règle ne marche pas ? »). Prévoir la structure dès maintenant, même si l'UI ne l'affiche qu'à partir de la Phase 2.

---

## 7. Front

### Fichiers

| Fichier | Rôle |
|---|---|
| `apps/web/src/lib/routingApi.ts` | `getRouting`, `saveRouting`, `deleteRouting`, `simulateRouting` |
| `apps/web/src/hooks/useRouting.ts` | État + mutations |
| `apps/web/src/components/routing/RoutingEditor.tsx` | Conteneur (variantes + règles + défaut) |
| `apps/web/src/components/routing/VarianteList.tsx` | CRUD variantes |
| `apps/web/src/components/routing/RegleList.tsx` | Liste ordonnée, drag & drop, activation |
| `apps/web/src/components/routing/ConditionFields.tsx` | Champs par type de condition (pays multi-select, langues, jours, plage horaire, appareil, seuils) |
| `apps/web/src/components/routing/RoutingSimulator.tsx` | Contexte simulé + résultat + trace |
| `apps/web/src/pages/QRRoutingPage.tsx` | Page `/dashboard/qrcodes/:id/routage` |

### UX (contrainte : utilisable sur mobile, 3 minutes)

1. **Onglet « Routage »** dans `QRDetailPage` (à côté de Détails / Stats).
2. **Bloc 1 — Destinations** : liste de variantes (libellé + URL). La première créée devient `defaut`.
3. **Bloc 2 — Règles** : cartes ordonnées, texte lisible généré automatiquement :
   > *« Si la langue est **anglais** → **Portfolio EN** »*
   > *« Si le pays est **Congo, France** → **Portfolio FR** »*
   > Puis : *« Sinon → **Portfolio FR** (défaut) »*
4. **Bloc 3 — Simulateur** : sélecteurs (pays, langue, appareil, date/heure) + bouton « Tester » → affiche la destination gagnante et la règle responsable.
5. **Bandeau d'avertissement** si routage actif alors que le QR a moins de 2 variantes, ou si une variante n'est utilisée par aucune règle et n'est pas le défaut.

### Presets (gain énorme en UX pour la cible networking)

Bouton « Modèle : Badge networking » qui pré-remplit :

```json
{
  "defaut": "v_fr",
  "variantes": [
    { "id": "v_fr", "libelle": "Profil FR", "contenu": "https://…/fr" },
    { "id": "v_en", "libelle": "Profil EN", "contenu": "https://…/en" },
    { "id": "v_call", "libelle": "Prise de contact", "contenu": "https://…/contact" }
  ],
  "regles": [
    { "id": "r_en", "priorite": 10, "varianteId": "v_en", "conditions": { "langues": ["en"] } }
  ]
}
```

(Ce preset n'inclut pas la règle « après 3 scans » — elle arrive en Phase 4, avec le consentement.)

---

## 8. Tests

`apps/api/tests/routing-resolve.test.ts` — **le plus important du projet**. Cas :

| Cas | Attendu |
|---|---|
| `cfg = null` | `variante = null` (l'appelant fallback) |
| `actif = false` | `null` |
| `defaut` pointe sur un id inexistant | `null`, pas d'exception |
| Aucune règle ne matche | variante `defaut` |
| Langue `en` + règle `langues:["en"]` | cette variante |
| Langue `undefined` + règle langue | **ne matche pas** → défaut |
| Deux règles matchent | la **priorité la plus basse** gagne |
| `heureMin: "11:30", heureMax: "15:00"` à 12:00 | match |
| à 15:00 pile | **pas** de match (`<` max, choix documenté) |
| Plage `22:00 → 02:00`, à 23:30 | match (passage minuit) |
| Plage `22:00 → 02:00`, à 01:30 | match |
| Plage `22:00 → 02:00`, à 03:00 | pas de match |
| Fuseau `Africa/Brazzaville` vs `Europe/Paris` à la même date | jour/heure différents (test avec date fixe) |
| `jours:[6,7]` un mercredi | pas de match |
| `pays:["CG"]` avec `ctx.pays="FR"` | pas de match |
| `minScansTotal: 10` avec 9 scans | pas de match |
| `maxScansTotal: 10` avec 10 scans | pas de match (borne exclusive) |
| Règle pointant une variante supprimée | règle ignorée, on continue |
| `priorite` en désordre dans le JSON | évaluation quand même ordonnée |
| `maintenant` injecté à 2 dates identiques | résultat **strictement identique** (déterminisme) |

`apps/api/tests/routing-api.test.ts` :

- `GET` sans config → `{ reglesRoutage: null }`
- `PUT` config invalide (URL cassée, priorité dupliquée, défaut inconnu) → `400` avec message précis
- `PUT` sur QR statique → `400`
- `PUT` sur le QR d'un autre utilisateur → `404`
- `PUT` valide → `200`, puis `GET /q/:alias` redirige vers la bonne destination
- `DELETE` → retour au contenu d'origine
- `POST /simuler` avec `langue: "en"` → variante EN
- `POST /simuler` avec `date` fixe en fuseau Brazzaville → cohérent avec le runtime

`apps/api/tests/routing-redirect.test.ts` (intégration) :

- QR dynamique + config → `/q/:alias` renvoie `302` vers la variante attendue
- Config JSON corrompue en base (`"{oops"`) → `302` vers `qrcode.contenu`, **pas de 500**
- `actif: true` mais `variantes: []` (base trafiquée) → `302` vers `contenu`

---

## 9. Documentation à mettre à jour

- `merise/11_API_OPENAPI.yaml` : 4 routes + schémas `RoutingConfig`.
- `README.md` : section « Routage contextuel » + nouvelles colonnes.
- `merise/03_MPD.md` : colonnes `regles_routage`, `fuseau`.

---

## Definition of Done

- [ ] Migration `002` appliquée en local **et** en remote
      *(local : oui — jouée par le setup de tests ; remote : reporté au déploiement final)*
- [x] `type-check` vert (api + web + shared-types)
- [x] Tous les tests du résolveur passent, y compris fuseaux et passage minuit (22 cas, 101 tests API au total)
- [x] `/q/:alias` sur QR sans config : comportement **strictement identique** à avant
- [x] Config corrompue → fallback, 0 erreur 5xx
- [x] Éditeur utilisable sur écran 375 px de large (grilles `sm:` + boutons `flex-wrap`)
- [x] Simulateur cohérent avec le runtime (même fonction de résolution, 5 scénarios couverts)
- [x] `deploy --dry-run` OK
- [ ] p95 `/q/:alias` mesuré **< 60 ms** *(à mesurer après déploiement)*

### Écarts assumés par rapport au plan

| Plan | Implémentation | Raison |
|---|---|---|
| `VarianteList.tsx` + `RegleList.tsx` séparés | Un seul `RoutingEditor.tsx` | ~200 lignes chacun, découpage artificiel à ce stade |
| Drag & drop des règles | Champ `priorite` numérique | Les priorités sont validées uniques ; le tri visuel suffit |
| `trace` affichée en Phase 2 | Affichée dès la Phase 1 | C'est elle qui rend le simulateur compréhensible |
| `parseRouting` par `safeParse` | `parseConfigRoutage` tolérant (sans Zod) | Zod sur le chemin chaud = CPU inutile ; validation stricte à l'écriture |
| `z.string().url()` pour les destinations | `+ refine(/^https?:\/\//)` | `.url()` accepte `javascript:alert(1)` (bug trouvé par les tests) |
| Fuseau invalide → fuseau de la machine | Fuseau invalide → **UTC explicite** | Ne jamais dépendre du fuseau local |

---

## Risques

| Risque | Mitigation |
|---|---|
| `Intl` / `formatToParts` indisponible ou fuseau mal supporté | Vérifier sur `wrangler dev` **et** en prod dès le premier déploiement ; fallback : offset fixe stocké par QR |
| Config trop grosse (> 100 Ko) | Limite Zod à 20 variantes / 50 règles / URLs 2 048 chars |
| L'utilisateur ne comprend pas la priorité des règles | Presets + texte généré + simulateur obligatoire dans l'UI |
| Régression sur les QR sans routage | Test d'intégration dédié + déploiement en 2 temps (code déployé, puis feature annoncée) |
