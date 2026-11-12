# ContextFlow QR — Index du plan

Routage contextuel des QR dynamiques : un seul QR imprimé, plusieurs destinations choisies à l'exécution.

## Documents

| # | Fichier | Contenu | Effort | Statut |
|---|---|---|---|---|
| 00 | [`00_PLAN_GLOBAL.md`](./00_PLAN_GLOBAL.md) | Vision, décisions actées, architecture, modèle de données, KPI | — |
| 01 | [`01_PHASE_0_SOCLE_CONTEXTE.md`](./01_PHASE_0_SOCLE_CONTEXTE.md) | `request.cf` (fin d'ipapi.co), fix `pays_top`, contexte normalisé | ~1 j | ✅ |
| 02 | [`02_PHASE_1_MOTEUR_REGLES.md`](./02_PHASE_1_MOTEUR_REGLES.md) | Migration, résolveur pur, routes, éditeur, simulateur, tests | ~5–7 j | ✅ |
| 03 | [`03_PHASE_2_ANALYTICS_VARIANTES.md`](./03_PHASE_2_ANALYTICS_VARIANTES.md) | `scans.id_variante`, stats comparées, export CSV | ~2–3 j | ✅ |
| 04 | [`04_PHASE_3_DIFFERENCIATION.md`](./04_PHASE_3_DIFFERENCIATION.md) | A/B pondéré, quotas, météo cachée, page hôte | ~5–8 j | 🟡 |
| 05 | [`05_PHASE_4_APPAREIL_CONSENTEMENT.md`](./05_PHASE_4_APPAREIL_CONSENTEMENT.md) | Cookie `cfq_did`, bandeau, compteur par appareil | ~3–4 j | ✅ |
| 06 | [`06_PHASE_5_MONETISATION.md`](./06_PHASE_5_MONETISATION.md) | `plan`, flag Pro, quotas, métriques d'adoption | ~2 j | ✅ |

## Ordre d'exécution

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 5
                │                        │
                └────────► Phase 4 ◄─────┘
```

- **0 et 1** sont obligatoires et suffisent à vendre la feature.
- **2** est la feature qui justifie l'abonnement (ne pas la sauter).
- **3** et **4** sont indépendantes entre elles (mais 4 suppose 1 + 2).
- **5** peut être faite n'importe quand après 1.

## Décisions verrouillées

| Sujet | Décision |
|---|---|
| Cible n° 1 | Événementiel / networking (badges, portfolio, CV) |
| Tarification | Gratuit pour l'instant ; couture Pro posée (`ROUTING_PRO_ONLY=false`) |
| Compteur par appareil | Cookie first-party + bandeau de consentement (opt-in) |
| Fuseau des règles | `Africa/Brazzaville` par défaut, configurable par QR |
| GPS / géofencing | Hors périmètre |
| Fingerprinting | Interdit |
| Configuration | JSON sur la ligne `qrcodes`, 0 requête supplémentaire sur le chemin chaud |

## Règles non négociables

1. **Jamais de 5xx sur `/q/:alias`** : config corrompue → fallback sur `qrcode.contenu`.
2. **Zéro requête D1 supplémentaire** sur le chemin de redirection (hors Phase 4, mesurée).
3. **Rétrocompatibilité** : un QR sans routage se comporte exactement comme avant.
4. **Résolveur pur** : `maintenant` injecté, aucun I/O, tests déterministes.
5. **Ne jamais afficher une métrique qu'on ne mesure pas** (pas de « conversion » sans page hôte).
