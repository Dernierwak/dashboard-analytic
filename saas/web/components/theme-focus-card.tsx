import { fmtCHF } from "@/lib/report";
import type { ThemeFocus, ThemeSeries } from "@/lib/report";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";

const CH_ICON: Record<string, { icon: string; color: string }> = {
  meta: { icon: "▣", color: "#1a56ff" },
  google: { icon: "◆", color: "#1a7a4a" },
};

// La frise (Phase 2) : la métrique du thème sur 10 semaines, avec un repère ▲
// à chaque semaine où tu as lancé une action. Tu vois si la courbe a suivi.
function ThemeTimeline({ series }: { series: ThemeSeries }) {
  const W = 640, H = 74, PAD = 6, base = H - 14;
  const vals = series.points.map((p) => p.value);
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (n - 1);
  const y = (v: number) => 6 + (1 - v / max) * (base - 6);
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M${x(0)},${base} L${vals.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${x(n - 1)},${base} Z`;
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          {series.metric_label} · 10 semaines
        </span>
        {series.markers.length > 0 && (
          <span className="text-[10px] text-brand font-semibold">▲ tes actions</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Évolution de ${series.metric_label} du thème sur 10 semaines`}>
        <line x1={PAD} y1={base} x2={W - PAD} y2={base} stroke="var(--color-line, #e6e6e9)" />
        <path d={area} fill="#1a56ff" opacity="0.08" />
        <polyline points={line} fill="none" stroke="#1a56ff" strokeWidth="2" strokeLinejoin="round" />
        {series.markers.map((mi) => (
          <g key={mi}>
            <line x1={x(mi)} y1={2} x2={x(mi)} y2={base} stroke="#1a7a4a" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={x(mi)} cy={y(vals[mi])} r="3.5" fill="#fff" stroke="#1a7a4a" strokeWidth="2" />
          </g>
        ))}
        <text x={PAD} y={H - 2} fontSize="9" fill="#8b8e98">{series.points[0]?.label}</text>
        <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="9" fill="#8b8e98">
          {series.points[n - 1]?.label}
        </text>
      </svg>
    </div>
  );
}

// Un thème (label), pensé DESKTOP : en-tête pleine largeur avec le bilan du
// thème, puis deux colonnes — à gauche ses campagnes (scroll si longues,
// réassignables), à droite ses conseils en grille (chacun distinct).
export function ThemeFocusCard({
  theme,
  labels,
  feedback,
  comments,
  trackedKeys,
  capReached = false,
}: {
  theme: ThemeFocus;
  labels: string[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
  trackedKeys: string[];
  capReached?: boolean;
}) {
  const s = theme.summary;
  const hasRoas = s.roas !== null && s.roas !== undefined;

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
    <section className="bg-white border border-line rounded-xl shadow-card overflow-hidden mb-5">
      {/* En-tête : le thème + son bilan */}
      <div className="px-5 py-4 border-b border-line bg-black/[0.015]">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h3 className="text-[17px] font-semibold text-ink">
            {theme.is_priority && <span className="text-warn">★ </span>}
            {theme.label}
          </h3>
          {s.spend_week > 0 && (
            <span className="text-[11.5px] text-faint">
              {fmtCHF(s.spend_week)} CHF cette semaine
            </span>
          )}
        </div>
        {bits.length > 0 ? (
          <p className="text-[12.5px] text-muted leading-relaxed mt-1">
            <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
              Ce qui fonctionne ·{" "}
            </span>
            {bits.join(" — ")}
            {!hasRoas && s.spend != null && s.spend > 0 && (
              <span className="text-faint"> (revenu inconnu tant que Google Analytics est muet)</span>
            )}
          </p>
        ) : (
          <p className="text-[12.5px] text-faint leading-relaxed mt-1">
            Pas encore assez de données sur ce thème pour en tirer une tendance.
          </p>
        )}
        {theme.series && <ThemeTimeline series={theme.series} />}
      </div>

      {/* Corps : DEUX blocs distincts, jamais mêlés — campagnes puis conseils. */}
      <div className="p-4 space-y-5">
        {/* Bloc 1 — Ses campagnes (liste homogène qui scrolle) */}
        {theme.campaigns.length > 0 ? (
          <ScrollList title="Ses campagnes" count={theme.campaigns.length} maxH="max-h-[40vh]">
            {theme.campaigns.map((c) => {
              const ch = CH_ICON[c.channel] ?? CH_ICON.meta;
              return (
                <div key={`${c.channel}:${c.key}`} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px]" style={{ color: ch.color }}>{ch.icon}</span>
                    <span className="text-[13.5px] text-ink truncate flex-1" title={c.name}>
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-[12px] text-faint">
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
                </div>
              );
            })}
          </ScrollList>
        ) : (
          <p className="text-[12.5px] text-faint">Aucune campagne pub sur ce thème.</p>
        )}

        {/* Bloc 2 — Ses conseils : carrousel horizontal, testés épinglés en tête */}
        <div>
          <h4 className="text-[11px] uppercase tracking-wide text-brand font-bold mb-2">
            Comment l&apos;améliorer cette semaine
          </h4>
          {theme.recos.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {[...theme.recos]
                .sort(
                  (a, b) =>
                    (trackedKeys.includes(b.key) ? 1 : 0) - (trackedKeys.includes(a.key) ? 1 : 0)
                )
                .map((r) => (
                  <div key={r.key} className="snap-start shrink-0 w-[300px] sm:w-[330px]">
                    <RecoCard
                      r={r}
                      current={feedback[r.key] ?? null}
                      comment={comments[r.key] ?? null}
                      theme={theme.label}
                      tracked={trackedKeys.includes(r.key)}
                      capReached={capReached}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-faint">
              Rien d&apos;urgent sur ce thème cette semaine — il tourne dans ses normes.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
