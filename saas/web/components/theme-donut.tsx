import { fmtCHF } from "@/lib/report";
import type { ThemeRow } from "@/lib/report";

// « Où part ton argent » — l'anneau de répartition par thème.
//
// Une liste de montants oblige à comparer des nombres de tête ; un anneau se
// lit d'un coup d'œil : on voit tout de suite si la dépense est concentrée sur
// un thème ou éparpillée sur dix. C'est le complément visuel de la boussole —
// elle dit COMMENT ça se passe, celui-ci dit OÙ ça se joue.

const TEINTES = ["#1a56ff", "#1a7a4a", "#7b4fff", "#b86b00", "#c0392b", "#5b6472"];

export function ThemeDonut({ rows, orphan }: { rows: ThemeRow[]; orphan: number }) {
  const tries = [...rows].sort((a, b) => b.spend - a.spend).filter((r) => r.spend > 0);
  if (tries.length === 0) return null;

  const top = tries.slice(0, 5);
  const reste = tries.slice(5).reduce((a, r) => a + r.spend, 0) + (orphan > 0 ? orphan : 0);
  const parts = [
    ...top.map((r, i) => ({ label: r.label, spend: r.spend, color: TEINTES[i] })),
    ...(reste > 0 ? [{ label: "autres", spend: reste, color: TEINTES[5] }] : []),
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
      <div className="text-[11.5px] text-faint mb-3">
        {parts.length} thème{parts.length > 1 ? "s" : ""} · {fmtCHF(total)} CHF au total
      </div>

      <div className="flex items-center gap-5 sm:gap-7 flex-wrap sm:flex-nowrap justify-center sm:justify-start">
        <svg viewBox="0 0 100 100" className="w-[150px] h-[150px] sm:w-[190px] sm:h-[190px] shrink-0 -rotate-90" role="img"
          aria-label="Répartition de la dépense par thème">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f1f4" strokeWidth="16" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="16"
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={-a.offset}
            >
              <title>{`${a.label} — ${fmtCHF(a.spend)} CHF (${Math.round(a.frac * 100)} %)`}</title>
            </circle>
          ))}
        </svg>

        <div className="min-w-0 flex-1 space-y-1.5">
          {arcs.map((a) => (
            <div key={a.label} className="flex items-baseline gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: a.color }}
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
