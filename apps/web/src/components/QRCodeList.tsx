import { useMemo } from 'react';
import type { QRCode } from '@free-qr/shared-types';
import { Link } from 'react-router-dom';
 import { buildPreviewUrl } from '@/lib/qrPreview';
interface QRCodeCardProps {
  qr: QRCode;
  onDelete?: (id: string) => void;
}

export function QRCodeCard({ qr, onDelete }: QRCodeCardProps) {
  const imageUrl = useMemo(() => {
    if (qr.urlImage) return qr.urlImage;
    return buildPreviewUrl(qr.contenu, qr.parametres, 200);
  }, [qr]);

  const typeLabel = qr.estDynamique ? 'Dynamique' : 'Statique';
  const typeClass = qr.estDynamique
    ? 'bg-indigo-100 text-indigo-800'
    : 'bg-gray-100 text-gray-800';

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-md border border-gray-100 bg-white object-contain p-1"
          />
        ) : (
          <div className="flex shrink-0 h-20 w-20 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
            QR
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeClass}`}>
              {typeLabel}
            </span>
            <span className={`text-xs ${qr.estActif ? 'text-green-600' : 'text-red-600'}`}>
              {qr.estActif ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <Link
            to={`/dashboard/qr/${qr.id}`}
            className="mt-1 block truncate text-sm font-semibold text-gray-900 hover:text-indigo-600"
          >
            {qr.aliasCourt || qr.contenu}
          </Link>
          <p className="mt-0.5 truncate text-xs text-gray-500" title={qr.contenu}>
            {qr.contenu}
          </p>
          {qr.estDynamique ? (
           <div className="mt-2 text-xs text-gray-500">
             {qr.nombreScansTotal} scan{qr.nombreScansTotal !== 1 ? 's' : ''}
           </div>
         ) : (
           <div className="mt-2 text-xs italic text-gray-400">Suivi des scans non disponible en statique</div>
         )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          to={`/dashboard/qr/${qr.id}`}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Détails
        </Link>
        <Link
          to={`/dashboard/qr/${qr.id}/stats`}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Stats
        </Link>
        <Link
          to={`/dashboard/qr/${qr.id}/edit`}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Modifier
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(qr.id)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}

interface QRCodeListProps {
  qrcodes: QRCode[];
  onDelete?: (id: string) => void;
}

export function QRCodeList({ qrcodes, onDelete }: QRCodeListProps) {
  if (qrcodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-600">Aucun QR code pour le moment.</p>
        <Link
          to="/dashboard/qr/new"
          className="mt-4 inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Créer un QR code
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {qrcodes.map((qr) => (
        <QRCodeCard key={qr.id} qr={qr} onDelete={onDelete} />
      ))}
    </div>
  );
}
