const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

function cleanHex(v: unknown): string | undefined {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : undefined;
}

export interface PreviewDesignInput {
  couleur?: unknown;
  background?: unknown;
  correction?: unknown;
}

// Aperçu via notre API (GET /preview/qr, public). Retourne null si pas affichable.
export function buildPreviewUrl(contenu: unknown, design?: PreviewDesignInput | null, size?: unknown): string | null {
  if (typeof contenu !== 'string' || contenu.length === 0) return null;
  const n = Number(size);
  const s = Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 64), 600) : 200;
  const params = new URLSearchParams();
  params.set('content', contenu);
  const couleur = cleanHex(design?.couleur);
  const background = cleanHex(design?.background);
  if (couleur) params.set('couleur', couleur);
  if (background) params.set('background', background);
  params.set('size', String(s));
  const correction = design?.correction;
  if (correction === 'L' || correction === 'M' || correction === 'Q' || correction === 'H') {
    params.set('correction', correction);
  }
  return `${API_BASE}/preview/qr?${params.toString()}`;
}