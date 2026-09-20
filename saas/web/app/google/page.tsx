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
  ByLabelTable,
} from "@/components/channel-dash";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { RetourRapport } from "@/components/retour-rapport";
import { CeQuiMarche } from "@/components/ce-qui-marche";
import { Carnet } from "@/components/carnet";
import { themesChoisis } from "@/lib/commandes";

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
        themes={d.labels}
        themesActifs={themesChoisis(searchParams)}
        statuts={d.statusOptions}
        statutActif={d.filters.status}
        campagnes={d.campOptions}
        campActive={d.filters.camp}
      />

      {/* D'où l'on vient, quand on vient de la carte d'un thème du rapport —
          et rien du tout sinon. Voir `components/retour-rapport.tsx`. */}
      <RetourRapport de={searchParams?.de} />

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
        <AdsKpis d={d} channel="google" />
      </div>
      {/* Même module, même place que sur Meta : deux pages canal qui posent la
          même question doivent la poser dans le même ordre. */}
      <MoyennesAds d={d} path="/google" />
      <MetricChart d={d} path="/google" />
      {/* Les deux tables qui suivent portent l'écart des mêmes deux périodes
          qu'une comparaison, dès qu'elle est posée — et rien de plus quand
          elle ne l'est pas. */}
      <ByLabelTable d={d} path="/google" />

      {/* Même bloc, même place que sur Meta (rang 4) : les constats sont ceux
          du compte, et chaque page ne garde que ceux qui la concernent —
          `constatsDeLaPage`. */}
      <CeQuiMarche page="google" />

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé — et
          sur Google le détail par groupe d'annonces n'est pas toujours là. */}
      <CampaignTable d={d} channel="google" path="/google" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — même liste que Meta
        et Instagram.
      </p>

      {/* Même module, même place que sur Meta. */}
      <Carnet
        canal="google"
        themes={themesChoisis(searchParams)}
        campKey={d.filters.camp}
        campagnes={d.campOptions}
      />
    </main>
  );
}
