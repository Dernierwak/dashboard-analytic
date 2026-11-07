import { formaterValeur } from "@/lib/instagram/tableau";
import { COULEUR_FORMAT } from "@/lib/instagram/couleurs";
import { MINIMUM_FOULE, NOM_FORMAT_PLURIEL, type CleMetrique, type Format } from "@/lib/instagram/lecture";
import type { Moustache } from "@/lib/instagram/annee";

// ── LA MINI-MOUSTACHE : UN POST SUR LA MOUSTACHE DE SON ANNÉE ───────────────
//
// Spec, la liste des 5 meilleurs (« mini-moustache parmi tes Reels des 12
// derniers mois ») et le Panneau (« la valeur et la moustache »). Couchée,
// pour tenir dans une carte : la boîte 25-75 %, le post type, les bouts dans
// les limites de Tukey, et le post lui-même en point cerclé. L'axe part de 0,
// comme celui des rangées (`dessin.ts`) : une boîte sur un axe tronqué se lit
// plus large qu'elle n'est.

const L = 260;
const H = 30;
const G = 4;
const D = 14;

export function MiniMoustache({
  moustache,
  valeur,
  format,
  metrique,
}: {
  moustache: Moustache;
  valeur: number;
  format: Format;
  metrique: CleMetrique;
}) {
  const pluriel = NOM_FORMAT_PLURIEL[format];
  if (moustache.etat === "mince") {
    return (
      <p className="text-[11.5px] text-faint">
        {moustache.n} / {MINIMUM_FOULE} {pluriel.toLowerCase()} sur 12 mois — pas encore de moustache
      </p>
    );
  }
  const c = COULEUR_FORMAT[format];
  const q = moustache.quartiles;
  // Un post au-delà du bout haut (un hors norme) se pose au bord, une flèche
  // le dit : il n'écrase pas la boîte en étirant l'axe.
  const max = Math.max(moustache.haute, q.q3) * 1.06 || 1;
  const x = (v: number) => G + (Math.min(v, max) / max) * (L - G - D);
  const dehors = valeur > max;
  const y = H / 2;
  const v = (n: number) => formaterValeur(metrique, n);
  return (
    <svg
      viewBox={`0 0 ${L} ${H}`}
      width="100%"
      className="block"
      role="img"
      aria-label={`Parmi tes ${pluriel} des 12 derniers mois : bas ${v(q.q1)}, post type ${v(q.mediane)}, haut ${v(q.q3)} ; ce post ${v(valeur)}`}
    >
      <title>{`Parmi tes ${pluriel} des 12 derniers mois (${moustache.n}) : bas ${v(q.q1)} · post type ${v(q.mediane)} · haut ${v(q.q3)}`}</title>
      <line x1={x(moustache.basse)} x2={x(moustache.haute)} y1={y} y2={y} stroke={c.trait} strokeOpacity={0.6} />
      <rect x={x(q.q1)} y={y - 7} width={Math.max(2, x(q.q3) - x(q.q1))} height={14} rx={3} fill={c.aplat} stroke={c.trait} strokeOpacity={0.7} />
      <line x1={x(q.mediane)} x2={x(q.mediane)} y1={y - 9} y2={y + 9} stroke={c.trait} strokeWidth={2.5} />
      {dehors ? (
        <path d={`M${L - D + 2},${y - 6} L${L - 2},${y} L${L - D + 2},${y + 6} Z`} fill="#0e0f12" />
      ) : (
        <circle cx={x(valeur)} cy={y} r={5} fill="#0e0f12" stroke="#fff" strokeWidth={1.5} />
      )}
    </svg>
  );
}
