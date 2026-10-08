import { useEffect, useMemo, useState } from 'react';
import { QR_MATRIX_ROWS } from './qr-matrix';

const SIZE = 320;
const QUIET = 4;
const MODULES = QR_MATRIX_ROWS.length;
const M = SIZE / (MODULES + QUIET * 2);

const FINDER_ORIGINS = [
  { x: 0, y: 0 },
  { x: MODULES - 7, y: 0 },
  { x: 0, y: MODULES - 7 },
];

function moduleRect(x: number, y: number): string {
  const X = ((x + QUIET) * M).toFixed(2);
  const Y = ((y + QUIET) * M).toFixed(2);
  const S = M.toFixed(2);
  return `M${X} ${Y}h${S}v${S}h-${S}z`;
}

// Finders (3 carrés 7×7) exclus des bandes : ils apparaissent en premier,
// comme un vrai lecteur les voit en premier. Le reste est groupé en bandes
// diagonales (x + y constant) pour la vague d'assemblage.
function buildScene() {
  const finders = ['', '', ''];
  const bands: string[] = [];
  QR_MATRIX_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '1') continue;
      const fi = FINDER_ORIGINS.findIndex(
        (f) => x >= f.x && x < f.x + 7 && y >= f.y && y < f.y + 7,
      );
      if (fi >= 0) {
        finders[fi] += moduleRect(x, y);
      } else {
        const k = x + y;
        bands[k] = (bands[k] ?? '') + moduleRect(x, y);
      }
    }
  });
  return { finders, bands };
}

const SCANS_START = 1247;
const SCANS_TICKS = 5;
const DESTINATIONS = ['menu-ete.pdf', 'menu-hiver.pdf'];

export function QrLifeCycleScene() {
  const { finders, bands } = useMemo(buildScene, []);
  const [scans, setScans] = useState(SCANS_START);
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScans(SCANS_START + SCANS_TICKS);
      setSwapped(true);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= SCANS_TICKS; i++) {
      timers.push(setTimeout(() => setScans(SCANS_START + i), 4400 + i * 400));
    }
    timers.push(setTimeout(() => setSwapped(true), 6600));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Démonstration animée : un QR code se construit module par module, est scanné, puis sa destination change sans que le QR bouge"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0" />
          <stop offset="0.5" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={SIZE} height={SIZE} fill="#ffffff" />

      {/* Phases 1-3 : assemblage (finders puis vague diagonale) + settle */}
      <g fill="#111827" className="qr-settle">
        {finders.map((d, i) => (
          <path
            key={`f${i}`}
            d={d}
            className="qr-finder"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        {bands.map((d, k) =>
          d ? (
            <path
              key={`b${k}`}
              d={d}
              className="qr-band"
              style={{ animationDelay: `${300 + k * 25}ms` }}
            />
          ) : null,
        )}
      </g>

      {/* Phase 4 : scan beam (delay 2.6s intégré à l'animation) */}
      <rect
        className="qr-beam motion-reduce:opacity-0"
        x="0"
        y="0"
        width={SIZE}
        height={SIZE / 3}
        fill="url(#beamGrad)"
      />

      {/* Phase 5 : compteur de scans (apparition 4.4s, ticks JS) */}
      <g className="qr-pop" style={{ animationDelay: '4.4s' }}>
        <rect x="186" y="12" rx="12" width="122" height="24" fill="#ecfdf5" stroke="#a7f3d0" />
        <circle cx="198" cy="24" r="3" fill="#10b981" />
        <text
          key={scans}
          x="206"
          y="28"
          fontSize="12"
          fill="#047857"
          className="qr-pop"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {scans.toLocaleString('fr-FR')} scans
        </text>
      </g>

      {/* Phase 6 : la destination change, le QR ne bouge pas */}
      <text
        x={SIZE / 2}
        y="308"
        textAnchor="middle"
        fontSize="12"
        className={`transition-opacity duration-500 ${swapped ? 'opacity-0' : 'opacity-100'}`}
      >
        <tspan fill="#9ca3af">Destination : </tspan>
        <tspan fill="#4b5563">{DESTINATIONS[0]}</tspan>
      </text>
      <text
        x={SIZE / 2}
        y="308"
        textAnchor="middle"
        fontSize="12"
        className={`transition-opacity duration-500 ${swapped ? 'opacity-100' : 'opacity-0'}`}
      >
        <tspan fill="#9ca3af">Destination : </tspan>
        <tspan fill="#4b5563">{DESTINATIONS[1]}</tspan>
      </text>
    </svg>
  );
}
