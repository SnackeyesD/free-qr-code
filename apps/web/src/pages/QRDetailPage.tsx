import { Link, useParams, useNavigate } from 'react-router-dom';
import { QRPreview } from '@/components/QRPreview';
import { useQR } from '@/hooks/useQR';

export default function QRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { qr, isLoading, error, remove, downloadImage, toggleActive } = useQR(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Chargement…</p>
      </div>
    );
  }

  if (error || !qr) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error || 'QR code introuvable.'}
        </div>
        <Link
          to="/dashboard/qr"
          className="inline-flex rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Retour à la liste
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement ce QR code ?')) return;
    const ok = await remove();
    if (ok) navigate('/dashboard/qr');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Détail du QR code</h2>
          <p className="mt-1 text-sm text-gray-600">
            {qr.estDynamique ? 'QR dynamique' : 'QR statique'} •{' '}
            {qr.estActif ? (
              <span className="text-green-600">Actif</span>
            ) : (
              <span className="text-red-600">Inactif</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleActive()}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              qr.estActif
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {qr.estActif ? 'Désactiver' : 'Activer'}
          </button>
          <Link
            to={`/dashboard/qr/${qr.id}/edit`}
            className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Modifier
          </Link>
          <Link
            to={`/dashboard/qr/${qr.id}/stats`}
            className="rounded-md bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
          >
            Statistiques
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded-md bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Contenu encodé</dt>
              <dd className="mt-1 break-all text-sm text-gray-900">{qr.contenu}</dd>
            </div>
            {qr.aliasCourt && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Alias court</dt>
                <dd className="mt-1 text-sm text-gray-900">{qr.aliasCourt}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-gray-500">Scans total</dt>
              <dd className="mt-1 text-sm text-gray-900">{qr.nombreScansTotal}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Date de création</dt>
              <dd className="mt-1 text-sm text-gray-900">{new Date(qr.dateCreation).toLocaleString('fr-FR')}</dd>
            </div>
            {qr.dateExpiration && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Date d'expiration</dt>
                <dd className="mt-1 text-sm text-gray-900">{new Date(qr.dateExpiration).toLocaleString('fr-FR')}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">QR code</h3>
          <div className="mt-4 flex justify-center">
            <QRPreview content={qr.contenu} design={qr.parametres} size={260} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(['png', 'svg', 'pdf'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => void downloadImage(format)}
                className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              >
                Télécharger {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
