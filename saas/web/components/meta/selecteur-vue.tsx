import Link from "next/link";
import { ICONE_VUE, ID_SELECTEUR_VUE, Icone, PastilleEcart } from "@/components/meta/elements";
import { METRIQUES, VUES, formaterValeur, type CarteVue, type Vue } from "@/lib/meta/lecture";
import { lienMeta, type Params } from "@/lib/meta/liens";

// ── MODULE 2 · LE SÉLECTEUR DE VUE ───────────────────────────────────────────
//
// Spec, § « Solution », module 2 ; user stories 12, 13, 17. Des cartes, pas des
// boutons : chacune répond à sa question AVANT qu'on clique — icône, question,
// chiffre principal, écart. Elles reconfigurent la page entière et ne filtrent
// rien : toutes les campagnes sont dans chacune.
//
// Ce qui dit qu'elles se cliquent (user story 13) : ce sont de vrais liens
// (ils s'ouvrent dans un nouvel onglet, se partagent), le curseur change, la
// carte inactive porte « Voir cette vue » et se soulève au survol, l'active est
// pleine et porte « Vue active ». La phrase au-dessus dit ce qu'elles font.
//
// Grammaire : le chiffre est le plus gros élément de la carte, aucune forme
// graphique avant lui.

export function SelecteurVue({
  cartes,
  vue,
  params,
}: {
  cartes: CarteVue[];
  vue: Vue;
  params: Params;
}) {
  return (
    <section id={ID_SELECTEUR_VUE} aria-labelledby="titre-vues">
      <p id="titre-vues" className="text-[13px] text-muted mb-3">
        Choisis ce que tu regardes : la vue change toute la page, sans écarter aucune campagne.
      </p>
      <nav className="grid gap-3 sm:grid-cols-2" aria-label="Vues">
        {cartes.map((c) => {
          const actif = c.vue === vue;
          return (
            <Link
              key={c.vue}
              href={lienMeta(params, { vue: c.vue })}
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
                <span className={`text-[12.5px] ${actif ? "text-white/60" : "text-muted"}`}>{METRIQUES[c.metrique].nom.toLowerCase()}</span>
                <span className="ml-auto"><PastilleEcart m={c.metrique} e={c.ecart} sombre={actif} /></span>
              </div>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
