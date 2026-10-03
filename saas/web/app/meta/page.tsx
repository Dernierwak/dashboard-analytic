// ── LE DASHBOARD META ADS ────────────────────────────────────────────────────
//
// Spec `.scratch/meta-ads/spec.md` ; ADR 0011 (les cinq modules nommés, dans
// l'ordre du brief). Cette page REMPLACE l'ancienne (héritée du Streamlit) :
// elle lit l'identité par ID, pagine au-delà de 1 000 lignes, recalcule ses
// ratios total ÷ total et dit à quelle date Pulse a lu Meta.
//
// L'état vit dans l'URL : `vue`, `campagne` (par ID), `from`/`to`. Le calcul
// est dans `lib/meta/lecture.ts`, la lecture de la base dans
// `lib/meta/donnees.ts`.
import { BandeauMeta } from "@/components/meta/bandeau";
import { SelecteurVue } from "@/components/meta/selecteur-vue";
import { Tendance } from "@/components/meta/tendance";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { getDonneesMeta } from "@/lib/meta/donnees";
import type { Params } from "@/lib/meta/liens";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function MetaPage({ searchParams }: { searchParams: Params }) {
  const meta = await getDonneesMeta({
    vue: un(searchParams.vue),
    campagne: un(searchParams.campagne),
    from: un(searchParams.from),
    to: un(searchParams.to),
  });
  const choisie = meta.campagneChoisie;
  const sujet = choisie ? (choisie.connue ? `« ${choisie.nom} »` : "la campagne demandée") : "toutes tes campagnes";

  return (
    // Pas de `max-w-*` : le conteneur prend toute la largeur laissée par la
    // colonne latérale ; un plafond fixe finit toujours par redevenir trop
    // étroit dès que l'écran ou la colonne change.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      <BandeauMeta
        // Remonté à chaque période : ses deux champs de date repartent des
        // bornes réellement affichées, pas de ce qui avait été tapé.
        key={`${meta.periode.debut}-${meta.periode.fin}`}
        lecture={meta.lecture}
        params={searchParams}
        campagnes={meta.campagnes}
        campagneChoisie={choisie}
        periode={meta.periode}
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
        <Tendance metriques={meta.tendance} dates={meta.dates} datesAvant={meta.datesAvant} sujet={sujet} />
      </div>
    </main>
  );
}
