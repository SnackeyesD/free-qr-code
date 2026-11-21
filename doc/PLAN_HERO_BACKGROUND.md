# Plan — Background animé du hero : grille QR + vague lumineuse

Décision : background de **hero uniquement** (pas toute la landing), en deux
couches — grille statique de modules carrés (ADN QR) + vague lumineuse indigo
qui allume les carrés à son passage via `mask-image`. Pure CSS, zéro
dépendance, zéro JS.

Références : `doc/AUDIT_ANIMATIONS_LANDING.md` §3 (règles motion),
`doc/PLAN_HERO_SLIDER.md` §10 (écueil @apply → keyframes en CSS pur),
skill `landing-page-design`.

---

## 1. Concept créatif

La tendance (Linear, Vercel, Stripe) : grille de points + lumière voyageuse.
Notre twist de marque : **des carrés, pas des points** — le module carré est
l'unité visuelle d'un QR code. La vague qui allume les modules fait écho au
scan beam de la carte hero : même geste, même couleur, deux échelles.

- **Subliminal, pas spectaculaire** : la vague est lente (25s) et à 5%
  d'opacité. Un background qui attire l'œil vole le H1 — interdit.
- **Périodes volontairement incommensurables** : beam carte 3.5s, slider 10s,
  vague background 25s. Jamais de synchronisation visible (effet métronome).

## 2. Architecture : deux couches + contenu

```
<div class="relative overflow-hidden">          <!-- nouveau wrapper full-width -->
  <div class="qr-grid-bg" />                     <!-- couche 1 : grille statique -->
  <div class="qr-grid-wave">                     <!-- couche 2 : masque = grille -->
    <div class="qr-grid-wave-band" />            <!-- le bandeau qui voyage -->
  </div>
  <section class="mx-auto max-w-7xl …">          <!-- hero actuel, inchangé -->
    …
  </section>
</div>
```

Décisions de structure :

- **Wrapper full-width** : la grille s'étend bord à bord du viewport. Sinon
  elle s'arrêterait aux bords du `max-w-7xl` → lignes de coupe visibles.
- `overflow-hidden` sur le wrapper : clippe le bandeau rotaté qui dépasse.
- Les deux couches en `absolute inset-0 pointer-events-none` + `aria-hidden`.
- Le contenu du hero n'a **pas besoin de z-index** : les couches sont avant lui
  dans le DOM (peintes dessous par ordre de document).
- La `<section>` hero garde toutes ses classes actuelles ; seul le wrapper
  est ajouté dans `LandingPage.tsx`.

## 3. Couche 1 — grille statique (`.qr-grid-bg`)

Data-URI SVG en `background-image`, tuilé :

```
<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>
  <rect x='1' y='1' width='2.5' height='2.5' fill='#e5e7eb'/>
</svg>
```

- Tuile 28×28, carré de 2.5px en `gray-200` (#e5e7eb) — densité calme,
  contraste quasi nul sur fond blanc, zéro impact lisibilité (texte gray-900).
- Coins carrés (pas de rx) : un module QR est carré.
- Coût : un seul tile décodé, répété par le moteur — **gratuit** en perfs.

## 4. Couche 2 — vague masquée (`.qr-grid-wave` + `.qr-grid-wave-band`)

### 4.1 Le masque (le détail qui tue)

`.qr-grid-wave` porte **le même data-URI** en `mask-image` (+ `-webkit-` pour
Safari) → la couche n'est visible **que là où il y a des carrés**, parfaitement
alignés avec la couche 1 (même origine, même tuile). Résultat : la lumière ne
« salit » pas le fond blanc, elle **allume les modules**.

### 4.2 Le bandeau (`.qr-grid-wave-band`)

- Gradient diagonal : `linear-gradient(105deg, transparent 35%, rgba(79,70,229,0.05) 50%, transparent 65%)`
  — indigo-600 à **5%**, ni plus (tache) ni moins (invisible).
- Géométrie : `position:absolute; top:-20%; bottom:-20%; left:0; width:55%`
  + léger `rotate(-4deg)` — le dépassement vertical couvre la rotation.
- Animation : `transform: translateX(-110%) → translateX(360%)` en **25s
  linear infinite** (pourcentages de la largeur du bandeau : traverse complète
  + sortie). Transform only → compositing GPU, zéro repaint.
- **Pas de `will-change`** : une seule couche animée ne le justifie pas.

### 4.3 Pourquoi bandeau enfant + masque parent (et pas l'inverse)

Si le masque était sur l'élément animé, la grille masquée **voyagerait avec la
vague** et se désalignerait de la couche 1. Masque sur le parent statique +
transform sur l'enfant = carrés fixes, lumière mobile. C'est LE point technique
du plan.

### 4.4 Fallback `@supports` (obligatoire)

Sans `mask-image`, le bandeau serait une tache indigo non masquée → pire que
rien. La couche 2 entière est donc gated :

```css
.qr-grid-wave { display: none; }
@supports ((-webkit-mask-image: url("")) or (mask-image: url(""))) {
  .qr-grid-wave { display: block; }
}
```

(Tous les navigateurs modernes supportent, mais le filet de sécurité coûte
3 lignes.)

## 5. CSS final (`index.css`, hors Tailwind)

Tout en CSS pur — cf. écueil @apply du plan slider : pas d'utility custom dans
la config Tailwind pour ça.

```css
/* Background hero : grille de modules QR */
.qr-grid-bg {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect x='1' y='1' width='2.5' height='2.5' fill='%23e5e7eb'/%3E%3C/svg%3E");
}

.qr-grid-wave {
  display: none;
  -webkit-mask-image: url("<même data-URI>");
  mask-image: url("<même data-URI>");
}
@supports ((-webkit-mask-image: url("")) or (mask-image: url(""))) {
  .qr-grid-wave { display: block; }
}

.qr-grid-wave-band {
  position: absolute; top: -20%; bottom: -20%; left: 0; width: 55%;
  transform: rotate(-4deg);
  background: linear-gradient(105deg, transparent 35%, rgba(79,70,229,0.05) 50%, transparent 65%);
}

@keyframes qr-grid-sweep {
  from { transform: rotate(-4deg) translateX(-110%); }
  to   { transform: rotate(-4deg) translateX(360%); }
}

@media (prefers-reduced-motion: no-preference) {
  .qr-grid-wave-band { animation: qr-grid-sweep 25s linear infinite; }
}
```

Notes :
- Le `rotate` est **dans le keyframe** (from/to) : un transform statique sur la
  classe serait écrasé par l'animation.
- Reduced-motion : grille statique conservée (elle n'est pas du mouvement),
  vague désactivée.
- Les data-URI doivent être **strictement identiques** entre `background-image`
  et `mask-image` — copier-coller, pas de réécriture à la main.

## 6. Modification `LandingPage.tsx`

Un seul changement structurel autour du hero :

```tsx
<div className="relative overflow-hidden">
  <div aria-hidden="true" className="qr-grid-bg pointer-events-none absolute inset-0" />
  <div aria-hidden="true" className="qr-grid-wave pointer-events-none absolute inset-0">
    <div className="qr-grid-wave-band" />
  </div>
  <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
    … hero inchangé …
  </section>
</div>
```

Attention : le hero n'est pas la seule section avec ces classes de padding —
l'ancre du patch doit inclure le commentaire `{/* Hero — above the fold … */}`
pour être unique.

## 7. Hors scope (phase 2 éventuelle)

- Extension au CTA final dark (grille de carrés blancs à 6% + vague indigo sur
  gray-900) : prévu comme follow-up si le hero valide le concept.
- Sync avec le beam de la carte : volontairement absent (§1, périodes
  incommensurables).

## 8. Risques et replis

- **Désalignement grille/masque** → même data-URI aux deux endroits (§5) ;
  vérifier visuellement que la vague allume les carrés existants, pas un
  réseau décalé.
- **Transform statique écrasé** → rotate inclus dans le keyframe (§5).
- **Tache indigo sur navigateur sans mask-image** → `@supports` gate (§4.4).
- **Trop visible** → seuil : si on remarque la vague en lisant le H1, baisser
  à `rgba(79,70,229,0.035)`. Critère de recette : lisibilité d'abord.
- **Perf** → transform only, une couche animée ; si jank mobile (à mesurer) :
  passer la période à 35s ou réduire la largeur du bandeau à 40%.
- **CLS** → couches `absolute`, aucune : zéro décalage de layout.

## 9. Ordre d'exécution et critères DONE

1. `index.css` : keyframes + 3 classes + `@supports` (§5).
2. `LandingPage.tsx` : wrapper hero (§6).
3. Gates : `pnpm --filter @free-qr/web type-check` + `eslint` + `build` verts ;
   `qr-grid-sweep` présent dans le CSS bundlé.
4. Vérif dev server frais (curl `/src/index.css` → 200, keyframes présents) —
   réflexe acquis au plan précédent.
5. Recette manuelle :
   - vague visible mais subliminale, carrés allumés alignés sur la grille
   - H1 lisible sans effort pendant le passage de la vague
   - reduced-motion émulé : grille là, vague absente
   - 375px : pas de débordement horizontal (overflow-hidden du wrapper)
   - Lighthouse : LCP inchangé (toujours l'img QR slide 1)

## 10. Suivi d'exécution

- `index.css` : `qr-grid-bg`, `qr-grid-wave` (+ `@supports` gate),
  `qr-grid-wave-band`, keyframes `qr-grid-sweep` (rotate inclus dans le
  keyframe), media query `no-preference`. Data-URI identique entre
  `background-image` et `mask-image` (vérifié au patch).
- `LandingPage.tsx` : wrapper `relative overflow-hidden` autour de la section
  hero, couches en `absolute inset-0 pointer-events-none aria-hidden`, contenu
  hero inchangé. Indentation du contenu hero conservée telle quelle (diff
  minimal pour le repo client).
- Gates : `type-check` vert, `eslint` vert, `build` vert (`qr-grid-sweep`,
  `mask-image` vérifiés dans le CSS bundlé).
- Dev server frais : curl `/src/index.css` → classes présentes, aucune erreur.
- Recette terrain restante (manuelle) : vague subliminale, carrés allumés
  alignés sur la grille, lisibilité H1 pendant le passage (si trop visible →
  `rgba(79,70,229,0.035)`, cf. §8), reduced-motion (grille là, vague absente),
  375px sans débordement, Lighthouse LCP inchangé.
