import { useState, useCallback } from 'react';
import type { QRCodeInput, QRCode } from '@free-qr/shared-types';
import { qrApi } from '@/lib/qrApi';

interface UseQRCreateReturn {
  create: (input: QRCodeInput) => Promise<QRCode | null>;
  isLoading: boolean;
  error: string | null;
  resetError: () => void;
}

export function useQRCreate(): UseQRCreateReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = useCallback(() => setError(null), []);

  const create = useCallback(async (input: QRCodeInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await qrApi.create(input);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du QR code');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { create, isLoading, error, resetError };
}
