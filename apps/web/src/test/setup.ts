import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './handlers';

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
afterAll(() => server.close());
