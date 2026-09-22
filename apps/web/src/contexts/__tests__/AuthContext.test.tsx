import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { fakeUser } from '@/test/fixtures';

function Probe() {
  const { user, login } = useAuth();
  return (
    <div>
      <div>{user ? `hello:${user.email}` : 'no-user'}</div>
      <button
        type="button"
        onClick={() => login({ email: 'test@example.com', motDePasse: 'password123' })}
      >
        login
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthContext', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    localStorage.clear();
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
    localStorage.clear();
  });

  it('login stocke le token et définit le user', async () => {
    const user = fakeUser();
    mock
      .onPost('/auth/login')
      .reply(200, { accessToken: 'access-test', expiresAt: 9999999999, user });

    renderAuth();
    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(await screen.findByText('hello:test@example.com')).toBeInTheDocument();
    expect(localStorage.getItem('accessToken')).toBe('access-test');
  });

  it('le mount restaure la session via GET /me/me', async () => {
    const user = fakeUser();
    localStorage.setItem('accessToken', 'access-test');
    mock.onGet('/me/me').reply(200, user);

    renderAuth();

    expect(await screen.findByText('hello:test@example.com')).toBeInTheDocument();
  });
});
