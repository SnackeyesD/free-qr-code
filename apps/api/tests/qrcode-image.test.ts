import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateQRCodeImage } from "../src/lib/qr-generator.js";
import { makeRequest, createTestEnv, createTestApp } from "./setup.js";

// Note : @cf-wasm/resvg est substitué par tests/mocks/resvg-workerd.ts
// (alias vitest, workerd-only). Les assertions portent sur le plumbing
// (marges SVG, buffers exacts, mime-types), pas sur le rendu resvg
// lui-même (vérifié en recette dev). Le mini-PNG du stub est valide
// (signature + CRC corrects), donc pdf-lib l'accepte aussi.

const app = createTestApp();

// Premier module sombre du path SVG : d="M<col> <row>.5h…"
// (col/row incluent la marge puisqu'elle fait partie du viewBox).
function firstDarkModule(svg: string): { col: number; row: number } {
  const m = svg.match(/<path stroke="[^"]+" d="M(\d+) ([\d.]+)h/);
  if (!m) throw new Error("module sombre introuvable dans le SVG");
  return { col: Number(m[1]), row: Math.floor(Number(m[2])) };
}

describe("QRCode image — marge et buffers", () => {
  it("garantit >= 4 modules de silence même avec cadre:false", async () => {
    for (const design of [
      { cadre: false as const },
      {},
      { cadre: true as const },
    ]) {
      // Marge lue sur le SVG (même géométrie que le PNG, sans resvg).
      const { buffer } = await generateQRCodeImage("https://youtu.be/abc123", {
        couleur: "#000000",
        background: "#ffffff",
        taille: 400,
        correction: "M",
        formatImage: "svg",
        ...design,
      });
      const svg = Buffer.from(buffer).toString("utf-8");
      const { col, row } = firstDarkModule(svg);
      expect(col).toBeGreaterThanOrEqual(4);
      expect(row).toBeGreaterThanOrEqual(4);
    }
  });

  it("retourne des buffers exacts par format", async () => {
    const png = await generateQRCodeImage("https://example.com", {
      formatImage: "png",
    });
    expect(png.mimeType).toBe("image/png");
    expect(png.buffer.byteLength).toBeGreaterThan(8);
    const pngBytes = new Uint8Array(png.buffer);
    expect(Array.from(pngBytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // Le buffer se termine exactement sur le chunk IEND (pas d'octets parasites).
    expect(Array.from(pngBytes.slice(-12, -8))).toEqual([0, 0, 0, 0]);
    expect(Buffer.from(pngBytes.slice(-8, -4)).toString("ascii")).toBe("IEND");

    const svg = await generateQRCodeImage("https://example.com", {
      formatImage: "svg",
    });
    expect(svg.mimeType).toBe("image/svg+xml");
    expect(Buffer.from(svg.buffer).toString("utf-8")).toMatch(/^<svg/);

    const pdf = await generateQRCodeImage("https://example.com", {
      formatImage: "pdf",
    });
    expect(pdf.mimeType).toBe("application/pdf");
    expect(Buffer.from(pdf.buffer.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });
});

describe("GET /preview/qr", () => {
  let ctx: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it("retourne un SVG sans auth", async () => {
    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      "/preview/qr?content=https://example.com&couleur=%23000000&background=%23ffffff&size=400&correction=M",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    const body = await res.text();
    expect(body).toMatch(/^<svg/);
    const { col, row } = firstDarkModule(body);
    expect(col).toBeGreaterThanOrEqual(4);
    expect(row).toBeGreaterThanOrEqual(4);
  });

  it("rejette l'absence de content (400)", async () => {
    const res = await makeRequest(app, ctx.env, "GET", "/preview/qr?size=400");
    expect(res.status).toBe(400);
  });

  it("rejette une couleur invalide (400)", async () => {
    const res = await makeRequest(
      app,
      ctx.env,
      "GET",
      "/preview/qr?content=x&couleur=red",
    );
    expect(res.status).toBe(400);
  });
});

export {};
