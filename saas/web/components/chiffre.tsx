import { Sparkline } from "@/components/line-chart";
import { Pente } from "@/components/pente";
import { COULEURS } from "@/lib/couleurs";

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
const TRAIT: Record<Ton, string> = {
  ink: COULEURS.encre,
  pos: COULEURS.pos,
  neg: COULEURS.neg,
  warn: COULEURS.warn,
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
}: {
  titre: string;
  valeur: string;
  unite?: string;
  sous?: string;
  delta?: number | null;
  baisseEstBonne?: boolean;
  verdict?: { texte: string; ton: Ton };
  /** `null` = un point qu'on n'a PAS mesuré (récolte muette, ticket 48). La
   *  sparkline le saute au lieu de le poser à zéro, où il dessinerait une chute
   *  que personne n'a décidée. */
  serie?: (number | null)[];
  /** Le libellé de chaque point de `serie` (une date, le plus souvent) —
   *  affiché dans la bulle au survol de la sparkline, en plus de la valeur. */
  serieLabels?: string[];
  ton?: Ton;
  grand?: boolean;
}) {
  const utile = (serie ?? []).filter((v) => v !== null && v > 0).length >= 2;

  return (
    <div className="bg-white border border-line rounded-xl shadow-card min-w-[180px] shrink-0 sm:min-w-0 sm:shrink overflow-hidden flex flex-col">
      <div className="p-4 pb-3 flex-1">
        <div className="text-[12px] text-faint font-semibold mb-1.5">
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
        <Pente delta={delta} baisseEstBonne={baisseEstBonne} base="vs période préc." />
        {sous && <div className="text-[11px] text-faint mt-1 leading-snug">{sous}</div>}
      </div>
      {utile && (
        <div className="px-0 pb-0 -mb-px">
          <Sparkline values={serie!} color={TRAIT[ton]} height={30} labels={serieLabels} unite={unite} />
        </div>
      )}
    </div>
  );
}
