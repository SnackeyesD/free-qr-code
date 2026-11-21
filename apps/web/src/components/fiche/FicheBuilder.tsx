import type {
  ChampFiche,
  OptionChampFiche,
  SchemaFiche,
  TypeChampFiche,
} from '@free-qr/shared-types';

const TYPES: Array<{ value: TypeChampFiche; label: string }> = [
  { value: 'texte', label: 'Texte court' },
  { value: 'texte_long', label: 'Texte long' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'url', label: 'Lien http(s)' },
  { value: 'date', label: 'Date' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'liste', label: 'Liste de choix' },
  { value: 'booleen', label: 'Oui / Non' },
  { value: 'section', label: 'Titre de section' },
];

const MAX_CHAMPS = 30;

interface FicheBuilderProps {
  schema: SchemaFiche;
  onChange: (schema: SchemaFiche) => void;
  disabled?: boolean;
}

function prochaineCle(champs: ChampFiche[]): string {
  const existantes = new Set(champs.map((champ) => champ.cle));
  let index = champs.length + 1;
  while (existantes.has(`champ_${index}`)) index += 1;
  return `champ_${index}`;
}

function prochaineOption(options: OptionChampFiche[]): string {
  const existantes = new Set(options.map((option) => option.valeur));
  let index = options.length + 1;
  while (existantes.has(`option_${index}`)) index += 1;
  return `option_${index}`;
}

function boutonClasse(desactive: boolean): string {
  return `rounded-md px-2 py-1 text-xs font-semibold ${
    desactive
      ? 'cursor-not-allowed bg-gray-50 text-gray-300'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`;
}

/**
 * Éditeur de schéma de fiche. Les clés (`cle`) sont générées automatiquement
 * et ne sont jamais exposées : elles restent stables pour ne pas casser les
 * valeurs déjà saisies.
 */
export function FicheBuilder({ schema, onChange, disabled = false }: FicheBuilderProps) {
  const champs = schema.champs;
  const complet = champs.length >= MAX_CHAMPS;

  const majChamps = (suivants: ChampFiche[]) => {
    onChange({ version: 1, champs: suivants });
  };

  const majChamp = (index: number, patch: Partial<ChampFiche>) => {
    majChamps(
      champs.map((champ, position) =>
        position === index ? { ...champ, ...patch } : champ,
      ),
    );
  };

  const ajouterChamp = (type: TypeChampFiche) => {
    if (complet) return;
    const champ: ChampFiche = {
      cle: prochaineCle(champs),
      libelle: '',
      type,
      obligatoire: false,
    };
    if (type === 'section') champ.obligatoire = false;
    if (type === 'liste') {
      champ.options = [{ valeur: 'option_1', libelle: 'Option 1' }];
    }
    majChamps([...champs, champ]);
  };

  const supprimerChamp = (index: number) => {
    majChamps(champs.filter((_, position) => position !== index));
  };

  const deplacerChamp = (index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= champs.length) return;
    const suivants = [...champs];
    const [champ] = suivants.splice(index, 1);
    suivants.splice(cible, 0, champ);
    majChamps(suivants);
  };

  const changerType = (index: number, type: TypeChampFiche) => {
    const champ = champs[index];
    const patch: Partial<ChampFiche> = { type };

    if (type === 'section') {
      patch.obligatoire = false;
      patch.options = undefined;
      patch.placeholder = undefined;
    } else if (type === 'liste') {
      patch.options =
        champ.options && champ.options.length > 0
          ? champ.options
          : [{ valeur: 'option_1', libelle: 'Option 1' }];
    } else {
      patch.options = undefined;
    }

    majChamp(index, patch);
  };

  const majOption = (
    indexChamp: number,
    indexOption: number,
    patch: Partial<OptionChampFiche>,
  ) => {
    const champ = champs[indexChamp];
    const options = (champ.options ?? []).map((option, position) =>
      position === indexOption ? { ...option, ...patch } : option,
    );
    majChamp(indexChamp, { options });
  };

  const ajouterOption = (indexChamp: number) => {
    const champ = champs[indexChamp];
    const options = [...(champ.options ?? [])];
    options.push({
      valeur: prochaineOption(options),
      libelle: `Option ${options.length + 1}`,
    });
    majChamp(indexChamp, { options });
  };

  const supprimerOption = (indexChamp: number, indexOption: number) => {
    const champ = champs[indexChamp];
    const options = (champ.options ?? []).filter(
      (_, position) => position !== indexOption,
    );
    majChamp(indexChamp, { options });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Champs de la fiche</h3>
          <p className="mt-1 text-xs text-gray-500">
            {champs.length} / {MAX_CHAMPS} éléments. Les libellés sont rendus en texte strict.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ajouterChamp('texte')}
            disabled={disabled || complet}
            className={boutonClasse(disabled || complet)}
          >
            + Champ
          </button>
          <button
            type="button"
            onClick={() => ajouterChamp('section')}
            disabled={disabled || complet}
            className={boutonClasse(disabled || complet)}
          >
            + Section
          </button>
        </div>
      </div>

      {champs.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            Ajoutez un premier champ pour composer la fiche.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {champs.map((champ, index) => {
            const estSection = champ.type === 'section';
            const estListe = champ.type === 'liste';

            return (
              <li
                key={`${champ.cle}-${index}`}
                className={`rounded-lg border p-4 ${
                  estSection
                    ? 'border-indigo-100 bg-indigo-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`champ-libelle-${index}`}
                      className="block text-xs font-medium text-gray-600"
                    >
                      Libellé
                    </label>
                    <input
                      id={`champ-libelle-${index}`}
                      type="text"
                      value={champ.libelle}
                      maxLength={80}
                      disabled={disabled}
                      onChange={(event) =>
                        majChamp(index, { libelle: event.target.value })
                      }
                      placeholder={estSection ? 'Ex. Coordonnées' : 'Ex. Nom complet'}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>

                  <div className="w-full sm:w-44">
                    <label
                      htmlFor={`champ-type-${index}`}
                      className="block text-xs font-medium text-gray-600"
                    >
                      Type
                    </label>
                    <select
                      id={`champ-type-${index}`}
                      value={champ.type}
                      disabled={disabled}
                      onChange={(event) =>
                        changerType(index, event.target.value as TypeChampFiche)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    >
                      {TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 self-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => deplacerChamp(index, -1)}
                      disabled={disabled || index === 0}
                      aria-label="Monter le champ"
                      className={boutonClasse(disabled || index === 0)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacerChamp(index, 1)}
                      disabled={disabled || index === champs.length - 1}
                      aria-label="Descendre le champ"
                      className={boutonClasse(disabled || index === champs.length - 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimerChamp(index)}
                      disabled={disabled}
                      aria-label="Supprimer le champ"
                      className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:text-red-300"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {!estSection && (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <input
                        type="checkbox"
                        checked={champ.obligatoire === true}
                        disabled={disabled}
                        onChange={(event) =>
                          majChamp(index, { obligatoire: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Obligatoire
                    </label>

                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={champ.aide ?? ''}
                        maxLength={200}
                        disabled={disabled}
                        onChange={(event) =>
                          majChamp(index, { aide: event.target.value || undefined })
                        }
                        placeholder="Aide affichée sous le champ (facultatif)"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {estSection && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={champ.aide ?? ''}
                      maxLength={200}
                      disabled={disabled}
                      onChange={(event) =>
                        majChamp(index, { aide: event.target.value || undefined })
                      }
                      placeholder="Description de la section (facultatif)"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    />
                  </div>
                )}

                {estListe && (
                  <div className="mt-3 rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-600">Options de la liste</p>
                    <div className="mt-2 space-y-2">
                      {(champ.options ?? []).map((option, indexOption) => (
                        <div key={`${option.valeur}-${indexOption}`} className="flex gap-2">
                          <input
                            type="text"
                            value={option.valeur}
                            maxLength={80}
                            disabled={disabled}
                            onChange={(event) =>
                              majOption(index, indexOption, {
                                valeur: event.target.value,
                              })
                            }
                            placeholder="Valeur"
                            aria-label={`Valeur de l'option ${indexOption + 1}`}
                            className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            value={option.libelle}
                            maxLength={80}
                            disabled={disabled}
                            onChange={(event) =>
                              majOption(index, indexOption, {
                                libelle: event.target.value,
                              })
                            }
                            placeholder="Libellé affiché"
                            aria-label={`Libellé de l'option ${indexOption + 1}`}
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => supprimerOption(index, indexOption)}
                            disabled={disabled || (champ.options ?? []).length <= 1}
                            aria-label="Supprimer l'option"
                            className={boutonClasse(
                              disabled || (champ.options ?? []).length <= 1,
                            )}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => ajouterOption(index)}
                      disabled={disabled || (champ.options ?? []).length >= 50}
                      className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:text-gray-400"
                    >
                      + Ajouter une option
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
