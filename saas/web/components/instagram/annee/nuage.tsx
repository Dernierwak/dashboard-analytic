import { dateCourte, formaterValeur, libellePlace, raisonPlace } from "@/lib/instagram/tableau";
import { COULEUR_FORMAT } from "@/lib/instagram/couleurs";
import { NOM_FORMAT, type CleMetrique } from "@/lib/instagram/lecture";
import type { PeriodeLue, RangeeLue } from "@/lib/instagram/annee";
import { HAUTEUR, ordonnee, Y_BAS, Y_HAUT } from "./dessin";

// ── LE NUAGE : LES POSTS DE LA PÉRIODE SUR LA BANDE DE L'ANNÉE ──────────────
//
// Spec, « À gauche, le nuage » : date × métrique, couleur du format, posé sur
// la bande 25-75 % et la ligne du post type des 12 mois. Un post de moins de
// 48 h est un point vide. Un point au-delà du haut de l'axe (un hors norme)
// est une flèche en haut, sa valeur écrite — il n'étire pas l'axe.
//
// À venir : les numéros des 5 meilleurs et le clic qui ouvre `?post=`
// (ticket 11), le gris des écartés et l'anneau des boostés (ticket 12).

const L = 560;
const GAUCHE = 64;
const DROITE = 12;
const JOUR_MS = 86_400_000;

export function Nuage({ rangee, metrique, periode }: { rangee: RangeeLue; metrique: CleMetrique; periode: PeriodeLue }) {
  const y = ordonnee(rangee.axeMax);
  const c = COULEUR_FORMAT[rangee.format];
  const t0 = Date.parse(`${periode.debut}T00:00:00Z`);
  // La fin de la période est incluse : son dernier jour va jusqu'à minuit.
  const t1 = Date.parse(`${periode.fin}T00:00:00Z`) + JOUR_MS;
  const x = (iso: string) => GAUCHE + ((Date.parse(iso) - t0) / (t1 - t0)) * (L - GAUCHE - DROITE);
  const boite = rangee.moustaches[0];
  const sansValeur = rangee.surLaPeriode - rangee.nuage.length;

  return (
    <svg viewBox={`0 0 ${L} ${HAUTEUR}`} width="100%" className="block" role="img" aria-label={`Les ${NOM_FORMAT[rangee.format]} de la période`}>
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={GAUCHE - 4} x2={L - DROITE} y1={y(k * rangee.axeMax)} y2={y(k * rangee.axeMax)} stroke="#a8a8b0" strokeOpacity={0.25} />
          <text x={GAUCHE - 8} y={y(k * rangee.axeMax) + 3.5} fontSize={11} fill="#8b8e98" textAnchor="end">
            {formaterValeur(metrique, k * rangee.axeMax)}
          </text>
        </g>
      ))}
      {boite.etat === "boite" && (
        <>
          <rect
            x={GAUCHE - 4}
            y={y(boite.quartiles.q3)}
            width={L - GAUCHE - DROITE + 4}
            height={Math.max(2, y(boite.quartiles.q1) - y(boite.quartiles.q3))}
            fill={c.aplat}
          >
            <title>Le milieu de tes habitudes : la moitié de tes posts de ce format des 12 derniers mois tombe ici.</title>
          </rect>
          <line x1={GAUCHE - 4} x2={L - DROITE} y1={y(boite.quartiles.mediane)} y2={y(boite.quartiles.mediane)} stroke={c.trait} strokeOpacity={0.7} strokeDasharray="5 4" />
          <text x={L - DROITE} y={y(boite.quartiles.mediane) - 5} fontSize={10.5} fill={c.trait} textAnchor="end">
            post type de l&apos;année
          </text>
        </>
      )}
      <text x={GAUCHE} y={HAUTEUR - 14} fontSize={11} fill="#8b8e98">
        {dateCourte(`${periode.debut}T00:00:00Z`)}
      </text>
      <text x={L - DROITE} y={HAUTEUR - 14} fontSize={11} fill="#8b8e98" textAnchor="end">
        {dateCourte(`${periode.fin}T00:00:00Z`)}
      </text>

      {rangee.surLaPeriode === 0 ? (
        <text x={(GAUCHE + L) / 2} y={(Y_HAUT + Y_BAS) / 2} fontSize={12.5} fill="#5a5d66" textAnchor="middle">
          aucun post sur la période
        </text>
      ) : (
        sansValeur > 0 && (
          <text x={L - DROITE} y={HAUTEUR - 2} fontSize={10.5} fill="#8b8e98" textAnchor="end">
            {sansValeur} post{sansValeur > 1 ? "s" : ""} de la période sans ce chiffre
          </text>
        )
      )}

      {rangee.nuage.map((p) => {
        const cx = x(p.post.date);
        const place = libellePlace(p.place);
        const bulle = [dateCourte(p.post.date), formaterValeur(metrique, p.valeur), place, raisonPlace(p.place)].filter(Boolean).join(" · ");
        if (p.horsAxe) {
          return (
            <g key={p.post.id}>
              <title>{bulle}</title>
              <path d={`M${cx - 6},${Y_HAUT + 8} L${cx + 6},${Y_HAUT + 8} L${cx},${Y_HAUT - 2} Z`} fill={c.trait} />
              <text x={cx} y={Y_HAUT - 6} fontSize={10.5} fill="#5a5d66" textAnchor="middle">
                {formaterValeur(metrique, p.valeur)}
              </text>
            </g>
          );
        }
        return (
          <circle key={p.post.id} cx={cx} cy={y(p.valeur)} r={5} fill={p.jeune ? "#fff" : c.trait} stroke={c.trait} strokeWidth={1.5}>
            <title>{bulle}</title>
          </circle>
        );
      })}
    </svg>
  );
}
