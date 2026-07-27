import { RecoActions } from "@/components/reco-actions";
import type { PayloadReco } from "@/lib/report";

const CONF: Record<string, { symbol: string; label: string }> = {
  solide: { symbol: "●", label: "Solide" },
  creuser: { symbol: "◐", label: "À creuser" },
  piste: { symbol: "○", label: "Piste" },
};

// Carte de reco ALLÉGÉE : par défaut on ne voit que l'essentiel (badge, titre,
// le fait, feedback). Le détail (pourquoi / comment tester / angle mort) est
// replié derrière « ▸ Pourquoi & comment tester » — <details> natif, zéro JS.
export function RecoCard({
  r,
  current,
  comment,
  theme = null,
  tracked = false,
  capReached = false,
}: {
  r: PayloadReco;
  current: string | null;
  comment: string | null;
  theme?: string | null;
  tracked?: boolean;
  capReached?: boolean;
}) {
  const cf = CONF[r.confidence] ?? CONF.piste;
  const hasDetail = Boolean(r.pourquoi || r.verifier || r.repere || r.angle_mort);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        {r.source === "ai" ? (
          <span className="text-[9.5px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
            IA · à tester
          </span>
        ) : (
          <span className="text-[9.5px] font-semibold text-muted bg-black/[0.06] rounded-full px-2 py-0.5">
            Règle
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted">
          <span className="text-[12px] text-ink">{cf.symbol}</span>
          {cf.label}
        </span>
      </div>
      <h3 className="text-[14px] font-semibold text-ink leading-snug">{r.title}</h3>
      <p className="text-[12.5px] text-muted leading-relaxed mt-1">{r.observation}</p>

      {/* Les deux infos qui permettent de trancher en 5 secondes : ce que ça
          coûte à faire, et l'indicateur qu'on regardera après. */}
      {(r.effort || r.metric_label) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {r.effort && (
            <span className="text-[11px] font-semibold text-muted bg-black/[0.05] rounded-full px-2.5 py-1">
              ⏱ {r.effort}
            </span>
          )}
          {r.metric_label && (
            <span className="text-[11px] font-semibold text-brand bg-brand/[0.07] rounded-full px-2.5 py-1">
              ↗ {r.metric_label}
            </span>
          )}
        </div>
      )}

      {hasDetail && (
        <details className="mt-2 group">
          <summary className="text-[11.5px] font-semibold text-brand cursor-pointer select-none list-none">
            <span className="group-open:hidden">▸ Pourquoi &amp; comment tester</span>
            <span className="hidden group-open:inline">▾ Replier</span>
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {r.pourquoi && (
              <p className="text-[12px] text-muted leading-relaxed">
                <span className="font-semibold text-ink">Pourquoi — </span>
                {r.pourquoi}
              </p>
            )}
            {r.verifier && (
              <p className="text-[12px] text-muted leading-relaxed">
                <span className="font-semibold text-ink">Avant d&apos;agir — </span>
                {r.verifier}
              </p>
            )}
            {r.repere && (
              <div className="text-[12px] text-ink leading-relaxed bg-brand/[0.05] border border-brand/[0.14] rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-brand">Repère — </span>
                {r.repere}
              </div>
            )}
            {r.angle_mort && (
              <p className="text-[11.5px] text-faint leading-relaxed">
                <span className="font-semibold">Angle mort — </span>
                {r.angle_mort}
              </p>
            )}
          </div>
        </details>
      )}

      <RecoActions
        recoKey={r.key}
        current={current}
        comment={comment}
        tracked={tracked}
        capReached={capReached}
        track={{
          title: r.title,
          theme,
          metric: r.metric ?? null,
          metricLabel: r.metric_label ?? null,
          direction: r.direction ?? null,
          baseline: r.baseline ?? null,
        }}
      />
    </div>
  );
}
