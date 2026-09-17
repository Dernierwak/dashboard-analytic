import Link from "next/link";
import type { ChangementApi } from "@/lib/changements-api";
import {
  estDecisionClient,
  feedbackKey,
  fmtCHF,
  noteSerie,
  type ChangementPlateforme,
  type ThemeFocus,
  type TrackedAction,
} from "@/lib/report";
import { LineChart } from "@/components/line-chart";
import { Triangle, sensPente } from "@/components/pente";
import { dateCourte, marqueursCourbe } from "@/components/etat-action";
import { RailActions } from "@/components/rail-actions";
import { NoteAjout } from "@/components/note-ajout";
import { RecoCard } from "@/components/reco-card";
import { ConseilsVerrouilles } from "@/components/conseils-verrouilles";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { ScrollList } from "@/components/scroll-list";
import { ThemeObjectifMini } from "@/components/theme-objectif-mini";
import { CANAUX, PorteCanal } from "@/components/porte-canal";
import { compteCampagnes, regiesDuManque } from "@/lib/campagnes-theme";
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

/**
 * CE THÈME REÇOIT-IL DES CONSEILS ?
 *
 * Le filtre dur du worker (`conseille`, voir `_THEMES_CONSEILLES` dans
 * `saas/traitement/build_report.py`). ABSENT VAUT « OUI » : les payloads
 * publiés avant ce filtre avaient bien des conseils sur toutes leurs cartes,
 * et les verrouiller rétroactivement serait mentir sur ce qu'ils contiennent.
 */
function recoitDesConseils(theme: ThemeFocus): boolean {
  return theme.conseille !== false;
}

export function ThemeCard({
  theme,
  actions,
  archived,
  changements = [],
  changementsApi = [],
  fenetre,
  fenetreDates = null,
  decroche = false,
  labels,
  feedback,
  comments,
  suivis,
  conversionsTheme = [],
  objectifEffectif = null,
  aucunePriorite = false,
}: {
  theme: ThemeFocus;
  actions: TrackedAction[];
  archived: TrackedAction[];
  /** Ce qu'on a DÉDUIT de la dépense, pour CE thème. */
  changements?: ChangementPlateforme[];
  /** Ce que les plateformes DÉCLARENT sur ce thème — prime sur le déduit. */
  changementsApi?: ChangementApi[];
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
  feedback: Record<string, string>;
  comments: Record<string, string>;
  /** L'action produite par un conseil, par clé de conseil. */
  suivis: Record<string, TrackedAction>;
  /** Les événements GA4 que CE thème suit comme conversions (`theme_ga4_events`,
   *  rang 'principal') — lu à part du payload du rapport, voir `app/page.tsx`. */
  conversionsTheme?: string[];
  /** L'objectif EFFECTIF de CE thème — le sien (`theme.objectif`) s'il en a un,
   *  sinon celui du compte. PRÉCALCULÉ PAR L'APPELANT (`app/page.tsx`) : `ThemeCard`
   *  ne connaît pas `data.objectif` (l'objectif du compte), donc ne peut pas
   *  reproduire le repli lui-même — même raison que `objectif-theme.tsx` avant
   *  lui, qui recevait `objectifEffectif` tout calculé pour la même raison. */
  objectifEffectif?: string | null;
  /** Le COMPTE n'a aucune étoile — distinct de « ce thème-ci n'en a pas ». Les
   *  deux verrouillent les conseils, mais la phrase qui déverrouille n'est pas
   *  la même : poser une première étoile, ou en échanger une des trois. Une
   *  carte ne peut pas trancher seule, elle ne voit que son propre thème. */
  aucunePriorite?: boolean;
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
  // LE REVENU A UNE SEULE SOURCE, ET C'EST LA VUE (ticket 22). Il se lisait
  // avant par `revenuTheme()`, « le plus grand des deux » entre ce bilan et la
  // ventilation `themes.rows` — deux périmètres différents, et le plus flatteur
  // des deux affiché sous la fenêtre de l'autre. `summary.revenue` est
  // rafraîchi à chaque affichage depuis `theme_regroupement`
  // (`lib/regroupement.ts`), et `null` y veut dire INCONNU, jamais zéro.
  const revenu = som.revenue ?? null;
  // LE REVENU EST LE JUGE DE LA NOTE. Le worker écrit « le ROAS de ce thème
  // n'est pas mesurable » sans regarder si le thème a du revenu : la carte
  // affichait donc « 820 CHF revenu · 0,2 ROAS » et, deux lignes plus bas, que
  // le ROAS n'était pas mesurable. On ne garde la note que quand elle est vraie.
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

  // ── POURQUOI IL N'Y A PAS DE ROAS : UNE SEULE GARDE, DEUX RÉPONSES ────────
  //
  // Les deux phrases sous le bilan portaient chacune sa copie de la condition,
  // et la copie a ouvert un trou : gardées sur `revenu === null` d'un côté et
  // `juge === false` de l'autre, un thème à `revenue: 0` sans `juge` connu — un
  // payload publié avant ce ticket, ou la vue muette (cas 3) — n'affichait PLUS
  // AUCUNE des deux, là où « revenu inconnu » s'affichait avant. Relevé par la
  // revue. Les deux branches sortent maintenant d'une garde commune et sont
  // exhaustives : dès qu'un thème a dépensé sans ROAS, il dit pourquoi.
  const sansRoasMalgreDepense = !hasRoas && !note && som.spend != null && som.spend > 0;
  // « Pas assez dépensé » ne se dit QUE si la vue l'a dit : le seuil vit dans le
  // SQL (`juge`), et `undefined` n'est pas un « non ». Partout ailleurs la seule
  // chose honnête reste « on ne sait pas » — ce que la carte disait déjà.
  const tropPeuDepense = sansRoasMalgreDepense && som.juge === false;
  const revenuNonConfirme = sansRoasMalgreDepense && !tropPeuDepense;
  // RIEN N'EST REGROUPÉ SOUS CE THÈME. Ni dépense, ni publication : ses
  // campagnes et ses posts ont perdu leur étiquette, ou n'en ont jamais eu.
  // Sans cette phrase la carte s'affichait avec son titre et un blanc dessous,
  // ce qui se lit comme une panne plutôt que comme un thème vide.
  const rienARegrouper = cases.length === 0;

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
  //
  // CE RATIO A CHANGÉ DE CONTENU AU TICKET 42, sans que cette ligne bouge : le
  // verdict se lit sur `suivi_actions` et non plus dans le payload, donc les
  // actions RANGÉES et ABANDONNÉES le portent enfin — elles en sortaient
  // silencieusement, parce que `suivi_en_cours()` ne rend que `running`/`done`.
  // Le compte dit maintenant la même chose que le bilan du carnet
  // (`compterVerdicts`, `lib/carnet.ts`), qui les comptait déjà en base : c'est
  // exactement la contradiction que le ticket refermait.
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

  // COMBIEN DE CAMPAGNES CE THÈME PORTE VRAIMENT — et combien la liste en
  // montre. `theme.campaigns` est un extrait des huit plus grosses dépenses
  // (ticket 34) ; ces deux-là ne se recomptent pas ici, ils se lisent
  // (`lib/campagnes-theme.ts`).
  const campagnes = compteCampagnes(theme);
  // OÙ SONT LES CAMPAGNES QUI NE SONT PAS DANS LA LISTE — et ce ne sont pas
  // « les régies du thème ». Sur un thème à huit grosses campagnes Meta et une
  // petite Google, la seule manquante est la Google : nommer les deux enverrait
  // chercher sur `/meta` quelque chose qui n'y manque pas. La liste est vide
  // sur un payload d'avant le ticket 34, qui ne permet pas de le savoir — la
  // phrase reste alors, sans nommer de régie.
  const regiesOuChercher = regiesDuManque(theme).map((r) => CANAUX[r].nom);

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
                  Et ce texte-ci ne s'écrit que si le thème n'a AUCUN revenu
                  confirmé : « revenu inconnu » sous un revenu affiché serait le
                  même mensonge que la note du worker, une ligne plus haut. */}
              {revenuNonConfirme && (
                <p className="text-[11px] text-faint mt-1.5 max-w-[62ch] leading-relaxed">
                  Revenu inconnu tant que Google Analytics ne remonte pas la valeur de tes
                  conversions — donc pas de ROAS ici, plutôt qu&apos;un ROAS faux.
                </p>
              )}
              {/* L'AUTRE RAISON DE NE PAS AFFICHER DE ROAS, ET ELLE NE SE
                  CONFOND PAS AVEC LA PREMIÈRE. Ici Google Analytics répond — le
                  revenu est connu — mais le thème n'a pas assez dépensé pour
                  qu'un ratio veuille dire quelque chose, et c'est la vue qui le
                  dit, par `juge` : le seuil vit dans le SQL et nulle part
                  ailleurs. Écrire « revenu inconnu » ici serait faux, et se
                  taire laisserait croire à un ROAS manquant par accident. */}
              {tropPeuDepense && (
                <p className="text-[11px] text-faint mt-1.5 max-w-[62ch] leading-relaxed">
                  Pas encore assez de dépense sur ce thème pour se prononcer : Pulse ne
                  publie pas un ROAS calculé sur quelques francs.
                </p>
              )}
            </>
          )}
          {rienARegrouper && (
            <p className="text-[11px] text-faint mt-3 max-w-[62ch] leading-relaxed">
              Aucune campagne ni publication ne porte ce thème pour l&apos;instant — il
              n&apos;y a rien à regrouper dessous. Étiquettes-en et ce bilan se remplit à
              la lecture suivante.
            </p>
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
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : recoitDesConseils(theme) ? (
              <p className="text-[12.5px] text-faint">
                Rien d&apos;urgent sur ce thème cette semaine — il tourne dans ses normes.
              </p>
            ) : null}

            {/* LE MODULE VERROUILLÉ PREND EXACTEMENT LA PLACE DES CONSEILS.
                C'est la seule position qui réponde à la question au moment où
                elle se pose : un lecteur qui compare deux cartes voit d'abord
                qu'il n'y a rien à faire ici, et il le voit ICI.

                IL NE MANGE PAS LA VEILLE. Une carte hors priorités peut quand
                même porter une veille — une campagne lancée il y a trois jours,
                un thème qui s'est arrêté net. Ça ne demande aucun geste, donc ce
                n'est pas un conseil, donc le filtre dur ne la retire pas : elle
                reste au-dessus, et le cadenas se lit comme ce qu'il est, une
                explication de ce qui manque.

                ET « RIEN D'URGENT » NE S'AFFICHE PLUS ICI, c'est la condition
                juste au-dessus : cette phrase est le verdict des règles, et sur
                un thème hors priorités aucune règle n'a tourné. L'écrire quand
                même ferait dire à Pulse qu'il a regardé. */}
            {!recoitDesConseils(theme) && (
              <div className="mt-3">
                <ConseilsVerrouilles
                  etat={aucunePriorite ? "aucune-priorite" : "hors-priorites"}
                />
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
            {/* « PRENDS UN CONSEIL À GAUCHE » NE SE DIT QUE S'IL Y EN A UN.
                Sur un thème hors priorités, la colonne de gauche porte un
                cadenas : envoyer le lecteur y chercher un conseil lui ferait
                traverser la carte pour rien, et lui ferait croire à une panne.
                On garde le fait — rien n'a été tenté — et on le laisse sans
                consigne : la consigne est déjà écrite sur le cadenas. */}
            {miennesManuelles.length === 0 &&
              changements.length === 0 &&
              changementsApi.length === 0 && (
                <p className="text-[11.5px] text-warn font-semibold leading-relaxed">
                  Rien n&apos;a encore été tenté sur ce thème
                  {theme.is_priority && <> — alors qu&apos;il est dans tes priorités</>}.
                  {recoitDesConseils(theme) && (
                    <> Prends un conseil à gauche : tu sauras dans deux semaines ce
                    qu&apos;il a donné.</>
                  )}
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

        {/* LA SORTIE, ET ELLE EST EN PIED — c'est-à-dire à la fin de ce qu'on
            vient de lire. Le profil qu'elle sert est celui qui prend l'hebdo
            comme du travail prémâché PUIS va creuser seul : la porte se
            présente donc après le bilan, la courbe, les conseils et les
            actions, pas avant. Elle ne rapporte rien — la page d'arrivée dit
            seulement d'où l'on vient et propose d'y revenir
            (`components/retour-rapport.tsx`). */}
        <PorteCanal theme={theme} fenetre={fenetreDates} />

        {/* Les campagnes du thème — c'est ici qu'on répare une étiquette. En
            pied, replié : on ne vient pas sur cette carte pour ça.

            LE COMPTE DU TITRE EST CELUI DU THÈME, PAS CELUI DE LA LISTE
            (ticket 34). Il écrivait `theme.campaigns.length`, c'est-à-dire la
            longueur d'un extrait plafonné à huit : « Ses campagnes (8) » sur un
            thème qui en porte douze, un chiffre qui n'était pas le nombre de
            campagnes du thème et se présentait comme s'il l'était
            (`CLAUDE.md` §7). */}
        {theme.campaigns.length > 0 && (
          <details className="group border-t border-line">
            <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 py-2.5">
              <span className="text-[11px] uppercase tracking-wide text-faint font-bold">
                Ses campagnes <span className="text-faint/70">({campagnes.total})</span>
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
              {/* CE QUI N'EST PAS DANS LA LISTE SE DIT, ET SE DIT OÙ ALLER LE
                  CHERCHER. Réparer une étiquette est la seule raison d'être de
                  ce bloc : sans cette phrase, les campagnes hors de l'extrait
                  ne sont nulle part, y compris pour être ré-étiquetées. Elles
                  le sont sur les pages de régie, qui les portent TOUTES — et la
                  porte juste au-dessus y mène en gardant la fenêtre du bilan. */}
              {campagnes.manquantes > 0 && (
                <p className="text-[10.5px] text-faint/80 mt-2.5 leading-relaxed">
                  Cette liste garde les {campagnes.affichees} plus grosses dépenses
                  cumulées. Les {campagnes.manquantes} autres campagnes de ce thème
                  s&apos;étiquettent sur {regiesOuChercher.length > 0
                    ? `${regiesOuChercher.join(" et ")}, qui ${
                        regiesOuChercher.length > 1 ? "les portent" : "les porte"} toutes`
                    : "ses pages de régie, qui les portent toutes"}.
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
