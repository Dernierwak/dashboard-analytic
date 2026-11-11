// ── LE DASHBOARD GOOGLE ADS ──────────────────────────────────────────────────
//
// Spec `.scratch/google-ads/spec.md` ; ADR 0011 : la page Google est la page
// Meta avec les chiffres de Google — mêmes modules, même nom, même place,
// chacun son propre code. Cette page REMPLACE l'ancienne (héritée du
// Streamlit) : elle lit l'identité par ID, pagine au-delà de 1 000 lignes,
// recalcule ses taux total ÷ total et dit à quelle date Pulse a lu Google.
//
// L'état vit dans l'URL : `vue`, `campagne` (par ID), `from`/`to`
// (`lib/google/liens.ts`). Le calcul est dans `lib/google/lecture.ts`, la
// lecture de la base dans `lib/google/donnees.ts`. Les modules suivants
// (Comparaison, Tableau détaillé, Panneau latéral, Groupes de termes) viennent
// par tickets.
import { BandeauGoogle } from "@/components/google/bandeau";
import { SelecteurVue } from "@/components/google/selecteur-vue";
import { Tendance } from "@/components/google/tendance";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { getDonneesGoogle } from "@/lib/google/donnees";
import type { Params } from "@/lib/google/liens";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GooglePage({ searchParams }: { searchParams: Params }) {
  const google = await getDonneesGoogle({
    vue: un(searchParams.vue),
    campagne: un(searchParams.campagne),
    from: un(searchParams.from),
    to: un(searchParams.to),
  });
  const choisie = google.campagneChoisie;
  const sujet = choisie ? (choisie.connue ? `« ${choisie.nom} »` : "la campagne demandée") : "toutes tes campagnes";

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
        <Tendance metriques={google.tendance} dates={google.dates} datesAvant={google.datesAvant} sujet={sujet} />
      </div>
    </main>
  );
}
