import type {
  ChampFiche,
  SchemaFiche,
  ValeurFiche,
  ValeursFiche,
} from '@free-qr/shared-types';

interface FicheValuesFormProps {
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  onChange: (valeurs: ValeursFiche) => void;
  disabled?: boolean;
}

interface GroupeChamps {
  titre: string | null;
  aide?: string;
  champs: ChampFiche[];
}

function regrouperChamps(schema: SchemaFiche): GroupeChamps[] {
  const groupes: GroupeChamps[] = [];
  let courant: GroupeChamps = { titre: null, champs: [] };

  for (const champ of schema.champs) {
    if (champ.type === 'section') {
      if (courant.titre !== null || courant.champs.length > 0) {
        groupes.push(courant);
      }
      courant = { titre: champ.libelle, aide: champ.aide, champs: [] };
    } else {
      courant.champs.push(champ);
    }
  }

  if (courant.titre !== null || courant.champs.length > 0) {
    groupes.push(courant);
  }
  return groupes;
}

function valeurTexte(valeur: ValeurFiche | undefined): string {
  if (valeur === undefined || valeur === null || typeof valeur === 'boolean') {
    return '';
  }
  return String(valeur);
}

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-50';

function ChampSaisie({
  champ,
  valeur,
  onChange,
  disabled,
}: {
  champ: ChampFiche;
  valeur: ValeurFiche | undefined;
  onChange: (valeur: ValeurFiche) => void;
  disabled: boolean;
}) {
  const id = `valeur-${champ.cle}`;
  const texte = valeurTexte(valeur);

  if (champ.type === 'booleen') {
    return (
      <input
        id={id}
        type="checkbox"
        checked={valeur === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
    );
  }

  if (champ.type === 'texte_long') {
    return (
      <textarea
        id={id}
        value={texte}
        rows={5}
        required={champ.obligatoire}
        disabled={disabled}
        placeholder={champ.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    );
  }

  if (champ.type === 'liste') {
    return (
      <select
        id={id}
        value={texte}
        required={champ.obligatoire}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className={inputClass}
      >
        <option value="">— Choisir —</option>
        {(champ.options ?? []).map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    );
  }

  const type =
    champ.type === 'email'
      ? 'email'
      : champ.type === 'telephone'
        ? 'tel'
        : champ.type === 'url'
          ? 'url'
          : champ.type === 'date'
            ? 'date'
            : champ.type === 'nombre'
              ? 'number'
              : 'text';

  const autoComplete =
    champ.type === 'email'
      ? 'email'
      : champ.type === 'telephone'
        ? 'tel'
        : champ.type === 'url'
          ? 'url'
          : undefined;

  return (
    <input
      id={id}
      type={type}
      value={texte}
      required={champ.obligatoire}
      disabled={disabled}
      placeholder={champ.placeholder}
      autoComplete={autoComplete}
      step={champ.type === 'nombre' ? 'any' : undefined}
      onChange={(event) => {
        if (champ.type === 'nombre') {
          const brut = event.target.value;
          onChange(brut === '' ? null : Number(brut));
          return;
        }
        onChange(event.target.value);
      }}
      className={inputClass}
    />
  );
}

/**
 * Formulaire de saisie des valeurs, piloté par le schéma. Les champs inconnus
 * ne sont jamais affichés et les valeurs restent scalaires.
 */
export function FicheValuesForm({
  schema,
  valeurs,
  onChange,
  disabled = false,
}: FicheValuesFormProps) {
  const groupes = regrouperChamps(schema);
  const champs = schema.champs.filter((champ) => champ.type !== 'section');

  if (champs.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ajoutez au moins un champ avant de saisir des valeurs.
      </p>
    );
  }

  const majValeur = (cle: string, valeur: ValeurFiche) => {
    onChange({ ...valeurs, [cle]: valeur });
  };

  return (
    <div className="space-y-6">
      {groupes.map((groupe, index) => (
        <fieldset
          key={`${groupe.titre ?? 'groupe'}-${index}`}
          className="min-w-0 space-y-4"
        >
          {groupe.titre && (
            <legend className="w-full border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
              {groupe.titre}
            </legend>
          )}
          {groupe.titre && groupe.aide && (
            <p className="-mt-2 text-xs text-gray-500">{groupe.aide}</p>
          )}

          {groupe.champs.map((champ) => {
            const id = `valeur-${champ.cle}`;
            const estBooleen = champ.type === 'booleen';

            return (
              <div key={champ.cle}>
                {estBooleen ? (
                  <div className="flex items-center gap-2">
                    <ChampSaisie
                      champ={champ}
                      valeur={valeurs[champ.cle]}
                      onChange={(valeur) => majValeur(champ.cle, valeur)}
                      disabled={disabled}
                    />
                    <label htmlFor={id} className="text-sm font-medium text-gray-700">
                      {champ.libelle}
                      {champ.obligatoire && <span className="text-red-500"> *</span>}
                    </label>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor={id}
                      className="block text-sm font-medium text-gray-700"
                    >
                      {champ.libelle}
                      {champ.obligatoire && <span className="text-red-500"> *</span>}
                    </label>
                    <ChampSaisie
                      champ={champ}
                      valeur={valeurs[champ.cle]}
                      onChange={(valeur) => majValeur(champ.cle, valeur)}
                      disabled={disabled}
                    />
                  </>
                )}
                {champ.aide && (
                  <p className="mt-1 text-xs text-gray-500">{champ.aide}</p>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
