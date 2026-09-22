// Base URL unique, résolue exactement comme dans src/lib/api.ts.
// Les tests restent verts quelle que soit la config locale (.env.local, CI…).
export const TEST_API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
