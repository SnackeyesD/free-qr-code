import { useEffect, useState } from 'react';
import type {
  RoutingConditions,
  RoutingConfig,
  RoutingRegle,
  RoutingState,
  RoutingVariante,
} from '@free-qr/shared-types';
import { ConditionFields } from './ConditionFields';
import { RoutingSimulator } from './RoutingSimulator';

const LIBELLES_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function nouvelId(prefixe: string): string {
  return `${prefixe}_${crypto.randomUUID().slice(0, 8)}`;
}

function urlInitiale(contenu: string): string {
  return /^https?:\/\//i.test(contenu) ? contenu : '';
}

function brouillon(state: RoutingState): RoutingConfig {
  const url = urlInitiale(state.contenu);
  return {
    version: 1,
    actif: false,
    fuseau: state.fuseau || 'Africa/Brazzaville',
    defaut: 'v_defaut',
    variantes: [
      { id: 'v_defaut', libelle: 'Destination par défaut', typeSortie: 'url', contenu: url },
    ],
    regles: [],
  };
}

function resumerConditions(conditions: RoutingConditions): string {
  const parties: string[] = [];
  if (conditions.langues) parties.push(`langue ${conditions.langues.join(' ou ')}`);
  if (conditions.pays) parties.push(`pays ${conditions.pays.join(', ')}`);
  if (conditions.villes) parties.push(`ville ${conditions.villes.join(' ou ')}`);
  if (conditions.jours) {
    parties.push(
      `jour ${conditions.jours
        .map((jour) => LIBELLES_JOURS[jour - 1] ?? jour)
        .join(', ')}`,
    );
  }
  if (conditions.heureMin && conditions.heureMax) {
    parties.push(`entre ${conditions.heureMin} et ${conditions.heureMax}`);
  }
  if (conditions.dates) {
    const debut = new Date(conditions.dates.debut);
    const fin = new Date(conditions.dates.fin);
    const format = (date: Date) =>
      Number.isNaN(date.getTime())
        ? '?'
        : date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    parties.push(`du ${format(debut)} au ${format(fin)}`);
  }
  if (conditions.appareil) parties.push(`appareil ${conditions.appareil.join(', ')}`);
  if (conditions.minScansTotal !== undefined) {
    parties.push(`à partir de ${conditions.minScansTotal} scans`);
  }
  if (conditions.maxScansTotal !== undefined) {
    parties.push(`avant ${conditions.maxScansTotal} scans`);
  }
  if (conditions.minScansAppareil !== undefined) {
    parties.push(`à partir du ${conditions.minScansAppareil}ᵉ scan de l'appareil`);
  }
  if (conditions.maxScansAppareil !== undefined) {
    parties.push(`avant le ${conditions.maxScansAppareil}ᵉ scan de l'appareil`);
  }
  return parties.length > 0 ? parties.join(' et ') : 'toujours';
}

interface RoutingEditorProps {
  qrId: string;
  state: RoutingState;
  isSaving: boolean;
  error: string | null;
  onSave: (config: RoutingConfig) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

export function RoutingEditor({
  qrId,
  state,
  isSaving,
  error,
  onSave,
  onDelete,
}: RoutingEditorProps) {
  const [config, setConfig] = useState<RoutingConfig>(
    state.reglesRoutage ?? brouillon(state),
  );

  useEffect(() => {
    setConfig(state.reglesRoutage ?? brouillon(state));
  }, [state]);

  if (!state.estDynamique) {
    return (
      <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        Le routage contextuel nécessite un QR code dynamique. Recréez ce QR en mode
        dynamique pour utiliser plusieurs destinations.
      </div>
    );
  }

  const variantes = config.variantes;
  const reglesTriees = [...config.regles].sort((a, b) => a.priorite - b.priorite);

  function majVariante(id: string, patch: Partial<RoutingVariante>) {
    setConfig({
      ...config,
      variantes: config.variantes.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  }

  function ajouterVariante() {
    const variante: RoutingVariante = {
      id: nouvelId('v'),
      libelle: `Destination ${config.variantes.length + 1}`,
      typeSortie: 'url',
      contenu: '',
    };
    setConfig({ ...config, variantes: [...config.variantes, variante] });
  }

  function supprimerVariante(id: string) {
    if (config.variantes.length <= 1) return;
    const restantes = config.variantes.filter((v) => v.id !== id);
    setConfig({
      ...config,
      variantes: restantes,
      defaut: config.defaut === id ? restantes[0].id : config.defaut,
      regles: config.regles.filter((r) => r.varianteId !== id),
    });
  }

  function ajouterRegle() {
    const prioriteMax = config.regles.reduce((max, r) => Math.max(max, r.priorite), 0);
    const regle: RoutingRegle = {
      id: nouvelId('r'),
      priorite: prioriteMax + 10,
      varianteId: config.variantes[1]?.id ?? config.defaut,
      conditions: { langues: ['fr'] },
    };
    setConfig({ ...config, regles: [...config.regles, regle] });
  }

  function majRegle(id: string, patch: Partial<RoutingRegle>) {
    setConfig({
      ...config,
      regles: config.regles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function supprimerRegle(id: string) {
    setConfig({ ...config, regles: config.regles.filter((r) => r.id !== id) });
  }

  function appliquerPresetNetworking() {
    const url = urlInitiale(state.contenu);
    setConfig({
      version: 1,
      actif: true,
      fuseau: config.fuseau,
      defaut: 'v_fr',
      variantes: [
        { id: 'v_fr', libelle: 'Profil FR', typeSortie: 'url', contenu: url },
        { id: 'v_en', libelle: 'Profil EN', typeSortie: 'url', contenu: '' },
        { id: 'v_contact', libelle: 'Prise de contact', typeSortie: 'url', contenu: '' },
      ],
      regles: [
        { id: 'r_en', priorite: 10, varianteId: 'v_en', conditions: { langues: ['en'] } },
      ],
    });
  }

  function libelleVariante(id: string): string {
    return variantes.find((variante) => variante.id === id)?.libelle ?? id;
  }

  function libelleDestination(regle: RoutingRegle): string {
    return Array.isArray(regle.varianteId)
      ? regle.varianteId.map(libelleVariante).join(' / ')
      : libelleVariante(regle.varianteId);
  }

  function basculerAbTest(regle: RoutingRegle) {
    if (Array.isArray(regle.varianteId)) {
      const conditions = { ...regle.conditions };
      delete conditions.abTest;
      majRegle(regle.id, {
        varianteId: regle.varianteId[0] ?? config.defaut,
        conditions,
      });
      return;
    }

    const seconde = variantes.find((variante) => variante.id !== regle.varianteId);
    if (!seconde) return;
    majRegle(regle.id, {
      varianteId: [regle.varianteId, seconde.id],
      conditions: { ...regle.conditions, abTest: true },
    });
  }

  function basculerVarianteAb(regle: RoutingRegle, varianteId: string) {
    const actuelles = Array.isArray(regle.varianteId) ? regle.varianteId : [];
    const suivantes = actuelles.includes(varianteId)
      ? actuelles.filter((id) => id !== varianteId)
      : [...actuelles, varianteId];

    // Un tirage A/B a besoin d'au moins deux destinations.
    if (suivantes.length < 2) return;
    majRegle(regle.id, { varianteId: suivantes });
  }

  const actifDesactive = config.actif && config.variantes.length < 2;
  const editionBloquee = state.limites ? !state.limites.autorise : false;
  const utiliseAppareil = config.regles.some(
    (regle) =>
      regle.conditions.minScansAppareil !== undefined ||
      regle.conditions.maxScansAppareil !== undefined,
  );

  return (
    <div className="space-y-6">
      {editionBloquee && (
        <div
          role="status"
          className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
        >
          <p className="font-semibold text-gray-900">
            Édition du routage réservée au plan Pro
          </p>
          <p className="mt-1">
            Vos configurations existantes continuent de fonctionner normalement : aucun QR
            déjà imprimé n'est affecté. Contactez-nous si vous souhaitez activer l'édition.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <fieldset disabled={editionBloquee} className="m-0 space-y-6 border-0 p-0">
      <section className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Destinations</h3>
            <p className="text-xs text-gray-600">
              Une variante par contenu possible. La destination par défaut sert quand aucune
              règle ne correspond.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={appliquerPresetNetworking}
              className="rounded-md bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              Modèle badge networking
            </button>
            <button
              type="button"
              onClick={ajouterVariante}
              className="rounded-md bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              + Variante
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {variantes.map((variante) => (
            <div
              key={variante.id}
              className="rounded-md border border-gray-200 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Libellé</span>
                  <input
                    type="text"
                    value={variante.libelle}
                    onChange={(e) => majVariante(variante.id, { libelle: e.target.value })}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">URL de destination</span>
                  <input
                    type="url"
                    value={variante.contenu}
                    onChange={(e) => majVariante(variante.id, { contenu: e.target.value })}
                    placeholder="https://…"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="variante-defaut"
                    checked={config.defaut === variante.id}
                    onChange={() => setConfig({ ...config, defaut: variante.id })}
                  />
                  Par défaut
                </label>
                <button
                  type="button"
                  onClick={() => supprimerVariante(variante.id)}
                  disabled={config.variantes.length <= 1}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Règles</h3>
            <p className="text-xs text-gray-600">
              Évaluées de la priorité la plus basse à la plus haute. La première qui
              correspond gagne.
            </p>
          </div>
          <button
            type="button"
            onClick={ajouterRegle}
            className="rounded-md bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + Règle
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {reglesTriees.length === 0 && (
            <p className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
              Aucune règle : tous les scans vont vers la destination par défaut.
            </p>
          )}

          {reglesTriees.map((regle) => (
            <div key={regle.id} className="rounded-md border border-gray-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">
                  Si {resumerConditions(regle.conditions)} → {libelleDestination(regle)}
                  {Array.isArray(regle.varianteId) && (
                    <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      A/B
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => supprimerRegle(regle.id)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Supprimer
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-xs font-medium text-gray-600">Destination</span>
                  {Array.isArray(regle.varianteId) ? (
                    <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Tirage A/B entre {regle.varianteId.length} variantes
                    </p>
                  ) : (
                    <select
                      value={regle.varianteId}
                      onChange={(e) => majRegle(regle.id, { varianteId: e.target.value })}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {variantes.map((variante) => (
                        <option key={variante.id} value={variante.id}>
                          {variante.libelle}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={Array.isArray(regle.varianteId)}
                      onChange={() => basculerAbTest(regle)}
                      disabled={variantes.length < 2}
                    />
                    Tester deux destinations (A/B pondéré)
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Priorité</span>
                  <input
                    type="number"
                    min={1}
                    value={regle.priorite}
                    onChange={(e) => {
                      const valeur = Number.parseInt(e.target.value, 10);
                      majRegle(regle.id, {
                        priorite: Number.isFinite(valeur) ? valeur : 1,
                      });
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {Array.isArray(regle.varianteId) && (
                <div className="mt-3 rounded-md bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-900">
                    Destinations du tirage (au moins deux)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {variantes.map((variante) => {
                      const inclus = regle.varianteId.includes(variante.id);
                      return (
                        <label
                          key={variante.id}
                          className="flex items-center gap-2 text-xs text-gray-800"
                        >
                          <input
                            type="checkbox"
                            checked={inclus}
                            disabled={inclus && regle.varianteId.length <= 2}
                            onChange={() => basculerVarianteAb(regle, variante.id)}
                          />
                          {variante.libelle}
                          {inclus && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-600">
                              poids
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={variante.poids ?? 1}
                                onChange={(e) => {
                                  const poids = Number.parseInt(e.target.value, 10);
                                  majVariante(variante.id, {
                                    poids: Number.isFinite(poids)
                                      ? Math.min(100, Math.max(1, poids))
                                      : 1,
                                  });
                                }}
                                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                              />
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-indigo-800">
                    La répartition est déterministe : un même appareil (IP + navigateur) revoit
                    toujours la même variante.
                  </p>
                </div>
              )}

              <div className="mt-3">
                <ConditionFields
                  value={regle.conditions}
                  onChange={(conditions) => majRegle(regle.id, { conditions })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900">Réglages</h3>
        {utiliseAppareil && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Ce QR affichera un écran de consentement au premier scan de chaque appareil.
            Le visiteur peut refuser : dans ce cas, le QR fonctionne normalement et les
            règles « appareil » sont ignorées.
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Fuseau horaire du QR</span>
            <input
              type="text"
              value={config.fuseau}
              onChange={(e) => setConfig({ ...config, fuseau: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Utilisé pour les règles horaires : « midi » = midi dans ce fuseau, pas celui du
              visiteur.
            </span>
          </label>
          <label className="flex items-center gap-3 self-start rounded-md bg-gray-50 px-3 py-3">
            <input
              type="checkbox"
              checked={config.actif}
              onChange={(e) => setConfig({ ...config, actif: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-800">
              Activer le routage contextuel
              {actifDesactive && (
                <span className="block text-xs text-amber-700">
                  Il faut au moins deux variantes pour activer.
                </span>
              )}
            </span>
          </label>
        </div>
      </section>
      </fieldset>

      <section className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900">Simulateur</h3>
        <p className="mb-4 text-xs text-gray-600">
          Vérifie quelle destination serait servie pour un contexte donné, sans attendre un
          vrai scan.
        </p>
        <RoutingSimulator qrId={qrId} config={config} />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onSave(config)}
          disabled={isSaving || editionBloquee}
          title={
            editionBloquee
              ? "Édition réservée au plan Pro. Vos configurations existantes restent actives."
              : undefined
          }
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm('Désactiver le routage et revenir au contenu unique ?')) return;
            void onDelete();
          }}
          disabled={isSaving || !state.reglesRoutage}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-40"
        >
          Désactiver le routage
        </button>
      </div>
    </div>
  );
}
