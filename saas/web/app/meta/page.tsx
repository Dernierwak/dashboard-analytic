// ── LE DASHBOARD META ADS ────────────────────────────────────────────────────
//
// Spec `.scratch/meta-ads/spec.md` ; ADR 0011 (les cinq modules nommés, dans
// l'ordre du brief). Cette page REMPLACE l'ancienne (héritée du Streamlit) :
// elle lit l'identité par ID, pagine au-delà de 1 000 lignes, recalcule ses
// ratios total ÷ total et dit à quelle date Pulse a lu Meta.
//
// L'état vit dans l'URL : `vue`, `campagne` (par ID), `from`/`to`, et pour la
// Comparaison `niveau`, `m1`/`m2` et `comparer` (répété), et dans le Panneau
// latéral `jour` (le jour ouvert) ou `annonce` (l'annonce lue, par ID) — l'un
// retire l'autre dans les liens, il n'y a donc jamais deux panneaux. Le calcul
// est dans `lib/meta/lecture.ts`, la lecture de la base dans
// `lib/meta/donnees.ts`.
import { BandeauMeta } from "@/components/meta/bandeau";
import { Comparaison } from "@/components/meta/comparaison";
import { JournalDuJour } from "@/components/meta/journal-du-jour";
import { LectureAnnonce } from "@/components/meta/lecture-annonce";
import { SelecteurVue } from "@/components/meta/selecteur-vue";
import { TableauDetaille } from "@/components/meta/tableau";
import { Tendance } from "@/components/meta/tendance";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { getDonneesMeta } from "@/lib/meta/donnees";
import { jourOuvertDe, joursMarques, panneauDuJour } from "@/lib/meta/changements";
import { lienMeta, type Params } from "@/lib/meta/liens";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** `comparer` se répète : une valeur par place cochée. */
const tous = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export default async function MetaPage({ searchParams }: { searchParams: Params }) {
  // Les deux paramètres ensemble n'arrivent que par une URL tapée à la main
  // (chaque lien retire l'autre) : le jour l'emporte, et l'annonce n'est pas
  // lue pour rien.
  const annonce = searchParams.jour ? undefined : un(searchParams.annonce);
  const meta = await getDonneesMeta({
    vue: un(searchParams.vue),
    campagne: un(searchParams.campagne),
    from: un(searchParams.from),
    to: un(searchParams.to),
    niveau: un(searchParams.niveau),
    m1: un(searchParams.m1),
    m2: un(searchParams.m2),
    comparer: tous(searchParams.comparer),
  }, annonce);
  const choisie = meta.campagneChoisie;
  const sujet = choisie ? (choisie.connue ? `« ${choisie.nom} »` : "la campagne demandée") : "toutes tes campagnes";
  // Le journal suit le filtre du Bandeau, par l'ID (`lib/meta/changements.ts`).
  const filtre = choisie?.cle ?? null;
  const marques = meta.journal && joursMarques(meta.journal, filtre, meta.dates);
  const jour = meta.journal && jourOuvertDe(un(searchParams.jour), meta.periode);

  return (
    // Pas de `max-w-*` : le conteneur prend toute la largeur laissée par la
    // colonne latérale ; un plafond fixe finit toujours par redevenir trop
    // étroit dès que l'écran ou la colonne change.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      {/* Jamais remonté par une `key` : la pilule se rattacherait en haut à
          chaque période choisie en plein défilement. */}
      <BandeauMeta
        lecture={meta.lecture}
        params={searchParams}
        vue={meta.vue}
        campagnes={meta.campagnes}
        campagneChoisie={choisie}
        periode={meta.periode}
        raccourcis={meta.raccourcis}
        hier={meta.hier}
      />

      {/* Ce qu'on n'a pas pu lire, AVANT les chiffres qu'il explique (ticket
          48) : sans lui, une récolte en échec se lirait comme une chute. */}
      {meta.muet && (
        <div className="mt-2">
          <TrouDeRecolte muets={[meta.muet]} taisent="La période affichée s'arrête au dernier jour lu, elle ne couvre pas les jours suivants" />
        </div>
      )}

      <div className="mt-6 space-y-12">
        <SelecteurVue cartes={meta.cartes} vue={meta.vue} params={searchParams} />
        <Tendance
          metriques={meta.tendance}
          dates={meta.dates}
          datesAvant={meta.datesAvant}
          sujet={sujet}
          marques={marques}
          params={searchParams}
        />
        <Comparaison
          comparaison={meta.comparaison}
          vue={meta.vue}
          dates={meta.dates}
          params={searchParams}
          sujet={sujet}
          vignettes={meta.vignettes}
        />
        <TableauDetaille tableau={meta.tableau} />
      </div>

      {/* Un jour hors de la période, ou un journal illisible, n'ouvre rien :
          le paramètre reste dans l'URL sans effet, et le prochain lien qui
          touche `jour` le remplace. */}
      {meta.journal && jour && (
        <JournalDuJour
          panneau={panneauDuJour(meta.journal, jour, filtre, meta.campagnes)}
          sujet={sujet}
          fermeture={lienMeta(searchParams, { jour: null })}
        />
      )}

      {/* Une annonce sans chiffres sur la période et la campagne choisies
          n'ouvre rien, comme un jour hors de la période. */}
      {meta.annonce && (
        <LectureAnnonce annonce={meta.annonce} fermeture={lienMeta(searchParams, { annonce: null })} />
      )}
    </main>
  );
}
