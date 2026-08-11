import { fmtCHF } from "@/lib/report";
import type { ThemeFocus } from "@/lib/report";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";

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
  trackedKeys,
  capReached = false,
  ancre = null,
}: {
  theme: ThemeFocus;
  labels: string[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
  trackedKeys: string[];
  capReached?: boolean;
  /** L'ancre de la carte du même thème en section 2, quand elle existe. */
  ancre?: string | null;
}) {
  const s = theme.summary;
  const hasRoas = s.roas !== null && s.roas !== undefined;

  // LE BILAN A DÉMÉNAGÉ, ET IL NE LAISSE PAS DE RAPPEL DERRIÈRE LUI.
  //
  // Il occupait ici six chiffres en 19 px — exactement les mêmes que ceux de la
  // carte de thème en section 2. Il a d'abord été remplacé par un rappel d'une
  // ligne (« 4 520 CHF → 820 CHF · ROAS 0,2 ↑ voir la courbe »), en pariant que
  // les onglets rendraient les deux rarement visibles ensemble. Faux : avec un
  // seul thème prioritaire, la section 2 et la section 4 tiennent dans le même
  // écran, et les mêmes chiffres s'y lisent deux fois à 900 px d'écart.
  //
  // Le rappel ne subsiste donc QUE pour un thème sans courbe — trop peu de
  // relevés pour une carte en section 2. Là, il n'est pas un doublon : c'est le
  // seul endroit où ces chiffres existent.
  const bouts: string[] = [];
  if (s.spend != null && s.spend > 0) {
    bouts.push(
      hasRoas
        ? `${fmtCHF(s.spend)} CHF → ${fmtCHF(s.revenue ?? 0)} CHF · ROAS ${s.roas!.toFixed(1)}`
        : `${fmtCHF(s.spend)} CHF dépensés${s.ctr != null ? ` · CTR ${s.ctr.toFixed(1)} %` : ""}`
    );
  }
  if (s.posts != null && s.posts > 0) {
    bouts.push(
      `${s.posts} publication${s.posts > 1 ? "s" : ""}${
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
          {!ancre && s.spend_week > 0 && (
            <span className="text-[11.5px] text-faint">
              {fmtCHF(s.spend_week)} CHF cette semaine
            </span>
          )}
          {ancre && (
            <a
              href={`#${ancre}`}
              className="text-[11.5px] font-semibold text-brand hover:underline"
            >
              ↑ ses chiffres et sa courbe
            </a>
          )}
        </div>
        {ancre ? null : bouts.length > 0 ? (
          <>
            <p className="text-[12.5px] text-muted leading-relaxed mt-1.5">
              {bouts.join(" · ")}
            </p>
            {!hasRoas && s.spend != null && s.spend > 0 && (
              <p className="text-[11px] text-faint mt-1.5">
                Revenu inconnu tant que Google Analytics ne remonte pas la valeur de tes
                conversions.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-faint leading-relaxed mt-1">
            Pas encore assez de données sur ce thème pour en tirer une tendance.
          </p>
        )}
      </div>

      {/* Corps : DEUX blocs distincts, jamais mêlés — campagnes puis conseils. */}
      <div className="p-4 space-y-5">
        {/* Bloc 1 — Ses campagnes (liste homogène qui scrolle) */}
        {theme.campaigns.length > 0 ? (
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none mb-2">
              <h3 className="text-[11px] uppercase tracking-wide text-faint font-bold">
                Ses campagnes <span className="text-faint/70">({theme.campaigns.length})</span>
              </h3>
              <span className="text-[11px] text-brand font-semibold group-open:hidden">déplier ▾</span>
              <span className="text-[11px] text-brand font-semibold hidden group-open:inline">replier ▴</span>
            </summary>
          <ScrollList title="" maxH="max-h-[40vh]">
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
          </details>
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
