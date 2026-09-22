import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUsers } from '@/hooks/useUsers';

describe('useUsers', () => {
  it('charge la liste paginée depuis GET /admin/users', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => expect(result.current.users).toHaveLength(2));

    expect(result.current.total).toBe(2);
    expect(result.current.error).toBeNull();
    expect(result.current.users[0]?.email).toBe('test@example.com');
  });

  it('toggleActive met à jour puis recharge', async () => {
    const { result } = renderHook(() => useUsers());

    await waitFor(() => expect(result.current.users).toHaveLength(2));
    await result.current.toggleActive('2', false);

    expect(result.current.error).toBeNull();
  });
});
