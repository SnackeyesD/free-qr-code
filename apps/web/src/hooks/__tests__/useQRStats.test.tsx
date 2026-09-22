import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useQRStats, rangeForPeriod } from '@/hooks/useQRStats';
import { server } from '@/test/handlers';
import { TEST_API_BASE as BASE } from '@/test/base';
import { fakeStats } from '@/test/fixtures';

describe('rangeForPeriod', () => {
  it('convertit 7j en from/to YYYY-MM-DD (7 jours inclus)', () => {
    const now = new Date('2026-09-22T12:00:00.000Z');
    expect(rangeForPeriod('7j', now)).toEqual({ from: '2026-09-16', to: '2026-09-22' });
  });

  it('retombe sur 7j pour une période inconnue', () => {
    const now = new Date('2026-09-22T12:00:00.000Z');
    expect(rangeForPeriod('nope', now)).toEqual({ from: '2026-09-16', to: '2026-09-22' });
  });
});

describe('useQRStats', () => {
  it('un seul appel ?from&to, dailyStats dérivée de evolution', async () => {
    const seenUrls: string[] = [];
    server.use(
      http.get(`${BASE}/qrcodes/:id/stats`, ({ request }) => {
        seenUrls.push(request.url);
        return HttpResponse.json(fakeStats());
      }),
    );

    const { result } = renderHook(() => useQRStats('1'));

    await waitFor(() => expect(result.current.stats).not.toBeNull());

    expect(seenUrls).toHaveLength(1);
    expect(seenUrls[0]).toContain('from=');
    expect(seenUrls[0]).toContain('to=');
    expect(seenUrls[0]).not.toContain('periode=');
    expect(result.current.stats?.totalScans).toBe(10);
    expect(result.current.dailyStats).toHaveLength(2);
    expect(result.current.dailyStats[0]).toMatchObject({
      id: '1-2026-09-21',
      nombreScans: 4,
      nombreScansUniques: 3,
    });
    expect(result.current.error).toBeNull();
  });

  it('remonte l’erreur quand l’API répond 403', async () => {
    server.use(http.get(`${BASE}/qrcodes/:id/stats`, () => HttpResponse.json({}, { status: 403 })));

    const { result } = renderHook(() => useQRStats('1'));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.stats).toBeNull();
  });
});
