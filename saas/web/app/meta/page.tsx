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
  ByLabelTable,
} from "@/components/channel-dash";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { CeQuiMarche } from "@/components/ce-qui-marche";
import { Carnet } from "@/components/carnet";
import { themesChoisis } from "@/lib/commandes";
// PROTOTYPE, À RETIRER — quatre façons de poser tes notes sur la courbe
// (`?variant=A|B|C|D`). Sans le paramètre, la page est exactement celle
// d'avant. Ticket 19 de `.scratch/refonte/`.
import { Suspense } from "react";
import { VARIANTES_NOTES, getNotesCourbe } from "@/lib/proto-notes";
import { ProtoNotesModule } from "@/components/proto-notes-module";
import { PrototypeSwitcher } from "@/components/prototype-switcher";

export const dynamic = "force-dynamic";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getMetaDash(searchParams);

  // PROTOTYPE — la variante remplace `MetricChart`, elle ne s'ajoute pas à lui :
  // deux fois la même courbe sur un écran est exactement ce que le ticket
  // interdit de produire.
  const brut = (searchParams as Record<string, unknown>)?.variant;
  const variante =
    typeof brut === "string" && VARIANTES_NOTES.some((v) => v.cle === brut) ? brut : null;
  const notes = variante ? await getNotesCourbe(d.daily, searchParams) : null;

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
          from: searchParams?.from,
          to: searchParams?.to,
        }}
        themes={d.labels}
        themesActifs={themesChoisis(searchParams)}
        statuts={d.statusOptions}
        statutActif={d.filters.status}
        campagnes={d.campOptions}
        campActive={d.filters.camp}
      />

      <div className="mt-5">
        <AdsKpis d={d} />
      </div>
      {/* Le rythme d'un mois AVANT la forme du jour : ce qu'un mois coûte et
          rapporte se compare d'un mois à l'autre, la courbe ne dit que la
          silhouette de la fenêtre affichée. */}
      <MoyennesAds d={d} path="/meta" />
      {variante && notes ? (
        <ProtoNotesModule d={d} path="/meta" variante={variante} notes={notes} canal="Meta" />
      ) : (
        <MetricChart d={d} path="/meta" />
      )}
      {/* Les deux tables qui suivent portent l'écart des mêmes deux périodes
          qu'une comparaison, dès qu'elle est posée — et rien de plus quand
          elle ne l'est pas. */}
      <ByLabelTable d={d} path="/meta" />

      {/* ── CE QUI MARCHE POUR TOI (rang 4) — le bloc qui CONCLUT, entre le
          thème (rang 3) et le détail ligne par ligne (rang 5). Il ne calcule
          rien : il lit les constats de `insights.py`, tirés de tout
          l'historique. Meta et Google ne concluaient rien jusqu'ici — seul
          Instagram le faisait, et il le faisait avec ses propres seuils. */}
      <CeQuiMarche page="meta" />

      {/* Ce que la table permet est écrit DANS son pied, où c'est calculé, et son
          titre dit son classement — promettre ici un dépliage ou un tri que la
          donnée ne permet pas fait chercher une panne. */}
      <CampaignTable d={d} channel="meta" path="/meta" />
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Le thème relie tes campagnes cross-canal (page Labels) — c&apos;est lui qui permet
        le « ce que chaque thème rapporte » du rapport.
      </p>

      {/* ── TON CARNET — le même module que sur les quatre autres pages, filtré
          par ce que le bandeau filtre (thème, campagne). Écrire ici plutôt que
          de revenir à l'accueil : la note hérite de la campagne cochée et de la
          régie de la page, donc elle sait de quoi elle parle sans qu'on le lui
          demande (`lib/carnet.ts`). */}
      <Carnet
        canal="meta"
        themes={themesChoisis(searchParams)}
        campKey={d.filters.camp}
        campagnes={d.campOptions}
      />

      {/* PROTOTYPE — la barre de comparaison, invisible en production. */}
      {variante && (
        <Suspense fallback={null}>
          <PrototypeSwitcher variantes={VARIANTES_NOTES} courant={variante} />
        </Suspense>
      )}
    </main>
  );
}
