import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/handlers';
import { TEST_API_BASE as BASE } from '@/test/base';
import { qrApi } from '@/lib/qrApi';

describe('qrApi — contrat', () => {
  it('list appelle GET /qrcodes avec page/limit/search/type', async () => {
    let seenUrl = '';
    server.use(
      http.get(`${BASE}/qrcodes`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ data: [], total: 0, page: 2, limit: 10, hasNext: false });
      }),
    );

    const res = await qrApi.list({ page: 2, limit: 10, search: 'test', type: 'dynamique' });

    expect(res.page).toBe(2);
    expect(seenUrl).toContain('page=2');
    expect(seenUrl).toContain('limit=10');
    expect(seenUrl).toContain('search=test');
    expect(seenUrl).toContain('type=dynamique');
  });

  it('getById appelle GET /qrcodes/:id', async () => {
    const qr = await qrApi.getById('1');
    expect(qr.id).toBe('1');
  });

  it('stats appelle GET /qrcodes/:id/stats avec ?from&to', async () => {
    let seenUrl = '';
    server.use(
      http.get(`${BASE}/qrcodes/:id/stats`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          idQrCode: '1',
          periode: { from: '2026-09-15', to: '2026-09-22' },
          totalScans: 0,
          scansUniques: 0,
          evolution: [],
          pays: {},
          appareils: {},
        });
      }),
    );

    const stats = await qrApi.stats('1', { from: '2026-09-15', to: '2026-09-22' });

    expect(seenUrl).toContain('from=2026-09-15');
    expect(seenUrl).toContain('to=2026-09-22');
    expect(stats.totalScans).toBe(0);
  });
});
