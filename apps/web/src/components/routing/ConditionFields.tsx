import type { FamilleAppareil, RoutingConditions } from '@free-qr/shared-types';

const JOURS: Array<{ valeur: number; libelle: string }> = [
  { valeur: 1, libelle: 'L' },
  { valeur: 2, libelle: 'M' },
  { valeur: 3, libelle: 'M' },
  { valeur: 4, libelle: 'J' },
  { valeur: 5, libelle: 'V' },
  { valeur: 6, libelle: 'S' },
  { valeur: 7, libelle: 'D' },
];

const APPAREILS: Array<{ valeur: FamilleAppareil; libelle: string }> = [
  { valeur: 'mobile', libelle: 'Mobile' },
  { valeur: 'tablet', libelle: 'Tablette' },
  { valeur: 'desktop', libelle: 'Ordinateur' },
];

type CleCondition =
  | 'langues'
  | 'pays'
  | 'villes'
  | 'jours'
  | 'heure'
  | 'dates'
  | 'appareil'
  | 'scans'
  | 'scansAppareil';

const LIBELLES: Record<CleCondition, string> = {
  langues: 'Langue',
  pays: 'Pays',
  villes: 'Ville',
  jours: 'Jour',
  heure: 'Heure',
  dates: 'Dates',
  appareil: 'Appareil',
  scans: 'Nombre de scans',
  scansAppareil: 'Scans sur cet appareil',
};

function listeDepuisTexte(texte: string): string[] {
  return texte
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** ISO 8601 → valeur acceptée par `<input type="datetime-local">` (heure locale). */
function versInputLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const decalage = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 16);
}

function depuisInputLocal(valeur: string): string | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface ConditionFieldsProps {
  value: RoutingConditions;
  onChange: (next: RoutingConditions) => void;
}

export function ConditionFields({ value, onChange }: ConditionFieldsProps) {
  const actives: Record<CleCondition, boolean> = {
    langues: value.langues !== undefined,
    pays: value.pays !== undefined,
    villes: value.villes !== undefined,
    jours: value.jours !== undefined,
    heure: value.heureMin !== undefined,
    dates: value.dates !== undefined,
    appareil: value.appareil !== undefined,
    scans: value.minScansTotal !== undefined || value.maxScansTotal !== undefined,
    scansAppareil:
      value.minScansAppareil !== undefined || value.maxScansAppareil !== undefined,
  };

  function basculer(cle: CleCondition) {
    const next: RoutingConditions = { ...value };
    if (actives[cle]) {
      switch (cle) {
        case 'langues':
          delete next.langues;
          break;
        case 'pays':
          delete next.pays;
          break;
        case 'villes':
          delete next.villes;
          break;
        case 'jours':
          delete next.jours;
          break;
        case 'heure':
          delete next.heureMin;
          delete next.heureMax;
          break;
        case 'dates':
          delete next.dates;
          break;
        case 'appareil':
          delete next.appareil;
          break;
        case 'scans':
          delete next.minScansTotal;
          delete next.maxScansTotal;
          break;
        case 'scansAppareil':
          delete next.minScansAppareil;
          delete next.maxScansAppareil;
          break;
      }
    } else {
      switch (cle) {
        case 'langues':
          next.langues = ['fr'];
          break;
        case 'pays':
          next.pays = ['CG'];
          break;
        case 'villes':
          next.villes = ['Brazzaville'];
          break;
        case 'jours':
          next.jours = [6, 7];
          break;
        case 'heure':
          next.heureMin = '12:00';
          next.heureMax = '14:00';
          break;
        case 'dates': {
          const debut = new Date();
          const fin = new Date(debut.getTime() + 7 * 24 * 3600 * 1000);
          next.dates = { debut: debut.toISOString(), fin: fin.toISOString() };
          break;
        }
        case 'appareil':
          next.appareil = ['mobile'];
          break;
        case 'scans':
          next.minScansTotal = 0;
          break;
        case 'scansAppareil':
          next.minScansAppareil = 3;
          break;
      }
    }
    onChange(next);
  }

  function majJours(jour: number) {
    const actuels = value.jours ?? [];
    const suivants = actuels.includes(jour)
      ? actuels.filter((j) => j !== jour)
      : [...actuels, jour].sort((a, b) => a - b);
    onChange({ ...value, jours: suivants.length > 0 ? suivants : undefined });
  }

  function majAppareils(appareil: FamilleAppareil) {
    const actuels = value.appareil ?? [];
    const suivants = actuels.includes(appareil)
      ? actuels.filter((a) => a !== appareil)
      : [...actuels, appareil];
    onChange({ ...value, appareil: suivants.length > 0 ? suivants : undefined });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LIBELLES) as CleCondition[]).map((cle) => (
          <button
            key={cle}
            type="button"
            onClick={() => basculer(cle)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              actives[cle]
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-pressed={actives[cle]}
          >
            {actives[cle] ? '✓ ' : '+ '}
            {LIBELLES[cle]}
          </button>
        ))}
      </div>

      {actives.langues && (
        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            Langues (codes à 2 lettres, séparés par une virgule)
          </span>
          <input
            type="text"
            value={(value.langues ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...value,
                langues: listeDepuisTexte(e.target.value).map((v) => v.toLowerCase()),
              })
            }
            placeholder="fr, en"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      )}

      {actives.pays && (
        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            Pays (codes ISO à 2 lettres, séparés par une virgule)
          </span>
          <input
            type="text"
            value={(value.pays ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...value,
                pays: listeDepuisTexte(e.target.value).map((v) => v.toUpperCase()),
              })
            }
            placeholder="CG, FR"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      )}

      {actives.villes && (
        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            Villes estimées par l'opérateur (séparées par une virgule)
          </span>
          <input
            type="text"
            value={(value.villes ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                ...value,
                villes: listeDepuisTexte(e.target.value),
              })
            }
            placeholder="Brazzaville, Pointe-Noire"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-amber-700">
            La ville vient du réseau (best-effort) : souvent absente ou imprécise en Afrique
            centrale. Privilégie le pays.
          </span>
        </label>
      )}

      {actives.jours && (
        <div>
          <span className="text-xs font-medium text-gray-600">Jours</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {JOURS.map((jour, index) => {
              const selectionne = (value.jours ?? []).includes(jour.valeur);
              return (
                <button
                  key={`${jour.valeur}-${index}`}
                  type="button"
                  onClick={() => majJours(jour.valeur)}
                  aria-pressed={selectionne}
                  className={`h-8 w-8 rounded-md text-xs font-semibold ${
                    selectionne
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {jour.libelle}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {actives.heure && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">À partir de</span>
            <input
              type="time"
              value={value.heureMin ?? '12:00'}
              onChange={(e) => onChange({ ...value, heureMin: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Jusqu'à</span>
            <input
              type="time"
              value={value.heureMax ?? '14:00'}
              onChange={(e) => onChange({ ...value, heureMax: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {actives.dates && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Du</span>
            <input
              type="datetime-local"
              value={versInputLocal(value.dates?.debut ?? '')}
              onChange={(e) => {
                const debut = depuisInputLocal(e.target.value);
                if (!debut) return;
                onChange({
                  ...value,
                  dates: {
                    debut,
                    fin: value.dates?.fin ?? debut,
                  },
                });
              }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Au</span>
            <input
              type="datetime-local"
              value={versInputLocal(value.dates?.fin ?? '')}
              onChange={(e) => {
                const fin = depuisInputLocal(e.target.value);
                if (!fin) return;
                onChange({
                  ...value,
                  dates: {
                    debut: value.dates?.debut ?? fin,
                    fin,
                  },
                });
              }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {actives.appareil && (
        <div>
          <span className="text-xs font-medium text-gray-600">Appareils</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {APPAREILS.map((appareil) => {
              const selectionne = (value.appareil ?? []).includes(appareil.valeur);
              return (
                <button
                  key={appareil.valeur}
                  type="button"
                  onClick={() => majAppareils(appareil.valeur)}
                  aria-pressed={selectionne}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    selectionne
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {appareil.libelle}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {actives.scans && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">À partir de (scans)</span>
            <input
              type="number"
              min={0}
              value={value.minScansTotal ?? 0}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                onChange({ ...value, minScansTotal: Number.isFinite(v) ? v : 0 });
              }}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Jusqu'à (exclu)</span>
            <input
              type="number"
              min={1}
              value={value.maxScansTotal ?? ''}
              onChange={(e) => {
                const brut = e.target.value;
                const v = Number.parseInt(brut, 10);
                onChange({
                  ...value,
                  maxScansTotal: brut === '' || !Number.isFinite(v) ? undefined : v,
                });
              }}
              placeholder="illimité"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}
      {actives.scansAppareil && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                À partir du scan n°
              </span>
              <input
                type="number"
                min={1}
                max={1_000_000}
                value={value.minScansAppareil ?? ''}
                onChange={(e) => {
                  const brut = e.target.value;
                  const v = Number.parseInt(brut, 10);
                  onChange({
                    ...value,
                    minScansAppareil:
                      brut === '' || !Number.isFinite(v) ? undefined : Math.max(1, v),
                  });
                }}
                placeholder="3"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">
                Avant le scan n° (exclu)
              </span>
              <input
                type="number"
                min={2}
                max={1_000_000}
                value={value.maxScansAppareil ?? ''}
                onChange={(e) => {
                  const brut = e.target.value;
                  const v = Number.parseInt(brut, 10);
                  onChange({
                    ...value,
                    maxScansAppareil:
                      brut === '' || !Number.isFinite(v)
                        ? undefined
                        : Math.max(2, v),
                  });
                }}
                placeholder="illimité"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-amber-800">
            ⓘ Nécessite le consentement du visiteur. Ce QR affichera un écran d'accord
            au premier scan ; en cas de refus, la règle est simplement ignorée. Le
            compteur est propre à chaque appareil (cookie), pas à chaque personne.
          </p>
        </div>
      )}
    </div>
  );
}
