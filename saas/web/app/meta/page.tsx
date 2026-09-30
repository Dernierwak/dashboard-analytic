// Dashboard Meta Ads — même base que l'onglet Streamlit : hero impressions,
// KPIs perf + coût, évolution quotidienne à métrique au choix, campagnes →
// adsets → annonces. La période et les filtres sont portés par le bandeau de
// commandes, pas par la page (`components/bandeau-commandes.tsx`).
import { getMetaDash, type DashParams } from "@/lib/channels";
import {
  AdsKpis,
  CampaignTable,
  MetricChart,
  MoyennesAds,
} from "@/components/channel-dash";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { TrouDeRecolte } from "@/components/trou-recolte";
// PROTOTYPE, À RETIRER — quatre façons de poser tes notes sur la courbe
// (`?variant=A|B|C|D`). Sans le paramètre, la page est exactement celle
// d'avant. Ticket 19 de `.scratch/refonte/`.
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getMetaDash(searchParams);

  return (
    // Pas de `max-w-*` : le conteneur prend toute la largeur laissée par la
    // colonne latérale — voir la note dans `app/page.tsx` pour le raisonnement
    // (un plafond fixe finit toujours par redevenir trop étroit dès que l'écran
    // ou la colonne change). `CampaignTable` en profite le premier : sa largeur
    // minimale (`largeurMin` dans `channel-dash.tsx`) monte à 1 088 px dès
    // qu'une comparaison ajoute sa colonne d'écart, et ne tenait dans AUCUN
    // plafond fixe testé.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      {/* Le bandeau EST le titre de la page : il l'absorbe, il ne se pose pas
          au-dessus. Voir l'en-tête de `bandeau-commandes.tsx`. */}
      <BandeauCommandes
        titre="Meta Ads."
        glyphe="▣"
        couleur="#1a56ff"
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
      {/* Le rythme d'un mois AVANT la forme du jour : ce qu'un mois coûte et
          rapporte se compare d'un mois à l'autre, la courbe ne dit que la
          silhouette de la fenêtre affichée. */}
      <MoyennesAds d={d} path="/meta" />
      <MetricChart d={d} path="/meta" />
      {/* La table qui suit porte l'écart des mêmes deux périodes qu'une
          comparaison, dès qu'elle est posée — et rien de plus quand elle ne
          l'est pas. */}

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé, et son
          titre dit son classement — promettre ici un dépliage ou un tri que la
          donnée ne permet pas fait chercher une panne. */}
      <CampaignTable d={d} channel="meta" path="/meta" />
    </main>
  );
}
