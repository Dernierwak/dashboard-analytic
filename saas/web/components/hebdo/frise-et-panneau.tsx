"use client";

import { useState } from "react";
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import type { SourcesHebdo } from "@/lib/hebdo/sources";
import {
  cleStatut,
  decalageMax,
  semaineDecalee,
  STATUTS,
  type CleStatut,
  type FriseHebdo,
} from "@/lib/hebdo/frise";
import { FriseAnnee, type Zoom } from "@/components/hebdo/frise-annee";
import { PanneauSemaine } from "@/components/hebdo/panneau-semaine";

// La frise et le panneau partagent la semaine choisie : ce parent la tient.
// Il ne reçoit que des props sérialisées par la page serveur, et n'exporte
// aucune constante (`CLAUDE.md` §8) — les règles vivent dans `lib/hebdo/frise.ts`.
export function FriseEtPanneau({
  frise,
  semaine,
  sources,
}: {
  frise: FriseHebdo;
  semaine: SemaineHebdo;
  sources: SourcesHebdo | null;
}) {
  // 0 = la semaine mesurée ; on recule de semaine en semaine.
  const [w, setW] = useState(0);
  // La frise s'ouvre sur le Mois (spec, point 31).
  const [zoom, setZoom] = useState<Zoom>("mois");
  // Tout est visible par défaut ; le filtre ne fait que cacher.
  const [masques, setMasques] = useState<ReadonlySet<CleStatut>>(new Set());
  // Incrémenté quand la semaine change AILLEURS que par un clic dans la frise
  // (‹ ›, « revenir », zoom) : la frise se recentre alors sur elle. Un clic
  // dans la frise ne la fait pas sauter sous le curseur.
  const [recentrer, setRecentrer] = useState(0);

  const wMax = decalageMax(semaine, frise.annee);
  const choisir = (n: number, centrer: boolean) => {
    setW(Math.min(wMax, Math.max(0, n)));
    if (centrer) setRecentrer((k) => k + 1);
  };

  const presents = STATUTS.filter((s) => frise.campagnes.some((c) => cleStatut(c) === s.cle));
  const basculer = (cle: CleStatut) =>
    setMasques((m) => {
      const n = new Set(m);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <div className="flex gap-1" role="group" aria-label="Zoom de la frise">
            {(["annee", "mois"] as const).map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => {
                  setZoom(z);
                  setRecentrer((k) => k + 1);
                }}
                className={`rounded-full border px-3 py-0.5 text-[12px] ${
                  zoom === z ? "bg-ink text-white border-ink" : "border-line text-muted bg-white"
                }`}
              >
                {z === "annee" ? "Année" : "Mois"}
              </button>
            ))}
          </div>
          {presents.length > 1 && (
            <div className="flex gap-1 flex-wrap ml-auto" role="group" aria-label="Statuts affichés">
              {presents.map((s) => {
                const visible = !masques.has(s.cle);
                return (
                  <button
                    key={s.cle}
                    type="button"
                    aria-pressed={visible}
                    onClick={() => basculer(s.cle)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                      visible ? "border-line text-muted bg-white" : "border-dashed border-line text-faint line-through"
                    }`}
                  >
                    {s.nom}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <FriseAnnee
          frise={frise}
          semaine={semaine}
          w={w}
          zoom={zoom}
          masques={masques}
          recentrer={recentrer}
          onChoisir={(n) => choisir(n, false)}
        />
        <p className="text-[11px] text-faint mt-2">
          Trait plein : jusqu&apos;à la fin déclarée · pointillés : pas de date de fin.
          Cliquer dans la frise choisit la semaine.
        </p>
      </div>

      <PanneauSemaine
        frise={frise}
        semaine={semaine}
        sources={sources}
        choisie={semaineDecalee(semaine, w)}
        w={w}
        wMax={wMax}
        onChoisir={(n) => choisir(n, true)}
      />
    </div>
  );
}
