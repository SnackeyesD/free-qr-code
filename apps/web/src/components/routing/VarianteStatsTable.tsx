import type { RoutingStatsResult, RoutingVarianteStat } from '@free-qr/shared-types';
import type { PeriodeRoutage } from '@/hooks/useRoutingStats';

const PERIODES: Array<{ valeur: PeriodeRoutage; libelle: string }> = [
  { valeur: '24h', libelle: '24 dernières heures' },
  { valeur: '7j', libelle: '7 derniers jours' },
  { valeur: '30j', libelle: '30 derniers jours' },
  { valeur: '90j', libelle: '90 derniers jours' },
  { valeur: '1an', libelle: '1 an' },
];

function topEntrees(repartition: Record<string, number>, max = 3): string {
  const entrees = Object.entries(repartition).sort((a, b) => b[1] - a[1]);
  if (entrees.length === 0) return '—';
  return entrees
    .slice(0, max)
    .map(([cle, valeur]) => `${cle} (${valeur})`)
    .join(', ');
}

function pourcentage(part: number): string {
  return `${(part * 100).toFixed(1)} %`;
}

function LigneVariante({ variante }: { variante: RoutingVarianteStat }) {
  return (
    <tr className="align-top">
      <td className="py-3 pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{variante.libelle}</span>
          {variante.supprimee && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              supprimée
            </span>
          )}
        </div>
        {variante.varianteId === null && (
          <p className="mt-1 text-[11px] text-gray-500">
            Scans sans routage : config absente ou inactive au moment du scan.
          </p>
        )}
        {variante.supprimee && (
          <p className="mt-1 text-[11px] text-gray-500">
            Cette variante n'existe plus dans la configuration ; l'historique est conservé.
          </p>
        )}
      </td>
      <td className="py-3 pr-3 text-right font-semibold text-gray-900">{variante.scans}</td>
      <td className="py-3 pr-3 text-right text-gray-700">{variante.scansUniques}</td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${Math.round(variante.part * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-700">{pourcentage(variante.part)}</span>
        </div>
      </td>
      <td className="py-3 pr-3 text-xs text-gray-700">{topEntrees(variante.langues)}</td>
      <td className="py-3 text-xs text-gray-700">{topEntrees(variante.pays)}</td>
    </tr>
  );
}

interface VarianteStatsTableProps {
  stats: RoutingStatsResult | null;
  isLoading: boolean;
  error: string | null;
  periode: PeriodeRoutage;
  onPeriodeChange: (periode: PeriodeRoutage) => void;
  onTelechargerCsv: () => Promise<void>;
}

export function VarianteStatsTable({
  stats,
  isLoading,
  error,
  periode,
  onPeriodeChange,
  onTelechargerCsv,
}: VarianteStatsTableProps) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Scans par destination</h3>
          <p className="mt-1 text-xs text-gray-600">
            Nombre de scans servis par chaque variante. Ce sont des <strong>scans</strong>, pas des
            conversions : aucune donnée de conversion n'est collectée à ce stade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periode}
            onChange={(e) => onPeriodeChange(e.target.value as PeriodeRoutage)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            aria-label="Période des statistiques de routage"
          >
            {PERIODES.map((option) => (
              <option key={option.valeur} value={option.valeur}>
                {option.libelle}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onTelechargerCsv()}
            className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {isLoading && <p className="mt-4 text-sm text-gray-600">Chargement des statistiques…</p>}

      {!isLoading && stats && stats.alertes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {stats.alertes.map((alerte) => (
            <li
              key={alerte.varianteId}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {alerte.message}
            </li>
          ))}
        </ul>
      )}

      {!isLoading && stats && stats.variantes.length > 0 && stats.totalScans < 30 && (
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          Échantillon faible ({stats.totalScans} scans) : trop tôt pour conclure sur la
          performance d'une destination.
        </p>
      )}

      {!isLoading && stats && stats.variantes.length === 0 && (
        <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
          Aucun scan sur cette période.
        </p>
      )}

      {!isLoading && stats && stats.variantes.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="pb-2 text-left font-medium text-gray-500">Destination</th>
                <th className="pb-2 pr-3 text-right font-medium text-gray-500">Scans</th>
                <th className="pb-2 pr-3 text-right font-medium text-gray-500">Uniques</th>
                <th className="pb-2 pr-3 text-left font-medium text-gray-500">Part</th>
                <th className="pb-2 pr-3 text-left font-medium text-gray-500">Langues</th>
                <th className="pb-2 text-left font-medium text-gray-500">Pays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.variantes.map((variante) => (
                <LigneVariante key={variante.varianteId ?? 'sans-routage'} variante={variante} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 text-xs text-gray-600">
                <td className="pt-3 font-medium">Total</td>
                <td className="pt-3 pr-3 text-right font-semibold text-gray-900">
                  {stats.totalScans}
                </td>
                <td className="pt-3 pr-3 text-right">{stats.scansUniques}</td>
                <td className="pt-3 pr-3" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
