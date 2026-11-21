import { useEffect, useState } from 'react';
import { QrLifeCycleScene } from './QrLifeCycleScene';
import { QrPreviewSlide } from './QrPreviewSlide';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

// Durée unique du slide : le storyboard de QrLifeCycleScene y est synchronisé.
const SLIDE_DURATION = 10000;

function previewUrl(content: string, couleur: string) {
  return (
    `${API_BASE}/preview/qr?content=${encodeURIComponent(content)}` +
    `&couleur=${encodeURIComponent(couleur)}&background=%23ffffff&size=320&correction=M`
  );
}

type SlideTone = 'live' | 'demo' | 'static';

const SLIDES: {
  id: string;
  title: string;
  badge: string;
  tone: SlideTone;
  alt?: string;
  chips: string[];
}[] = [
  {
    id: 'menu',
    title: 'Menu du restaurant',
    badge: 'Dynamique',
    tone: 'live',
    alt: 'Exemple de QR code dynamique généré par Free QR Code',
    chips: ['Alias court modifiable', 'Stats de scans', 'PNG · SVG · PDF'],
  },
  {
    id: 'scene',
    title: 'Créé. Scanné. Modifié.',
    badge: 'Démo',
    tone: 'demo',
    chips: ['QR réel et scannable', 'Scans mesurés', 'Destination modifiable'],
  },
  {
    id: 'wifi',
    title: 'Wi-Fi invités',
    badge: 'Statique',
    tone: 'static',
    alt: 'Exemple de QR code Wi-Fi aux couleurs de la marque',
    chips: ['Sans compte', 'Gravé dans le QR', 'SVG net à toute taille'],
  },
];

function SlideBadge({ tone, children }: { tone: SlideTone; children: React.ReactNode }) {
  const tones: Record<SlideTone, string> = {
    live: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    demo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    static: 'bg-gray-100 text-gray-700 ring-gray-600/20',
  };
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {tone === 'live' && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {children}
    </span>
  );
}

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Remount de la scène à chaque activation de la slide 2 : l'animation rejoue.
  const [sceneKey, setSceneKey] = useState(0);

  useEffect(() => {
    if (active === 1) setSceneKey((k) => k + 1);
  }, [active]);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), SLIDE_DURATION);
    return () => clearInterval(id);
  }, [paused, active]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Démonstration du produit"
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg shadow-gray-900/5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="relative">
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} sur ${SLIDES.length} : ${s.title}`}
            aria-hidden={i !== active}
            className={`transition-opacity duration-500 ${
              i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
            } ${i === 0 ? 'relative' : 'absolute inset-0'}`}
          >
            <div className="flex h-6 items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              <SlideBadge tone={s.tone}>{s.badge}</SlideBadge>
            </div>
            {s.id === 'scene' ? (
              <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
                <QrLifeCycleScene key={sceneKey} />
              </div>
            ) : (
              <QrPreviewSlide
                src={previewUrl(
                  s.id === 'wifi'
                    ? 'WIFI:T:WPA;S:CafeMalongo;P:motdepasse-24-caracteres;;'
                    : 'https://app.free-qrcode.app',
                  s.id === 'wifi' ? '#4f46e5' : '#111827',
                )}
                alt={s.alt ?? ''}
                beam={s.id === 'menu'}
              />
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-gray-600">
              {s.chips.map((c) => (
                <span key={c} className="rounded-md bg-gray-100 px-2 py-1">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Slide ${i + 1} : ${s.title}`}
            aria-current={i === active}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
            }`}
          />
          ))}
      </div>
    </div>
  );
}
