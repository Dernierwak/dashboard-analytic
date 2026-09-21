import Link from "next/link";
import type { ChangementApi } from "@/lib/changements-api";
import {
  fmtCHF,
  noteSerie,
  revenuTheme,
  type ChangementPlateforme,
  type ThemeFocus,
  type ThemeRow,
} from "@/lib/report";
import { LineChart } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";
import { Changements } from "@/components/changements";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";
import { ThemeObjectifMini } from "@/components/theme-objectif-mini";
import { CANAUX, PorteCanal } from "@/components/porte-canal";
import { ancreTheme } from "@/lib/liens";

// UNE SEULE CARTE PAR THÈME, ET ELLE PORTE TOUT.
//
// Il y en avait deux, à 900 px d'écart sur la même page : une en section 2 (le
// bilan et la courbe) et une en section 3 (les campagnes et les conseils). Même
// titre, même étoile, même thème — et le lecteur devait faire le lien lui-même
// entre « voilà la courbe » et « voilà quoi faire ». Les deux sont fusionnées.
//
// L'ordre suit la question qu'on se pose : où j'en suis (le bilan), ce que ça
// donne dans le temps (la courbe), et sous elle DEUX COLONNES —
//
//   à GAUCHE, ce qui peut la faire bouger : les conseils du thème ;
//   à DROITE, ce qui a déjà essayé : les actions passées, leur verdict, et
//   l'indicateur qu'elles suivaient avec son mouvement réel.
//
// C'est la boucle complète, dans un seul écran : conseil → action → effet. Elle
// était éclatée sur trois sections, et personne ne la voyait.
//
// ET ELLE PORTE MAINTENANT LE CYCLE DE VIE ENTIER. « Ce que tu dois faire » et
// « Ton historique d'actions » étaient deux sections pour un objet qui
// appartient au thème : cliquer « ▶ Je le teste » faisait apparaître une
// section ailleurs sur la page, et il fallait traverser 900 px pour relier un
// conseil à ce qu'il a donné.
//
// Ce que l'ancienne règle protégeait — la pastille passive du rail contre la
// case à cocher de 44 px — est conservé sous une autre forme : le rail garde
// ses pastilles de 7 px qu'on ne clique pas, et les gestes sont des boutons
// posés SOUS l'entrée. La distinction n'était pas entre deux modules, elle
// était entre deux formes ; elle survit à la fusion.

type Cadre = { unite: string; fmt: (v: number) => string; portee: string; neutre: boolean };

const CADRES: Record<string, Cadre> = {
  "Portée moyenne": {
    unite: "",
    fmt: (v) => Math.round(v).toLocaleString("fr-CH"),
    portee: "moyenne par publication, dernière semaine",
    neutre: false,
  },
  "Engagement moyen (%)": {
    unite: " %",
    fmt: (v) => v.toFixed(1),
    portee: "moyenne par publication, dernière semaine",
    neutre: false,
  },
  // La dépense n'a pas de bon sens : dépenser plus n'est ni une victoire ni un
  // échec tant qu'on ne sait pas ce que ça rapporte. Sa pente reste donc grise.
  "Dépense (CHF)": {
    unite: " CHF",
    fmt: (v) => fmtCHF(v),
    portee: "total de la dernière semaine",
    neutre: true,
  },
};

const PAR_DEFAUT: Cadre = {
  unite: "",
  fmt: (v) => Math.round(v).toLocaleString("fr-CH"),
  portee: "dernière semaine",
  neutre: false,
};

/**
 * Vrai quand la pente de cet indicateur ne se juge pas. Dépenser moins n'est ni
 * une victoire ni un échec tant qu'on ne sait pas ce que ça rapporte : classer
 * les thèmes sur une dépense qui baisse désignerait « celui qui décroche » à
 * celui qui a simplement coupé une campagne — un verdict non mérité.
 */
export function penteNeutre(metricLabel: string): boolean {
  return (CADRES[metricLabel] ?? PAR_DEFAUT).neutre;
}

/** Moyenne des 4 dernières semaines contre les 4 précédentes — une semaine
 *  seule se laisse trop facilement emporter par un accident. */
export function ecartTheme(vals: number[]): number | null {
  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const recent = moy(vals.slice(-4));
  const avant = moy(vals.slice(-8, -4));
  return avant > 0 ? ((recent - avant) / avant) * 100 : null;
}

export function ThemeCard({
  theme,
  changements = [],
  changementsApi = [],
  rows,
  fenetre,
  fenetreDates = null,
  decroche = false,
  labels,
  conversionsTheme = [],
  objectifEffectif = null,
}: {
  theme: ThemeFocus;
  /** Ce qu'on a DÉDUIT de la dépense, pour CE thème. */
  changements?: ChangementPlateforme[];
  /** Ce que les plateformes DÉCLARENT sur ce thème — prime sur le déduit. */
  changementsApi?: ChangementApi[];
  /** La ventilation par thème du rapport — l'autre endroit qui connaît le
   *  revenu du thème, et le seul à le connaître sur les anciens payloads. */
  rows?: ThemeRow[] | null;
  /** « depuis le 1 jan » — la fenêtre du bilan, qui n'est PAS celle de la courbe. */
  fenetre: string | null;
  /** LES MÊMES BORNES QUE `fenetre`, EN DATES — `matrice.period`, la fenêtre
   *  d'où sortent tous les chiffres du bilan. `fenetre` les dit au lecteur
   *  (« depuis le 1 jan »), celles-ci les disent à la page canal : la porte les
   *  emporte pour que le chiffre affiché là-bas soit celui qu'on vient de lire
   *  ici. Absentes des payloads v1 — la porte ne s'ouvre alors pas. */
  fenetreDates?: { from: string; to: string } | null;
  decroche?: boolean;
  labels: string[];
  /** Les événements GA4 que CE thème suit comme conversions (`theme_ga4_events`,
   *  rang 'principal') — lu à part du payload du rapport, voir `app/page.tsx`. */
  conversionsTheme?: string[];
  /** L'objectif EFFECTIF de CE thème — le sien (`theme.objectif`) s'il en a un,
   *  sinon celui du compte. PRÉCALCULÉ PAR L'APPELANT (`app/page.tsx`) : `ThemeCard`
   *  ne connaît pas `data.objectif` (l'objectif du compte), donc ne peut pas
   *  reproduire le repli lui-même — même raison que `objectif-theme.tsx` avant
   *  lui, qui recevait `objectifEffectif` tout calculé pour la même raison. */
  objectifEffectif?: string | null;
}) {
  const s = theme.series && theme.series.points.length > 1 ? theme.series : null;
  const vals = s ? s.points.map((p) => p.value) : [];
  const cadre = s ? CADRES[s.metric_label] ?? PAR_DEFAUT : PAR_DEFAUT;
  const ecart = s ? ecartTheme(vals) : null;
  const p = sensPente(ecart, false, 8);
  // Pente neutre : on affiche le mouvement, on ne le juge pas.
  const filet =
    !s || cadre.neutre || p.plat ? "rgba(14,15,18,0.10)" : p.bon ? "#1a7a4a" : "#c0392b";

  const som = theme.summary;
  const hasRoas = som.roas !== null && som.roas !== undefined;
  // LE REVENU EST LE JUGE DE LA NOTE. Le worker écrit « le ROAS de ce thème
  // n'est pas mesurable » sans regarder si le thème a du revenu : la carte
  // affichait donc « 820 CHF revenu · 0,2 ROAS » et, deux lignes plus bas, que
  // le ROAS n'était pas mesurable. On ne garde la note que quand elle est vraie.
  const revenu = revenuTheme(theme, rows);
  const note = noteSerie(s, revenu);
  const exclure = s && s.metric_label.startsWith("Engagement") ? "Engagement" : null;
  const cases: { cle: string; valeur: string; unite?: string }[] = [];
  if (som.spend != null && som.spend > 0) {
    cases.push({ cle: "Dépensé", valeur: fmtCHF(som.spend), unite: "CHF" });
    if (hasRoas) {
      cases.push({ cle: "Revenu", valeur: fmtCHF(som.revenue ?? 0), unite: "CHF" });
      cases.push({ cle: "ROAS", valeur: som.roas!.toFixed(1) });
    } else if (som.ctr != null) {
      cases.push({ cle: "CTR", valeur: som.ctr.toFixed(1), unite: "%" });
    }
  }
  if (som.posts != null && som.posts > 0) {
    cases.push({ cle: "Publications", valeur: String(som.posts) });
    if (som.eng_avg != null && exclure !== "Engagement")
      cases.push({ cle: "Engagement", valeur: som.eng_avg.toFixed(1), unite: "%" });
  }

  // ── LE PLI A DISPARU ──────────────────────────────────────────────────────
  //
  // Une carte de thème fait 900 à 1 400 px de haut. Empilées, quinze cartes
  // faisaient un couloir de dix-huit mille pixels : la parade était d'ouvrir
  // les trois premières et de laisser arriver les suivantes FERMÉES — un
  // `<details>`/`<summary>` monté à la place du `<div>` de l'en-tête, piloté
  // par une prop `replie`.
  //
  // Il n'y a plus de couloir : `components/themes-carrousel.tsx` ne montre
  // qu'une carte à la fois, avec sa barre d'onglets, ses flèches et son
  // « 2 / 5 ». Un repli qui ne replie rien n'est pas une sécurité, c'est un
  // geste de plus à comprendre pour rien — et un `▾` qui ne cache plus rien est
  // un signe qui ment. La prop, les deux balises variables et le
  // « déplier ▾ / replier ▴ » de l'en-tête sont partis avec lui.
  //
  // Ce que le pli protégeait reste protégé, autrement : la carte n'est toujours
  // jamais amputée — « quand une forme ne tient pas à plusieurs, on change la
  // forme, pas le nombre d'éléments affichés ». Le carrousel est ce changement
  // de forme, d'un cran de plus.

  return (
    <section
      id={ancreTheme(theme.label)}
      className="bg-white border border-line rounded-xl shadow-card overflow-hidden scroll-mt-4"
    >
      <div className="border-l-[3px]" style={{ borderColor: filet }}>
        <div className="px-5 py-4 border-b border-line bg-black/[0.015]">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h3 className="font-serif text-[17px] text-ink">
              {theme.is_priority && <span className="text-warn">★ </span>}
              {theme.label}
            </h3>
            {decroche && (
              <span className="text-[10.5px] font-bold text-neg bg-neg/[0.08] border border-neg/20 rounded-full px-2 py-0.5">
                celui qui décroche
              </span>
            )}
            {/* `null` = un canal payant était muet cette semaine, la dépense
                du thème traverse un trou de récolte (ticket 20). La ligne
                disparaît alors — elle n'affiche NI 0 CHF, ni un total amputé
                qui se lirait comme une coupe de budget. */}
            {som.spend_week !== null && som.spend_week > 0 && (
              <span className="text-[11.5px] text-faint">
                {fmtCHF(som.spend_week)} CHF cette semaine
              </span>
            )}
          </div>

          {/* Le rang 3 — le chiffre, et c'est celui de la COURBE, jamais un
              autre : sinon l'en-tête et le graphe parlent de deux sujets. */}
          {s && (
            <>
              <div className="flex items-baseline gap-2.5 flex-wrap mt-2.5">
                <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
                  {cadre.fmt(vals[vals.length - 1])}
                  <span className="text-[15px] text-faint">{cadre.unite}</span>
                </span>
                {ecart !== null && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      cadre.neutre ? "text-muted" : p.cls
                    }`}
                    style={{ background: cadre.neutre ? "rgba(0,0,0,0.05)" : p.fond }}
                    title="Moyenne des 4 dernières semaines comparée aux 4 précédentes"
                  >
                    {p.plat ? (
                      "≈ stable"
                    ) : (
                      <>
                        <Triangle sens={p.monte ? "haut" : "bas"} /> {ecart > 0 ? "+" : ""}
                        {Math.round(ecart)} %
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-faint mt-1">
                {s.metric_label.replace(/ \(.*\)$/, "").toLowerCase()} · {cadre.portee}
              </p>
            </>
          )}

          {/* Le bilan. Il porte SA fenêtre : « 103 CHF cette semaine » et
              « 4 520 dépensé » se lisaient comme une même période alors que le
              second couvre tout l'historique. */}
          {cases.length > 0 && (
            <>
              <div className="mt-3 flex gap-x-7 gap-y-3 flex-wrap">
                {cases.map((c) => (
                  <div key={c.cle}>
                    <div className="font-mono text-[19px] leading-none font-medium text-ink">
                      {c.valeur}
                      {c.unite && <span className="text-[11.5px] text-faint"> {c.unite}</span>}
                    </div>
                    <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
                      {c.cle}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-2">
                {fenetre ? `Ce bilan couvre tout ${fenetre}` : "Ce bilan couvre tout l'historique"}
              </p>
              {/* La note de la série dit déjà pourquoi le ROAS manque, sous la
                  courbe : deux fois la même explication, c'est une de trop.
                  Et ce texte-ci ne s'écrit que si le thème n'a AUCUN revenu :
                  « revenu inconnu » sous un revenu affiché serait le même
                  mensonge que la note du worker, une ligne plus haut. */}
              {!hasRoas && !note && revenu === 0 && som.spend != null && som.spend > 0 && (
                <p className="text-[11px] text-faint mt-1.5 max-w-[62ch] leading-relaxed">
                  Revenu inconnu tant que Google Analytics ne remonte pas la valeur de tes
                  conversions — donc pas de ROAS ici, plutôt qu&apos;un ROAS faux.
                </p>
              )}
            </>
          )}
        </div>

        {/* Le mini-module objectif + conversions de CE thème — entre le bilan
            chiffré qu'on vient de lire et la courbe qui montre comment ça
            évolue. Voir l'en-tête de `theme-objectif-mini.tsx`. */}
        <ThemeObjectifMini
          objectifEffectif={objectifEffectif}
          objectifPropre={theme.objectif_propre ?? false}
          conversions={conversionsTheme}
          jugement={theme.jugement}
        />

        {s && (
          <div className="px-3 pt-3 pb-2">
            <LineChart
              labels={s.points.map((pt) => pt.label)}
              series={[{ name: s.metric_label, color: "#1a56ff", values: vals }]}
              height={180}
              fmt={cadre.fmt}
              unit={cadre.unite}
              ariaLabel={`${s.metric_label} du thème ${theme.label} sur ${s.points.length} semaines`}
            />
            {/* Le comptage « N semaines où tu as lancé une action » a disparu
                avec le plafond de deux étiquettes qui le rendait nécessaire :
                chaque repère porte maintenant son nom au survol du point. Un
                nombre qui ne dit ni quoi ni quand n'était qu'un pis-aller. */}
            {note && (
              <p className="text-[11px] text-warn leading-relaxed bg-warn/[0.06] border border-warn/20 rounded-lg px-2.5 py-1.5 mt-2 mx-1">
                {note}
              </p>
            )}
          </div>
        )}

        {/* CE QUI A BOUGÉ SUR CE THÈME — des faits datés, rien d'autre.
            Ici vivaient deux colonnes : à gauche les conseils, à droite les
            actions décidées et leur verdict. Les deux sont parties avec les
            recommandations. Ce qui reste répond à la seule question qu'une
            courbe pose : qu'est-ce qui a changé pendant qu'elle bougeait. */}
        {changements.length + changementsApi.length > 0 && (
          <div className="border-t border-line px-4 py-4">
            <h4 className="text-[11px] uppercase tracking-wide text-faint font-bold mb-2">
              Ce qui a bougé sur ce thème
            </h4>
            <Changements
              changements={changements}
              changementsApi={changementsApi}
              themeCourant={theme.label}
            />
          </div>
        )}

        {/* LA SORTIE, ET ELLE EST EN PIED — c'est-à-dire à la fin de ce qu'on
            vient de lire. Le profil qu'elle sert est celui qui prend l'hebdo
            comme du travail prémâché PUIS va creuser seul : la porte se
            présente donc après le bilan, la courbe, les conseils et les
            actions, pas avant. Elle ne rapporte rien — la page d'arrivée dit
            seulement d'où l'on vient et propose d'y revenir
            (`components/retour-rapport.tsx`). */}
        <PorteCanal theme={theme} fenetre={fenetreDates} />

        {/* Les campagnes du thème — c'est ici qu'on répare une étiquette. En
            pied, replié : on ne vient pas sur cette carte pour ça. */}
        {theme.campaigns.length > 0 && (
          <details className="group border-t border-line">
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 py-2.5">
              <span className="text-[11px] uppercase tracking-wide text-faint font-bold">
                Ses campagnes <span className="text-faint/70">({theme.campaigns.length})</span>
              </span>
              <span className="text-[11px] text-brand font-semibold group-open:hidden">
                déplier ▾
              </span>
              <span className="text-[11px] text-brand font-semibold hidden group-open:inline">
                replier ▴
              </span>
            </summary>
            <div className="px-4 pb-4">
              <ScrollList title="" maxH="max-h-[40vh]">
                {theme.campaigns.map((c) => {
                  const ch = CANAUX[c.channel] ?? CANAUX.meta;
                  return (
                    <div key={`${c.channel}:${c.key}`} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px]" style={{ color: ch.couleur }}>
                          {ch.glyphe}
                        </span>
                        <span className="text-[13.5px] text-ink truncate flex-1" title={c.name}>
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-mono text-[12px] text-faint">
                          {fmtCHF(c.spend)} CHF
                          {c.revenue != null && c.revenue > 0 && ` → ${fmtCHF(c.revenue)}`}
                        </span>
                        <span className="ml-auto">
                          <CampaignLabelSelect
                            channel={c.channel}
                            campaignKey={c.key}
                            campaignName={c.name}
                            current={c.label}
                            labels={labels}
                            source={c.label_source}
                          />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </ScrollList>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
