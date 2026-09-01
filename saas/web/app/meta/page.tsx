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
    // Pas de `max-w-*` : le conteneur prend toute la largeur laissée par la
    // colonne latérale — voir la note dans `app/page.tsx` pour le
    // raisonnement (un plafond fixe finit toujours par redevenir trop
    // étroit dès que l'écran ou la colonne change). `CampaignTable` en
    // profite le premier : sa largeur minimale (`largeurMin` dans
    // `channel-dash.tsx`) monte à 1 088 px dès qu'une comparaison ajoute sa
    // colonne d'écart, et ne tenait dans AUCUN plafond fixe testé.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

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

      <AdsKpis d={d} path="/meta" />
      <MetricChart d={d} path="/meta" />
      {/* Les deux tables qui suivent portent l'écart des mêmes deux périodes
          qu'une comparaison, dès qu'elle est posée — et rien de plus quand
          elle ne l'est pas. */}
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
