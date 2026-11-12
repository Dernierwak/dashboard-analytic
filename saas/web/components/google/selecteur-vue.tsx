import Link from "next/link";
import { Icone } from "@/components/meta/elements";
import { ICONE_VUE, ID_SELECTEUR_VUE, PastilleEcart } from "@/components/google/elements";
import { METRIQUES, VUES, formaterValeur, type CarteVue, type Vue } from "@/lib/google/lecture";
import { lienGoogle, METRIQUES_DE_LA_VUE, type Params } from "@/lib/google/liens";

// ── MODULE 2 · LE SÉLECTEUR DE VUE ───────────────────────────────────────────
//
// Spec Google, § « Solution », module 2 ; user stories 14 à 20. Le module Meta
// de même nom (`components/meta/selecteur-vue.tsx`), avec trois vues : des
// cartes, pas des boutons — chacune répond à sa question AVANT qu'on clique.
// Elles reconfigurent la page entière et ne filtrent rien : toutes les
// campagnes, de tous les types, sont dans chacune.
//
// Grammaire : le chiffre est le plus gros élément de la carte, aucune forme
// graphique avant lui.

export function SelecteurVue({ cartes, vue, params }: { cartes: CarteVue[]; vue: Vue; params: Params }) {
  return (
    <section id={ID_SELECTEUR_VUE} aria-labelledby="titre-vues">
      <p id="titre-vues" className="mb-3 text-[13px] text-muted">
        Choisis ce que tu regardes : la vue change toute la page, sans écarter aucune campagne.
      </p>
      <nav className="grid gap-3 sm:grid-cols-3" aria-label="Vues">
        {cartes.map((c) => {
          const actif = c.vue === vue;
          return (
            <Link
              key={c.vue}
              href={lienGoogle(params, { vue: c.vue, ...METRIQUES_DE_LA_VUE })}
              scroll={false}
              aria-current={actif ? "page" : undefined}
              className={`group min-w-0 rounded-2xl p-5 transition-all duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                actif
                  ? "bg-ink text-white shadow-[0_18px_40px_-12px_rgba(14,15,18,0.45)]"
                  : "bg-white border border-line hover:border-ink/20 hover:shadow-[0_10px_30px_-12px_rgba(14,15,18,0.18)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${actif ? "bg-white/10 text-white" : "bg-canvas text-ink group-hover:text-brand"}`}>
                  <Icone nom={ICONE_VUE[c.vue]} className="h-[18px] w-[18px]" />
                </span>
                <span className={`flex items-center gap-1 text-[12.5px] font-medium ${actif ? "text-white/70" : "text-brand"}`}>
                  {actif ? <>Vue active <Icone nom="coche" className="h-3.5 w-3.5" /></> : <>Voir cette vue <Icone nom="fleche" className="h-3.5 w-3.5" /></>}
                </span>
              </div>
              <p className={`mt-4 text-[17px] font-semibold ${actif ? "text-white" : "text-ink"}`}>{VUES[c.vue].titre}</p>
              <p className={`mt-0.5 text-[13px] ${actif ? "text-white/65" : "text-muted"}`}>{VUES[c.vue].question}</p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`text-[28px] font-semibold leading-none tracking-tight tabular-nums ${actif ? "text-white" : "text-ink"}`}>
                  {formaterValeur(c.metrique, c.valeur)}
                </span>
                <span className={`min-w-0 text-[12.5px] ${actif ? "text-white/60" : "text-muted"}`}>{METRIQUES[c.metrique].nom.toLowerCase()}</span>
                <span className="ml-auto"><PastilleEcart m={c.metrique} e={c.ecart} sombre={actif} /></span>
              </div>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
