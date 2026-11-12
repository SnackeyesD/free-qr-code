import { Link, useParams } from 'react-router-dom';
import { RoutingEditor } from '@/components/routing/RoutingEditor';
import { VarianteStatsTable } from '@/components/routing/VarianteStatsTable';
import { useRouting } from '@/hooks/useRouting';
import { useRoutingStats } from '@/hooks/useRoutingStats';

export default function QRRoutingPage() {
  const { id } = useParams<{ id: string }>();
  const { state, isLoading, isSaving, error, save, remove } = useRouting(id);
  const statsRoutage = useRoutingStats(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Routage contextuel</h2>
          <p className="mt-1 text-sm text-gray-600">
            Une seule affiche, plusieurs destinations selon l'heure, le pays, la langue, le
            nombre de scans ou l'appareil.
          </p>
        </div>
        <Link
          to={id ? `/dashboard/qr/${id}` : '/dashboard/qr'}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Retour au QR
        </Link>
      </div>

      {isLoading && (
        <div className="rounded-lg bg-white p-6 text-sm text-gray-600 shadow-sm">
          Chargement de la configuration…
        </div>
      )}

      {!isLoading && !state && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Impossible de charger la configuration de routage.'}
        </div>
      )}

      {!isLoading && state && id && (
        <>
          <RoutingEditor
            qrId={id}
            state={state}
            isSaving={isSaving}
            error={error}
            onSave={save}
            onDelete={remove}
          />
          <VarianteStatsTable
            stats={statsRoutage.stats}
            isLoading={statsRoutage.isLoading}
            error={statsRoutage.error}
            periode={statsRoutage.periode}
            onPeriodeChange={statsRoutage.setPeriode}
            onTelechargerCsv={statsRoutage.telechargerCsv}
          />
        </>
      )}
    </div>
  );
}
