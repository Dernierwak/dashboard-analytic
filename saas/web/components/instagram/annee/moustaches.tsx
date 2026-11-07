import { formaterValeur } from "@/lib/instagram/tableau";
import { COULEUR_FORMAT } from "@/lib/instagram/couleurs";
import { COEF_HORS_NORME, MINIMUM_FOULE, NOM_FORMAT, type CleMetrique } from "@/lib/instagram/lecture";
import type { Moustache, RangeeLue } from "@/lib/instagram/annee";
import { HAUTEUR, ordonnee, Y_BAS, Y_HAUT } from "./dessin";

// ── LES MOUSTACHES PESÉES : 12 MOIS, 3 MOIS, 1 MOIS ─────────────────────────
//
// Spec, « À droite, les moustaches pesées » : même axe que le nuage ; la
// largeur et l'encre d'une boîte suivent son nombre de posts (`poids`) ; la
// ligne du post type de l'année traverse les trois ; sous 6 posts, « 5 / 6
// posts » à la place. Le haut de la boîte, le post type et le bas sont écrits ;
// les petits points sont les posts qui la font ; un hors norme est compté
// (« ▲ 1 hors norme plus haut »), jamais dessiné hors de l'axe.

const L = 560;
const STATUT: Record<Moustache["mois"], { nom: string; statut: string }> = {
  12: { nom: "12 mois", statut: "la référence" },
  3: { nom: "3 derniers mois", statut: "à lire avec prudence" },
  1: { nom: "dernier mois", statut: "encore mince" },
};
const AIDE_HORS_NORME = `Hors norme : au-delà de ${String(COEF_HORS_NORME).replace(".", ",")} × l'écart entre le bas et le haut de la boîte.`;

/** Un décalage fixe par rang : les points d'une même valeur ne s'empilent pas
 *  en un seul, et le dessin reste le même d'un rendu à l'autre (hydratation). */
const decalage = (i: number) => ((i * 7) % 13) - 6;

export function Moustaches({ rangee, metrique }: { rangee: RangeeLue; metrique: CleMetrique }) {
  const y = ordonnee(rangee.axeMax);
  const c = COULEUR_FORMAT[rangee.format];
  const colonne = (L - 20) / 3;
  const v = (x: number) => formaterValeur(metrique, x);

  return (
    <svg viewBox={`0 0 ${L} ${HAUTEUR}`} width="100%" className="block" role="img" aria-label={`Les ${NOM_FORMAT[rangee.format]} : l'année et les derniers mois`}>
      {rangee.postType !== null && (
        <line x1={6} x2={L - 6} y1={y(rangee.postType)} y2={y(rangee.postType)} stroke={c.trait} strokeOpacity={0.6} strokeDasharray="5 4" />
      )}
      {rangee.moustaches.map((b, i) => {
        const cx = 10 + colonne * i + colonne / 2 - 22;
        const { nom, statut } = STATUT[b.mois];
        return (
          <g key={b.mois}>
            <text x={cx} y={HAUTEUR - 22} fontSize={11.5} fontWeight={b.mois === 12 ? 700 : 500} fill="#0e0f12" textAnchor="middle">
              {nom}
            </text>
            <text x={cx} y={HAUTEUR - 8} fontSize={10} fill="#8b8e98" textAnchor="middle">
              {b.n} posts · {statut}
            </text>
            {b.etat === "mince" ? (
              <text x={cx} y={(Y_HAUT + Y_BAS) / 2} fontSize={11} fill="#8b8e98" textAnchor="middle">
                <title>{`Il faut ${MINIMUM_FOULE} posts pour dessiner une moustache.`}</title>
                {b.n} / {MINIMUM_FOULE} posts
              </text>
            ) : (
              <Boite b={b} cx={cx} y={y} couleur={c.trait} aplat={c.aplat} v={v} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Boite({
  b,
  cx,
  y,
  couleur,
  aplat,
  v,
}: {
  b: Extract<Moustache, { etat: "boite" }>;
  cx: number;
  y: (x: number) => number;
  couleur: string;
  aplat: string;
  v: (x: number) => string;
}) {
  const demi = Math.max(8, 26 * b.poids);
  const encre = 0.45 + 0.55 * b.poids;
  const q = b.quartiles;
  const pleine = b.mois === 12;
  return (
    <g opacity={encre}>
      <title>{`${STATUT[b.mois].nom} : bas ${v(q.q1)} · post type ${v(q.mediane)} · haut ${v(q.q3)} · ${b.n} posts. ${AIDE_HORS_NORME}`}</title>
      <line x1={cx} x2={cx} y1={y(b.haute)} y2={y(b.basse)} stroke={couleur} />
      <line x1={cx - 6} x2={cx + 6} y1={y(b.haute)} y2={y(b.haute)} stroke={couleur} />
      <line x1={cx - 6} x2={cx + 6} y1={y(b.basse)} y2={y(b.basse)} stroke={couleur} />
      <rect
        x={cx - demi}
        y={y(q.q3)}
        width={demi * 2}
        height={Math.max(3, y(q.q1) - y(q.q3))}
        rx={4}
        fill={pleine ? aplat : "#fff"}
        stroke={couleur}
        strokeDasharray={pleine ? undefined : "4 3"}
      />
      <line x1={cx - demi - 3} x2={cx + demi + 3} y1={y(q.mediane)} y2={y(q.mediane)} stroke={couleur} strokeWidth={3} />
      {b.points.map((p, i) => (
        <circle key={i} cx={cx + decalage(i) * (demi / 8)} cy={y(p)} r={1.8} fill={couleur} fillOpacity={0.55} />
      ))}
      <text x={cx + demi + 7} y={y(q.q3) + 4} fontSize={10} fill="#5a5d66">{v(q.q3)}</text>
      <text x={cx + demi + 7} y={y(q.mediane) + 4} fontSize={11} fontWeight={700} fill="#0e0f12">{v(q.mediane)}</text>
      <text x={cx + demi + 7} y={y(q.q1) + 4} fontSize={10} fill="#5a5d66">{v(q.q1)}</text>
      {b.horsNormeHaut > 0 && (
        <text x={cx} y={Y_HAUT - 8} fontSize={10} fill="#5a5d66" textAnchor="middle">
          <title>{AIDE_HORS_NORME}</title>▲ {b.horsNormeHaut} hors norme plus haut
        </text>
      )}
      {b.horsNormeBas > 0 && (
        <text x={cx + demi + 7} y={Y_BAS} fontSize={10} fill="#5a5d66">
          <title>{AIDE_HORS_NORME}</title>▼ {b.horsNormeBas} hors norme plus bas
        </text>
      )}
    </g>
  );
}
