import type { R2Bucket } from '@cloudflare/workers-types';

export async function uploadQRImage(
  bucket: R2Bucket,
  key: string,
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ key: string }> {
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000' },
    customMetadata: { uploadedAt: new Date().toISOString() },
  });
  return { key };
}

export function buildQRImageKey(userId: string, qrId: string, extension: string): string {
  return `users/${userId}/qrcodes/${qrId}.${extension}`;
}

export async function deleteQRImage(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export function getPublicR2Url(
  env: { R2_PUBLIC_URL?: string; API_BASE_URL?: string },
  key: string,
): string {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `${env.API_BASE_URL?.replace(/\/$/, '') ?? ''}/r2/${key}`;
}
