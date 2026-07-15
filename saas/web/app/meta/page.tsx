// Dashboard Meta Ads — KPIs période + table campagnes avec thèmes éditables.
import { getMetaDash, periodDays } from "@/lib/channels";
import { SiteHeader } from "@/components/site-header";
import {
  PeriodPills,
  AdsKpis,
  CampaignTable,
  DailyChart,
  ByLabelTable,
} from "@/components/channel-dash";

export const dynamic = "force-dynamic";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: { d?: string };
}) {
  const days = periodDays(searchParams);
  const d = await getMetaDash(days);

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <SiteHeader email={d.email} active="meta" />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#1a56ff" }}>▣</span> Meta Ads.
          </h1>
          <PeriodPills path="/meta" days={days} />
        </div>
      </div>

      <AdsKpis d={d} />
      <DailyChart d={d} />
      <ByLabelTable d={d} />

      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par campagne <span className="text-faint font-normal">· triées par dépense</span>
      </h2>
      <CampaignTable d={d} channel="meta" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — c&apos;est lui qui permet
        le « ce que chaque thème rapporte » du rapport.
      </p>
    </main>
  );
}
