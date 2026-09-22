import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import QRStatsPage from '@/pages/QRStatsPage';
import { server } from '@/test/handlers';
import { TEST_API_BASE as BASE } from '@/test/base';
import { fakeStats } from '@/test/fixtures';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/qr/1/stats']}>
      <Routes>
        <Route path="/dashboard/qr/:id/stats" element={<QRStatsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('QRStatsPage', () => {
  it('affiche compteurs, répartitions et barres journalières depuis un seul appel', async () => {
    const seenUrls: string[] = [];
    server.use(
      http.get(`${BASE}/qrcodes/:id/stats`, ({ request }) => {
        seenUrls.push(request.url);
        return HttpResponse.json(fakeStats());
      }),
    );

    renderPage();

    expect(await screen.findByText('Total scans')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByTitle('22/09: 6 scans')).toBeInTheDocument();
    expect(seenUrls).toHaveLength(1);
  });

  it('recharge avec une nouvelle période au changement du select', async () => {
    const seenUrls: string[] = [];
    server.use(
      http.get(`${BASE}/qrcodes/:id/stats`, ({ request }) => {
        seenUrls.push(request.url);
        return HttpResponse.json(fakeStats({ totalScans: 1, scansUniques: 1, evolution: [] }));
      }),
    );

    renderPage();
    await screen.findByText('Total scans');

    const callsBefore = seenUrls.length;
    await userEvent.selectOptions(screen.getByRole('combobox'), '30j');

    await waitFor(() => expect(seenUrls.length).toBeGreaterThan(callsBefore));
  });

  it('affiche l’erreur API sans planter', async () => {
    server.use(http.get(`${BASE}/qrcodes/:id/stats`, () => HttpResponse.json({}, { status: 403 })));

    renderPage();

    expect(await screen.findByText('Retour à la liste')).toBeInTheDocument();
  });
});
