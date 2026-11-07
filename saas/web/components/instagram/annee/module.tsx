import type { ReactNode } from "react";
import { METRIQUES } from "@/lib/instagram/lecture";
import { texteReference, type ModuleAnnee } from "@/lib/instagram/annee";
import type { Params } from "@/lib/instagram/liens";
import { RangeeFormat } from "./rangee";

// ── MODULE · « TES POSTS FACE À TON ANNÉE » ──────────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tes posts face à ton année » ; user
// stories 13 à 18 et 22. Un seul module, peu de texte au-dessus des graphes :
// une ligne pour la référence et la définition de la métrique, puis une
// rangée par format. Le calcul est dans `lib/instagram/annee.ts` (harnais du
// ticket 10) ; ce composant dessine.
//
// Découpé pour les tickets suivants : `aside` reçoit la liste collante des 5
// meilleurs (ticket 11) à droite des rangées, `rangs` leurs numéros pour le
// nuage ; `regles` la seconde ligne « Lu sans les boostés — 4 posts
// écartés. Revenir aux règles standard », posée par la page. `params` : un point du nuage ouvre `?post=` en
// gardant le reste de l'URL.

export function TesPostsFaceATonAnnee({
  module,
  params,
  rangs = {},
  aside,
  regles,
}: {
  module: ModuleAnnee;
  params: Params;
  rangs?: Record<string, number>;
  aside?: ReactNode;
  regles?: ReactNode;
}) {
  const m = METRIQUES[module.metrique];
  return (
    <section aria-labelledby="titre-annee" className="min-w-0">
      <h2 id="titre-annee" className="mb-3 text-[22px] font-semibold tracking-tight text-ink">
        Tes posts face à ton année
      </h2>
      <div className={`grid items-start gap-4 ${aside ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
          {module.reference === null ? (
            <p className="text-[14px] text-muted">Aucun post en base pour ce compte.</p>
          ) : (
            <>
              <p className="text-[12.5px] text-muted">
                Référence : <b className="text-ink">{texteReference(module.reference)}</b>
                {!module.reference.complete && " — elle ne bouge pas avec la période"} · <b className="text-ink">{m.nom}</b> : {m.aide}
              </p>
              {regles}
              {module.rangees.length === 0 ? (
                <p className="mt-4 text-[14px] text-muted">Aucun post sur les 12 derniers mois.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {module.rangees.map((r) => (
                    <RangeeFormat key={r.format} rangee={r} metrique={module.metrique} periode={module.periode} rangs={rangs} params={params} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {aside}
      </div>
    </section>
  );
}
