// Dashboard Google Ads — même base que l'onglet Streamlit : périodes 7→Tout,
// filtres, hero impressions, KPIs, évolution quotidienne à métrique au choix,
// campagnes → groupes d'annonces → annonces (google_ads_ad_insights).
import { getGoogleDash, type DashParams } from "@/lib/channels";
import { FilterBar } from "@/components/filter-bar";
import { DateRange } from "@/components/date-range";
import {
  PeriodPills,
  AdsKpis,
  CampaignTable,
  MetricChart,
  MoyennesAds,
  ByLabelTable,
} from "@/components/channel-dash";

import { getCompteActif } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getGoogleDash(searchParams);
  const compte = await getCompteActif();

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#1a7a4a" }}>◆</span> Google Ads.
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodPills path="/google" d={d} />
            <DateRange from={searchParams?.from} to={searchParams?.to} />
          </div>
        </div>
      </div>

      <FilterBar
        statusOptions={d.statusOptions}
        campOptions={d.campOptions}
        labels={d.labels}
        current={d.filters}
      />

      <AdsKpis d={d} channel="google" />
      {/* Même module, même place que sur Meta : deux pages canal qui posent la
          même question doivent la poser dans le même ordre. */}
      <MoyennesAds d={d} path="/google" />
      <MetricChart d={d} path="/google" />
      {/* Les deux tables qui suivent portent l'écart des mêmes deux périodes
          qu'une comparaison, dès qu'elle est posée — et rien de plus quand
          elle ne l'est pas. */}
      <ByLabelTable d={d} path="/google" />

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé — et
          sur Google le détail par groupe d'annonces n'est pas toujours là. */}
      <CampaignTable d={d} channel="google" path="/google" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — même liste que Meta
        et Instagram.
      </p>
    </main>
  );
}
