import { fmtCHF } from "@/lib/report";
import type { ThemeFocus } from "@/lib/report";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";

const CH_ICON: Record<string, { icon: string; color: string }> = {
  meta: { icon: "▣", color: "#1a56ff" },
  google: { icon: "◆", color: "#1a7a4a" },
};

// Un thème (label), pensé DESKTOP : en-tête pleine largeur avec le bilan du
// thème, puis deux colonnes — à gauche ses campagnes (scroll si longues,
// réassignables), à droite ses conseils en grille (chacun distinct).
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
      </div>

      {/* Corps : campagnes (gauche) · conseils (droite) sur desktop.
          Tient dans ~46 % de l'écran puis SCROLLE — l'en-tête reste visible. */}
      <div className="grid lg:grid-cols-3 max-h-[46vh] overflow-y-auto">
        {/* Colonne campagnes */}
        <div className="lg:col-span-1 p-4 lg:border-r border-line border-b lg:border-b-0">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2 sticky top-0 bg-white">
            Ses campagnes ({theme.campaigns.length})
          </div>
          {theme.campaigns.length > 0 ? (
            <div className="pr-1 divide-y divide-line">
              {theme.campaigns.map((c) => {
                const ch = CH_ICON[c.channel] ?? CH_ICON.meta;
                return (
                  <div key={`${c.channel}:${c.key}`} className="py-2.5 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]" style={{ color: ch.color }}>
                        {ch.icon}
                      </span>
                      <span
                        className="text-[12.5px] text-ink truncate flex-1"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
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
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-faint">Aucune campagne pub sur ce thème.</p>
          )}
        </div>

        {/* Colonne conseils — chacun distinct, en grille sur grand écran */}
        <div className="lg:col-span-2 p-4">
          <div className="text-[10px] uppercase tracking-wide text-brand font-bold mb-2">
            Comment l&apos;améliorer cette semaine
          </div>
          {theme.recos.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
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
      </div>
    </section>
  );
}
