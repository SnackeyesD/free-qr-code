import { useState } from 'react';

export function QrPreviewSlide({
  src,
  alt,
  beam = false,
}: {
  src: string;
  alt: string;
  beam?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative mt-4 aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          width={320}
          height={320}
          className="absolute inset-0 h-full w-full"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gray-50 p-8 text-center text-sm text-gray-500">
          Aperçu indisponible hors connexion — vos QR restent accessibles dans le tableau de bord.
        </div>
      )}
      {!failed && beam && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent motion-safe:animate-scan"
        />
      )}
    </div>
  );
}
