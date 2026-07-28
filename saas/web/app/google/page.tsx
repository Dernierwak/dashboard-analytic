// Dashboard Google Ads — même base que l'onglet Streamlit : périodes 7→Tout,
// filtres, hero impressions, KPIs, évolution quotidienne à métrique au choix,
// campagnes → groupes d'annonces → annonces (google_ads_ad_insights).
import { getGoogleDash, type DashParams } from "@/lib/channels";
import { SiteHeader } from "@/components/site-header";
import { FilterBar } from "@/components/filter-bar";
import { DateRange } from "@/components/date-range";
import {
  PeriodPills,
  AdsKpis,
  CampaignTable,
  MetricChart,
  ByLabelTable,
} from "@/components/channel-dash";

export const dynamic = "force-dynamic";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getGoogleDash(searchParams);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <SiteHeader email={d.email} active="google" />

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
      <MetricChart d={d} path="/google" />
      <ByLabelTable d={d} />

      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par campagne{" "}
        <span className="text-faint font-normal">
          · triées par dépense · déplie pour voir groupes et annonces
        </span>
      </h2>
      <CampaignTable d={d} channel="google" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — même liste que Meta
        et Instagram.
      </p>
    </main>
  );
}
