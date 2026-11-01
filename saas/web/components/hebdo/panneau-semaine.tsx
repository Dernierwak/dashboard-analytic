"use client";

import { useState } from "react";
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import type { SourcesHebdo } from "@/lib/hebdo/sources";
import { dateFr, dateNue } from "@/lib/jour-de-travail";
import { tourneDans, type Bornes, type FriseHebdo } from "@/lib/hebdo/frise";
import { PanneauCampagnes } from "@/components/hebdo/panneau-campagnes";
import { PanneauOrganique } from "@/components/hebdo/panneau-organique";
import { postsDans } from "@/lib/hebdo/posts";

type Onglet = "organique" | "campagnes";

/** « 22 → 28 octobre », ou « 28 septembre → 4 octobre ». */
function plage(sem: Bornes): string {
  const d = dateNue(sem.debut);
  const f = dateNue(sem.fin);
  if (!d || !f) return `${sem.debut} → ${sem.fin}`;
  return `${d.getUTCMonth() === f.getUTCMonth() ? d.getUTCDate() : dateFr(d)} → ${dateFr(f)}`;
}

// Le panneau collant de la semaine choisie, en onglets Organique · Campagnes.
//
// UN ONGLET N'EXISTE QUE POUR UNE SOURCE BRANCHÉE (spec, point 48). Sans
// `sources` (payload d'avant le ticket 04), Campagnes reste — la frise n'a de
// campagnes que des régies récoltées — et Organique attend ses posts (08).
export function PanneauSemaine({
  frise,
  semaine,
  sources,
  choisie,
  w,
  wMax,
  onChoisir,
}: {
  frise: FriseHebdo;
  semaine: SemaineHebdo;
  sources: SourcesHebdo | null;
  choisie: Bornes;
  w: number;
  wMax: number;
  onChoisir: (w: number) => void;
}) {
  const avecOrganique = frise.posts !== undefined || Boolean(sources?.instagram);
  const avecCampagnes = !sources || Boolean(sources.meta || sources.google);
  const [onglet, setOnglet] = useState<Onglet>(
    avecOrganique && frise.posts !== undefined ? "organique" : "campagnes"
  );

  const campagnes = frise.campagnes.filter((c) => tourneDans(c, choisie, semaine));
  // Le compte de l'onglet est celui de la semaine choisie, comme Campagnes.
  const posts = frise.posts && postsDans(frise.posts, choisie);
  const onglets: { cle: Onglet; nom: string; compte?: number }[] = [
    ...(avecOrganique
      ? [{ cle: "organique" as const, nom: "Organique", compte: posts?.length }]
      : []),
    ...(avecCampagnes ? [{ cle: "campagnes" as const, nom: "Campagnes", compte: campagnes.length }] : []),
  ];
  const actif = onglets.some((o) => o.cle === onglet) ? onglet : onglets[0]?.cle;

  return (
    <aside className="min-w-0 rounded-xl border border-line bg-white p-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-24px)] lg:overflow-auto defile">
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <button
          type="button"
          onClick={() => onChoisir(w + 1)}
          disabled={w >= wMax}
          aria-label="Semaine précédente"
          className="h-8 w-8 shrink-0 rounded-full border border-line text-muted disabled:opacity-35"
        >
          ‹
        </button>
        <div className="text-center min-w-0">
          <div className="text-[15px] font-semibold text-ink">{plage(choisie)}</div>
          <div className="text-[11.5px] text-faint">
            {w === 0 ? (
              "la semaine mesurée"
            ) : (
              <button type="button" onClick={() => onChoisir(0)} className="underline hover:text-ink">
                revenir à la semaine mesurée
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChoisir(w - 1)}
          disabled={w <= 0}
          aria-label="Semaine suivante"
          className="h-8 w-8 shrink-0 rounded-full border border-line text-muted disabled:opacity-35"
        >
          ›
        </button>
      </div>

      {onglets.length > 0 && (
        <div className="flex gap-1 mb-3.5" role="tablist">
          {onglets.map((o) => (
            <button
              key={o.cle}
              type="button"
              role="tab"
              aria-selected={actif === o.cle}
              onClick={() => setOnglet(o.cle)}
              className={`rounded-full border px-3 py-0.5 text-[12.5px] ${
                actif === o.cle ? "bg-ink text-white border-ink" : "border-line text-muted bg-white"
              }`}
            >
              {o.nom}
              {o.compte !== undefined && ` · ${o.compte}`}
            </button>
          ))}
        </div>
      )}

      {actif === "organique" && <PanneauOrganique frise={frise} choisie={choisie} sources={sources} />}
      {actif === "campagnes" && (
        <PanneauCampagnes campagnes={campagnes} choisie={choisie} sources={sources} mesuree={w === 0} />
      )}
    </aside>
  );
}
