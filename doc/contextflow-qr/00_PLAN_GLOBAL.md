# ContextFlow QR — Plan global

> Moteur de routage contextuel pour QR codes dynamiques.
> Un seul QR imprimé, plusieurs destinations choisies à l'exécution selon le contexte du scan
> (heure, jour, pays, langue, appareil, nombre de scans).

---

## 1. Positionnement

| Élément | Décision |
|---|---|
| **Cible n° 1** | **Événementiel & networking** (badges de conférence, portfolio/CV, salons type Odoo / Samedis du Numérique) |
| **Cible n° 2** (plus tard) | Restauration (menus midi/soir) — le moteur est le même, seule la presets change |
| **Différenciateur réel** | Pas « le QR change de destination » (commodité) mais **l'analytics par variante** : savoir quelle destination convertit |
| **Modèle** | Multi-routing **gratuit pour l'instant**, conçu avec une couture de monétisation (`plan`, quotas) activable plus tard |
| **Fuseau par défaut** | `Africa/Brazzaville` (configurable par QR) |
| **Compteur par appareil** | Cookie first-party + bandeau de consentement (Phase 4) |

### Le scénario vitrine (networking)

> Un QR unique imprimé sur un badge. Un recruteur allemand le scanne → portfolio en anglais.
> Un client français le scanne → portfolio en français + formulaire de contact.
> La même personne scanne 3 fois → bascule vers « Merci pour ton intérêt, réservons un appel ».
> Le propriétaire du badge voit : *EN = 47 scans / 12 contacts, FR = 31 scans / 9 contacts*.

---

## 2. Ce qu'on ne promet PAS

| Promesse marketing | Réalité technique | Décision |
|---|---|---|
| « position GPS précise au scan » | Impossible sans permission après chargement (page intermédiaire) | ❌ Pays via Cloudflare, ville best-effort. GPS = hors périmètre. |
| « 3 scans par la même personne » | Pas d'identité au scan ; IP inutilisable (CGNAT massif MTN/Airtel) | ✅ Reformulé en **« 3 scans sur le même appareil »** (cookie, Phase 4) |
| « météo en temps réel » | Latence + dépendance tierce dans le chemin critique | ✅ Météo **cachée par ville/heure** (Phase 3), jamais en direct |
| « conversion » sur site externe | On ne voit pas ce qui se passe après la redirection | ⚠️ Phase 3 : page hôte optionnelle, seule façon d'avoir une vraie conversion |

---

## 3. Architecture cible

```
GET /q/:alias
   │
   ├─ resolveQrCodeByAlias()        [existant]  → renvoie aussi `regles_routage` (0 requête en plus)
   ├─ vérifs actif / expiration     [existant]
   ├─ buildContexteScan(c)          [Phase 0]   ← request.cf, Accept-Language, UA, compteurs
   ├─ besoinConsentement ?           [Phase 4]   ← 302 /c/:alias si aucun choix mémorisé
   ├─ compteur cfq_c (cookie)        [Phase 4]   ← numéro de scan appareil, 0 requête D1
   ├─ resoudreVariante(config, ctx) [Phase 1]   ← fonction PURE, zéro I/O, 100 % testable
   ├─ waitUntil(recordScan(...))    [existant]  + id_variante (Phase 2) + id_appareil (Phase 4)
   └─ 302 → destination de la variante gagnante
         (fallback : `qrcode.contenu` si aucune config / aucune règle → comportement actuel inchangé)
```

**Invariants non négociables :**

1. **Jamais de 500 sur `/q/:alias`** à cause d'une règle. Config invalide, JSON cassé, aucune correspondance → destination par défaut.
2. **Zéro requête supplémentaire sur le chemin chaud.** La config vit dans une colonne de la ligne `qrcodes` déjà lue. Pas de KV, pas de join.
3. **Rétrocompatibilité totale.** Un QR sans `regles_routage` se comporte exactement comme aujourd'hui.
4. **Le résolveur est une fonction pure.** Aucun `fetch`, aucun `Date.now()` interne (le `maintenant` est injecté) → tests déterministes.
5. **Fuseau du QR, pas du scanner.** « Midi » = midi à Brazzaville.

---

## 4. Modèle de données

### Choix : config en JSON sur la ligne `qrcodes` (pas de tables normalisées)

```sql
ALTER TABLE qrcodes ADD COLUMN regles_routage TEXT;                          -- JSON validé par Zod
ALTER TABLE qrcodes ADD COLUMN fuseau TEXT NOT NULL DEFAULT 'Africa/Brazzaville';
```

**Pourquoi pas de tables `qr_variantes` / `qr_regles` ?**
`resolveQrCodeByAlias` lit déjà la ligne complète : embarquer la config = **0 aller-retour D1 supplémentaire** sur chaque scan.
Une config fait 1–3 Ko max ; le surcoût de payload est négligeable.
Les identifiants de variantes sont des **UUID courts stables stockés dans le JSON**, donc l'analytics (Phase 2) n'a besoin d'aucun join : `scans.id_variante TEXT`.

Si un jour le besoin de requêtes SQL sur les règles apparaît (audit, quotas globaux), on normalisera — la migration sera mécanique.

### Schéma JSON (`RoutingConfig`, version 1)

```json
{
  "version": 1,
  "actif": true,
  "fuseau": "Africa/Brazzaville",
  "defaut": "v_fr",
  "variantes": [
    { "id": "v_fr", "libelle": "Portfolio FR", "typeSortie": "url", "contenu": "https://exemple.com/fr", "poids": 1 },
    { "id": "v_en", "libelle": "Portfolio EN", "typeSortie": "url", "contenu": "https://exemple.com/en", "poids": 1 }
  ],
  "regles": [
    { "id": "r_en",  "priorite": 10, "varianteId": "v_en", "conditions": { "langues": ["en"] } },
    { "id": "r_we",  "priorite": 20, "varianteId": "v_en", "conditions": { "jours": [6, 7] } }
  ]
}
```

### Conditions supportées

| Condition | Source | Phase |
|---|---|---|
| `jours` (1=lundi … 7=dimanche) | `maintenant` dans `fuseau` | 1 |
| `heureMin` / `heureMax` (`"11:30"`) | idem, gestion du passage minuit | 1 |
| `pays` (`["CG","FR"]`) | `request.cf.country` | 1 |
| `langues` (`["en"]`) | `Accept-Language` | 1 |
| `appareil` (`["mobile","tablet","desktop"]`) | `request.cf` + UA | 1 |
| `minScansTotal` / `maxScansTotal` | `qrcodes.nombre_scans_total` | 1 |
| `dates` (`{debut, fin}` ISO) | `maintenant` | 3 |
| `villes` (`["Brazzaville"]`) | `request.cf.city` (best-effort) | 3 |
| `meteo` (`["pluie","soleil"]`) | cache par ville/heure | 3 |
| `minScansAppareil` / `maxScansAppareil` | cookie `cfq_did` | 4 |

**Sémantique :** conditions **ET** entre elles, règles évaluées par `priorite` croissante, **première qui matche gagne**, sinon `defaut`.
Condition absente = joker. Condition présente mais contexte inconnu = **ne matche pas** (on ne devine pas).

---

## 5. Découpage

| Phase | Fichier | Contenu | Effort | Statut |
|---|---|---|---|---|
| **0** | [`01_PHASE_0_SOCLE_CONTEXTE.md`](./01_PHASE_0_SOCLE_CONTEXTE.md) | `request.cf` (fin d'ipapi.co), fix bug `pays_top`, contexte de scan normalisé | ~1 j | ✅ |
| **1** | [`02_PHASE_1_MOTEUR_REGLES.md`](./02_PHASE_1_MOTEUR_REGLES.md) | Migration, résolveur pur, routes CRUD + simulateur, éditeur front | ~5–7 j | ✅ |
| **2** | [`03_PHASE_2_ANALYTICS_VARIANTES.md`](./03_PHASE_2_ANALYTICS_VARIANTES.md) | `scans.id_variante`, stats comparées, export CSV | ~2–3 j | ✅ |
| **3** | [`04_PHASE_3_DIFFERENCIATION.md`](./04_PHASE_3_DIFFERENCIATION.md) | A/B pondéré, quotas de scans, météo cachée, page hôte (conversion) | ~5–8 j | 🟡 |
| **4** | [`05_PHASE_4_APPAREIL_CONSENTEMENT.md`](./05_PHASE_4_APPAREIL_CONSENTEMENT.md) | Cookie `cfq_did`, bandeau, compteur par appareil | ~3–4 j | ✅ |
| **5** | [`06_PHASE_5_MONETISATION.md`](./06_PHASE_5_MONETISATION.md) | `plan` utilisateur, quotas, flag Pro, CTA upgrade | ~2 j | ✅ |

Chaque phase est **livrable et déployable seule**. La Phase 1 est le cœur ; les autres n'ont de sens qu'après.

---

## 6. Dette à payer avant (Phase 0)

Deux choses bloquantes, découvertes en lisant le code :

1. `apps/api/src/services/scan.ts:68-90` — `fetch` vers **ipapi.co** sur **chaque scan**, timeout 1,5 s, quota gratuit ~1 000 req/jour. Silencieusement dégradé au-delà. **Cloudflare fournit la même donnée en local, gratuitement** (`request.cf`).
2. `apps/api/src/services/scan.ts:153-157` — `statsRow?.paysTop` alors que la colonne SQL s'appelle `pays_top` → les tops sont **écrasés à chaque scan**. Ne pas construire l'analytics par variante sur ce pattern sans l'avoir corrigé.

---

## 7. KPI de succès

| Indicateur | Cible |
|---|---|
| Latence p95 `/q/:alias` | **< 60 ms** (contre ~1,5 s worst case aujourd'hui) |
| Scans sans information pays | **< 5 %** (contre > 50 % en cas de dépassement de quota ipapi.co) |
| Taux d'activation du routage parmi les QR dynamiques | > 25 % à 3 mois |
| QR avec ≥ 2 variantes | > 10 % à 3 mois |
| Part des comptes ayant consulté l'analytics par variante | > 40 % des comptes actifs |

---

## 8. Ce qu'on ne fait pas dans ce plan

- ❌ Pas de GPS / géofencing précis (nécessite permission + page intermédiaire).
- ❌ Pas de fingerprinting d'appareil (RGPD + inefficace).
- ❌ Pas de moteur de règles générique type « scripting » (Boucle infinie, coût de maintenance). Conditions fermées, validées, typées.
- ❌ Pas de paiement en ligne (Phase 5 = flag + CTA manuel).
- ❌ Pas de bulk create ici (sujet séparé, cf. discussion QRFY) — mais le JSON de routage se prête bien à une génération en masse plus tard.
