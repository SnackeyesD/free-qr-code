import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/handlers';
import { TEST_API_BASE as BASE } from '@/test/base';
import { adminApi } from '@/lib/adminApi';

describe('adminApi — contrat', () => {
  it('campaigns.list appelle GET /admin/campaigns avec filtres', async () => {
    let seenUrl = '';
    server.use(
      http.get(`${BASE}/admin/campaigns`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ data: [], total: 0 });
      }),
    );

    const res = await adminApi.campaigns.list({ page: 2, limit: 5, statut: 'brouillon', search: 'promo' });

    expect(res.total).toBe(0);
    expect(seenUrl).toContain('page=2');
    expect(seenUrl).toContain('limit=5');
    expect(seenUrl).toContain('statut=brouillon');
    expect(seenUrl).toContain('search=promo');
  });

  it('campaigns.remove appelle DELETE /admin/campaigns/:id', async () => {
    await adminApi.campaigns.remove('1');
  });

  it('campaigns.cancel appelle POST /admin/campaigns/:id/cancel', async () => {
    await adminApi.campaigns.cancel('1');
  });

  it('templates.list appelle GET /admin/templates avec pagination', async () => {
    let seenUrl = '';
    server.use(
      http.get(`${BASE}/admin/templates`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ data: [], total: 0 });
      }),
    );

    const res = await adminApi.templates.list({ page: 1, limit: 12, search: 'menu' });

    expect(res.total).toBe(0);
    expect(seenUrl).toContain('limit=12');
    expect(seenUrl).toContain('search=menu');
  });

  it('users.list appelle GET /admin/users avec filtres', async () => {
    const res = await adminApi.users.list({ page: 1, limit: 12, role: 'admin' });
    expect(res.total).toBe(2);
  });

  it('users.update appelle PATCH /admin/users/:id', async () => {
    const user = await adminApi.users.update('2', { estActif: false });
    expect(user.estActif).toBe(false);
  });

  it('users.remove appelle DELETE /admin/users/:id', async () => {
    await adminApi.users.remove('2');
  });
});
