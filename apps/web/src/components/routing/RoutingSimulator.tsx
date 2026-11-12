import { useState } from 'react';
import type {
  FamilleAppareil,
  RoutingConfig,
  RoutingSimulationResult,
} from '@free-qr/shared-types';
import { routingApi, routingErrorMessage } from '@/lib/routingApi';

function maintenantLocal(): string {
  const date = new Date();
  const decalage = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 16);
}

interface RoutingSimulatorProps {
  qrId: string;
  config: RoutingConfig | null;
}

export function RoutingSimulator({ qrId, config }: RoutingSimulatorProps) {
  const [pays, setPays] = useState('CG');
  const [ville, setVille] = useState('Brazzaville');
  const [langue, setLangue] = useState('fr');
  const [appareil, setAppareil] = useState<FamilleAppareil>('mobile');
  const [scansAppareil, setScansAppareil] = useState('');
  const [date, setDate] = useState(maintenantLocal());
  const [isLoading, setIsLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<RoutingSimulationResult | null>(null);

  async function tester() {
    if (!config) {
      setErreur("Enregistre d'abord une configuration.");
      return;
    }
    setIsLoading(true);
    setErreur(null);
    try {
      const nombreAppareil = Number.parseInt(scansAppareil, 10);
      const reponse = await routingApi.simulate(qrId, {
        config,
        pays: pays.trim().toUpperCase() || undefined,
        ville: ville.trim() || undefined,
        langue: langue.trim().toLowerCase() || undefined,
        appareil,
        scansAppareil:
          Number.isFinite(nombreAppareil) && nombreAppareil > 0
            ? nombreAppareil
            : undefined,
        date: date ? new Date(date).toISOString() : undefined,
      });
      setResultat(reponse);
    } catch (err) {
      setResultat(null);
      setErreur(routingErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Pays</span>
          <input
            type="text"
            maxLength={2}
            value={pays}
            onChange={(e) => setPays(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Ville</span>
          <input
            type="text"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            placeholder="(inconnue)"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Langue</span>
          <input
            type="text"
            maxLength={2}
            value={langue}
            onChange={(e) => setLangue(e.target.value.toLowerCase())}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Appareil</span>
          <select
            value={appareil}
            onChange={(e) => setAppareil(e.target.value as FamilleAppareil)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablette</option>
            <option value="desktop">Ordinateur</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Scan appareil n°</span>
          <input
            type="number"
            min={1}
            value={scansAppareil}
            onChange={(e) => setScansAppareil(e.target.value)}
            placeholder="inconnu"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date et heure</span>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void tester()}
        disabled={isLoading}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isLoading ? 'Simulation…' : 'Tester ce contexte'}
      </button>

      {erreur && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>
      )}

      {resultat && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Destination servie
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{resultat.libelle}</p>
          <p className="break-all text-xs text-gray-600">{resultat.contenu}</p>
          <p className="mt-1 text-xs text-gray-500">
            {resultat.regleId
              ? `Règle déclenchée : ${resultat.regleId}`
              : 'Aucune règle : variante par défaut'}
          </p>

          {resultat.trace.length > 0 && (
            <ul className="mt-3 space-y-1">
              {resultat.trace.map((etape) => (
                <li
                  key={etape.regleId}
                  className={`text-xs ${
                    etape.correspond ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  {etape.correspond ? '✓' : '✗'} {etape.regleId} ({etape.priorite}) —{' '}
                  {etape.motif}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
