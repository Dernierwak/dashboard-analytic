// ── LE DASHBOARD GOOGLE ADS ──────────────────────────────────────────────────
//
// Spec `.scratch/google-ads/spec.md` ; ADR 0011 : la page Google est la page
// Meta avec les chiffres de Google — mêmes modules, même nom, même place,
// chacun son propre code. Cette page REMPLACE l'ancienne (héritée du
// Streamlit) : elle lit l'identité par ID, pagine au-delà de 1 000 lignes,
// recalcule ses taux total ÷ total et dit à quelle date Pulse a lu Google.
//
// L'état vit dans l'URL : `vue`, `campagne` (par ID), `from`/`to`, les
// réglages de la Comparaison (`type`, `niveau`, `m1`, `m2`, `comparer`,
// `courbe`), le jour ouvert dans le Panneau latéral (`jour`)
// (`lib/google/liens.ts`), et le mode, la campagne et la taille des Groupes
// de termes (`gm`, `gc`, `gt`, `lib/google/termes.ts`). Le jour est
// tenu par le navigateur, qui l'ouvre sans relire la page
// (`components/google/journal-ouvert.tsx`). Le calcul est dans
// `lib/google/lecture.ts`, `lib/google/changements.ts` et
// `lib/google/tableau.ts` (le Tableau détaillé), `lib/google/comparaison.ts`
// (la Comparaison), `lib/google/termes.ts` (les Groupes de termes), la lecture
// de la base dans `lib/google/donnees.ts`. Le module suivant (annonce lue)
// vient par ticket.
import { BandeauGoogle } from "@/components/google/bandeau";
import { Comparaison } from "@/components/google/comparaison";
import { GroupesDeTermes } from "@/components/google/groupes-de-termes";
import { JournalOuvert } from "@/components/google/journal-ouvert";
import { SelecteurVue } from "@/components/google/selecteur-vue";
import { TableauDetaille } from "@/components/google/tableau";
import { Tendance } from "@/components/google/tendance";
import { PanneauLateral } from "@/components/meta/panneau";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { aideJournal, jourOuvertDe, joursMarques } from "@/lib/google/changements";
import { getDonneesGoogle } from "@/lib/google/donnees";
import { lienGoogle, SANS_PANNEAU, sansJour, type Params } from "@/lib/google/liens";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
// `comparer` est répété (une valeur par place cochée).
const tous = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export default async function GooglePage({ searchParams: brutes }: { searchParams: Params }) {
  // Les composants reçoivent les paramètres sans le jour : c'est le
  // navigateur qui le tient (`sansJour`).
  const searchParams = sansJour(brutes);
  const google = await getDonneesGoogle(
    {
      vue: un(searchParams.vue),
      campagne: un(searchParams.campagne),
      from: un(searchParams.from),
      to: un(searchParams.to),
      type: un(searchParams.type),
      niveau: un(searchParams.niveau),
      m1: un(searchParams.m1),
      m2: un(searchParams.m2),
      comparer: tous(searchParams.comparer),
      courbe: un(searchParams.courbe),
    },
    { gm: un(searchParams.gm), gc: un(searchParams.gc), gt: un(searchParams.gt) }
  );
  const choisie = google.campagneChoisie;
  const sujet = choisie ? (choisie.connue ? `« ${choisie.nom} »` : "la campagne demandée") : "toutes tes campagnes";
  // Le journal suit le filtre du Bandeau, par l'ID (`lib/google/changements.ts`).
  const campagne = choisie?.cle ?? null;
  const { journal } = google;
  const marques = journal && joursMarques(journal, campagne, google.dates);
  const fermeture = lienGoogle(searchParams, SANS_PANNEAU);

  return (
    // Pas de `max-w-*` : même raison que /meta, le conteneur prend toute la
    // largeur laissée par la colonne latérale.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      {/* Jamais remonté par une `key` : la pilule se rattacherait en haut à
          chaque période choisie en plein défilement. */}
      <BandeauGoogle
        lecture={google.lecture}
        params={searchParams}
        vue={google.vue}
        campagnes={google.campagnes}
        campagneChoisie={choisie}
        periode={google.periode}
        raccourcis={google.raccourcis}
        hier={google.hier}
      />

      {/* Ce qu'on n'a pas pu lire, AVANT les chiffres qu'il explique : sans
          lui, une récolte en échec se lirait comme une chute. */}
      {google.muet && (
        <div className="mt-2">
          <TrouDeRecolte muets={[google.muet]} taisent="La période affichée s'arrête au dernier jour lu, elle ne couvre pas les jours suivants" />
        </div>
      )}

      <div className="mt-6 space-y-12">
        <SelecteurVue cartes={google.cartes} vue={google.vue} params={searchParams} />
        <Tendance
          metriques={google.tendance}
          dates={google.dates}
          datesAvant={google.datesAvant}
          sujet={sujet}
          marques={marques}
          aideJournal={aideJournal(google.debutJournal)}
          params={searchParams}
        />
        <Comparaison comparaison={google.comparaison} dates={google.dates} params={searchParams} sujet={sujet} />
        <TableauDetaille tableau={google.tableau} />
        {/* En bas de page, à la place de l'ancienne « Analyse » (carte, issue 21). */}
        <GroupesDeTermes groupes={google.groupes} params={searchParams} />
      </div>

      {journal ? (
        <JournalOuvert
          journal={journal}
          campagnes={google.campagnes}
          campagne={campagne}
          periode={google.periode}
          sujet={sujet}
          fermeture={fermeture}
        />
      ) : (
        // Sans journal il n'y a pas de point à cliquer : seul un lien partagé
        // demande un jour. Il le dit au lieu d'ouvrir un panneau vide qui se
        // lirait « aucun changement ».
        jourOuvertDe(un(brutes.jour), google.periode) && (
          <PanneauLateral titre="Changements du jour" fermeture={fermeture}>
            <p className="mt-2 text-[14px] text-muted">
              Le journal des changements n&apos;a pas pu être lu. Les chiffres de la page, eux, ne sont pas touchés.
            </p>
          </PanneauLateral>
        )
      )}
    </main>
  );
}
