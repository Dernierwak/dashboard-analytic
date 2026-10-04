// Dashboard Google Ads — même base que l'onglet Streamlit : hero impressions,
// KPIs, évolution quotidienne à métrique au choix, campagnes → groupes
// d'annonces → annonces (google_ads_ad_insights). La période et les filtres
// sont portés par le bandeau de commandes, pas par la page.
import { getGoogleDash, type DashParams } from "@/lib/channels";
import {
  AdsKpis,
  CampaignTable,
  MetricChart,
  MoyennesAds,
} from "@/components/channel-dash";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { TrouDeRecolte } from "@/components/trou-recolte";

export const dynamic = "force-dynamic";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getGoogleDash(searchParams);

  return (
    // Pas de `max-w-*` : même raison que /meta, voir sa note.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <BandeauCommandes
        titre="Google Ads."
        glyphe="◆"
        couleur="#1a7a4a"
        periode={{
          fenetre: d.periodLabel,
          jours: d.days,
          // LES BORNES RÉELLEMENT AFFICHÉES, pas celles qui ont été tapées
          // (ticket 48). Une plage sur mesure se rabat sur le dernier jour
          // plein — et, quand la récolte a échoué, sur le dernier jour LU.
          // Réafficher les dates brutes laissait les deux champs annoncer une
          // fenêtre que la page ne montrait pas.
          from: searchParams?.from ? d.windowDebut : undefined,
          to: searchParams?.to ? d.windowFin : undefined,
        }}
        statuts={d.statusOptions}
        statutActif={d.filters.status}
        campagnes={d.campOptions}
        campActive={d.filters.camp}
      />


      {/* CE QU'ON N'A PAS PU LIRE, AVANT LES CHIFFRES QU'IL EXPLIQUE (ticket
          48). Les chiffres de cette page restent justes quand la récolte a
          échoué — la fenêtre s'ancre sur la dernière ligne écrite — mais elle
          RECULE alors sans le dire, et le client relit sa semaine d'avant sous
          les dates du jour. C'est la sortie la plus discrète du problème : la
          panne devient invisible pour tout le monde. Ce bandeau est ce qui
          l'empêche. */}
      {d.muet && (
        <div className="mt-5">
          <TrouDeRecolte
            muets={[d.muet]}
            taisent="La fenêtre affichée s'arrête au dernier jour lu, elle ne couvre pas les jours suivants"
          />
        </div>
      )}

      <div className="mt-5">
        <AdsKpis d={d} />
      </div>
      {/* Même module, même place que sur Meta : deux pages canal qui posent la
          même question doivent la poser dans le même ordre. */}
      <MoyennesAds d={d} path="/google" />
      <MetricChart d={d} path="/google" />
      {/* La table qui suit porte l'écart des mêmes deux périodes qu'une
          comparaison, dès qu'elle est posée — et rien de plus quand elle ne
          l'est pas. */}

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé — et
          sur Google le détail par groupe d'annonces n'est pas toujours là. */}
      <CampaignTable d={d} path="/google" />
    </main>
  );
}
