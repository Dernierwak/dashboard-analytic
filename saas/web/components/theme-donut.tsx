import { fmtCHF } from "@/lib/report";
import type { ThemeRow } from "@/lib/report";
import { teinteLabel, NEUTRE } from "@/lib/palette";

// « Où part ton argent » — l'anneau de répartition par thème.
//
// Une liste de montants oblige à comparer des nombres de tête ; un anneau se
// lit d'un coup d'œil : on voit tout de suite si la dépense est concentrée sur
// un thème ou éparpillée sur dix. C'est le complément visuel de la boussole —
// elle dit COMMENT ça se passe, celui-ci dit OÙ ça se joue.



export function ThemeDonut({
  rows,
  orphan,
  univers,
}: {
  rows: ThemeRow[];
  orphan: number;
  // La liste maîtresse des thèmes : elle fixe la couleur de chacun, pour qu'un
  // thème garde la sienne d'un module à l'autre et d'une semaine à l'autre.
  univers?: string[];
}) {
  const tries = [...rows].sort((a, b) => b.spend - a.spend).filter((r) => r.spend > 0);
  if (tries.length === 0) return null;

  const top = tries.slice(0, 5);
  const reste = tries.slice(5).reduce((a, r) => a + r.spend, 0) + (orphan > 0 ? orphan : 0);
  const parts = [
    ...top.map((r) => ({ label: r.label, spend: r.spend, t: teinteLabel(r.label, univers) })),
    ...(reste > 0 ? [{ label: "autres", spend: reste, t: NEUTRE }] : []),
  ];
  const total = parts.reduce((a, p) => a + p.spend, 0);
  if (total <= 0) return null;

  // Anneau dessiné en arcs de cercle : un seul cercle, un dasharray par part.
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = parts.map((p) => {
    const frac = p.spend / total;
    const arc = { ...p, frac, dash: frac * C, offset };
    offset += frac * C;
    return arc;
  });

  return (
    <div className="bg-white border border-line rounded-2xl shadow-card p-5 sm:p-6">
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">
        Où part ton argent
      </div>

      <div className="flex items-center gap-5 sm:gap-7 flex-wrap sm:flex-nowrap justify-center sm:justify-start">
        {/* Le total au CENTRE de l'anneau, pas en sous-titre gris. Un anneau
            sans son total est une forme sans sa valeur. */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="w-[150px] h-[150px] sm:w-[190px] sm:h-[190px] -rotate-90" role="img"
            aria-label="Répartition de la dépense par thème">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f1f4" strokeWidth="16" />
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={a.t.trait}
                strokeWidth="16"
                opacity={0.9}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={-a.offset}
              >
                <title>{`${a.label} — ${fmtCHF(a.spend)} CHF (${Math.round(a.frac * 100)} %)`}</title>
              </circle>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-[22px] sm:text-[26px] leading-none font-medium text-ink">
              {fmtCHF(total)}
            </span>
            <span className="text-[10.5px] text-faint mt-1">
              CHF · {parts.length} thème{parts.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Sur toute la largeur, une légende en colonne unique laisse un grand
            vide à droite. Elle s'étale en colonnes dès qu'il y a la place. */}
        <div className="min-w-0 flex-1 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {arcs.map((a) => (
            <div key={a.label} className="flex items-baseline gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0 border-2"
                style={{ background: a.t.aplat, borderColor: a.t.trait }}
              />
              <span className="text-[12.5px] text-ink truncate">{a.label}</span>
              <span className="ml-auto font-mono text-[12px] text-muted shrink-0">
                {Math.round(a.frac * 100)} %
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-faint leading-relaxed mt-3.5">
        Dépense cumulée par thème. Un thème qui prend la moitié du budget mérite la
        moitié de ton attention — c&apos;est rarement le cas.
      </p>
    </div>
  );
}
