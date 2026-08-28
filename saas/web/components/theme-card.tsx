import Link from "next/link";
import type { ChangementApi } from "@/lib/changements-api";
import {
  estDecisionClient,
  feedbackKey,
  fmtCHF,
  noteSerie,
  revenuTheme,
  type ChangementPlateforme,
  type ThemeFocus,
  type ThemeRow,
  type TrackedAction,
} from "@/lib/report";
import { LineChart } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";
import { dateCourte, marqueursCourbe } from "@/components/etat-action";
import { RailActions } from "@/components/rail-actions";
import { NoteAjout } from "@/components/note-ajout";
import { RecoCard } from "@/components/reco-card";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";
import { ThemeObjectifMini } from "@/components/theme-objectif-mini";

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

/**
 * L'IA A-T-ELLE RÉDIGÉ POUR CE THÈME ?
 *
 * Le champ est écrit par le worker (`ia_redigee`, voir `_THEMES_IA` dans
 * `saas/worker/build_report.py`) et n'existe pas dans `ThemeFocus` : ce type
 * décrit ce qu'un payload est GARANTI de porter, or les rapports publiés avant
 * août 2026 ne le portent pas. On le lit donc ici, en local et en optionnel.
 *
 * ABSENT VAUT « OUI », et c'est le point important : traiter l'absence comme un
 * « non » collerait rétroactivement, sur des dizaines d'anciens rapports, une
 * explication qui n'a rien à y faire — ces thèmes-là ONT été rédigés par l'IA.
 */
function iaARedige(theme: ThemeFocus): boolean {
  return (theme as ThemeFocus & { ia_redigee?: boolean }).ia_redigee !== false;
}

export function ThemeCard({
  theme,
  actions,
  archived,
  changements = [],
  changementsApi = [],
  rows,
  fenetre,
  decroche = false,
  labels,
  feedback,
  comments,
  suivis,
  capReached = false,
  conversionsTheme = [],
  objectifEffectif = null,
}: {
  theme: ThemeFocus;
  actions: TrackedAction[];
  archived: TrackedAction[];
  /** Ce qu'on a DÉDUIT de la dépense, pour CE thème. */
  changements?: ChangementPlateforme[];
  /** Ce que les plateformes DÉCLARENT sur ce thème — prime sur le déduit. */
  changementsApi?: ChangementApi[];
  /** La ventilation par thème du rapport — l'autre endroit qui connaît le
   *  revenu du thème, et le seul à le connaître sur les anciens payloads. */
  rows?: ThemeRow[] | null;
  /** « depuis le 1 jan » — la fenêtre du bilan, qui n'est PAS celle de la courbe. */
  fenetre: string | null;
  decroche?: boolean;
  labels: string[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
  /** L'action produite par un conseil, par clé de conseil. */
  suivis: Record<string, TrackedAction>;
  capReached?: boolean;
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

  // Les actions de CE thème. Le rail les répartit lui-même entre ce qui court
  // et ce qui est clos ; ici on ne calcule que ce qui se lit AVANT lui.
  //
  // `miennes` reste TOUT — y compris `"auto"` (l'hypothèse posée par le worker
  // sans clic, voir `build_report.py`) — parce que le rail doit continuer à
  // la montrer et à porter son verdict (confirmé correct par le checker).
  const miennes = [...actions, ...archived].filter((a) => a.theme === theme.label);
  // `miennesManuelles` : ce que LE CLIENT a réellement décidé de tenter.
  // Rejet du checker (2e ET 3e passe) : le ratio « ce que tu as tenté a bougé
  // l'indicateur », la date de dernière décision et l'alerte de carence ne
  // peuvent pas compter une hypothèse que personne n'a cliquée, sous peine
  // de fabriquer un chiffre (CLAUDE.md §7) et de désactiver ces deux alertes
  // en silence. `a.status !== "auto"` NE SUFFIT PAS (3e passe) : « ✓ Vu — je
  // range » et « × j'abandonne » changent `status` sans que le client ait
  // rien décidé — `estDecisionClient` lit `origin` (durable, survit à ces
  // deux gestes) au lieu de `status` (voir `lib/report.ts`).
  const miennesManuelles = miennes.filter(estDecisionClient);
  // Ce qui a MARCHÉ sur ce thème, pas ce qui a été coché : le verdict vient du
  // worker quatorze jours après coup, pas du clic.
  const jugees = miennesManuelles.filter((a) => a.verdict);
  const gagnantes = jugees.filter((a) => a.verdict === "better").length;
  const prochain = miennes
    // Ici, en revanche, `"auto"` reste inclue : « prochain verdict le… » est
    // informatif sur CE QUI VA ÊTRE JUGÉ, peu importe qui l'a déclenché — ce
    // n'est pas un chiffre attribué au client, juste une date.
    .filter((a) => (a.status === "done" || a.status === "auto") && !a.due)
    .map((a) => a.check_at)
    .filter(Boolean)
    .sort()[0];
  const derniereDecision = miennesManuelles.map((a) => a.decided_at).sort().pop();
  const semainesDepuis = derniereDecision
    ? Math.floor(
        (Date.now() - new Date(derniereDecision + "T00:00:00").getTime()) / (7 * 864e5)
      )
    : null;

  const marqueurs = s
    ? marqueursCourbe(s.marqueurs, s.markers, s.points.length, (i) => s.points[i].label)
    : [];

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
              marqueurs={marqueurs}
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

        {/* LES DEUX COLONNES. À gauche ce qui peut faire bouger la courbe, à
            droite ce qui a déjà essayé et ce que ça a donné. Sur téléphone
            elles s'empilent, les conseils d'abord. */}
        <div className="border-t border-line px-4 py-4 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 min-w-0">
            <h4 className="text-[11px] uppercase tracking-wide text-brand font-bold mb-2.5">
              Comment l&apos;améliorer cette semaine
            </h4>
            {theme.recos.length > 0 ? (
              /* UNE SEULE RANGÉE QUI GLISSE, plus une grille qui empile.
                 En `sm:grid-cols-2`, trois conseils donnaient deux lignes dont
                 la seconde était à moitié vide, et le troisième conseil passait
                 sous la ligne de flottaison de la carte : on ne savait pas
                 qu'il existait. Alignés, ils se comparent — c'est la seule
                 chose qu'on fait avec trois conseils.

                 Largeur FIXE et hauteur commune : une rangée dont les cartes
                 respirent chacune à sa taille se lit comme un empilement raté.
                 `grid` sur l'enveloppe plutôt que `flex` — c'est ce qui étire
                 la carte aux deux dimensions sans toucher à `RecoCard`.
                 `scroll-snap` sur chaque carte : le glissement s'arrête sur une
                 carte entière, jamais sur un tiers de carte. */
              <div className="defile-x -mx-1 px-1 pb-1.5 snap-x snap-mandatory">
                <div className="flex gap-3 items-stretch w-max">
                  {[...theme.recos]
                    .sort(
                      (a, b) => (suivis[b.key] ? 1 : 0) - (suivis[a.key] ? 1 : 0)
                    )
                    .map((r) => (
                      <div
                        key={r.key}
                        className="grid w-[268px] sm:w-[300px] shrink-0 snap-start"
                      >
                        <RecoCard
                          r={r}
                          current={feedback[feedbackKey(r.key, theme.label)] ?? feedback[r.key] ?? null}
                          comment={comments[feedbackKey(r.key, theme.label)] ?? comments[r.key] ?? null}
                          theme={theme.label}
                          action={suivis[r.key] ?? null}
                          capReached={capReached}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-faint">
                Rien d&apos;urgent sur ce thème cette semaine — il tourne dans ses normes.
              </p>
            )}

            {/* ── LE THÈME QUE L'IA N'A PAS TRAVAILLÉ ─────────────────────────
                Ce bloc occupe EXACTEMENT la place où les pistes rédigées
                auraient été : sous les conseils-règles, dans la colonne des
                conseils. C'est la seule position qui réponde à la question au
                moment où elle se pose — un lecteur qui compare deux cartes voit
                d'abord qu'il y a moins de choses ici, et il le voit ICI.

                POURQUOI IL EXISTE. Une carte plus courte que sa voisine, sans
                un mot, se lit de deux façons et les deux sont fausses : « Pulse
                est cassé sur ce thème », ou « ce thème n'a aucun problème ». Le
                vide non expliqué est une règle connue de ce projet ; c'est
                pourquoi la phrase dit à la fois POURQUOI et QUOI FAIRE.

                ET IL N'EST PAS UNE ALERTE. Pas de rouge, pas d'orange : rien
                n'a échoué, un budget a été tenu. Cadre gris, texte `muted`,
                sous les conseils — le poids visuel d'une note de bas de bloc.
                Le seul mot en gras est le fait lui-même. */}
            {!iaARedige(theme) && (
              <div className="mt-3 rounded-lg border border-line bg-black/[0.02] px-3 py-2.5 max-w-[68ch]">
                <p className="text-[11.5px] text-muted leading-relaxed">
                  <span className="font-semibold text-ink">
                    Pas de pistes rédigées par l&apos;IA sur ce thème.
                  </span>{" "}
                  Elle n&apos;en écrit que pour tes <span className="font-semibold">3
                  premières étoiles</span>, et celui-ci vient après.
                  {theme.recos.length > 0 ? (
                    <>
                      {" "}Les conseils ci-dessus sortent des règles, calculées sur tes
                      propres chiffres : plus sûrs qu&apos;une piste, mais moins nombreux.
                    </>
                  ) : (
                    /* La ligne au-dessus dit déjà « rien d'urgent » ; la répéter
                       ici serait la même explication deux fois. Ce qu'elle ne dit
                       pas, en revanche, c'est QUI a conclu ça — et c'est
                       justement ce qu'un lecteur pourrait mettre sur le dos de
                       l'IA absente. */
                    <> Ce &laquo;&nbsp;rien d&apos;urgent&nbsp;&raquo; est donc le
                      verdict des règles, pas un silence de l&apos;IA.
                    </>
                  )}{" "}
                  {theme.is_priority ? (
                    <>
                      Pour qu&apos;elle le travaille aussi, retire sur{" "}
                      <Link href="/labels" className="text-brand font-semibold hover:underline">
                        ◫ Thèmes
                      </Link>{" "}
                      une des trois étoiles posées avant lui.
                    </>
                  ) : (
                    <>
                      Pour qu&apos;elle le travaille aussi, étoile-le sur{" "}
                      <Link href="/labels" className="text-brand font-semibold hover:underline">
                        ◫ Thèmes
                      </Link>{" "}
                      et retire une des trois étoiles les plus anciennes.
                    </>
                  )}
                </p>
              </div>
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

            {/* Le rail montre TOUT ce qui vit sur ce thème — y compris une
                hypothèse `"auto"` sans aucune action manuelle. L'alerte
                juste en dessous, elle, ne parle que de ce que LE CLIENT a
                tenté : les deux ne sont plus le même test (rejet du checker,
                2e passe) — sinon une hypothèse auto-suivie masquait en
                silence le rappel « tu n'as encore rien lancé toi-même ». */}
            {miennes.length + changements.length + changementsApi.length > 0 && (
              <RailActions
                actions={miennes}
                changements={changements}
                changementsApi={changementsApi}
                themeCourant={theme.label}
              />
            )}
            {miennesManuelles.length === 0 &&
              changements.length === 0 &&
              changementsApi.length === 0 && (
                <p className="text-[11.5px] text-warn font-semibold leading-relaxed">
                  Rien n&apos;a encore été tenté sur ce thème
                  {theme.is_priority && <> — alors qu&apos;il est dans tes priorités</>}. Prends
                  un conseil à gauche : tu sauras dans deux semaines ce qu&apos;il a donné.
                </p>
              )}

            {miennesManuelles.length > 0 && semainesDepuis !== null && semainesDepuis >= 6 && (
              <p className="text-[11.5px] text-warn font-semibold mt-2">
                Rien de nouveau lancé depuis {semainesDepuis} semaines.
              </p>
            )}

            {/* La troisième voix du fil : ce que Pulse ne peut pas deviner. */}
            <NoteAjout theme={theme.label} />

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
