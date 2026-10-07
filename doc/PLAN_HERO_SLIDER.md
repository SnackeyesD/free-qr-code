# Plan — Hero slider : previews QR réelles + scène SVG animée

Décision : **option A** (carousel de vraies previews `/preview/qr`) avec une
**scène SVG animée signature intercalée entre les deux previews** (slide 2).
Commande utilisateur : slider qui change toutes les ~10s, SVG animé « digne de
ce nom » et fidèle à l'application.

Périmètre : hero de la landing uniquement. Aucune dépendance ajoutée. Aucun
changement backend (l'endpoint `GET /preview/qr` existant suffit, cf.
`PLAN_PREVIEW_QR.md`).

Références : `doc/AUDIT_ANIMATIONS_LANDING.md` (règles motion),
`doc/PLAN_LANDING_MOTION.md` (P0–P3 déjà livrés), skills `claude-design`
(motion = discipline, anti-slop) et `popular-web-designs` (Framer/Stripe :
« product IS the marketing »).

---

## 1. Concept créatif

Le slider raconte le produit en 3 scènes, 10s chacune, boucle infinie :

| # | Slide | Type | Message produit |
|---|---|---|---|
| 1 | **Menu du restaurant** | QR réel (API) | Le produit réel, QR dynamique, tel qu'imprimé |
| 2 | **Le cycle de vie d'un QR** | **SVG animé signature** | Création → scan → mesure → modification. L'USP en mouvement |
| 3 | **Wi-Fi invités** | QR réel (API, indigo) | QR statique, personnalisation couleur, sans compte |

L'ordre n'est pas un hasard : scène 1 = ce que le client obtient, scène 2 =
pourquoi c'est fort (la démo animée), scène 3 = la largeur des cas d'usage.
La scène SVG absorbe le crossfade de destination actuel de `DemoQrCard`
(qui disparaît en tant que composant — voir §7).

## 2. Faisabilité technique vérifiée (fait, pas supposé)

- Extraction de la vraie matrice QR **déjà testée** avec la lib du repo
  (`qrcode@1.5.4`, CJS) depuis `apps/api` :
  `QRCode.create('https://app.free-qrcode.app', { errorCorrectionLevel: 'M' })`
  → matrice **29×29** (version 3), **429 modules sombres** / 841.
- Stratégie de rendu retenue : **pas 429 rects animés individuellement**,
  mais un `<path>` par **bande diagonale** (x+y = constante → 57 bandes),
  chaque bande animée en cascade. ~70 nœuds SVG au total : budget DOM
  négligeable, animation GPU-friendly.
- Le QR de la scène est **réellement scannable** (vraie matrice + quiet zone) :
  c'est du produit, pas une illustration fake (règle anti-slop respectée).

## 3. Spec des slides

### 3.1 Slide 1 — « Menu du restaurant » (QR réel, dynamique)

Reprend exactement le contenu actuel de `DemoQrCard` :

- Badge : `Dynamique` avec dot live `animate-ping` (déjà livré en P3, déplacé tel quel)
- Visuel : `${API_BASE}/preview/qr?content=${encodeURIComponent('https://app.free-qrcode.app')}&couleur=%23111827&background=%23ffffff&size=320&correction=M`
- Scan beam `motion-safe:animate-scan` conservé (déjà livré)
- Chips : `Alias court modifiable` · `Stats de scans` · `PNG · SVG · PDF`
- Fallback `onError` conservé (message hors-connexion)

### 3.2 Slide 3 — « Wi-Fi invités » (QR réel, statique, couleur brand)

- Badge : `Statique` (gris neutre : `bg-gray-100 text-gray-700 ring-gray-600/20`,
  pas de dot — un statique n'est pas « live », cohérence honnête)
- Visuel : `${API_BASE}/preview/qr?content=${encodeURIComponent('WIFI:T:WPA;S:CafeMalongo;P:motdepasse-24-caracteres;;')}&couleur=%234f46e5&background=%23ffffff&size=320&correction=M`
  → QR **indigo-600** : démontre la personnalisation couleur sans un mot de copy
- Chips : `Sans compte` · `Gravé dans le QR` · `SVG net à toute taille`
- Pas de beam (un statique n'a pas de suivi — le beam reste la marque du dynamique)
- Même fallback `onError`

### 3.3 Slide 2 — Scène SVG « Le cycle de vie d'un QR » (pièce maîtresse)

Spec complète en §4. Encadrement identique aux autres slides (même carte,
même header avec titre « Créé. Scanné. Modifié. » + badge `Démo` indigo),
pour que seul le visuel change pendant la transition.

## 4. Spec détaillée de la scène SVG animée

### 4.1 Données : matrice réelle

- Fichier généré (commité) : `apps/web/src/components/qr-matrix.ts`
- Génération one-shot depuis `apps/api` :

```bash
cd apps/api && node -e "
const QR = require('qrcode');
const q = QR.create('https://app.free-qrcode.app', { errorCorrectionLevel: 'M' });
const rows = [];
for (let y = 0; y < q.modules.size; y++) {
  let r = '';
  for (let x = 0; x < q.modules.size; x++) r += q.modules.get(x, y) ? '1' : '0';
  rows.push(r);
}
console.log('export const QR_MATRIX_ROWS = ' + JSON.stringify(rows, null, 2) + ';');
" > ../web/src/components/qr-matrix.ts
```

- Header commentaire dans le fichier généré : commande de régénération +
  contenu encodé + date.
- Format : `QR_MATRIX_ROWS: string[]` (29 lignes de 29 caractères `0`/`1`).
  Léger (~900 octets), lisible, diff-able.

### 4.2 Géométrie

- `viewBox="0 0 320 320"` (même aspect que les `<img>` des autres slides :
  transition de slide sans saut de dimensions)
- Quiet zone : 4 modules de chaque côté (comme le SVG réel de l'API, F1)
- `module = 320 / (29 + 8) ≈ 8.649px` — calculé en JS (`const M = 320 / 37`),
  jamais en dur
- Modules sombres : `fill="#111827"` (gray-900, identique à la slide 1)

### 4.3 Structure DOM (ordre de peinture = ordre dans le SVG)

```
<svg viewBox="0 0 320 320" role="img" aria-label="Démonstration animée : un QR code se construit, est scanné, puis sa destination change">
  <defs>
    <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6366f1" stop-opacity="0" />
      <stop offset="0.5" stop-color="#6366f1" stop-opacity="0.25" />
      <stop offset="1" stop-color="#6366f1" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="320" height="320" fill="#ffffff" />            <!-- fond -->

  <g fill="#111827">
    <path d="…" class="qr-finder" style="animation-delay:0ms" />     <!-- 3 finders -->
    <path d="…" class="qr-finder" style="animation-delay:100ms" />
    <path d="…" class="qr-finder" style="animation-delay:200ms" />
    <path class="qr-band" style="animation-delay:…" d="…" />  <!-- × 57 bandes -->
  </g>

  <rect class="qr-beam" x="0" width="320" height="107" fill="url(#beamGrad)" />

  <g>                                                          <!-- compteur -->
    <rect x="196" y="12" rx="12" width="112" height="24" fill="#ecfdf5" stroke="#a7f3d0" />
    <circle cx="208" cy="24" r="3" fill="#10b981" />
    <text x="216" y="28" font-size="12" fill="#047857">1 247 scans</text>
  </g>

  <g>                                                          <!-- destination -->
    <text x="160" y="306" text-anchor="middle" font-size="12" fill="#9ca3af">Destination :</text>
    <text x="160" y="306" text-anchor="middle" font-size="12" fill="#4b5563">…</text>
  </g>
</svg>
```

Notes de construction :
- **Finders exclus des bandes** : les 3 carrés 7×7 aux coins sont calculés hors
  du groupage diagonal et rendus comme 3 `<path>` pleins (inner white + inner
  dark calculés depuis la matrice, pas dessinés à la main) — ils apparaissent
  en premier, comme un vrai lecteur les voit en premier.
- **Bandes** : pour chaque module sombre hors finder, groupé par `k = x + y`
  (0 → 56). Un `<path>` par bande : `d` = concaténation de
  `M{x*M} {y*M}h{M}v{M}h{-M}z` par module (même forme que le générateur de
  l'API — cohérence de rendu).
- Calcul des bandes : `useMemo` (ou module-level, 29×29 = trivial) depuis
  `QR_MATRIX_ROWS`.
- Le **compteur** et la **destination** sont du `<text>` SVG (pas d'overlay
  HTML) : tout vit dans le même repère, transition de slide propre.
  `fontFamily: inherit` + `fontVariantNumeric: 'tabular-nums'` pour le compteur.

### 4.4 Storyboard (timeline 10s, synchronisée avec la durée du slide)

| Phase | Timing | Élément | Animation | Message |
|---|---|---|---|---|
| 1. Naissance | 0.0–0.3s | 3 finders | pop `scale 0.4→1`, opacity 0→1, stagger 100ms | « ça commence » |
| 2. Assemblage | 0.3–2.0s | 57 bandes | même pop, `delay = 300ms + k×25ms` | le QR se construit sous les yeux |
| 3. Settle | 2.0–2.4s | groupe QR | `scale 1.015→1` (transform-box: fill-box) | « c'est prêt » |
| 4. Scan | 2.6–4.2s | beam | traverse `translateY(-112px → 432px)`, ease-in-out | « il se fait scanner » |
| 5. Mesure | 4.4–6.4s | compteur | pill fade-in, puis 1 247 → 1 252 : 5 ticks de 400ms, micro-pop (`scale 1→1.12→1` à chaque tick) | « chaque scan est mesuré » |
| 6. Modification | 6.6–8.6s | destination | `menu-ete.pdf` fade-out 500ms / `menu-hiver.pdf` fade-in 500ms, QR **immobile** | l'USP : destination changée, QR inchangé |
| 7. Hold | 8.6–10s | tout | statique | respiration avant transition |

Le QR reste **parfaitement immobile** pendant les phases 4-6 : c'est lui le
héros, le monde bouge autour.

### 4.5 Keyframes & easings exacts

Ajouts à `tailwind.config.js` (keyframes dédiés, valeurs px déterministes —
pas de `%` sur les transforms SVG, ambigu selon la reference box) :

```js
'qr-pop': {
  from: { opacity: '0', transform: 'scale(0.4)' },
  to: { opacity: '1', transform: 'scale(1)' },
},
'qr-scan': {   // beam de 107px (320/3) : -112px = hors haut, 432px = hors bas
  from: { transform: 'translateY(-112px)' },
  to: { transform: 'translateY(432px)' },
},
```
```js
'qr-pop': 'qr-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',  // léger overshoot
'qr-scan-once': 'qr-scan 1.6s ease-in-out 2.6s both',            // delay 2.6s intégré
```

CSS custom minimal dans `index.css` (`@layer utilities`) — Tailwind ne couvre
pas `transform-box` :

```css
.qr-finder, .qr-band {
  transform-box: fill-box;
  transform-origin: center;
}
.qr-finder, .qr-band { @apply motion-safe:animate-qr-pop; }
.qr-beam { @apply motion-safe:animate-scan-once; }
```

- Compteur : ticks pilotés en JS (`setTimeout` initial 4.4s puis
  `setInterval` 400ms × 5), `<text>` re-rendu à chaque tick ; le micro-pop via
  une classe togglée. Cleanup complet à l'unmount.
- Reduced-motion : la scène affiche **l'état final** (QR assemblé, compteur à
  1 252, destination `menu-hiver.pdf`), zéro animation — toutes les animations
  sont `motion-safe:` et le JS du compteur a sa garde `matchMedia`.

### 4.6 Rejouabilité (détail critique)

La scène doit **rejouer à chaque passage de la slide 2**. Mécanique :
`QrLifeCycleScene` reçoit un `activationKey` (compteur incrémenté par le shell
à chaque activation de la slide 2) utilisé comme `key` React → remount → les
animations CSS repartent de 0 et le compteur se réinitialise. Sans ça, la
seconde visite de la slide montre une scène figée en état final.

## 5. Mécanique du slider (shell `HeroShowcase`)

### 5.1 État et autoplay

```ts
const [active, setActive] = useState(0);            // 0..2
const [paused, setPaused] = useState(false);
useEffect(() => {
  if (paused) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const id = setInterval(() => setActive((a) => (a + 1) % 3), 10000);
  return () => clearInterval(id);
}, [paused]);
```

- Pause au **hover** (`onMouseEnter/Leave`) et au **focus-within**
  (`onFocus/onBlur` avec vérification `relatedTarget`) : un utilisateur qui
  interagit ne se fait jamais voler la slide.
- Reduced-motion : pas d'autoplay, slide 1 affichée, navigation manuelle par
  dots toujours disponible.

### 5.2 Rendu et transitions

- Les **deux slides `<img>` restent montées en permanence** (empilées en
  `absolute inset-0`, toggle `opacity` + `pointer-events-none`) : pas de
  re-téléchargement, pas de flash, et l'API sert déjà avec `Cache-Control: 1h`.
- La **slide SVG** n'est montée que lorsqu'elle est active ou en transition
  (500ms) — remount à chaque activation (§4.6).
- Conteneur du visuel : `relative aspect-square` (les 3 visuels sont carrés,
  hauteur stable garantie, zéro layout shift entre slides).
- Transition : crossfade `opacity` 500ms `ease-out`. Pas de slide horizontal :
  img et SVG mélangés glissent mal, le crossfade est plus noble.
- Header (titre + badge) et chips **crossfadent avec la slide** (mêmes classes
  de transition), dans des blocs à hauteur fixe (`h-5` / hauteur de chips
  constante) pour éviter tout reflow.

### 5.3 Dots de navigation

- 3 boutons sous la carte : `aria-label="Slide 1 : Menu du restaurant"` etc.,
  `aria-current={i === active}`.
- Visuel : `h-1.5 rounded-full`, actif = `w-6 bg-indigo-600`, inactif =
  `w-1.5 bg-gray-300 hover:bg-gray-400`, `transition-all` (le dot actif
  s'allonge — pattern discret, pas de barre de progression qui stresse).
- Clic : `setActive(i)` + reset du timer (l'interval est recréé via le state).

### 5.4 Accessibilité carousel

- Conteneur : `role="region"` `aria-roledescription="carousel"`
  `aria-label="Démonstration du produit"`.
- Chaque slide : `role="group"` `aria-roledescription="slide"`
  `aria-label="1 sur 3 : …"`, `aria-hidden={i !== active}`.
- **Pas de `aria-live`** : un carousel en autoplay qui annonce chaque
  changement spamme les lecteurs d'écran. Les dots suffisent.

## 6. Architecture des fichiers

| Fichier | Contenu |
|---|---|
| `apps/web/src/components/HeroShowcase.tsx` | Shell slider : état, autoplay, pause, dots, transitions |
| `apps/web/src/components/QrPreviewSlide.tsx` | Slide QR réel (props : title, badge, src, chips, beam?) |
| `apps/web/src/components/QrLifeCycleScene.tsx` | La scène SVG animée (§4) |
| `apps/web/src/components/qr-matrix.ts` | Matrice générée (§4.1), header avec commande de régénération |
| `apps/web/src/pages/LandingPage.tsx` | `DemoQrCard` + `DEMO_QR` + `DEMO_DESTINATIONS` **supprimés**, remplacés par `<HeroShowcase />` dans la colonne hero (l'import `useEffect` part avec) |
| `apps/web/tailwind.config.js` | keyframes `qr-pop`, `qr-scan` + animations associées |
| `apps/web/src/index.css` | utilities `qr-finder`/`qr-band`/`qr-beam` (transform-box) |

`DemoQrCard` a vécu : sa logique se répartit entre `QrPreviewSlide` (slide 1)
et la scène SVG (destination crossfade → phase 6). Ne pas garder l'ancien
composant « au cas où » — git s'en souvient.

## 7. Règles non négociables (rappel, inchangées)

1. `transform`/`opacity` uniquement — la seule exception est le grid-rows de la
   FAQ, déjà arbitré. Le beam SVG utilise des px déterministes, pas des `%`.
2. Tout est `motion-safe:` côté CSS + garde `matchMedia` côté JS (autoplay,
   compteur).
3. **LCP inchangé** : la slide 1 (`<img>` QR) est montée au premier rendu,
   sans animation d'entrée, visible immédiatement. Le slider démarre son
   premier cycle 10s après mount.
4. Budget DOM de la scène : ~70 nœuds SVG (3 finders + 57 bandes + beam +
   compteur + destination). Si la recette montre un drop de frames sur mobile
   bas de gamme → repli : fusionner les bandes par paquets de 3 (19 bandes).

## 8. Risques et replis

- **Transforms SVG en %** : ambigus → keyframes en px calculés pour 320×320
  (§4.5). Si le viewBox change un jour, les keyframes suivent le px — documenté
  dans le commentaire du config.
- **transform-box: fill-box** : support excellent (tous navigateurs modernes) ;
  sans lui, le pop scalerait depuis le centre du SVG entier. Fallback gracieux :
  l'opacity seule reste si non supporté.
- **Rejouabilité** : risque de scène figée au 2e passage → `activationKey`
  (§4.6), à vérifier en recette (cycle complet de 30s).
- **API down** : slides 1/3 en fallback texte (existant), la slide 2 SVG n'a
  **aucune dépendance réseau** → elle devient la slide la plus robuste du hero.
- **Sync storyboard/slide** : la scène dure 10s comme le slide ; si on change
  la durée du slide un jour, adapter les delays — documenter la constante
  `SLIDE_DURATION = 10000` à un seul endroit (props du shell).
- **Compteur fake ?** Non : 1 247 est un chiffre de démo affiché dans une
  scène explicitement labellisée « Démo » (badge slide 2) — pas une métrique
  affichée comme réelle ailleurs sur la page.

## 9. Ordre d'exécution et critères DONE

1. Générer `qr-matrix.ts` (§4.1) → le fichier contient 29 lignes de 29 chars.
2. `tailwind.config.js` + `index.css` (§4.5) → build vert, keyframes dans le CSS.
3. `QrLifeCycleScene.tsx` (phases 1-3 d'abord : assemblage) → vérif visuelle
   isolée sur une route temporaire ou dans le hero directement.
4. Phases 4-6 (beam, compteur, destination) → scène complète en 10s.
5. `QrPreviewSlide.tsx` + `HeroShowcase.tsx` → slider complet.
6. Intégration `LandingPage.tsx` (suppression `DemoQrCard`) →
   `type-check` + `eslint` + `build` verts.
7. Recette manuelle :
   - cycle complet 30s × 2 (rejouabilité de la scène au 2e passage)
   - pause au hover et au focus clavier sur les dots
   - navigation dots + reset du timer
   - reduced-motion émulé : slide 1 fixe, scène en état final, dots manuels OK
   - 375px : pas de débordement, chips wraps propres
   - API coupée : fallbacks slides 1/3, scène SVG intacte
   - Lighthouse : LCP toujours porté par l'`<img>` slide 1
8. Mise à jour du §10 ci-dessous.

## 10. Suivi d'exécution

- `qr-matrix.ts` généré (29 lignes × 29 chars, commande de régénération en header).
- `tailwind.config.js` : inchangé pour la scène — ne contient que `fade-up` et
  `scan` (utilisés en `motion-safe:animate-*` dans le contenu).
- `index.css` : utilities `qr-finder`/`qr-band`/`qr-pop`/`qr-settle`/`qr-beam`.
  Écueil rencontré : `@apply` refuse les variantes (`motion-safe:`) ET l'@apply
  d'utilities custom passe au build mais casse en dev (vite garde la config
  Tailwind en cache) → **keyframes `qr-pop`/`qr-scan`/`qr-settle` écrites en CSS
  pur dans index.css**, hors de la config Tailwind (qui ne garde que `fade-up`
  et `scan`, utilisées comme classes `motion-safe:animate-*` dans le contenu).
  Fix vérifié sur un serveur dev frais (curl de `/src/index.css` → keyframes
  présents, zéro erreur PostCSS).
- `QrLifeCycleScene.tsx` : storyboard complet §4.4 — finders pop stagger 100ms,
  57 bandes cascade 25ms, settle 2s, beam (delay intégré 2.6s), compteur pill
  pop 4.4s + ticks JS 1 247→1 252 (remount `key={scans}` = micro-pop par tick),
  destination crossfade à 6.6s via `transition-opacity` React (pas de keyframes
  dédiés — plus simple). Reduced-motion : état final direct (JS + classes).
- `QrPreviewSlide.tsx` : visuel QR réel seul (img absolue dans `aspect-square`,
  fallback, beam optionnel) — déviation assumée au §6 : le cadre
  (header/badge/chips) vit dans `HeroShowcase` pour garantir des hauteurs
  identiques entre slides.
- `HeroShowcase.tsx` : autoplay 10s (deps `[paused, active]` → clic dot reset le
  timer), pause hover + focus-within, dots allongés, carousel a11y complet
  (region/carousel, group/slide, aria-hidden, pas d'aria-live), slides img
  montées en permanence, scène remontée via `sceneKey` à chaque activation
  (rejouabilité §4.6).
- `LandingPage.tsx` : `DemoQrCard`, `DEMO_QR`, `DEMO_DESTINATIONS` supprimés,
  `<HeroShowcase />` dans la colonne hero.
- Gates : `type-check` vert, `eslint` vert sur tous les fichiers touchés,
  `build` vert ; keyframes `qr-pop`/`qr-scan`/`qr-settle`, media query
  `no-preference` et `transform-box` vérifiés dans le CSS bundlé.
- Recette terrain restante (manuelle) : cf. §9.7 — cycle 30s ×2, pause
  hover/focus, dots, reduced-motion (slide 1 fixe + scène état final), 375px,
  API coupée, Lighthouse LCP.
