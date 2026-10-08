// src/services/r2Image.service.ts
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types/index.js";

export interface QRImageResult {
  body: ReadableStream;
  contentType: string;
  etag?: string;
}

export async function getQRImage(
  env: AppEnv["Bindings"],
  userId: string,
  filename: string,
): Promise<QRImageResult> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: "Invalid user id" });
  }

  if (!env.QR_IMAGES) {
    throw new HTTPException(500, { message: "R2 storage not configured" });
  }

  const key = `users/${userId}/qrcodes/${filename}`;
  const object = await env.QR_IMAGES.get(key);

  if (!object) {
    throw new HTTPException(404, { message: "Image not found" });
  }

  const contentType = filename.endsWith(".png")
    ? "image/png"
    : filename.endsWith(".svg")
      ? "image/svg+xml"
      : (object.httpMetadata?.contentType ?? "application/octet-stream");

  return {
    body: object.body,
    contentType,
    etag: object.httpEtag,
  };
}
