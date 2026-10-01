"use client";

import { ScrollList } from "@/components/scroll-list";
import { ConversionCategorySelect } from "@/components/conversion-category-select";
import type { EvenementCatalogue } from "@/lib/channels";

// « TOUTES TES CONVERSIONS » — le catalogue GA4 complet (`getCatalogueGa4`),
// page_view et scroll compris : une catégorie doit pouvoir se poser sur
// n'importe quel événement, même AVANT qu'il soit marqué « clé » par GA4 —
// sinon impossible de catégoriser en premier ce qui deviendra un jour une
// conversion reconnue.
//
// Deux listes : « à faire » (sans catégorie) ouverte par défaut, « déjà fait »
// repliée par défaut.
export function ConversionsCatalogueModule({
  catalogue,
  categories,
  parEvenement,
}: {
  catalogue: EvenementCatalogue[];
  categories: string[];
  /** { nom d'événement → catégorie }, tenu par ce module et par le CRUD juste en dessous. */
  parEvenement: Record<string, string>;
}) {
  // Le catalogue vide (jamais récolté, GA4 non connecté…) est déjà expliqué
  // par le bloc juste au-dessus du camembert, en haut de la page — un second
  // message ici redirait la même chose sous un autre titre.
  if (catalogue.length === 0) return null;

  const sansCategorie = catalogue.filter((e) => !parEvenement[e.nom]);
  const dejaCategorise = catalogue.filter((e) => parEvenement[e.nom]);

  return (
    <div>
      {sansCategorie.length === 0 ? (
        <div className="bg-white border border-pos/25 rounded-xl shadow-card p-5 mb-4">
          <p className="text-[14px] text-ink font-medium">
            Tout ton catalogue est catégorisé. <span className="text-pos">✓</span>
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <ScrollList title="Sans catégorie" count={sansCategorie.length} maxH="max-h-[40vh]">
            {sansCategorie.map((e) => (
              <LigneConversion key={e.nom} e={e} current={parEvenement[e.nom] ?? null} categories={categories} />
            ))}
          </ScrollList>
          {categories.length === 0 && (
            <p className="text-[10.5px] text-warn mt-1.5 leading-relaxed">
              Tu n&apos;as encore aucune catégorie à poser — crée-en une plus bas, ou laisse
              l&apos;IA les proposer avec le bouton ci-dessus.
            </p>
          )}
        </div>
      )}

      {dejaCategorise.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 py-1 select-none">
            <span className="text-[10px] text-faint transition-transform group-open:rotate-90">
              ▶
            </span>
            <h3 className="text-[11px] uppercase tracking-wide text-faint font-bold group-hover:text-muted">
              Déjà catégorisé <span className="text-faint/70">({dejaCategorise.length})</span>
            </h3>
            <span className="ml-auto text-[10.5px] text-faint/80 group-open:hidden">
              ouvrir pour corriger
            </span>
          </summary>
          <div className="mt-2">
            <ScrollList title="" maxH="max-h-[40vh]">
              {dejaCategorise.map((e) => (
                <LigneConversion key={e.nom} e={e} current={parEvenement[e.nom] ?? null} categories={categories} />
              ))}
            </ScrollList>
          </div>
        </details>
      )}
    </div>
  );
}

function LigneConversion({
  e,
  current,
  categories,
}: {
  e: EvenementCatalogue;
  current: string | null;
  categories: string[];
}) {
  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-mono font-semibold text-ink truncate">{e.nom}</div>
        <div className="text-[10.5px] text-faint mt-0.5">
          {e.volume.toLocaleString("fr-CH")} événement{e.volume > 1 ? "s" : ""} sur la fenêtre
          récoltée
          {e.cle === true && (
            <span className="text-brand ml-1.5" title="Événement clé dans GA4">
              ◆ clé GA4
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <ConversionCategorySelect eventName={e.nom} current={current} categories={categories} />
      </div>
    </div>
  );
}
