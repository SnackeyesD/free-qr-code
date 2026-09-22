import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { api } from '@/lib/api';
import { TEST_API_BASE as API_BASE } from '@/test/base';

describe('api — intercepteur 401 + refresh', () => {
  let instanceMock: MockAdapter;
  let globalMock: MockAdapter;

  beforeEach(() => {
    localStorage.clear();
    instanceMock = new MockAdapter(api);
    globalMock = new MockAdapter(axios);
  });

  afterEach(() => {
    instanceMock.restore();
    globalMock.restore();
    localStorage.clear();
  });

  it('rejoue la requête avec le nouveau token après refresh réussi', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    instanceMock
      .onGet('/protected')
      .replyOnce(401)
      .onGet('/protected')
      .reply(200, { ok: true });
    globalMock.onPost(`${API_BASE}/auth/refresh`).reply(200, { accessToken: 'fresh-token' });

    const { data } = await api.get('/protected');

    expect(data).toEqual({ ok: true });
    expect(localStorage.getItem('accessToken')).toBe('fresh-token');
    expect(instanceMock.history.get).toHaveLength(2);
    expect(instanceMock.history.get[1]?.headers?.Authorization).toBe('Bearer fresh-token');
  });

  it('purge le token quand le refresh échoue', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    instanceMock.onGet('/protected').reply(401);
    globalMock.onPost(`${API_BASE}/auth/refresh`).reply(401, { error: 'revoked' });

    await expect(api.get('/protected')).rejects.toBeDefined();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('ne rafraîchit qu’une fois pour des 401 concurrents, sans boucle', async () => {
    localStorage.setItem('accessToken', 'expired-token');
    instanceMock.onGet('/concurrent').reply(401);
    globalMock.onPost(`${API_BASE}/auth/refresh`).replyOnce(200, { accessToken: 'fresh-token' });

    const [first, second] = await Promise.allSettled([api.get('/concurrent'), api.get('/concurrent')]);

    expect(first.status).toBe('rejected');
    expect(second.status).toBe('rejected');
    expect(globalMock.history.post).toHaveLength(1);
  });
});
