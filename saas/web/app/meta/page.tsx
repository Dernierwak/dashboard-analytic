// Dashboard Meta Ads — même base que l'onglet Streamlit : périodes 7→Tout,
// filtres statut/campagne/thème, hero impressions, KPIs perf + coût,
// évolution quotidienne à métrique au choix, campagnes → adsets → annonces.
import { getMetaDash, type DashParams } from "@/lib/channels";
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

import { getCompteActif } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getMetaDash(searchParams);
  const compte = await getCompteActif();

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <SiteHeader email={d.email} active="meta" compte={compte} />

      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#1a56ff" }}>▣</span> Meta Ads.
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodPills path="/meta" d={d} />
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

      <AdsKpis d={d} />
      <MetricChart d={d} path="/meta" />
      <ByLabelTable d={d} />

      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par campagne{" "}
        <span className="text-faint font-normal">
          · triées par dépense · déplie pour voir adsets et annonces
        </span>
      </h2>
      <CampaignTable d={d} channel="meta" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — c&apos;est lui qui permet
        le « ce que chaque thème rapporte » du rapport.
      </p>
    </main>
  );
}
