import type { DefRatio, Jugement, RatioHebdo } from "@/lib/hebdo/canaux";
import { NEUTRE } from "@/lib/palette";

// ── LA MOUSTACHE D'UN RATIO : LA SEMAINE PARMI SES 12 PRÉCÉDENTES ────────────
//
// Forme validée au prototype 08, variante E (spec hebdo, « Moustache ») : l'axe
// va de la moins bonne à la meilleure semaine, chaque semaine en petit point
// pour voir où elles se tassent, la boîte q1 → q3 nommée « tes habitudes », la
// médiane nommée « semaine type », la semaine regardée en gros point.
//
// LE MIEUX EST TOUJOURS À DROITE : pour CPC et CPM, où plus bas est mieux,
// l'axe s'inverse — on ne retourne jamais la lecture d'une ligne à l'autre.
//
// Tons légers : le gros point prend le vert et le rouge maison (`pos`, `neg`
// de `tailwind.config.ts`) adoucis d'un halo à ~14 %, la règle de dilution de
// `lib/palette.ts` ; le gris `NEUTRE` dit « dans tes habitudes ».

const L = 460;
const H = 66;
const MARGE = 14;
const Y = 34;

const TEINTE: Record<Jugement, { point: string; halo: string }> = {
  mieux: { point: "#1a7a4a", halo: "rgba(26, 122, 74, 0.16)" },
  moins: { point: "#c0392b", halo: "rgba(192, 57, 43, 0.14)" },
  dans: { point: NEUTRE.trait, halo: NEUTRE.aplat },
};
const ENCRE_DOUCE = "#8b8e98"; // `faint`
const ENCRE = "#5a5d66"; // `muted`

export function Moustache({
  ratio,
  def,
  juge,
}: {
  ratio: RatioHebdo;
  def: DefRatio;
  juge: Jugement | null;
}) {
  const { semaines, valeur, q1, q3, mediane } = ratio;
  if (q1 === null || q3 === null || mediane === null || !semaines.length) return null;

  const min = Math.min(...semaines);
  const max = Math.max(...semaines);
  const bas = Math.min(min, valeur ?? min);
  const haut = Math.max(max, valeur ?? max);
  const pad = (haut - bas) * 0.06 || Math.abs(haut) * 0.1 || 1;
  const x = (v: number) => {
    const t = (v - (bas - pad)) / (haut - bas + 2 * pad);
    return MARGE + (def.mieux === "haut" ? t : 1 - t) * (L - 2 * MARGE);
  };
  const [pire, meilleure] = def.mieux === "haut" ? [min, max] : [max, min];
  // L'étiquette de la semaine type ne déborde pas du dessin.
  const xType = Math.min(L - 70, Math.max(70, x(mediane)));
  const boite = { de: Math.min(x(q1), x(q3)), a: Math.max(x(q1), x(q3)) };

  const resume =
    `${def.nom} : semaine type ${def.format(mediane)}, tes habitudes de ` +
    `${def.format(Math.min(q1, q3))} à ${def.format(Math.max(q1, q3))}` +
    (valeur === null ? "." : `, cette semaine ${def.format(valeur)}.`);

  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" className="block" role="img" aria-label={resume}>
      <text x={xType} y={11} fontSize={10.5} fill={ENCRE} textAnchor="middle">
        semaine type {def.format(mediane)}
      </text>
      <line x1={x(pire)} x2={x(meilleure)} y1={Y} y2={Y} stroke={NEUTRE.trait} strokeOpacity={0.5} strokeWidth={1.5} />
      <rect x={boite.de} y={Y - 11} width={Math.max(3, boite.a - boite.de)} height={22} rx={6} fill={NEUTRE.aplat} />
      <text x={(boite.de + boite.a) / 2} y={Y + 21} fontSize={9.5} fill={ENCRE_DOUCE} textAnchor="middle">
        tes habitudes
      </text>
      {semaines.map((v, i) => (
        <circle key={i} cx={x(v)} cy={Y} r={2.6} fill={NEUTRE.trait} />
      ))}
      <line x1={x(mediane)} x2={x(mediane)} y1={16} y2={Y + 12} stroke={ENCRE} strokeWidth={2} strokeLinecap="round" />
      {valeur !== null && (
        <>
          <circle cx={x(valeur)} cy={Y} r={12} fill={TEINTE[juge ?? "dans"].halo} />
          <circle cx={x(valeur)} cy={Y} r={7} fill={TEINTE[juge ?? "dans"].point} stroke="#fff" strokeWidth={2.5} />
        </>
      )}
      <text x={x(pire)} y={H - 3} fontSize={10} fill={ENCRE_DOUCE} textAnchor="start">
        moins bonne {def.format(pire)}
      </text>
      <text x={x(meilleure)} y={H - 3} fontSize={10} fill={ENCRE_DOUCE} textAnchor="end">
        meilleure {def.format(meilleure)} →
      </text>
    </svg>
  );
}
