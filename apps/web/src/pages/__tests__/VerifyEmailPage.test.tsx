import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import { server } from '@/test/handlers';
import { TEST_API_BASE as BASE } from '@/test/base';

function renderPage(token: string | null) {
  const entry = token ? `/verify-email?token=${token}` : '/verify-email';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  it('POST /auth/verify-email puis affiche le succès', async () => {
    let seenMethod = '';
    let seenBody: unknown = null;
    server.use(
      http.post(`${BASE}/auth/verify-email`, async ({ request }) => {
        seenMethod = request.method;
        seenBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );

    renderPage('token-abc');

    expect(await screen.findByText('Email confirmé !')).toBeInTheDocument();
    expect(seenMethod).toBe('POST');
    expect(seenBody).toEqual({ token: 'token-abc' });
  });

  it('affiche une erreur quand le token est rejeté', async () => {
    server.use(http.post(`${BASE}/auth/verify-email`, () => HttpResponse.json({}, { status: 400 })));

    renderPage('bad-token');

    expect(await screen.findByText('Lien invalide')).toBeInTheDocument();
  });

  it('affiche une erreur sans token dans l’URL', async () => {
    renderPage(null);

    expect(await screen.findByText('Lien invalide')).toBeInTheDocument();
  });
});
