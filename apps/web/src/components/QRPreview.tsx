import { useMemo, useState } from "react";
import type { QRCodeDesign } from "@free-qr/shared-types";

interface QRPreviewProps {
  content: string;
  design: QRCodeDesign;
  imageUrl?: string;
  size?: number;
  className?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function QRPreview({
  content,
  design,
  imageUrl,
  size = 200,
  className = "",
}: QRPreviewProps) {
  const [error, setError] = useState(false);

  const livePreviewUrl = useMemo(() => {
    if (imageUrl || !content) return null; // pas besoin si on a déjà une image
    try {
      const params = new URLSearchParams();
      params.set("content", content);
      if (design.couleur) params.set("couleur", design.couleur);
      if (design.background) params.set("background", design.background);
      if (design.taille)
        params.set("size", String(Math.min(design.taille, 600)));
      if (design.correction) params.set("correction", design.correction);
      return `${API_BASE_URL}/preview/qr?${params.toString()}`;
    } catch {
      return null;
    }
  }, [content, design, imageUrl]);

  const resolvedUrl = imageUrl || livePreviewUrl;

  if (!content || !resolvedUrl || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm">Aperçu indisponible</span>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={resolvedUrl}
        alt="Aperçu du QR code"
        className="rounded-lg border border-gray-200 bg-white object-contain p-2"
        style={{ width: size, height: size }}
        onError={() => setError(true)}
      />
      {design.logoUrl && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ width: size, height: size }}
        >
          <img
            src={design.logoUrl}
            alt=""
            className="rounded-full border-2 border-white bg-white object-contain shadow-sm"
            style={{ width: size * 0.2, height: size * 0.2 }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      )}
    </div>
  );
}

export function QRDesignPanel({
  design,
  setDesignValue,
}: {
  design: QRCodeDesign;
  setDesignValue: <K extends keyof QRCodeDesign>(
    key: K,
    value: QRCodeDesign[K],
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="qr-color"
            className="block text-sm font-medium text-gray-700"
          >
            Couleur
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="qr-color"
              type="color"
              value={design.couleur || "#000000"}
              onChange={(e) => setDesignValue("couleur", e.target.value)}
              className="h-10 w-10 rounded border border-gray-300 p-1"
            />
            <span className="text-sm text-gray-600">
              {design.couleur || "#000000"}
            </span>
          </div>
        </div>
        <div>
          <label
            htmlFor="qr-bg"
            className="block text-sm font-medium text-gray-700"
          >
            Fond
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="qr-bg"
              type="color"
              value={design.background || "#ffffff"}
              onChange={(e) => setDesignValue("background", e.target.value)}
              className="h-10 w-10 rounded border border-gray-300 p-1"
            />
            <span className="text-sm text-gray-600">
              {design.background || "#ffffff"}
            </span>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="qr-size"
          className="block text-sm font-medium text-gray-700"
        >
          Taille de l'image ({design.taille || 400}px)
        </label>
        <input
          id="qr-size"
          type="range"
          min={200}
          max={1000}
          step={100}
          value={design.taille || 400}
          onChange={(e) => setDesignValue("taille", Number(e.target.value))}
          className="mt-1 w-full"
        />
      </div>

      <div>
        <label
          htmlFor="qr-correction"
          className="block text-sm font-medium text-gray-700"
        >
          Niveau de correction
        </label>
        <select
          id="qr-correction"
          value={design.correction || "M"}
          onChange={(e) =>
            setDesignValue(
              "correction",
              e.target.value as QRCodeDesign["correction"],
            )
          }
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        >
          <option value="L">L (~7%)</option>
          <option value="M">M (~15%)</option>
          <option value="Q">Q (~25%)</option>
          <option value="H">H (~30%)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="qr-frame"
          type="checkbox"
          checked={design.cadre || false}
          onChange={(e) => setDesignValue("cadre", e.target.checked)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="qr-frame" className="text-sm font-medium text-gray-700">
          Ajouter un cadre
        </label>
      </div>

      <div>
        <label
          htmlFor="qr-logo"
          className="block text-sm font-medium text-gray-700"
        >
          URL du logo (optionnel)
        </label>
        <input
          id="qr-logo"
          type="url"
          value={design.logoUrl || ""}
          onChange={(e) => setDesignValue("logoUrl", e.target.value)}
          placeholder="https://example.com/logo.png"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
