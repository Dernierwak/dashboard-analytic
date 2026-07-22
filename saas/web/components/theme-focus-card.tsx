import { fmtCHF } from "@/lib/report";
import type { ThemeFocus } from "@/lib/report";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";

const CH_ICON: Record<string, { icon: string; color: string }> = {
  meta: { icon: "▣", color: "#1a56ff" },
  google: { icon: "◆", color: "#1a7a4a" },
};

// Une carte = un thème (label). Cross-canal : ce qui fonctionne, ses campagnes
// (Meta+Google, réassignables), et ≤3 conseils pour l'améliorer.
export function ThemeFocusCard({
  theme,
  labels,
  feedback,
  comments,
}: {
  theme: ThemeFocus;
  labels: string[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
}) {
  const s = theme.summary;
  const hasRoas = s.roas !== null && s.roas !== undefined;

  // Résumé « ce qui fonctionne » — chiffres full-history, honnête si GA4 muet.
  const bits: string[] = [];
  if (s.spend != null && s.spend > 0) {
    bits.push(
      hasRoas
        ? `${fmtCHF(s.spend)} CHF → ${fmtCHF(s.revenue ?? 0)} CHF (ROAS ${s.roas!.toFixed(1)})`
        : `${fmtCHF(s.spend)} CHF investis${s.ctr != null ? ` · CTR ${s.ctr.toFixed(1)} %` : ""}`
    );
  }
  if (s.posts != null && s.posts > 0) {
    bits.push(
      `${s.posts} post${s.posts > 1 ? "s" : ""}${
        s.eng_avg != null ? ` · ${s.eng_avg.toFixed(1)} % d'engagement` : ""
      }`
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      {/* En-tête : le thème + ce qui fonctionne */}
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <h3 className="text-[16px] font-semibold text-ink">
          {theme.is_priority && <span className="text-warn">★ </span>}
          {theme.label}
        </h3>
        {s.spend_week > 0 && (
          <span className="text-[11px] text-faint">
            {fmtCHF(s.spend_week)} CHF cette semaine
          </span>
        )}
      </div>
      {bits.length > 0 ? (
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
            Ce qui fonctionne ·{" "}
          </span>
          {bits.join(" — ")}
          {!hasRoas && s.spend != null && s.spend > 0 && (
            <span className="text-faint"> (revenu inconnu tant que Google Analytics est muet)</span>
          )}
        </p>
      ) : (
        <p className="text-[12.5px] text-faint leading-relaxed mb-3">
          Pas encore assez de données sur ce thème pour en tirer une tendance.
        </p>
      )}

      {/* Ses campagnes — réassignables (change le thème d'une campagne) */}
      {theme.campaigns.length > 0 && (
        <details className="mb-3 group">
          <summary className="text-[11.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
            ▸ Ses campagnes ({theme.campaigns.length}) — vois et change leur thème
          </summary>
          <div className="mt-2 divide-y divide-line border-t border-line">
            {theme.campaigns.map((c) => {
              const ch = CH_ICON[c.channel] ?? CH_ICON.meta;
              return (
                <div key={`${c.channel}:${c.key}`} className="flex items-center gap-2 py-2 flex-wrap">
                  <span className="text-[13px]" style={{ color: ch.color }}>
                    {ch.icon}
                  </span>
                  <span className="text-[12.5px] text-ink truncate max-w-[180px] sm:max-w-[260px]" title={c.name}>
                    {c.name}
                  </span>
                  <span className="font-mono text-[11.5px] text-faint">
                    {fmtCHF(c.spend)} CHF
                    {c.revenue != null && c.revenue > 0 && ` → ${fmtCHF(c.revenue)}`}
                  </span>
                  <span className="ml-auto">
                    <CampaignLabelSelect
                      channel={c.channel}
                      campaignKey={c.key}
                      campaignName={c.name}
                      current={c.label}
                      labels={labels}
                      source={c.label_source}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Ses conseils — ≤3, cross-canal */}
      {theme.recos.length > 0 ? (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wide text-brand font-bold">
            Comment l&apos;améliorer cette semaine
          </div>
          {theme.recos.map((r) => (
            <RecoCard
              key={r.key}
              r={r}
              current={feedback[r.key] ?? null}
              comment={comments[r.key] ?? null}
            />
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-faint">
          Rien d&apos;urgent sur ce thème cette semaine — il tourne dans ses normes.
        </p>
      )}
    </div>
  );
}
