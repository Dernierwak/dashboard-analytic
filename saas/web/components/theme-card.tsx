import {
  fmtCHF,
  type ChangementPlateforme,
  type ThemeFocus,
  type TrackedAction,
} from "@/lib/report";
import { LineChart, garderEtiquettes } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";
import { dateCourte, marqueursCourbe } from "@/components/etat-action";
import { RailActions } from "@/components/rail-actions";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";

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

const CH_ICON: Record<string, { icon: string; color: string }> = {
  meta: { icon: "▣", color: "#1a56ff" },
  google: { icon: "◆", color: "#1a7a4a" },
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

/** L'ancre de la carte d'un thème, pour y renvoyer d'ailleurs sur la page. */
export function ancreTheme(label: string): string {
  return (
    "theme-" +
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
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
  actions,
  archived,
  changements = [],
  fenetre,
  decroche = false,
  labels,
  feedback,
  comments,
  suivis,
  capReached = false,
}: {
  theme: ThemeFocus;
  actions: TrackedAction[];
  archived: TrackedAction[];
  /** Ce qui a bougé sur les plateformes pour CE thème. */
  changements?: ChangementPlateforme[];
  /** « depuis le 1 jan » — la fenêtre du bilan, qui n'est PAS celle de la courbe. */
  fenetre: string | null;
  decroche?: boolean;
  labels: string[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
  /** L'action produite par un conseil, par clé de conseil. */
  suivis: Record<string, TrackedAction>;
  capReached?: boolean;
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

  // Les actions de CE thème. Le rail les répartit lui-même entre ce qui court
  // et ce qui est clos ; ici on ne calcule que ce qui se lit AVANT lui.
  const miennes = [...actions, ...archived].filter((a) => a.theme === theme.label);
  // Ce qui a MARCHÉ sur ce thème, pas ce qui a été coché : le verdict vient du
  // worker quatorze jours après coup, pas du clic.
  const jugees = miennes.filter((a) => a.verdict);
  const gagnantes = jugees.filter((a) => a.verdict === "better").length;
  const prochain = miennes
    .filter((a) => a.status === "done" && !a.due)
    .map((a) => a.check_at)
    .filter(Boolean)
    .sort()[0];
  const derniereDecision = miennes.map((a) => a.decided_at).sort().pop();
  const semainesDepuis = derniereDecision
    ? Math.floor(
        (Date.now() - new Date(derniereDecision + "T00:00:00").getTime()) / (7 * 864e5)
      )
    : null;

  const marqueurs = s
    ? marqueursCourbe(s.marqueurs, s.markers, s.points.length, (i) => s.points[i].label)
    : [];
  const etiquettes = garderEtiquettes(marqueurs);

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
            {som.spend_week > 0 && (
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
                  courbe : deux fois la même explication, c'est une de trop. */}
              {!hasRoas && !s?.note && som.spend != null && som.spend > 0 && (
                <p className="text-[11px] text-faint mt-1.5 max-w-[62ch] leading-relaxed">
                  Revenu inconnu tant que Google Analytics ne remonte pas la valeur de tes
                  conversions — donc pas de ROAS ici, plutôt qu&apos;un ROAS faux.
                </p>
              )}
            </>
          )}
        </div>

        {s && (
          <div className="px-3 pt-3 pb-2">
            <LineChart
              labels={s.points.map((pt) => pt.label)}
              series={[{ name: s.metric_label, color: "#1a56ff", values: vals }]}
              height={180}
              fmt={cadre.fmt}
              unit={cadre.unite}
              ariaLabel={`${s.metric_label} du thème ${theme.label} sur ${s.points.length} semaines`}
              marqueurs={marqueurs}
            />
            {marqueurs.length > etiquettes.length && (
              <p className="text-[10px] text-faint px-1 pt-1">
                <span className="text-ink font-bold">┄</span> {marqueurs.length} semaines où tu as
                lancé une action sur ce thème.
              </p>
            )}
            {s.note && (
              <p className="text-[11px] text-warn leading-relaxed bg-warn/[0.06] border border-warn/20 rounded-lg px-2.5 py-1.5 mt-2 mx-1">
                {s.note}
              </p>
            )}
          </div>
        )}

        {/* LES DEUX COLONNES. À gauche ce qui peut faire bouger la courbe, à
            droite ce qui a déjà essayé et ce que ça a donné. Sur téléphone
            elles s'empilent, les conseils d'abord. */}
        <div className="border-t border-line px-4 py-4 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <h4 className="text-[11px] uppercase tracking-wide text-brand font-bold mb-2.5">
              Comment l&apos;améliorer cette semaine
            </h4>
            {theme.recos.length > 0 ? (
              /* Les conseils remplissent réellement leurs deux tiers : avec un
                 nombre impair, le dernier prend toute la largeur au lieu de
                 laisser un trou de fin de ligne. Un conseil seul occupait une
                 demi-colonne et la moitié de la carte restait blanche. */
              <div
                className={`grid gap-3 sm:grid-cols-2 ${
                  theme.recos.length % 2 === 1 ? "sm:[&>*:last-child]:col-span-2" : ""
                }`}
              >
                {[...theme.recos]
                  .sort(
                    (a, b) => (suivis[b.key] ? 1 : 0) - (suivis[a.key] ? 1 : 0)
                  )
                  .map((r) => (
                    <RecoCard
                      key={r.key}
                      r={r}
                      current={feedback[r.key] ?? null}
                      comment={comments[r.key] ?? null}
                      theme={theme.label}
                      action={suivis[r.key] ?? null}
                      capReached={capReached}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-faint">
                Rien d&apos;urgent sur ce thème cette semaine — il tourne dans ses normes.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-[11px] uppercase tracking-wide text-faint font-bold mb-2">
              Tes actions sur ce thème
            </h4>

            {/* Le chiffre de la colonne. En 20 px : 1,7 fois plus petit que le
                34 px de tête, donc un chiffre de bilan, pas un second titre.
                ET IL NE S'AFFICHE QU'À PARTIR DE DEUX VERDICTS — un ratio sur
                n = 1 n'est pas une mesure, et « 0/1 » condamnerait un thème
                pour un seul essai. À un verdict, on écrit le fait, qui est plus
                fort que la fraction. */}
            {jugees.length >= 2 ? (
              <div className="mb-2.5">
                <span className="font-mono text-[20px] leading-none font-medium text-ink">
                  {gagnantes}
                  <span className="text-faint">/{jugees.length}</span>
                </span>
                <span className="text-[11.5px] text-muted ml-2">
                  de ce que tu as tenté ici a bougé l&apos;indicateur
                </span>
              </div>
            ) : jugees.length === 1 ? (
              <p className="text-[11.5px] text-muted mb-2.5">
                <span className="font-semibold text-ink">1 action jugée</span> sur ce thème —
                trop peu pour un taux, assez pour un enseignement.
              </p>
            ) : null}

            {prochain && (
              <p className="text-[11.5px] text-muted mb-2">
                Prochain verdict le{" "}
                <span className="font-semibold text-ink">{dateCourte(prochain)}</span>
              </p>
            )}

            {miennes.length + changements.length > 0 ? (
              <RailActions
                actions={miennes}
                changements={changements}
                themeCourant={theme.label}
              />
            ) : (
              <p className="text-[11.5px] text-warn font-semibold leading-relaxed">
                Rien n&apos;a encore été tenté sur ce thème
                {theme.is_priority && <> — alors qu&apos;il est dans tes priorités</>}. Prends
                un conseil à gauche : tu sauras dans deux semaines ce qu&apos;il a donné.
              </p>
            )}

            {miennes.length > 0 && semainesDepuis !== null && semainesDepuis >= 6 && (
              <p className="text-[11.5px] text-warn font-semibold mt-2">
                Rien de nouveau lancé depuis {semainesDepuis} semaines.
              </p>
            )}

            {/* La phrase qui rend le chiffre honnête. Elle vivait dans
                « Ton historique d'actions » et serait morte avec lui. */}
            {jugees.length > 0 && (
              <p className="text-[10.5px] text-faint/80 mt-2.5 leading-relaxed">
                Avant/après honnête, pas une preuve absolue — la saisonnalité et le contenu
                jouent aussi.
              </p>
            )}
          </div>
        </div>

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
                  const ch = CH_ICON[c.channel] ?? CH_ICON.meta;
                  return (
                    <div key={`${c.channel}:${c.key}`} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px]" style={{ color: ch.color }}>
                          {ch.icon}
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
