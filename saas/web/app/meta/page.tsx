// Dashboard Meta Ads — même base que l'onglet Streamlit : périodes 7→Tout,
// filtres statut/campagne/thème, hero impressions, KPIs perf + coût,
// évolution quotidienne à métrique au choix, campagnes → adsets → annonces.
import { getMetaDash, type DashParams } from "@/lib/channels";
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

import { Comparer } from "@/components/comparaison";

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
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

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
      {/* Le rythme d'un mois AVANT la forme du jour : ce qu'un mois coûte et
          rapporte se compare d'un mois à l'autre, la courbe ne dit que la
          silhouette de la fenêtre affichée. */}
      <MoyennesAds d={d} path="/meta" />
      <MetricChart d={d} path="/meta" />
      {/* On lit ce qui s'est passé, son rythme, sa forme — PUIS on le compare.
          Le module arrive après la courbe et non avant : comparer deux périodes
          suppose qu'on ait déjà en tête celle qu'on regarde. */}
      <Comparer c={d.comparaison} sp={d.params} path="/meta" tete={d.metric}
        metriqueParDefaut="spend" couleur="#1a56ff" />
      {/* Les deux tables qui suivent portent l'écart des MÊMES deux périodes que
          le module ci-dessus, dès qu'une comparaison est posée — et rien de plus
          quand elle ne l'est pas. */}
      <ByLabelTable d={d} path="/meta" />

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé, et son
          titre dit son classement — promettre ici un dépliage ou un tri que la
          donnée ne permet pas fait chercher une panne. */}
      <CampaignTable d={d} channel="meta" path="/meta" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — c&apos;est lui qui permet
        le « ce que chaque thème rapporte » du rapport.
      </p>
    </main>
  );
}
