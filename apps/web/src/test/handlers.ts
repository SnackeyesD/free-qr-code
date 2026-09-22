import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TEST_API_BASE as BASE } from './base';
import { fakeCampaign, fakeQR, fakeStats, fakeTemplate, fakeUser } from './fixtures';

export const handlers = [
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ accessToken: 'access-test', expiresAt: 9999999999, user: fakeUser() }),
  ),
  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ accessToken: 'access-refreshed', expiresAt: 9999999999 }),
  ),
  // Contrat cible : GET /me/me (cf. AUDIT P0-1). Le handler couvre aussi /me pour détecter la régression.
  http.get(`${BASE}/me/me`, () => HttpResponse.json(fakeUser())),
  http.post(`${BASE}/auth/verify-email`, () =>
    HttpResponse.json({ accessToken: 'access-verified', expiresAt: 9999999999, user: fakeUser() }),
  ),
  http.get(`${BASE}/qrcodes`, () =>
    HttpResponse.json({ data: [fakeQR()], total: 1, page: 1, limit: 20, hasNext: false }),
  ),
  http.get(`${BASE}/qrcodes/:id`, () => HttpResponse.json(fakeQR())),
  http.get(`${BASE}/qrcodes/:id/stats`, () => HttpResponse.json(fakeStats())),
  http.get(`${BASE}/admin/campaigns`, () =>
    HttpResponse.json({ data: [fakeCampaign()], total: 1 }),
  ),
  http.delete(`${BASE}/admin/campaigns/:id`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/admin/campaigns/:id/cancel`, () =>
    HttpResponse.json(fakeCampaign({ statut: 'annulee' })),
  ),
  http.get(`${BASE}/admin/templates`, () =>
    HttpResponse.json({ data: [fakeTemplate()], total: 1 }),
  ),
  http.get(`${BASE}/admin/users`, () =>
    HttpResponse.json({ data: [fakeUser(), fakeUser({ id: '2', email: 'other@example.com' })], total: 2 }),
  ),
  http.patch(`${BASE}/admin/users/:id`, () => HttpResponse.json(fakeUser({ estActif: false }))),
  http.delete(`${BASE}/admin/users/:id`, () => HttpResponse.json({ success: true })),
];

export const server = setupServer(...handlers);
