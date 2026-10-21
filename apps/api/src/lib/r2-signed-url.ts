// src/lib/r2-signed-url.ts
// Signature HMAC-SHA256 des URLs d'images R2 servies par le worker (/r2/*).
// La signature porte sur `${key}\n${exp}` ; la clé est R2_SIGNING_SECRET,
// avec repli sur JWT_ACCESS_SECRET pour ne pas casser les déploiements
// existants. Une URL stockée en base n'est jamais exposée telle quelle :
// elle est re-signée (avec une expiration fraîche) à chaque lecture.
import type { AppEnv } from "../types/index.js";

export const R2_URL_TTL_SECONDS = 7 * 24 * 3600; // 7 jours

type Bindings = AppEnv["Bindings"];

function signingSecret(env: Bindings): string {
  return env.R2_SIGNING_SECRET ?? env.JWT_ACCESS_SECRET;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(env: Bindings, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return toBase64Url(signature);
}

/**
 * Extrait la clé R2 (`users/…`) d'une URL publique stockée en base.
 * Retourne null pour les URLs hors worker (ex. R2_PUBLIC_URL direct).
 */
export function extractR2Key(url: string): string | null {
  const marker = "/r2/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length).split("?")[0];
}

/**
 * Re-signe une URL d'image stockée (expiration fraîche à chaque lecture).
 * Retourne undefined si l'URL ne passe pas par le worker (non signable).
 */
export async function signR2Url(
  env: Bindings,
  url: string,
  ttlSeconds: number = R2_URL_TTL_SECONDS,
): Promise<string | undefined> {
  const key = extractR2Key(url);
  if (!key) return undefined;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmacSha256(env, `${key}\n${exp}`);
  return `${url.split("?")[0]}?exp=${exp}&sig=${sig}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/** Vérifie la signature + l'expiration d'une requête /r2/*. */
export async function verifyR2Signature(
  env: Bindings,
  key: string,
  expRaw: string | undefined,
  sig: string | undefined,
): Promise<boolean> {
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
  const expected = await hmacSha256(env, `${key}\n${exp}`);
  return timingSafeEqual(expected, sig);
}
