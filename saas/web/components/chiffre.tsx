import type { ReactNode } from "react";
import { Sparkline } from "@/components/line-chart";
import { Pente } from "@/components/pente";

// La tuile-chiffre, une seule fois.
//
// Elle existait en double : `Tuile` sur la page Coûts (chiffre 20 px, écart en
// texte gris) et les tuiles de `AdsKpis` (chiffre 18 px, écart coloré). Deux
// tailles, deux formes d'écart, deux fichiers — pour le même objet. Les deux
// pages héritent maintenant du delta coloré ET de la sparkline d'un coup.
//
// Elle applique la grammaire (docs/03-grammaire-des-modules.md) :
//   surtitre → chiffre → verdict → delta → forme.
// La forme est en dernier et touche le bas de la carte : c'est le contour de la
// courbe qu'on lit, pas ses valeurs.

export type Ton = "ink" | "pos" | "neg" | "warn";

const CLS: Record<Ton, string> = {
  ink: "text-ink",
  pos: "text-pos",
  neg: "text-neg",
  warn: "text-warn",
};
// Exporté : le hero d'`AdsKpis` (`channel-dash.tsx`) n'est pas un `Chiffre`
// (son chiffre de tête est deux fois plus grand) mais reprend ses deux mêmes
// couleurs de sparkline à la main — une seule palette, jamais deux hex dupliqués.
export const TRAIT: Record<Ton, string> = {
  ink: "#1a56ff",
  pos: "#1a7a4a",
  neg: "#c0392b",
  warn: "#b86b00",
};

export function Chiffre({
  titre,
  valeur,
  unite,
  sous,
  delta,
  /** true quand une BAISSE est une bonne nouvelle (CPC, CPM, coût par contact). */
  baisseEstBonne = false,
  verdict,
  serie,
  serieLabels,
  ton = "ink",
  grand = false,
  deltaNode,
  serieMoyenne,
  serieMoyenneLabels,
  uniteMoyenne,
}: {
  titre: string;
  valeur: string;
  unite?: string;
  sous?: string;
  delta?: number | null;
  baisseEstBonne?: boolean;
  verdict?: { texte: string; ton: Ton };
  serie?: number[];
  /** Le libellé de chaque point de `serie` (une date, le plus souvent) —
   *  affiché dans la bulle au survol de la sparkline, en plus de la valeur. */
  serieLabels?: string[];
  ton?: Ton;
  grand?: boolean;
  /** Remplace le `<Pente>` automatique (qui suppose un POURCENTAGE, et suffixe
   *  toujours « % ») par un rendu fourni par l'appelant — pour un delta
   *  ABSOLU (ex. abonnés gagnés) qui a besoin du même rang (5, sous le
   *  chiffre) et du même signal (couleur + triangle par le SENS) mais pas du
   *  même texte. `delta` est alors ignoré. */
  deltaNode?: ReactNode;
  /** Sparkline DÉDIÉE à la moyenne (retour de David, 2026-09-01 : « fait un
   *  sparkline avec une belle couleur pour les moyennes et en hover on voit le
   *  chiffre » — un texte seul ne suffisait pas). JAMAIS la même série que
   *  `serie` : une valeur par UNITÉ moyennée (jour, mois ou publication selon
   *  la fenêtre — `ChiffreMoyen.parUnite` dans `channel-dash.tsx`), pas la
   *  courbe brute déjà tracée par `serie`. Couleur fixe (`TRAIT.warn`, le même
   *  ambre que le repère de seuil sur `LineChart`) : une seule couleur pour
   *  « ceci est une moyenne » sur toute l'app, jamais celle du `ton` de la
   *  tuile — sinon les deux formes se confondraient sur les tuiles `warn`. */
  serieMoyenne?: (number | null)[];
  serieMoyenneLabels?: string[];
  /** Unité affichée dans la bulle au survol de la sparkline de moyenne —
   *  reprend `unite` par défaut, distincte quand le libellé de la moyenne le
   *  demande (ex. CPM en CHF sur une tuile sans unité de tête). */
  uniteMoyenne?: string;
}) {
  const utile = (serie ?? []).filter((v) => v > 0).length >= 2;
  const utileMoyenne =
    (serieMoyenne ?? []).filter((v): v is number => v !== null && isFinite(v)).length >= 2;

  return (
    <div className="bg-white border border-line rounded-xl min-w-[180px] shrink-0 sm:min-w-0 sm:shrink overflow-hidden flex flex-col">
      <div className="p-4 pb-3 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
          {titre}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`font-mono ${grand ? "text-[30px] sm:text-[34px]" : "text-[22px]"} leading-none font-medium ${CLS[ton]}`}
          >
            {valeur}
            {unite && <span className="text-[13px] text-faint"> {unite}</span>}
          </span>
          {verdict && (
            <span
              className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${CLS[verdict.ton]}`}
              style={{ background: `${TRAIT[verdict.ton]}14` }}
            >
              {verdict.texte}
            </span>
          )}
        </div>
        {/* Le delta est coloré par le SENS, jamais par le signe : un CPC qui
            baisse est une bonne nouvelle et sort en vert. */}
        {deltaNode ?? <Pente delta={delta} baisseEstBonne={baisseEstBonne} base="vs période préc." />}
        {sous && <div className="text-[11px] text-faint mt-1 leading-snug">{sous}</div>}
      </div>
      {/* Deux formes possibles, empilées : la valeur de la période (couleur du
          `ton`) puis, séparée par un trait fin, sa moyenne par unité (ambre,
          fixe). Chacune ne se dessine que si elle a de quoi tracer une
          tendance — un chiffre unique ne serait pas une forme, ce serait un
          point. */}
      {utile && (
        <div className="px-0 pb-0 -mb-px">
          <Sparkline values={serie!} color={TRAIT[ton]} height={utileMoyenne ? 22 : 30} labels={serieLabels} unite={unite} />
        </div>
      )}
      {utileMoyenne && (
        <div className={`px-0 pb-0 -mb-px ${utile ? "border-t border-line/70" : ""}`}>
          <Sparkline
            values={serieMoyenne!}
            color={TRAIT.warn}
            height={22}
            labels={serieMoyenneLabels}
            unite={uniteMoyenne ?? unite}
          />
        </div>
      )}
    </div>
  );
}
