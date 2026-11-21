import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { HeroShowcase } from '@/components/HeroShowcase';
import { useReveal } from '@/hooks/useReveal';

const PRIMARY_CTA = 'Créer mon premier QR';

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M2.5 8h11M10 4.5 13.5 8 10 11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
      {intro && <p className="mt-4 text-lg text-gray-600">{intro}</p>}
    </div>
  );
}

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3)))); // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

function PrimaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      {children}
      <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-base font-semibold text-gray-900 transition-colors hover:text-indigo-600"
      >
        {q}
        <span
          aria-hidden="true"
          className={`text-xl font-normal text-gray-400 motion-safe:transition-transform motion-safe:duration-300 ${
            open ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`grid motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="pt-3 leading-7 text-gray-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

const BENEFITS = [
  {
    title: 'Changez la destination sans réimprimer',
    text: 'QR dynamiques avec alias court : la carte, le menu ou l’affiche restent en place, vous modifiez le lien derrière, en un clic.',
    large: true,
  },
  {
    title: 'À vos couleurs, avec votre logo',
    text: 'Couleurs, fond, taille, niveau de correction, cadre : chaque QR respecte votre charte.',
    large: false,
  },
  {
    title: 'Sachez qui scanne, quand',
    text: 'Nombre de scans total et détaillé par QR, directement dans le tableau de bord.',
    large: false,
  },
  {
    title: 'Branchez vos outils via l’API',
    text: 'Clés API à permissions fines pour créer et gérer vos QR depuis vos propres systèmes.',
    large: false,
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Choisissez le contenu',
    text: 'Lien, texte, email, téléphone, SMS, Wi-Fi, vCard, position ou PDF : 9 formats pris en charge.',
  },
  {
    n: '2',
    title: 'Personnalisez le visuel',
    text: 'Couleurs, logo, taille. L’aperçu en direct montre exactement ce qui sera imprimé.',
  },
  {
    n: '3',
    title: 'Partagez et suivez',
    text: 'Téléchargez en PNG, SVG ou PDF, diffusez, puis mesurez les scans en temps réel.',
  },
];

const USE_CASES = [
  { title: 'Restaurants', text: 'Menu sur table, modifiable à chaque changement de carte.' },
  { title: 'Événements', text: 'Billetterie, programme, plan d’accès sur un seul QR.' },
  { title: 'Cartes de visite', text: 'vCard scannable : vos coordonnées dans le téléphone en 2 secondes.' },
  { title: 'Accueil visiteurs', text: 'Wi-Fi invités sans dicter un mot de passe de 24 caractères.' },
];

const GUARANTEES: { term?: string; count?: number; suffix?: string; def: string }[] = [
  { term: 'Gratuit', def: 'sans carte bancaire' },
  { count: 9, suffix: ' formats', def: 'lien, Wi-Fi, vCard, PDF…' },
  { term: 'Suivi réel', def: 'scans mesurés par QR' },
  { term: 'Données protégées', def: 'IP anonymisées, RGPD' },
];

const FAQS = [
  {
    q: 'C’est vraiment gratuit ?',
    a: 'Oui. La création de QR codes statiques et dynamiques, la personnalisation et les statistiques sont gratuites, sans carte bancaire.',
  },
  {
    q: 'Quelle différence entre QR statique et dynamique ?',
    a: 'Le statique fige le contenu dans le QR lui-même : pour changer la destination, il faut le réimprimer. Le dynamique pointe vers un alias court que vous pouvez rediriger à tout moment, et il mesure les scans.',
  },
  {
    q: 'Quels formats d’export ?',
    a: 'PNG pour le web et le print courant, SVG pour un rendu vectoriel net à toute taille, PDF pour l’impression professionnelle.',
  },
  {
    q: 'Que deviennent mes données de scans ?',
    a: 'Elles servent uniquement à vos statistiques. Les adresses IP sont anonymisées avant stockage, et vous pouvez exporter ou supprimer vos données.',
  },
  {
    q: 'Puis-je créer des QR depuis mes propres outils ?',
    a: 'Oui, avec les clés API : permissions fines par usage (lecture, création, suppression, stats) et révocation en un clic.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const dashboardTo = user ? '/dashboard' : '/register';

  return (
    <div className="bg-white">
      {/* Hero — above the fold : bénéfice + CTA sans scroll */}
      <div className="relative overflow-hidden">
        <div aria-hidden="true" className="qr-grid-bg pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="qr-grid-wave pointer-events-none absolute inset-0">
          <div className="qr-grid-wave-band" />
        </div>
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 motion-safe:animate-fade-up">
              QR codes statiques &amp; dynamiques
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 motion-safe:animate-fade-up motion-safe:[animation-delay:60ms] sm:text-5xl">
              Changez la destination de vos QR codes sans les réimprimer
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600 motion-safe:animate-fade-up motion-safe:[animation-delay:120ms]">
              Créez des QR codes à vos couleurs, modifiez leur cible à tout moment
              et mesurez chaque scan. Gratuit, en quelques clics.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 motion-safe:animate-fade-up motion-safe:[animation-delay:200ms]">
              {user ? (
                <PrimaryLink to="/dashboard">Aller au tableau de bord</PrimaryLink>
              ) : (
                <>
                  <PrimaryLink to="/register">{PRIMARY_CTA}</PrimaryLink>
                  <a href="#comment-ca-marche" className="text-sm font-semibold text-gray-900 transition-colors hover:text-indigo-600">
                    Voir comment ça marche
                  </a>
                </>
              )}
            </div>
            <p className="mt-6 text-sm text-gray-500 motion-safe:animate-fade-up motion-safe:[animation-delay:280ms]">
              Gratuit · Sans carte bancaire · PNG, SVG, PDF
            </p>
          </div>
          {/* Pas de fade d'entrée sur la carte : l'img QR reste le LCP */}
          <div className="mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <HeroShowcase />
          </div>
        </div>
        </section>
      </div>

      {/* Bandeau réassurance — factuel uniquement */}
      <section aria-label="Garanties" className="border-y border-gray-200 bg-gray-50">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          {GUARANTEES.map((g) => (
            <div key={g.def}>
              <dt className="text-sm font-semibold text-gray-900">
                {g.count !== undefined ? <CountUp to={g.count} suffix={g.suffix} /> : g.term}
              </dt>
              <dd className="mt-1 text-sm text-gray-600">{g.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Bénéfices — grille asymétrique */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pourquoi Free QR Code"
          title="Des QR codes qui continuent de travailler après impression"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 75} className={b.large ? 'md:col-span-2' : ''}>
              <article
                className={`h-full rounded-2xl border border-gray-200 bg-white p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  b.large ? 'md:border-gray-900 md:bg-gray-900' : ''
                }`}
              >
                <h3 className={`text-xl font-bold tracking-tight ${b.large ? 'text-white sm:text-2xl' : 'text-gray-900'}`}>
                  {b.title}
                </h3>
                <p className={`mt-3 leading-7 ${b.large ? 'text-gray-300' : 'text-gray-600'}`}>{b.text}</p>
                {b.large && (
                  <div className="mt-6">
                    <Link to={dashboardTo} className="group inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-indigo-300">
                      {PRIMARY_CTA} <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="scroll-mt-20 border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="En pratique" title="Trois étapes, pas de compte à rebours" />
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n}>
                <Reveal delay={i * 100} className="flex gap-4">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{s.title}</h3>
                    <p className="mt-2 leading-7 text-gray-600">{s.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Statique vs dynamique — le différenciateur honnête */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Bien choisir"
          title="Statique ou dynamique ?"
          intro="Les deux sont gratuits. Le bon choix dépend de ce qui peut changer après impression."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-2xl border border-gray-200 p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-xl font-bold text-gray-900">Statique</h3>
              <p className="mt-2 text-gray-600">Le contenu est gravé dans le QR.</p>
              <ul className="mt-6 space-y-3 text-gray-700">
                {['Contenu simple et définitif', 'Fonctionne sans compte ni suivi', 'Idéal : Wi-Fi invités, vCard, lien permanent'].map((li) => (
                  <li key={li} className="flex gap-3">
                    <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
          <Reveal delay={100}>
            <article className="h-full rounded-2xl border-2 border-indigo-600 p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-xl font-bold text-gray-900">Dynamique <span className="ml-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Recommandé</span></h3>
              <p className="mt-2 text-gray-600">Le QR pointe vers un alias que vous pilotez.</p>
              <ul className="mt-6 space-y-3 text-gray-700">
                {['Destination modifiable sans réimprimer', 'Statistiques de scans par QR', 'Idéal : menus, campagnes, affiches, événements'].map((li) => (
                  <li key={li} className="flex gap-3">
                    <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </section>

      {/* Cas d'usage concrets */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Cas d’usage" title="Là où un QR change la donne" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u, i) => (
              <Reveal key={u.title} delay={i * 60}>
                <article className="h-full rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <h3 className="font-semibold text-gray-900">{u.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{u.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-10">
            <PrimaryLink to={dashboardTo}>{PRIMARY_CTA}</PrimaryLink>
          </div>
        </div>
      </section>

      {/* FAQ — les vraies objections */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Questions fréquentes" title="Ce que l’on nous demande avant de se lancer" />
        <Reveal className="mt-10">
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA final — même libellé, même destination */}
      <section className="bg-gray-900">
        <Reveal className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white">
            Créez un QR qui restera valable même quand vos infos changeront
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
            Compte gratuit, premier QR en moins de deux minutes.
          </p>
          <div className="mt-8">
            <PrimaryLink to={dashboardTo}>{PRIMARY_CTA}</PrimaryLink>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
