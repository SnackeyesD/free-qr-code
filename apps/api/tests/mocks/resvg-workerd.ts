// Stub workerd-only de @cf-wasm/resvg pour vitest/Node.
// Le vrai module importe 'wbg' (glue wasm-bindgen), irrésolvable hors workerd :
// sans cet alias, tout fichier important qr-generator.ts échoue à l'import.
// Le rendu réel est vérifié en recette dev (wrangler dev + curl).
// Rend un mini-PNG 1x1 valide et déterministe (signature + CRC corrects).
import { deflateSync, crc32 } from "node:zlib";

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(name, 4);
  out.set(data, 8);
  view.setUint32(
    8 + data.length,
    crc32(Buffer.concat([Buffer.from(name), Buffer.from(data)])) >>> 0,
  );
  return out;
}

function miniPng(): Uint8Array {
  const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const idat = deflateSync(Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff]));
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export class Resvg {
  render(): { asPng: () => Uint8Array } {
    return { asPng: () => miniPng() };
  }
}

export function initResvg(): void {}
