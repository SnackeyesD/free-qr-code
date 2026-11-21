# Audit — Animations & motion design de la landing page

**Fichier audité :** `apps/web/src/pages/LandingPage.tsx`
**Date :** 2026-10-06
**Référentiels utilisés :** skill `landing-page-design` (synthèse Wix/Elementor), skill `claude-design` (doctrine motion + anti-slop), design systems `framer` et `stripe` (skill `popular-web-designs`)

---

## 1. État des lieux (factuel)

- **Zéro animation** sur la landing : aucune classe `animate-*`, `transition-*`, aucun `@keyframes`, aucun reveal au scroll.
- **Les hover states snappent** : `hover:bg-indigo-500`, `hover:text-indigo-600` etc. n'ont **pas de `transition-colors`** — le changement de couleur est instantané. C'est le détail qui fait "site statique d'il y a 10 ans".
- **Aucune lib d'animation** dans `apps/web/package.json` (pas de framer-motion, GSAP, Lottie). Stack : React 19 + Tailwind 3.4 + Vite.
- Dans tout `apps/web/src`, seulement 3 occurrences de `animate|transition|keyframe` (dans `TemplateList`, `CampaignList`, `QRCodeList` — probablement des états de chargement). Le dashboard est donc quasi aussi statique.
- Le seul élément "vivant" du hero est le QR démo chargé depuis l'API (`/preview/qr`), avec fallback hors-ligne propre.

**Conclusion : le constat est juste — la page est totalement inerte.**

## 2. Mon impression de designer

Le constat est bon, mais attention à la solution envisagée (remplacer le QR par une illustration SVG animée).

### Pourquoi il faut GARDER le vrai QR dans le hero

La doctrine des deux benchmarks motion du référentiel :

- **Framer** : "the product IS the marketing — no decorative imagery, all images are functional". Le hero de Framer, c'est l'outil lui-même.
- **Stripe** : pareil, dashboard previews en hero art.
- **Anti-slop (claude-design)** : "decorative SVG illustrations pretending to be product imagery" est un tell classique de design IA générique.

La `DemoQrCard` actuelle montre le **vrai output du produit** (généré par l'API, avec ses chips de features). C'est un atout de crédibilité. Le remplacer par une illustration décorative serait un **downgrade** : on échange du produit réel contre de la déco.

### Évaluation des deux idées proposées

| Idée | Verdict |
|---|---|
| **Slide montrant le process de création** | Moyen. Ça raconte le "comment", mais le visiteur veut d'abord le "pourquoi". La section "3 étapes" juste en dessous fait déjà ce boulot. Risque : animation qui boucle sans but = "bad motion" (retarde, attire l'attention sur elle-même). |
| **Main qui scanne un QR** | Le **concept** est excellent — le scan est le geste central du produit. Mais une **main en SVG illustré** est un piège : très difficile à bien exécuter, rendu clip-art quasi garanti. |

### La recommandation : garder le vrai QR, l'animer avec intention

Le motion doit **vendre l'USP**, pas décorer. L'USP du produit : *"Changez la destination sans réimprimer"*. Donc :

1. **Scan beam** : une ligne lumineuse (gradient indigo) qui balaye le QR verticalement, comme un lecteur. Subtil, boucle 3-4s. Ça communique "ce truc se scanne" sans un seul mot. Pure CSS, ~15 lignes.
2. **Destination qui change sous un QR identique** (le kill shot) : sous le QR, le label de destination fait un crossfade `menu-ete.pdf → menu-hiver.pdf` toutes les ~3s pendant que le QR, lui, ne bouge pas. **C'est l'H1 démontré en image.** Aucun concurrent gratuit ne montre ça.
3. Optionnel : léger tilt/float de la carte au hover (transform 3D discret).

## 3. Plan de motion proposé (par priorité)

### P0 — Quick wins (30 min, zéro risque)

- Ajouter `transition-colors` (ou `transition-all duration-200`) sur **tous** les hover states : `PrimaryLink`, liens, `summary` de la FAQ, cards.
- Flèche des CTA : `group-hover:translate-x-0.5 transition-transform` (micro-tactilité, pattern Stripe/Linear).
- Cards bénéfices / use-cases : `hover:-translate-y-0.5 hover:shadow-md transition-all` (élévation au survol = affordance).

### P1 — Hero vivant (le vrai impact)

- **Scan beam** sur `DemoQrCard` : `::after` absolu, `background: linear-gradient(transparent, rgba(99,102,241,.35), transparent)`, keyframe `translateY(-100%) → translateY(100%)`, `animation: scan 3.5s ease-in-out infinite`.
- **Crossfade de destination** sous le QR : petit state React + `setInterval` + transition opacity. ~20 lignes.
- Reveal d'entrée du hero : fade-up léger au mount (`opacity-0 translate-y-4 → opacity-100 translate-y-0`).

### P2 — Scroll reveals (page longue = obligatoire)

- Hook `useReveal()` maison (~20 lignes, IntersectionObserver, threshold 0.15, `once: true`).
- Appliquer en stagger sur : cards bénéfices, étapes 1-2-3, comparatif statique/dynamique, use-cases, FAQ.
- Pattern : `opacity-0 translate-y-6` → `opacity-100 translate-y-0`, `duration-500 ease-out`, `transition-delay` échelonné (0 / 75 / 150 / 225ms).

### P3 — Polish (si le temps le permet)

- FAQ : ouverture fluide via le trick `grid-template-rows: 0fr → 1fr` (propre, sans JS de mesure de hauteur).
- Compteur animé sur "9 formats" dans le bandeau réassurance (count-up au scroll). **Uniquement si le chiffre est réel** — pas de fake metrics.
- Badge "Dynamique" : pulse discret (`animate-pulse` Tailwind existe déjà, gratuit).

## 4. Règles non négociables (perf + a11y)

- **`transform` et `opacity` uniquement.** Jamais d'animation sur `width/height/top/left` → sinon layout thrash, et la landing perd son avantage perf.
- **`@media (prefers-reduced-motion: reduce)`** : désactiver scan beam, reveals (contenu visible direct), crossfade. C'est dans le skill, c'est dans WCAG, non optionnel.
- **Le hero ne doit pas attendre l'animation** : le QR image reste le LCP, les animations sont purement additives (pas de `opacity: 0` initial géré en JS qui bloquerait le rendu si le JS fail).
- **Pas de lib pour l'instant.** CSS + IntersectionObserver suffisent à tout le plan ci-dessus. framer-motion (~40 kB) ne se justifie que si on veut plus tard des transitions physiques/spring complexes ou des layout animations dans le dashboard.
- Budget motion : une landing = **une animation "signature"** (ici : le scan beam + destination crossfade), le reste reste subtil. Si tout bouge, rien ne bouge.

## 5. Slop diagnostic (skill claude-design)

Score de la page actuelle : **2/10** (bas = bien).

- Tell #2 "generic tech hue" : `indigo-600` est l'accent Tailwind par défaut — acceptable si c'est la couleur brand du client, sinon à challenger.
- Tell #3 "feature-tile grid" : évité de justesse grâce à la grille asymétrique (card large dark). OK.
- Tell #10 "wrong surface" : non — c'est bien une surface Decide/Learn, le hero est justifié ici.

Le risque slop viendrait de **l'ajout** d'une illustration SVG décorative à la place du produit réel — d'où la recommandation de la section 2.

## 6. Verdict

| Aspect | Note | Commentaire |
|---|---|---|
| Structure / contenu | 8/10 | Discipline CTA exemplaire, FAQ objections réelles |
| Motion | 2/10 | Inerte, hovers qui snappent, aucun reveal |
| Potentiel | 9/10 | Le produit a une USP **démontrable** en animation — c'est rare |

La page n'a pas besoin d'être "plus animée", elle a besoin d'**une animation qui raconte le produit**. Le scan beam + destination crossfade sur le vrai QR fait ça, en pure CSS, sans dépendance, sans toucher à la crédibilité du hero.

**Next step proposé :** implémenter P0 + P1 (scan beam + crossfade + transitions hovers), mesurer, puis P2 au scroll si le rendu le justifie.
