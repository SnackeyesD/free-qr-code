// tests/r2-signed-url.test.ts
import { describe, it, expect } from "vitest";
import {
  extractR2Key,
  signR2Url,
  verifyR2Signature,
} from "../src/lib/r2-signed-url.js";
import { createTestApp, createTestEnv, makeRequest } from "./setup.js";

const KEY = "users/1/qrcodes/42.png";
const STORED_URL = `http://localhost:8787/r2/${KEY}`;

describe("r2-signed-url (unitaire)", () => {
  it("extrait la clé R2 d'une URL worker", () => {
    expect(extractR2Key(STORED_URL)).toBe(KEY);
    expect(extractR2Key(`${STORED_URL}?exp=1&sig=abc`)).toBe(KEY);
    expect(extractR2Key("https://pub.r2.dev/users/1/qrcodes/42.png")).toBeNull();
  });

  it("signe puis vérifie une URL (round-trip)", async () => {
    const { env, cleanup } = createTestEnv();
    const signed = await signR2Url(env, STORED_URL);
    expect(signed).toBeDefined();
    const url = new URL(signed!);
    const ok = await verifyR2Signature(
      env,
      KEY,
      url.searchParams.get("exp") ?? undefined,
      url.searchParams.get("sig") ?? undefined,
    );
    expect(ok).toBe(true);
    cleanup();
  });

  it("rejette une signature invalide, une expiration passée et une URL hors worker", async () => {
    const { env, cleanup } = createTestEnv();
    const signed = new URL((await signR2Url(env, STORED_URL))!);
    const exp = signed.searchParams.get("exp")!;
    const sig = signed.searchParams.get("sig")!;

    expect(await verifyR2Signature(env, KEY, exp, "AAAA")).toBe(false);
    expect(await verifyR2Signature(env, "users/1/qrcodes/43.png", exp, sig)).toBe(false);
    expect(await verifyR2Signature(env, KEY, "1000000000", sig)).toBe(false); // expiré (2001)
    expect(await verifyR2Signature(env, KEY, undefined, sig)).toBe(false);
    expect(await verifyR2Signature(env, KEY, exp, undefined)).toBe(false);
    expect(await signR2Url(env, "https://pub.r2.dev/users/1/qrcodes/42.png")).toBeUndefined();
    cleanup();
  });

  it("produit des signatures différentes avec un R2_SIGNING_SECRET dédié", async () => {
    const { env, cleanup } = createTestEnv();
    const withFallback = await signR2Url(env, STORED_URL);
    const withDedicated = await signR2Url(
      { ...env, R2_SIGNING_SECRET: "r2-dedicated-secret" },
      STORED_URL,
    );
    expect(withDedicated).not.toBe(withFallback);
    cleanup();
  });
});

describe("GET /r2/users/:userId/qrcodes/:filename (route)", () => {
  function envWithR2() {
    const { env, cleanup } = createTestEnv();
    const objects = new Map<string, Uint8Array>([
      [KEY, new TextEncoder().encode("fake-png-bytes")],
    ]);
    env.QR_IMAGES = {
      async get(key: string) {
        const data = objects.get(key);
        if (!data) return null;
        return {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(data);
              controller.close();
            },
          }),
          httpEtag: '"fake-etag"',
          httpMetadata: { contentType: "image/png" },
        };
      },
    } as unknown as NonNullable<typeof env.QR_IMAGES>;
    return { env, cleanup };
  }

  it("403 sans signature, même pour un objet existant", async () => {
    const app = createTestApp();
    const { env, cleanup } = envWithR2();
    const res = await makeRequest(app, env, "GET", `/r2/${KEY}`);
    expect(res.status).toBe(403);
    cleanup();
  });

  it("200 avec une URL signée par l'API", async () => {
    const app = createTestApp();
    const { env, cleanup } = envWithR2();
    const signed = new URL((await signR2Url(env, STORED_URL))!);
    const res = await makeRequest(
      app,
      env,
      "GET",
      `/r2/${KEY}${signed.search}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toContain("private");
    cleanup();
  });

  it("403 avec une signature valide mais expirée", async () => {
    const app = createTestApp();
    const { env, cleanup } = envWithR2();
    const signed = new URL((await signR2Url(env, STORED_URL, -3600))!);
    const res = await makeRequest(
      app,
      env,
      "GET",
      `/r2/${KEY}${signed.search}`,
    );
    expect(res.status).toBe(403);
    cleanup();
  });
});
