import { useState, useEffect, useCallback } from 'react';
import type { QRCode, QRCodeUpdateInput } from '@free-qr/shared-types';
import { qrApi } from '@/lib/qrApi';

interface UseQRReturn {
  qr: QRCode | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  update: (input: QRCodeUpdateInput) => Promise<QRCode | null>;
  remove: () => Promise<boolean>;
  downloadImage: (format: 'png' | 'svg') => Promise<void>;
  toggleActive: () => Promise<QRCode | null>;
}

export function useQR(id: string | undefined): UseQRReturn {
  const [qr, setQr] = useState<QRCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await qrApi.getById(id);
      setQr(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du QR code');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const update = useCallback(
    async (input: QRCodeUpdateInput) => {
      if (!id) return null;
      try {
        const data = await qrApi.update(id, input);
        setQr(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
        return null;
      }
    },
    [id],
  );

  const remove = useCallback(async () => {
    if (!id) return false;
    try {
      await qrApi.remove(id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      return false;
    }
  }, [id]);

  const downloadImage = useCallback(
    async (format: 'png' | 'svg' = 'png') => {
      if (!id || !qr) return;
      const blob = await qrApi.downloadImage(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${qr.aliasCourt || qr.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [id, qr],
  );

  const toggleActive = useCallback(async () => {
    if (!qr) return null;
    return update({ estActif: !qr.estActif });
  }, [qr, update]);

  return {
    qr,
    isLoading,
    error,
    refetch,
    update,
    remove,
    downloadImage,
    toggleActive,
  };
}
