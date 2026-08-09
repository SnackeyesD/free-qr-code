import { toBuffer, toString } from "qrcode";
import type { QRCodeDesign } from "@free-qr/shared-types";
import { Resvg } from "@cf-wasm/resvg/workerd";
import { PDFDocument } from "pdf-lib";

export interface GeneratedImage {
  buffer: ArrayBuffer;
  mimeType: string;
  extension: string;
}

async function pngToPdf(
  pngBytes: Uint8Array,
  size: number,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([size, size]);
  const pngImage = await pdfDoc.embedPng(pngBytes);
  page.drawImage(pngImage, { x: 0, y: 0, width: size, height: size });
  return pdfDoc.save();
}

async function svgToPng(svgString: string, width: number): Promise<Uint8Array> {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

export async function generateQRCodeImage(
  content: string,
  design: QRCodeDesign = {},
): Promise<GeneratedImage> {
  const formatImage = design.formatImage || "png";
  const width = design.taille || 512;
  const color = {
    dark: design.couleur || "#000000",
    light: design.background || "#FFFFFF",
  };
  const margin = design.cadre === false ? 0 : 2;
  const errorCorrectionLevel = design.correction || "M";

  const svgString = await toString(content, {
    type: "svg",
    width,
    color,
    margin,
    errorCorrectionLevel,
  });

  if (formatImage === "svg") {
    const buffer = new TextEncoder().encode(svgString).buffer as ArrayBuffer;
    return { buffer, mimeType: "image/svg+xml", extension: "svg" };
  }

  const pngBytes = await svgToPng(svgString, width);

  if (formatImage === "png") {
    return {
      buffer: pngBytes.buffer as ArrayBuffer,
      mimeType: "image/png",
      extension: "png",
    };
  }

  if (formatImage === "pdf") {
    const pdfBytes = await pngToPdf(pngBytes, width);
    return {
      buffer: pdfBytes.buffer as ArrayBuffer,
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }

  throw new Error(`Format non supporté: ${formatImage}`);
}
export function detectTypeContenu(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (/^https?:\/\//i.test(input) || trimmed.startsWith("www.")) return "url";
  if (/^mailto:/i.test(input) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input))
    return "email";
  if (/^tel:/i.test(input) || /^\+?[\d\s\-()]{7,20}$/.test(input))
    return "telephone";
  if (/^smsto:/i.test(input) || /^sms:/i.test(input)) return "sms";
  if (/^wifi:/i.test(input) || /^(WIFI|T):/i.test(input)) return "wifi";
  if (/^BEGIN:VCARD/i.test(input) || trimmed.includes("vcard")) return "vcard";
  if (/^geo:/i.test(input) || /^[-+]?\d+\.\d+,[-+]?\d+\.\d+/.test(input))
    return "geo";
  if (trimmed.endsWith(".pdf") || input.includes("application/pdf"))
    return "pdf";
  return "texte";
}

export function encodeQRContent(type: string, content: string): string {
  const trimmed = content.trim();
  switch (type) {
    case "email":
      if (trimmed.startsWith("mailto:")) return trimmed;
      return `mailto:${trimmed}`;
    case "telephone":
      if (trimmed.startsWith("tel:")) return trimmed;
      return `tel:${trimmed.replace(/\s/g, "")}`;
    case "sms": {
      if (trimmed.startsWith("sms:") || trimmed.startsWith("smsto:"))
        return trimmed;
      const parts = trimmed.split(/[:;]/);
      if (parts.length >= 2)
        return `smsto:${parts[0]}:${parts.slice(1).join(":")}`;
      return `smsto:${trimmed}:`;
    }
    case "wifi": {
      if (trimmed.toUpperCase().startsWith("WIFI:")) return trimmed;
      const [ssid, password = ""] = trimmed.split(";");
      return `WIFI:T:WPA;S:${ssid};P:${password};;`;
    }
    case "vcard":
      if (trimmed.toUpperCase().startsWith("BEGIN:VCARD")) return trimmed;
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${trimmed}\nEND:VCARD`;
    case "geo":
      if (trimmed.startsWith("geo:")) return trimmed;
      return `geo:${trimmed}`;
    case "pdf":
      return trimmed;
    case "url":
      return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    case "texte":
    default:
      return trimmed;
  }
}
