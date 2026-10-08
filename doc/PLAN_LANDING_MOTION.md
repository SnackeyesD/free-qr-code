# Plan — Motion design de la landing page (P0 → P3)

Source : `doc/AUDIT_ANIMATIONS_LANDING.md` (audit du 2026-10-06).
Périmètre strict : **motion de `apps/web/src/pages/LandingPage.tsx`** (+ config Tailwind et
un hook). Aucun changement backend, aucune nouvelle dépendance, aucune refonte de copy.
Hors scope : section social proof, SEO meta/SSR, animations du dashboard, framer-motion
(non justifié à ce stade — tout le plan tient en CSS + IntersectionObserver).

## 1. Contexte

- La landing est **totalement inerte** : aucune classe `animate-*`/`transition-*`,
  aucun `@keyframes`. Même les hovers (`hover:bg-indigo-500`…) snappent sans transition.
- `apps/web/tailwind.config.js` : `theme.extend` vide → aucune animation custom.
- `apps/web/src/index.css` : 9 lignes, `@layer base` uniquement.
- `DemoQrCard` (`LandingPage.tsx:50-83`) affiche le **vrai QR** généré par
  `GET /preview/qr` avec fallback propre : c'est un atout, on anime **autour et dessus**,
  on ne le remplace pas (doctrine « product IS the marketing », cf. audit §2).

## 2. Conventions relevées (à respecter)

| Sujet | Convention sur le repo |
|---|---|
| Hooks | `apps/web/src/hooks/useX.ts`, export nommé, typés (cf. `useQR.ts`, `useSettings.ts`) |
| Styles | Tailwind utility-first, pas de CSS custom hors `index.css` |
| Config Tailwind | `tailwind.config.js` ESM (`export default`), `extend` vide — c'est là que vont les keyframes |
| Composants landing | `PrimaryLink` (lignes 38-48), `DemoQrCard` (50-83), `SectionHeading` (28-36) — les modifier sur place, pas de duplication |
| Accessibilité déco | `aria-hidden="true"` sur tout élément purement visuel (déjà fait pour les icônes) |
| Vérifs | `pnpm --filter @free-qr/web type-check` / `lint` (max-warnings 5) / `build`. Le script `test` web est un stub (`echo`), pas de gate tests ici |

## 3. Principes motion non négociables

1. **`transform` et `opacity` uniquement** — rien sur `top/left/width/height`.
2. **Variantes Tailwind `motion-safe:`** sur toute animation CSS (built-in v3.4,
   mappe `prefers-reduced-motion: no-preference`). Pour les animations pilotées en JS
   (crossfade), garde `matchMedia('(prefers-reduced-motion: reduce)')` explicite.
3. **Le QR `<img>` reste le LCP** : ne pas appliquer de fade d'entrée retardé sur la
   carte hero. Le fade-up d'entrée s'applique à la colonne texte uniquement ; la carte
   reste visible immédiatement (le scan beam démarre après le premier paint, c'est
   purement additif).
4. **Une animation « signature »** (scan beam + crossfade destination), le reste subtil.
5. Reveals au scroll : `once: true` (pas de re-trigger), seuil 0.15, contenu visible
   si JS/IO indisponible.

## 4. P0 — Transitions des micro-interactions (quick wins)

Dans `LandingPage.tsx`, uniquement des ajouts de classes :

- `PrimaryLink` (ligne 42) : ajouter `group transition-colors`.
- `ArrowIcon` dans `PrimaryLink` : `<ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />`.
- Lien « Voir comment ça marche » (ligne 182) : ajouter `transition-colors`.
- Cards bénéfices (ligne 223) et use-cases (ligne 306) : ajouter
  `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`
  (la card large dark garde son traitement, même motion).
- `summary` FAQ (ligne 324) : ajouter `transition-colors`.

Critère DONE P0 : aucun changement visuel au repos ; tous les hovers sont lisses (~200ms).

## 5. P1 — Hero vivant (l'animation signature)

### 5.1 Keyframes dans `tailwind.config.js`

```js
theme: {
  extend: {
    keyframes: {
      'fade-up': {
        from: { opacity: '0', transform: 'translateY(16px)' },
        to: { opacity: '1', transform: 'translateY(0)' },
      },
      scan: {
        // le beam fait h-1/3 : -110% = juste au-dessus, 340% = juste en dessous
        from: { transform: 'translateY(-110%)' },
        to: { transform: 'translateY(340%)' },
      },
    },
    animation: {
      'fade-up': 'fade-up 0.6s ease-out both',
      scan: 'scan 3.5s ease-in-out infinite',
    },
  },
},
```

### 5.2 Scan beam sur `DemoQrCard`

- Conteneur QR (ligne 60) : ajouter `relative` (a déjà `overflow-hidden rounded-xl`).
- Après le bloc `<img>`/fallback, overlay (rendu **uniquement si `!failed`** — pas de
  beam sur le message hors-connexion) :

```tsx
{!failed && (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent motion-safe:animate-scan"
  />
)}
```

`pointer-events-none` obligatoire : l'overlay ne doit pas bloquer clic droit / sélection
sur le QR.

### 5.3 Crossfade « destination modifiable » (l'USP démontré)

Dans `DemoQrCard`, sous la carte QR (avant les chips, ligne 76) :

```tsx
const DESTINATIONS = ['menu-ete.pdf', 'menu-hiver.pdf', 'carte-dejeuner.pdf'];

const [destIndex, setDestIndex] = useState(0);
useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const id = setInterval(() => setDestIndex((i) => (i + 1) % DESTINATIONS.length), 3000);
  return () => clearInterval(id);
}, []);
```

Rendu : spans empilés en absolu dans un conteneur à hauteur fixe (pas de layout shift,
quelle que soit la longueur du texte) :

```tsx
<p className="relative mt-3 h-5 text-sm text-gray-500">
  <span className="mr-1 text-gray-400">Destination :</span>
  {DESTINATIONS.map((d, i) => (
    <span
      key={d}
      className={`absolute transition-opacity duration-500 ${i === destIndex ? 'opacity-100' : 'opacity-0'}`}
    >
      {d}
    </span>
  ))}
</p>
```

Le QR ne bouge pas, la destination change : c'est le H1 en démo. Cleanup de l'interval
dans le `useEffect` (retour de fonction), garde reduced-motion **avant** le `setInterval`.

### 5.4 Reveal d'entrée du hero

- Colonne texte (ligne 165) : `motion-safe:animate-fade-up` ; éventuellement
  `[animation-delay:120ms]` sur la subheadline et les CTA pour un mini-stagger.
- **Ne pas** animer la carte QR au mount (règle LCP, §3.3).

Critère DONE P1 : beam visible en boucle douce, destination qui change toutes les 3s,
hero texte en fade-up au chargement, rien de tout ça en mode reduced-motion.

## 6. P2 — Scroll reveals

### 6.1 Nouveau `apps/web/src/hooks/useReveal.ts`

```ts
import { useEffect, useRef, useState } from 'react';

export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}
```

### 6.2 Wrapper `<Reveal>` local à `LandingPage.tsx`

```tsx
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </div>
  );
}
```

### 6.3 Application (stagger)

- Bénéfices : `<Reveal delay={i * 75}>` autour de chaque `<article>`.
- Étapes 1-2-3 : `delay={i * 100}`.
- Comparatif statique/dynamique : les deux cards, `delay` 0 / 100.
- Use-cases : `delay={i * 60}`.
- FAQ : un seul `<Reveal>` sur le bloc complet (pas par question — trop nerveux).
- CTA final : un `<Reveal>` global.

Critère DONE P2 : chaque section apparaît en fade-up décalé au premier scroll ;
au second passage, tout est déjà visible (once) ; contenu intégralement visible
si reduced-motion.

## 7. P3 — Polish (optionnel, à arbitrer après P1/P2)

- Badge « Dynamique » (ligne 56) : `motion-safe:animate-pulse` (gratuit, Tailwind
  natif) — vérifier que ce n'est pas trop fort, sinon dot + `animate-ping` custom.
- FAQ fluide : le trick `grid-template-rows: 0fr → 1fr` impose de remplacer
  `<details>/<summary>` par `<button aria-expanded>` + div. **Trade-off a11y/SEO** :
  les `details` natifs sont robustes et indexables. Recommandation : ne faire que si
  le snap à l'ouverture gêne vraiment en recette.
- Compteur animé « 9 formats » : uniquement si le chiffre reste réel (pas de fake
  metrics). Faible valeur, dernier de la liste.

## 8. Ordre d'exécution et critères DONE

1. `tailwind.config.js` (§5.1) → `build` web vert (JIT compile les nouvelles classes).
2. P0 (§4) → `type-check` + `lint` verts ; recette hovers.
3. P1 (§5.2 → 5.4) → `type-check` + `lint` + `build` verts ; recette hero
   (beam, crossfade, fade-up, reduced-motion émulé dans DevTools).
4. P2 (§6) → mêmes gates ; recette scroll desktop **et** 375px.
5. P3 (§7) au choix, un point à la fois.
6. Recette finale : `pnpm --filter @free-qr/web build` vert ; navigation complète ;
   DevTools → Rendering → `prefers-reduced-motion: reduce` → **tout visible, zéro
   animation** ; Lighthouse rapide : LCP non régressé (l'`<img>` QR reste le LCP,
   le fade-up ne la retarde pas).

## 9. Risques et replis

- **LCP dégradé** si le fade-up touche la carte QR → règle §3.3 ; en cas de doute,
  retirer le fade-up du hero entièrement (le beam suffit).
- **Layout shift du crossfade** → conteneur `h-5` fixe + spans absolus (§5.3) ;
  vérifier sur 375px que la destination la plus longue ne wrappe pas (sinon
  raccourcir les libellés ou passer en `truncate`).
- **Beam sur le fallback hors-connexion** → rendu conditionnel `!failed` (§5.2).
- **Fuite d'interval** → cleanup `useEffect` systématique ; un seul interval par carte.
- **Reduced-motion oublié côté JS** → la variante `motion-safe:` ne couvre que le CSS ;
  la garde `matchMedia` du §5.3 est obligatoire.
- **Régression lint** (max-warnings 5) → les hooks ajoutés doivent respecter
  `react-hooks/exhaustive-deps` (deps `[threshold]`).
- Si un jour le dashboard veut des springs/layout animations : réévaluer framer-motion
  à ce moment-là, pas avant.

## 10. Suivi d'exécution

- P0 implémenté : `transition-colors` sur tous les hovers (PrimaryLink, lien ancre,
  CTA de la card large, summary FAQ) ; flèches CTA avec
  `group-hover:translate-x-0.5` ; élévation au survol des cards
  (`hover:-translate-y-0.5 hover:shadow-md`).
- P1 implémenté : keyframes `scan` + `fade-up` dans `tailwind.config.js` ;
  scan beam sur `DemoQrCard` (conditionné à `!failed`, `pointer-events-none`) ;
  crossfade de destination (`DEMO_DESTINATIONS`, interval 3s, garde
  `matchMedia('(prefers-reduced-motion: reduce)')`) ; fade-up stagger sur la
  colonne texte du hero (0/60/120/200/280ms), carte QR sans fade (règle LCP).
- P2 implémenté : `apps/web/src/hooks/useReveal.ts` (IO, threshold 0.15, once,
  fallback visible si IO absente ou reduced-motion) ; composant `Reveal` local ;
  stagger sur bénéfices (75ms), étapes (100ms, via `<li><Reveal>` pour préserver
  la sémantique `ol>li`), comparatif (0/100ms), use-cases (60ms), FAQ (bloc
  unique), CTA final.
- P3 implémenté : badge « Dynamique » avec dot live (`animate-ping` sur dot,
  pas de pulse du texte — plus lisible) ; FAQ fluide via `FaqItem`
  (`<button aria-expanded>` + `grid-rows-[0fr→1fr]`, icône `+` qui tourne en ×,
  transitions gated par `motion-safe:`) — les `<details>/<summary>` natifs ont
  été remplacés, le contenu reste dans le DOM (SEO préservé) ; compteur animé
  `CountUp` 0→9 sur « 9 formats » (rAF, ease-out cubic 700ms, valeur finale
  directe en reduced-motion) ; bandeau réassurance extrait en const `GUARANTEES`
  typée (fix union TS : `'count' in g` insuffisant, discrimination explicite
  `g.count !== undefined`).
- Gates : `type-check` web vert ; `eslint` vert sur les fichiers touchés
  (le lint global échoue sur `SettingsPage.tsx:55` `resetPassword` inutilisé —
  pré-existant, hors périmètre) ; `build` vert ; keyframes `scan`/`fade-up` et
  media query `prefers-reduced-motion` vérifiés dans le CSS bundlé.
- Recette terrain restante (manuelle) : `pnpm dev`, vérifier beam + crossfade +
  reveals au scroll desktop et 375px, ouverture FAQ fluide, dot live, compteur,
  émuler reduced-motion (tout visible, zéro animation), Lighthouse rapide
  (LCP non régressé).
