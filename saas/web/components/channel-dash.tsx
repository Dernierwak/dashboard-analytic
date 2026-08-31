// Blocs partagés des dashboards par canal (server components).
// Même base que les onglets Streamlit : hero + 7 KPIs (coûts « baisse = bon »),
// graphe journalier à métrique sélectionnable, campagnes avec statut et
// drill-down adset/groupe → annonce, vue Par thème.
import { fmtCHF } from "@/lib/report";
import { LineChart } from "@/components/line-chart";
import { Chiffre } from "@/components/chiffre";
import type {
  Campaign, ChannelDash, DashParams, DayPoint, InstaDash, InstaPost, LabelAgg, PostLabelAgg,
} from "@/lib/channels";
import { lienDash } from "@/lib/liens";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { SummaryStop } from "@/components/summary-stop";
import { Pente, Triangle, sensPente } from "@/components/pente";
import {
  CelluleEcart,
  EnteteEcart,
  mentionEcart,
  ouvrirEcart,
  phraseEcart,
  trierParEcart,
  triParEcart,
  type MetriqueEcart,
} from "@/components/ecart";

// Les liens de ces modules passent tous par `lienDash` : on y énumère ce qu'on
// CHANGE, jamais ce qu'on garde. Le `qs()` / `keepFilters()` d'avant listait
// statut, campagne et thème — donc perdait la période sur mesure et, plus tard,
// le réglage de comparaison. Voir l'en-tête de `lib/liens.ts`.
const lienAds = (path: string, d: ChannelDash, patch: Partial<DashParams>) =>
  lienDash(path, d.params, patch, "spend");

export function PeriodPills({ path, d }: { path: string; d: ChannelDash }) {
  const opts: { v: number; label: string }[] = [
    { v: 7, label: "7 j" },
    { v: 14, label: "14 j" },
    { v: 30, label: "30 j" },
    { v: 90, label: "90 j" },
    { v: 0, label: "Tout" },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {opts.map((o) => (
        <a
          key={o.v}
          href={lienAds(path, d, { d: o.v === 7 ? undefined : String(o.v) })}
          className={`text-[11.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            d.days === o.v
              ? "bg-ink text-white border-ink"
              : "border-line text-muted hover:bg-black/[0.03] bg-white"
          }`}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}

// Hero (impressions) + 3 KPIs perf + 3-4 KPIs coût — la hiérarchie du Streamlit.
export function AdsKpis({ d, channel = "meta" }: { d: ChannelDash; channel?: "meta" | "google" }) {
  // Google n'a pas de portée. Plutôt que de répéter les impressions déjà en
  // grand dans le hero, on montre le CPC — l'autre chiffre qu'on regarde.
  const firstTile =
    channel === "google"
      ? {
          label: "CPC moyen",
          value: d.cpc > 0 ? `${d.cpc.toFixed(2)} CHF` : "—",
          delta: d.cpc > 0 ? d.cpcDelta : null,
          invert: true,
        }
      : { label: "Portée", value: d.reach > 0 ? fmtCHF(d.reach) : "—", delta: d.reach > 0 ? d.reachDelta : null, invert: false };
  return (
    <div className="mb-8">
      {/* Hero */}
      <div className="bg-white border border-line rounded-xl p-5 mb-3">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Impressions{" "}
          <span className="normal-case tracking-normal font-normal">
            · {d.activeCampaigns} campagne{d.activeCampaigns > 1 ? "s" : ""} sur la période
          </span>
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="font-mono text-[32px] font-medium text-ink leading-tight">
            {fmtCHF(d.impressions)}
          </div>
          <Pente delta={d.imprDelta} base="vs période préc." />
        </div>
      </div>
      {/* Ce qu'on regarde d'abord : trois chiffres, chacun avec sa forme.
          Sept tuiles de poids identique, c'était une liste, pas une page. */}
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-3 pb-1 sm:pb-0">
        <Chiffre
          titre="Dépensé"
          valeur={fmtCHF(d.spend)}
          unite="CHF"
          delta={d.spendDelta}
          serie={d.daily.map((p) => p.spend)}
          serieLabels={d.daily.map((p) => p.label)}
          grand
        />
        <Chiffre
          titre="Clics"
          valeur={fmtCHF(d.clicks)}
          delta={d.clicksDelta}
          serie={d.daily.map((p) => p.clicks)}
          serieLabels={d.daily.map((p) => p.label)}
          grand
        />
        <Chiffre
          titre="CTR moyen"
          valeur={`${d.ctr.toFixed(2)}`}
          unite="%"
          delta={d.ctrDelta}
          serie={d.daily.map((p) => (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0))}
          serieLabels={d.daily.map((p) => p.label)}
          grand
        />
      </div>

      {/* Les coûts unitaires descendent d'un cran : on les replie, on ne les
          supprime pas — ils sont regardés par ceux qui savent ce qu'ils
          regardent, et ils restent sur la page. */}
      <details>
        <summary className="text-[11.5px] font-semibold text-muted cursor-pointer select-none mb-2.5 hover:text-ink">
          Coûts unitaires et {channel === "google" ? "CPC" : "portée"} — voir
        </summary>
        <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 pb-1 sm:pb-0">
          <Chiffre titre={firstTile.label} valeur={firstTile.value} delta={firstTile.delta} baisseEstBonne={firstTile.invert} />
          <Chiffre
            titre="CPM moyen"
            valeur={d.cpm > 0 ? d.cpm.toFixed(2) : "—"}
            unite={d.cpm > 0 ? "CHF" : undefined}
            delta={d.cpm > 0 ? d.cpmDelta : null}
            baisseEstBonne
          />
          <Chiffre
            titre="CPC moyen"
            valeur={d.cpc > 0 ? d.cpc.toFixed(2) : "—"}
            unite={d.cpc > 0 ? "CHF" : undefined}
            delta={d.cpc > 0 ? d.cpcDelta : null}
            baisseEstBonne
          />
        </div>
      </details>
    </div>
  );
}

// ── LES MOYENNES, ET LEUR UNITÉ ──────────────────────────────────────────────
//
// Le module qui manquait au-dessus des courbes. La règle qu'il porte est ce qui
// le rend honnête :
//
//   UNE MOYENNE POUR CE QUI EST UN TAUX, UN TOTAL POUR CE QUI S'ADDITIONNE.
//
// Un CTR moyen se lit ; une « dépense moyenne » entre deux dépenses n'a aucun
// sens — ce qu'on veut de la dépense, c'est ce qu'une unité coûte. La valeur de
// L'UNITÉ se fabrique donc différemment selon la nature du chiffre (somme, ou
// taux calculé sur les totaux de l'unité), et c'est seulement ENTRE les unités
// qu'on moyenne.
//
// L'UNITÉ SUIT LA FENÊTRE, et c'est le changement de cette passe.
// Le module était mensuel en toutes circonstances. Sur « 7 jours » il n'avait
// donc aucun mois entier à moyenner et se contentait d'écrire qu'il n'avait
// rien à dire : le filtre le vidait au lieu de le déplacer, ce qui est
// exactement le défaut déjà corrigé sur les formats et les thèmes d'Instagram —
// un filtre qui ne change rien à l'écran a l'air cassé, et ici il l'était.
//
//   ON MOYENNE CE QUI SE RÉPÈTE AU MOINS DEUX FOIS DANS LA FENÊTRE.
//
// Deux mois entiers ou plus → l'unité est le MOIS. Sinon → l'unité descend d'un
// cran, au JOUR pour la publicité, à la PUBLICATION pour Instagram. Un seul mois
// entier ne fait pas une moyenne, c'est ce mois-là ; le module ne prétend plus
// le contraire, il change d'unité.
//
// UN MOIS INCOMPLET RESTE ÉCARTÉ, et c'est écrit à l'écran.
// Treize jours d'août pesés comme un mois plein tirent toute la moyenne vers le
// bas, et rien ne le dirait. C'est exactement la règle déjà en vigueur sur les
// deltas — « toute comparaison exclut le jour en cours, parce qu'il est
// incomplet » (docs/03-grammaire-des-modules.md) — appliquée d'un cran plus
// haut. Elle vaut aussi pour le PREMIER mois de la fenêtre : un mois qu'on
// n'observe qu'à partir du 12 est incomplet par l'autre bout.
//
// Le test est unique et ne connaît pas « aujourd'hui » : un mois compte s'il
// est ENTIÈREMENT couvert par la fenêtre affichée. Le mois en cours l'échoue
// mécaniquement, sans qu'on ait à le nommer. La branche courte n'a pas ce
// problème — un jour plein est un jour plein, la fenêtre s'arrêtant déjà hier —
// mais elle en a un autre : **une fenêtre peut ne rien contenir du tout**, et
// c'est là qu'un « 0 » mentirait. Zéro n'est pas la moyenne, c'est l'absence de
// moyenne ; le module l'écrit en toutes lettres.

const MOIS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function nomMois(cle: string): string {
  const [an, m] = cle.split("-");
  return `${MOIS_LONG[Number(m) - 1]} ${an}`;
}

/** Dernier jour du mois `YYYY-MM`, en ISO. Le jour 0 du mois suivant. */
function dernierJourDuMois(cle: string): string {
  const [an, m] = cle.split("-").map(Number);
  return new Date(Date.UTC(an, m, 0)).toISOString().slice(0, 10);
}

export type MoisPlein<T> = { cle: string; nom: string; complet: boolean; pts: T[] };

/**
 * Découpe une série datée en mois, et dit lesquels la fenêtre couvre en ENTIER.
 *
 * Les mois sont engendrés à partir de la COUVERTURE, pas des points : un mois
 * sans une seule publication est un mois à zéro, pas un mois qui n'existe pas —
 * l'oublier gonflerait la moyenne de celui qui a publié une fois sur deux.
 */
export function moisDeLaPeriode<T extends { date: string }>(
  pts: T[],
  couverture: { debut: string; fin: string }
): MoisPlein<T>[] {
  const d = couverture.debut.slice(0, 7);
  const f = couverture.fin.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(d) || !/^\d{4}-\d{2}$/.test(f) || d > f) return [];

  const paquets = new Map<string, T[]>();
  for (const p of pts) {
    const cle = String(p.date).slice(0, 7);
    const l = paquets.get(cle) ?? [];
    l.push(p);
    paquets.set(cle, l);
  }

  const out: MoisPlein<T>[] = [];
  let [an, mo] = d.split("-").map(Number);
  const [anF, moF] = f.split("-").map(Number);
  // Garde-fou : une date aberrante en base ne doit pas produire mille mois.
  while ((an < anF || (an === anF && mo <= moF)) && out.length < 120) {
    const cle = `${an}-${String(mo).padStart(2, "0")}`;
    out.push({
      cle,
      nom: nomMois(cle),
      complet: couverture.debut <= `${cle}-01` && couverture.fin >= dernierJourDuMois(cle),
      pts: paquets.get(cle) ?? [],
    });
    mo += 1;
    if (mo > 12) { mo = 1; an += 1; }
  }
  return out;
}

export type ChiffreMoyen = {
  titre: string;
  unite?: string;
  /** `somme` = la valeur de l'unité est un total · `taux` = c'est un rapport. */
  nature: "somme" | "taux";
  /** Une valeur par unité moyennée. `null` quand l'unité n'a rien à mesurer —
   *  un CTR sans impression n'est pas 0 %, il est indéfini, et le compter
   *  comme un zéro ferait baisser la moyenne d'un mois sans campagne. */
  parUnite: (number | null)[];
  fmt: (v: number) => string;
};

function moyenne(xs: (number | null)[]): { v: number; n: number } | null {
  const reels = xs.filter((x): x is number => x !== null && isFinite(x));
  if (reels.length === 0) return null;
  return { v: reels.reduce((a, b) => a + b, 0) / reels.length, n: reels.length };
}

/** « mois » est invariable ; « jour » et « publication » prennent leur s. */
function pluriel(unite: string, n: number): string {
  return n > 1 && unite !== "mois" ? `${unite}s` : unite;
}

/** Un SIGLE ne se met pas en minuscules : « de ctr par mois » se lit comme une
 *  coquille, là où « de CTR par mois » se lit comme une mesure. Le test est la
 *  casse du titre lui-même — pas une liste de sigles à tenir à jour. */
function enPhrase(titre: string): string {
  return titre === titre.toUpperCase() ? titre : titre.toLowerCase();
}

/** « de engagement » — l'élision manquait. Un module qui explique un chiffre
 *  dans une phrase fautive fait douter du chiffre. */
function deQuoi(titre: string): string {
  const t = enPhrase(titre);
  return /^[aeiouyéèêàâîôûh]/i.test(t) ? `d'${t}` : `de ${t}`;
}

/** Le seul mot féminin des trois est « publication » — et l'écran écrivait
 *  « la jour est un total ». Une faute d'accord dans la phrase qui EXPLIQUE le
 *  chiffre décrédibilise le chiffre. */
function article(unite: string): string {
  return unite === "publication" ? "la" : "le";
}

export function Moyennes({
  unite,
  n,
  fenetre,
  chiffres,
  tete = 0,
  pied,
  vide,
  elargir,
}: {
  /** Le DÉNOMINATEUR, au singulier : « mois », « jour », « publication ». */
  unite: string;
  /** Combien d'unités sont moyennées. Zéro bascule le module sur `vide`. */
  n: number;
  /** La fenêtre, écrite : « 11 aoû → 17 aoû 2026 ». Elle fait partie du
   *  chiffre — une moyenne dont la fenêtre bouge et qui ne la dit pas se lit
   *  comme la même moyenne qu'avant. */
  fenetre: string;
  chiffres: ChiffreMoyen[];
  /** Lequel des chiffres porte le rang 3. Les autres forment le bilan. */
  tete?: number;
  /** Rang 9 — ce qui rend CETTE moyenne honnête. Un seul pied, jamais deux. */
  pied?: string;
  /** Ce qui s'écrit à la place du chiffre quand il n'y a rien à moyenner. */
  vide: string;
  /** Où aller chercher plus de matière quand la fenêtre est trop courte. */
  elargir?: { href: string; texte: string };
}) {
  const i = Math.min(tete, chiffres.length - 1);

  return (
    <div className="mb-8">
      {/* Rang 1 — l'identité, et rang 2 le contexte : le dénominateur EST dans
          le titre, la fenêtre juste après. Les deux changent avec le filtre. */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Tes moyennes par {unite}{" "}
        <span className="text-faint font-normal">
          · {n} {pluriel(unite, n)} · {fenetre}
        </span>
      </h2>

      <div className="bg-white border border-line rounded-xl shadow-card p-5">
        {n === 0 || chiffres.length === 0 ? (
          // Un vide se dit en toutes lettres, et il dit quoi faire. Zéro serait
          // un chiffre faux : ce n'est pas « la moyenne vaut 0 », c'est « il
          // n'y a rien à moyenner ».
          <p className="text-[12.5px] text-muted leading-relaxed">
            {vide}
            {elargir && (
              <>
                {" "}
                <a href={elargir.href} className="text-brand font-semibold underline">
                  {elargir.texte}
                </a>
                .
              </>
            )}
          </p>
        ) : (
          <>
            {/* Rang 3 — le chiffre, avant toute forme. */}
            {(() => {
              const t = chiffres[i];
              const m = moyenne(t.parUnite);
              return (
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
                    {m ? t.fmt(m.v) : "—"}
                    {t.unite && <span className="text-[15px] text-faint"> {t.unite}</span>}
                  </span>
                  <span className="text-[11px] text-faint">
                    {deQuoi(t.titre)} par {unite}, en moyenne
                    {` · ${article(unite)} ${unite} est un ${t.nature === "somme" ? "total" : "taux"}`}
                  </span>
                </div>
              );
            })()}

            {/* Le bilan — au moins 1,7 fois plus petit que la tête (34 → 19 px)
                et sur UN SEUL fond : c'est ce qui le fait lire comme la suite du
                chiffre, pas comme quatre chiffres qui lui disputent la place. */}
            {chiffres.length > 1 && (
              <div className="mt-4 rounded-lg bg-black/[0.02] border border-line/70">
                <div className="defile-x flex items-start gap-6 px-4 py-3 rounded-lg">
                  {chiffres.map((c, j) =>
                    j === i ? null : (
                      <div key={c.titre} className="shrink-0">
                        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
                          {c.titre}
                        </div>
                        <div className="font-mono text-[19px] leading-tight text-ink mt-0.5">
                          {(() => {
                            const m = moyenne(c.parUnite);
                            return m ? c.fmt(m.v) : "—";
                          })()}
                          {c.unite && <span className="text-[11px] text-faint"> {c.unite}</span>}
                        </div>
                        <div className="text-[10px] text-faint mt-0.5">
                          {c.nature === "somme" ? "total" : "taux"} · {unite}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Rang 9 — un seul pied, et il porte la seule chose qui rend la
            moyenne honnête : sa fenêtre, et ce qu'on en a retiré.
            IL SE TAIT QUAND IL N'Y A PAS DE MOYENNE : « Moyenne des 0
            publication de la période » sous un bloc qui vient d'écrire qu'il
            n'y a rien à moyenner reprend d'une main ce que le vide donnait de
            l'autre. */}
        {pied && n > 0 && chiffres.length > 0 && (
          <p className="text-[10.5px] text-faint leading-relaxed mt-3">{pied}</p>
        )}
      </div>
    </div>
  );
}

// Ce que la fenêtre d'un canal donne comme unité, et ce qu'il faut en écrire.
// Une seule fonction pour les trois pages : c'est elle qui garantit que Meta,
// Google et Instagram basculent au même moment et le disent avec les mêmes mots.
function uniteDeLaFenetre<T extends { date: string }>(
  pts: T[],
  couverture: { debut: string; fin: string },
  courte: string
): {
  unite: string;
  groupes: T[][];
  /** La phrase du rang 9 qui vient de la BRANCHE (pas des chiffres). */
  pied: string;
} {
  const mois = moisDeLaPeriode(pts, couverture);
  const complets = mois.filter((m) => m.complet);

  // Un seul mois entier ne fait pas une moyenne, c'est ce mois-là. En dessous de
  // deux, on descend d'un cran plutôt que d'écrire « rien à afficher » : c'est
  // le filtre de l'utilisateur, il doit produire une réponse.
  if (complets.length < 2)
    return { unite: courte, groupes: pts.map((p) => [p]), pied: "" };

  const ecartes = mois.filter((m) => !m.complet);
  const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const phrase =
    ecartes.length === 0
      ? ""
      : ecartes.length === 1
        ? ` ${maj(ecartes[0].nom)} est écarté : la période ne le couvre pas en entier — un mois en cours compté comme un mois plein tirerait la moyenne vers le bas sans qu'on le voie.`
        : ` ${ecartes.length} mois sont écartés (${ecartes.map((m) => m.nom).join(", ")}) : la période ne les couvre pas en entier — un mois en cours compté comme un mois plein tirerait la moyenne vers le bas sans qu'on le voie.`;

  return {
    unite: "mois",
    groupes: complets.map((m) => m.pts),
    pied:
      `Moyenne des ${complets.length} mois entièrement couverts par la période affichée, ` +
      `de ${complets[0].nom} à ${complets[complets.length - 1].nom}.${phrase}`,
  };
}

// Les bornes d'une fenêtre, écrites court : « 11 aoû → 17 aoû 2026 ».
// Découpage de la chaîne ISO, jamais `new Date(...)` : « 2026-08-11 » se parse
// à minuit UTC, et `getDate()` rend alors le 10 dans tout fuseau derrière
// Greenwich. Une date affichée n'a pas à dépendre de l'heure du navigateur.
const MOIS_COURT = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function jourISO(d: string): string {
  const [a, m, j] = d.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  return mi >= 0 && mi < 12 ? `${j} ${MOIS_COURT[mi]}` : a;
}
function bornes(debut: string, fin: string): string {
  return `${jourISO(debut)} → ${jourISO(fin)} ${fin.slice(0, 4)}`;
}

// Les moyennes des dashboards publicitaires (Meta, Google, et toute régie qui
// suivra). Elles lisent la MÊME fenêtre que la courbe posée juste dessous :
// c'est ce qui permet de les lire l'une après l'autre sans se demander de quoi
// on parle.
//
// Elles lisent `dailyComplet` et non `daily` : `daily` est plafonnée à 120
// points pour rester lisible en graphe, et une moyenne calculée sur les 120
// derniers jours d'un historique de deux ans, sous un titre qui dit « Tout »,
// serait un chiffre présenté pour autre chose que ce qu'il mesure.
export function MoyennesAds({ d, path }: { d: ChannelDash; path: string }) {
  const pts = d.dailyComplet;
  const { unite, groupes, pied } = uniteDeLaFenetre(
    pts,
    { debut: d.windowDebut, fin: d.windowFin },
    "jour"
  );

  const som = (g: DayPoint[], f: (p: DayPoint) => number) => g.reduce((a, p) => a + f(p), 0);

  const chiffres: ChiffreMoyen[] = [
    {
      titre: "Dépense", unite: "CHF", nature: "somme", fmt: fmtCHF,
      parUnite: groupes.map((g) => som(g, (p) => p.spend)),
    },
    {
      titre: "Clics", nature: "somme", fmt: fmtCHF,
      parUnite: groupes.map((g) => som(g, (p) => p.clicks)),
    },
    {
      titre: "Impressions", nature: "somme", fmt: fmtCHF,
      parUnite: groupes.map((g) => som(g, (p) => p.impressions)),
    },
    {
      titre: "CTR", unite: "%", nature: "taux", fmt: (v) => v.toFixed(2),
      // Le taux d'une unité se calcule sur SES TOTAUX, jamais en moyennant
      // trente taux quotidiens : un dimanche à 12 impressions pèserait autant
      // qu'un mardi à 4 000.
      parUnite: groupes.map((g) => {
        const i = som(g, (p) => p.impressions);
        return i > 0 ? (som(g, (p) => p.clicks) / i) * 100 : null;
      }),
    },
    {
      titre: "CPC", unite: "CHF", nature: "taux", fmt: (v) => v.toFixed(2),
      parUnite: groupes.map((g) => {
        const c = som(g, (p) => p.clicks);
        return c > 0 ? som(g, (p) => p.spend) / c : null;
      }),
    },
  ];

  // La tête suit la métrique choisie SOUS la courbe : le sélecteur pilote les
  // deux modules à la fois, et il reste en bas des deux (rang 8).
  const ordre = ["spend", "clicks", "impressions", "ctr", "cpc"];
  const tete = Math.max(0, ordre.indexOf(d.metric));

  // En branche « jour », le pied dit ce qui rend la moyenne lisible : un jour
  // sans campagne est un jour à ZÉRO, pas un jour absent. C'est la différence
  // entre « tu dépenses peu » et « tu dépenses sur peu de jours », et sans ce
  // compte les deux se lisent pareil.
  const actifs = pts.filter((p) => p.spend > 0 || p.impressions > 0 || p.clicks > 0).length;
  const piedJour =
    `Moyenne sur les ${pts.length} jours pleins de la période affichée. ` +
    (actifs === 0
      ? "Aucun n'a porté de campagne : la moyenne est un zéro MESURÉ, pas une absence de mesure."
      : `${actifs} d'entre eux ${actifs > 1 ? "ont porté" : "a porté"} une campagne : les autres comptent comme des jours à zéro, ` +
        "sinon « peu dépensé » et « dépensé sur peu de jours » se liraient pareil.");

  return (
    <Moyennes
      unite={unite}
      n={groupes.length}
      fenetre={bornes(d.windowDebut, d.windowFin)}
      chiffres={chiffres}
      tete={tete}
      pied={unite === "mois" ? pied : piedJour}
      vide="La période affichée ne contient aucun jour plein — il n'y a rien à moyenner."
      elargir={{
        href: lienAds(path, d, { d: "0" }),
        texte: "Passe la période sur « Tout »",
      }}
    />
  );
}

// Les moyennes d'Instagram. Même module, même règle, même composant que Meta et
// Google — c'est le but : trois pages canal qui posent la même question doivent
// la poser de la même façon. Ce qui change, c'est l'unité observée quand la
// fenêtre est trop courte pour un mois : là-bas des jours de dépense, ici des
// PUBLICATIONS. Un jour sans post n'est pas un jour à zéro sur Instagram, c'est
// un jour où il ne s'est rien passé ; le dénominateur naturel est le post.
//
// C'est ce module qui a absorbé « Tes moyennes par post · tout l'historique »,
// supprimé de la page : il en reprend exactement les chiffres, mais sur la
// fenêtre affichée au lieu de tout l'historique.
export function MoyennesInsta({ d }: { d: InstaDash }) {
  const posts = d.posts.map((p) => ({ ...p, date: String(p.date).slice(0, 10) }));
  const { unite, groupes, pied } = uniteDeLaFenetre(
    posts,
    { debut: d.windowDebut, fin: d.windowFin },
    "publication"
  );

  const som = (g: InstaPost[], f: (p: InstaPost) => number) => g.reduce((a, p) => a + f(p), 0);
  // Zéro vue sur un post publié n'existe pas : c'est une mesure absente, pas une
  // mesure nulle. La compter comme un zéro ferait plonger la moyenne de tout
  // compte mêlant photos et reels.
  const vues = (g: InstaPost[]) => {
    const v = som(g, (p) => p.views);
    return v > 0 ? v : null;
  };

  const chiffres: ChiffreMoyen[] = [
    { titre: "Portée", nature: "somme", fmt: fmtCHF, parUnite: groupes.map((g) => som(g, (p) => p.reach)) },
    { titre: "Vues", nature: "somme", fmt: fmtCHF, parUnite: groupes.map(vues) },
    { titre: "J'aime", nature: "somme", fmt: fmtCHF, parUnite: groupes.map((g) => som(g, (p) => p.likes)) },
    { titre: "Commentaires", nature: "somme", fmt: (v) => v.toFixed(1), parUnite: groupes.map((g) => som(g, (p) => p.comments)) },
    { titre: "Enregistrements", nature: "somme", fmt: (v) => v.toFixed(1), parUnite: groupes.map((g) => som(g, (p) => p.saved)) },
    {
      titre: "Engagement", unite: "%", nature: "taux", fmt: (v) => v.toFixed(1),
      // Le taux se calcule sur les totaux de l'unité : moyenner les engagements
      // de chaque post donnerait le même poids à un post vu par 40 personnes et
      // à un reel vu par 12 000.
      parUnite: groupes.map((g) => {
        const r = som(g, (p) => p.reach);
        return r > 0 ? (som(g, (p) => p.likes + p.comments + p.saved) / r) * 100 : null;
      }),
    },
  ];
  // Le nombre de publications n'a de sens qu'en branche mensuelle : par
  // publication, il vaudrait 1 partout. Il vient donc en fin de bilan, après les
  // six métriques dont l'ordre est celui du sélecteur (`tete` en dépend).
  if (unite === "mois")
    chiffres.push({
      titre: "Publications", nature: "somme", fmt: (v) => v.toFixed(1),
      parUnite: groupes.map((g) => g.length),
    });

  const ordre = ["reach", "views", "likes", "comments", "saved", "eng"];
  const tete = Math.max(0, ordre.indexOf(d.topMetric));

  // Une fenêtre qui couvre deux mois entiers SANS aucune publication donne des
  // moyennes à zéro, et ce zéro-là est mesuré : rien n'a été publié. Il faut le
  // dire, sinon il se lit comme une panne de récolte.
  const piedMois =
    posts.length === 0
      ? `${pied} Aucune publication sur la période : ces moyennes valent zéro parce que rien n'a été publié, pas parce que rien n'a été mesuré.`
      : pied;

  return (
    <Moyennes
      unite={unite}
      n={groupes.length}
      fenetre={bornes(d.windowDebut, d.windowFin)}
      chiffres={chiffres}
      tete={tete}
      pied={
        unite === "mois"
          ? piedMois
          : `Moyenne des ${posts.length} publication${posts.length > 1 ? "s" : ""} de la période affichée. ` +
            `Une publication est le dénominateur tant que la fenêtre ne couvre pas deux mois entiers : ` +
            `sur sept jours, un « par mois » n'aurait aucun mois à moyenner.`
      }
      vide="Aucune publication sur la période affichée — il n'y a rien à moyenner. Ce n'est pas une moyenne à zéro, c'est une moyenne sans dénominateur."
      elargir={{ href: lienDash("/instagram", d.params, { d: "0" }, "reach"), texte: "Élargis la période" }}
    />
  );
}

const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "spend", label: "Dépense", unit: "CHF" },
  { key: "clicks", label: "Clics", unit: "" },
  { key: "impressions", label: "Impressions", unit: "" },
  { key: "ctr", label: "CTR", unit: "%" },
  { key: "cpc", label: "CPC", unit: "CHF" },
];

// Évolution quotidienne — métrique au choix (barres SVG, zéro dépendance).
export function MetricChart({ d, path }: { d: ChannelDash; path: string }) {
  const pts = d.daily;
  if (pts.length === 0) return null;
  const val = (p: (typeof pts)[0]): number => {
    switch (d.metric) {
      case "clicks": return p.clicks;
      case "impressions": return p.impressions;
      case "ctr": return p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
      case "cpc": return p.clicks > 0 ? p.spend / p.clicks : 0;
      default: return p.spend;
    }
  };
  const meta = METRICS.find((m) => m.key === d.metric) ?? METRICS[0];
  const vals = pts.map(val);
  const max = Math.max(...vals, 0.001);
  const fmtV = (v: number) => (v >= 100 ? fmtCHF(v) : v.toFixed(2));

  // Le CUMUL de la métrique choisie, en clair, avant la courbe. Ce module
  // n'avait aucun chiffre : il ouvrait sur un surtitre et une rangée de
  // boutons, puis un graphe. Un graphe dit la forme, jamais la valeur.
  // Une moyenne pour ce qui est un taux, un total pour ce qui s'additionne.
  const taux = d.metric === "ctr" || d.metric === "cpc";
  const valeur = taux
    ? vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.filter((v) => v > 0).length)
    : vals.reduce((a, b) => a + b, 0);

  // La pente : 2e moitié de la période contre la 1re. Trois mots au lieu de
  // dix secondes de lecture de courbe.
  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const mi = Math.floor(vals.length / 2);
  const av = moy(vals.slice(0, mi));
  const ap = moy(vals.slice(mi));
  const ec = av > 0 ? ((ap - av) / av) * 100 : null;
  // « Mieux » dépend de la métrique : un CPC qui baisse est une bonne nouvelle.
  const baisseEstBonne = d.metric === "cpc";
  const s = sensPente(ec, baisseEstBonne, 8);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Évolution quotidienne <span className="text-ink">· {meta.label}</span>
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtV(valeur)}
          <span className="text-[15px] text-faint"> {meta.unit}</span>
        </span>
        <span className="text-[11px] text-faint">{taux ? "en moyenne" : "au total"}</span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}
          style={{ background: s.fond }}
          title="Seconde moitié de la période comparée à la première"
        >
          {s.plat ? (
            "≈ stable"
          ) : (
            <>
              <Triangle sens={s.monte ? "haut" : "bas"} /> {ec! > 0 ? "+" : ""}
              {Math.round(ec!)} % sur la période
            </>
          )}
        </span>
      </div>

      <LineChart
        labels={pts.map((p) => p.label)}
        series={[{ name: meta.label, color: "#1a56ff", values: vals }]}
        fmt={fmtV}
        unit={` ${meta.unit}`}
        ariaLabel={`${meta.label} par jour`}
      />

      {/* Le sélecteur passe SOUS le graphe : il pilote ce module, il ne le
          quitte pas. Au-dessus, c'était la télécommande avant l'écran — le
          défaut déjà corrigé sur la boussole du rapport. */}
      <div className="flex items-center gap-1 overflow-x-auto pt-3 mt-1 border-t border-line">
        {METRICS.map((m) => (
          <a
            key={m.key}
            href={lienAds(path, d, { m: m.key })}
            className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${
              d.metric === m.key
                ? "bg-ink text-white border-ink"
                : "border-line text-muted hover:bg-black/[0.03] bg-white"
            }`}
          >
            {m.label}
          </a>
        ))}
        <span className="ml-auto shrink-0 text-[10.5px] text-faint pl-3">
          max {fmtV(max)} {meta.unit} / jour
        </span>
      </div>
    </div>
  );
}

// ── LES CINQ MÉTRIQUES PUBLICITAIRES, VUES COMME UN ÉCART ────────────────────
//
// Mêmes clés, mêmes natures et mêmes règles de jugement que dans « Comparer »
// (`components/comparaison.tsx`) : c'est la métrique choisie SOUS la courbe qui
// pilote la page, donc aussi l'écart des deux tables. Voir une frise de dépense
// et un écart de clics sous elle, ce serait répondre à côté de la question.
//
// Les taux se dérivent des totaux de la fenêtre, jamais d'une moyenne de taux.
const METRIQUES_ECART: Record<string, MetriqueEcart> = {
  spend: {
    titre: "Dépense", valeur: (b) => b.spend, ramenerAuJour: true,
    fmt: fmtCHF, unite: "CHF", neutre: true,
  },
  clicks: { titre: "Clics", valeur: (b) => b.clicks, ramenerAuJour: true, fmt: fmtCHF },
  impressions: { titre: "Impressions", valeur: (b) => b.impressions, ramenerAuJour: true, fmt: fmtCHF },
  ctr: {
    titre: "CTR", valeur: (b) => (b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0),
    ramenerAuJour: false, fmt: (v) => v.toFixed(2), unite: "%",
  },
  cpc: {
    titre: "CPC", valeur: (b) => (b.clicks > 0 ? b.spend / b.clicks : 0),
    ramenerAuJour: false, fmt: (v) => v.toFixed(2), unite: "CHF", baisseEstBonne: true,
  },
};

/** La valeur AFFICHÉE d'une ligne, pour la métrique qui pilote la page. */
function valeurAds(
  x: { spend: number; clicks: number; impressions: number; ctr: number; cpc: number },
  cle: string
): number {
  return cle === "clicks" ? x.clicks
    : cle === "impressions" ? x.impressions
    : cle === "ctr" ? x.ctr
    : cle === "cpc" ? x.cpc
    : x.spend;
}

export function ByLabelTable({ d, path }: { d: ChannelDash; path: string }) {
  if (d.byLabel.length === 0) return null;

  // `ouvrirEcart` rend `null` dès que la comparaison ne tient pas — la table
  // reprend alors exactement la forme qu'elle avait, sans colonne ni pied.
  const e = ouvrirEcart(d.comparaison, "theme", METRIQUES_ECART[d.metric] ?? METRIQUES_ECART.spend);
  const trie = e !== null && triParEcart(d.params);
  const valeur = (x: LabelAgg) => valeurAds(x, d.metric);
  const lignes = e && trie ? trierParEcart(d.byLabel, e, (x) => x.label, valeur) : d.byLabel;
  const disparues = e ? e.disparues(d.byLabel.map((x) => x.label)) : [];

  const thc = "font-semibold py-3 sticky top-0 bg-white z-10 border-b border-line";
  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par thème{" "}
        <span className="text-faint font-normal">
          · période filtrée · {d.periodLabel}
          {mentionEcart(e, trie)}
        </span>
      </h2>
      {/* Règle maison : une liste longue scrolle DANS sa boîte, jamais la page.
          Et `.defile-x` plutôt que `overflow-x-auto` nu : la colonne d'écart
          élargit la table, donc une partie peut sortir du cadre — une rangée
          coupée à droite ne se devine pas (docs/03-grammaire-des-modules.md). */}
      <div className="bg-white border border-line rounded-xl shadow-card defile-x">
        <div className={`max-h-[46vh] overflow-y-auto ${e ? "min-w-[620px]" : "min-w-[480px]"}`}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className={`text-left px-5 ${thc}`}>Thème</th>
              <th className={`text-right px-2 ${thc}`}>Dépensé</th>
              <th className={`text-right px-2 ${thc}`}>Clics</th>
              <th className={`text-right px-2 ${thc}`}>CTR</th>
              <th className={`text-right ${e ? "px-2" : "px-5"} ${thc}`}>CPC</th>
              {e && (
                <th className={`text-right px-5 ${thc}`}>
                  <EnteteEcart path={path} sp={d.params} metriqueParDefaut="spend" trie={trie} />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lignes.map((l) => (
              <tr key={l.label}>
                <td className="px-5 py-3 font-semibold text-brand">{l.label}</td>
                <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.spend)} CHF</td>
                <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.clicks)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{l.ctr.toFixed(2)} %</td>
                <td className={`${e ? "px-2" : "px-5"} py-3 text-right font-mono text-muted`}>
                  {l.cpc > 0 ? l.cpc.toFixed(2) : "—"}
                </td>
                {e && (
                  <td className="px-5 py-3 text-right">
                    <CelluleEcart e={e.ligne(l.label, valeur(l))} l={e} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {/* Rang 9 — il n'existe QUE quand il y a un écart à rendre honnête. */}
        {e && (
          <p className="text-[10.5px] text-faint px-5 py-2.5 border-t border-line leading-relaxed">
            {phraseEcart(e, disparues, trie, { ligne: "thème", lignes: "thèmes" })} Le thème d&apos;une
            campagne est celui d&apos;aujourd&apos;hui, des deux côtés : on ne garde pas l&apos;histoire
            des étiquettes, donc une campagne ré-étiquetée hier emporte tout son passé avec elle.
          </p>
        )}
      </div>
    </div>
  );
}

// ── LA MÊME TABLE, CÔTÉ INSTAGRAM ────────────────────────────────────────────
//
// Elle était écrite à même `app/instagram/page.tsx`, donc invérifiable autrement
// qu'en production — la page est derrière `middleware.ts` et lit un vrai compte.
// C'est la raison déjà écrite dans la grammaire pour `couts-modules` et
// `hors-theme` : une page compose, elle ne dessine pas. Elle rejoint ici ses deux
// sœurs publicitaires, ce qui garantit accessoirement que les trois disent
// l'écart avec les mêmes mots.
//
// CE QUI CHANGE PAR RAPPORT À LA PUBLICITÉ, et c'est le seul point qui compte :
// ses colonnes sont des MOYENNES PAR PUBLICATION, pas des totaux de fenêtre. Le
// dénominateur est déjà le post, donc `ramenerAuJour: false` partout — diviser
// une moyenne par post par un nombre de jours ne corrigerait rien, ça
// fabriquerait un chiffre que personne ne pourrait relire.
//
// `engSomme` est la somme des taux d'engagement POST PAR POST : c'est ce que la
// colonne « Eng. » affiche (`avgEng`, une moyenne de taux). Le module
// « Comparer », lui, calcule l'engagement sur les TOTAUX de la fenêtre — deux
// nombres légitimes, qu'on n'a pas le droit de comparer l'un à l'autre.
const METRIQUES_INSTA: Record<string, MetriqueEcart> = {
  reach: { titre: "Portée", valeur: (b) => (b.posts > 0 ? b.reach / b.posts : 0), ramenerAuJour: false, fmt: fmtCHF },
  views: { titre: "Vues", valeur: (b) => (b.posts > 0 ? b.views / b.posts : 0), ramenerAuJour: false, fmt: fmtCHF },
  likes: { titre: "J'aime", valeur: (b) => (b.posts > 0 ? b.likes / b.posts : 0), ramenerAuJour: false, fmt: fmtCHF },
  comments: { titre: "Commentaires", valeur: (b) => (b.posts > 0 ? b.comments / b.posts : 0), ramenerAuJour: false, fmt: fmtCHF },
  saved: { titre: "Enregistrements", valeur: (b) => (b.posts > 0 ? b.saved / b.posts : 0), ramenerAuJour: false, fmt: fmtCHF },
  eng: {
    titre: "Engagement", valeur: (b) => (b.posts > 0 ? b.engSomme / b.posts : 0),
    ramenerAuJour: false, fmt: (v) => v.toFixed(1), unite: "%",
  },
};

const INSTA_NOMS: Record<string, string> = {
  reach: "portée", views: "vues", likes: "j'aime",
  comments: "comm.", saved: "enreg.", eng: "engagement",
};

/** La valeur AFFICHÉE d'une ligne de thème, pour la métrique qui pilote la page. */
function valeurInsta(l: PostLabelAgg, cle: string): number {
  return cle === "views" ? l.mViews
    : cle === "likes" ? l.mLikes
    : cle === "comments" ? l.mComments
    : cle === "saved" ? l.mSaved
    : cle === "eng" ? l.avgEng
    : l.mReach;
}

export function ByLabelInsta({ d }: { d: InstaDash }) {
  if (d.byLabel.length === 0) return null;

  // `scope === "historique"` COUPE l'écart, et c'est la même règle que partout :
  // sous deux publications dans la fenêtre, cette table retombe sur TOUT
  // l'historique. Elle ne montre alors plus la période affichée — lui coller
  // l'écart d'une référence comparerait l'historique entier à sept jours de
  // juillet, sous une colonne qui prétendrait le contraire.
  const e =
    d.scope === "periode"
      ? ouvrirEcart(d.comparaison, "theme", METRIQUES_INSTA[d.topMetric] ?? METRIQUES_INSTA.reach)
      : null;
  const trie = e !== null && triParEcart(d.params);
  const valeur = (l: PostLabelAgg) => valeurInsta(l, d.topMetric);
  const lignes = e && trie ? trierParEcart(d.byLabel, e, (l) => l.label, valeur) : d.byLabel;
  const disparues = e ? e.disparues(d.byLabel.map((l) => l.label)) : [];

  const thc = "font-semibold py-3 sticky top-0 bg-white z-10 border-b border-line";
  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Performance par thème{" "}
        <span className="text-faint font-normal">
          · moyennes par post · triée par {INSTA_NOMS[d.topMetric] ?? INSTA_NOMS.reach}
          {d.scope === "historique" ? " · tout l'historique" : " · période filtrée"}
          {mentionEcart(e, trie)}
        </span>
      </h2>
      <div className="bg-white border border-line rounded-xl shadow-card defile-x">
        <div className={`max-h-[46vh] overflow-y-auto ${e ? "min-w-[780px]" : "min-w-[640px]"}`}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                {["Thème", "Posts", "Portée", "Vues", "J'aime", "Comm.", "Enreg.", "Eng."].map((h, hi) => (
                  <th
                    key={h}
                    className={`${hi === 0 ? "text-left px-5" : "text-right px-2"} ${hi === 7 && !e ? "pr-5" : ""} ${thc}`}
                  >
                    {h}
                  </th>
                ))}
                {e && (
                  <th className={`text-right px-5 ${thc}`}>
                    <EnteteEcart path="/instagram" sp={d.params} metriqueParDefaut="reach" trie={trie} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lignes.map((l) => (
                <tr key={l.label}>
                  <td className="px-5 py-3 font-semibold text-brand">{l.label}</td>
                  <td className="px-2 py-3 text-right font-mono text-muted">{l.count}</td>
                  <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.mReach)}</td>
                  <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.mViews)}</td>
                  <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mLikes)}</td>
                  <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mComments)}</td>
                  <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mSaved)}</td>
                  <td className={`px-2 ${e ? "" : "pr-5"} py-3 text-right font-mono text-ink`}>
                    {l.avgEng.toFixed(1)} %
                  </td>
                  {e && (
                    <td className="px-5 py-3 text-right">
                      <CelluleEcart e={e.ligne(l.label, valeur(l))} l={e} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Rang 9 — il n'existe qu'avec l'écart, et il dit ce qui le rend honnête
            ICI : le dénominateur est la publication, pas le jour. */}
        {e && (
          <p className="text-[10.5px] text-faint px-5 py-2.5 border-t border-line leading-relaxed">
            {phraseEcart(e, disparues, trie, { ligne: "thème", lignes: "thèmes" })} Ces colonnes sont
            des moyennes PAR PUBLICATION : rien n&apos;est ramené au jour, même quand les deux
            fenêtres n&apos;ont pas la même longueur — le dénominateur est déjà le post. Un post
            porte tous ses thèmes, donc les lignes ne s&apos;additionnent pas.
          </p>
        )}
      </div>
      {/* Une comparaison posée sur une table retombée sur l'historique n'aurait
          comparé ni la même fenêtre ni le même périmètre : on le dit, plutôt que
          de laisser la colonne manquer en silence. */}
      {!e && d.scope === "historique" && d.comparaison.ventilations && (
        <p className="text-[11px] text-faint mt-2 leading-relaxed">
          Pas d&apos;écart sur cette table : la fenêtre affichée porte moins de deux publications,
          elle est donc calculée sur tout l&apos;historique. Comparer tout l&apos;historique à une
          période de référence n&apos;aurait aucun sens.
        </p>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string | null }) {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pos bg-pos/10 rounded-full px-2 py-0.5 shrink-0">
        ● Active
      </span>
    );
  if (s === "PAUSED")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-faint bg-black/[0.05] rounded-full px-2 py-0.5 shrink-0">
        ◦ En pause
      </span>
    );
  if (!s || s === "UNKNOWN") return null;
  return (
    <span className="text-[10px] font-bold text-warn bg-warn/10 rounded-full px-2 py-0.5 shrink-0">
      {s.toLowerCase()}
    </span>
  );
}

// Table campagnes en accordéon : chaque campagne se DÉROULE en adsets/groupes,
// puis en annonces — chiffres alignés sur les mêmes colonnes à chaque niveau.
// Hauteur bornée : la table scrolle à l'intérieur, l'en-tête reste collé.
//
// UNE LIGNE QUI NE SE DÉPLIE PAS N'EST PAS UN `<details>`.
//
// C'était la correction du « on ne peut plus déplier les campagnes Google ».
// Le dépliage se nourrit d'une table dédiée, `google_ads_ad_insights`,
// alimentée autrefois par le passage Streamlit et qui ne l'était plus depuis
// que la récolte est autonome (`saas/worker/fetch_all.py`, `_fetch_google` ne
// demandait que le niveau CAMPAGNE ; Meta, lui, récolte au niveau annonce et
// sert les deux). `_fetch_google` appelle maintenant aussi `fetch_ad_insights`
// et écrit dans `google_ads_ad_insights` (sa propre date de reprise, déduite
// d'elle-même comme les autres tables) — la vraie réparation était dans le
// worker, elle y est faite.
//
// Ce qui restait réparable ICI, et qui était la moitié visible du défaut : la
// ligne restait un `<details>` avec son curseur de main et son fond au
// survol, on cliquait, elle s'ouvrait — SUR RIEN. Un pied écrivait même
// « clique une campagne pour dérouler ses groupes ». On promettait un geste
// qui ne pouvait pas aboutir, et le silence se lisait comme une panne
// d'interface. Sans détail, la ligne redevient une ligne, et le pied DIT
// pourquoi — ce qui reste vrai tant que le worker n'a pas encore tourné une
// première fois après ce correctif (aucune ligne en base pour l'instant).
export function CampaignTable({
  d,
  channel,
  path,
}: {
  d: ChannelDash;
  channel: "meta" | "google";
  path: string;
}) {
  // Le titre vit DANS le module, comme celui de `ByLabelTable` : son sous-titre
  // dit le classement en cours, et le classement change avec l'URL. Écrit dans
  // les deux pages, il aurait fallu y recopier le test — deux copies d'une
  // condition finissent par ne plus dire la même chose que la table.
  const enTete = (sousTitre: string) => (
    <h2 className="text-[14px] font-semibold text-ink mb-3">
      Par campagne <span className="text-faint font-normal">· {sousTitre}</span>
    </h2>
  );

  if (d.campaigns.length === 0) {
    return (
      <>
        {enTete("aucune sur la période")}
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[13px] text-muted">Aucune campagne sur la période (ou filtre trop strict).</p>
        </div>
      </>
    );
  }
  const isMeta = channel === "meta";
  // Combien de campagnes ont réellement un détail à ouvrir. Zéro sur Google
  // tant que `google_ads_ad_insights` n'est pas alimentée — voir le commentaire
  // au-dessus du composant.
  const deroulables = d.campaigns.filter((c) => c.adsets.length > 0).length;
  const groupWord = isMeta ? "adset" : "groupe";

  // L'ÉCART, quand une comparaison est posée. `null` sinon, et la table ne
  // change alors pas d'un pixel : ni colonne, ni tri, ni phrase de pied.
  const e = ouvrirEcart(d.comparaison, "campagne", METRIQUES_ECART[d.metric] ?? METRIQUES_ECART.spend);
  const trie = e !== null && triParEcart(d.params);
  const valeur = (c: Campaign) => valeurAds(c, d.metric);
  const campagnes = e && trie ? trierParEcart(d.campaigns, e, (c) => c.key, valeur) : d.campaigns;
  // LA CLÉ N'EST PAS UN NOM. Côté Google elle vaut `campaign_id` : écrire
  // « 2 campagnes (17204418833, 21996755021) » dans le pied nommerait deux
  // nombres que personne ne peut relier à quoi que ce soit. `campOptions` est
  // bâti AVANT filtrage sur tout l'historique chargé — il connaît donc aussi les
  // campagnes qui ont disparu de la période affichée.
  const nomDe = new Map(d.campOptions.map((c) => [c.key, c.name]));
  const disparues = e
    ? e.disparues(d.campaigns.map((c) => c.key)).map((x) => ({ ...x, cle: nomDe.get(x.cle) ?? x.cle }))
    : [];

  // LA LARGEUR MINIMALE VIENT DES COLONNES, elle n'est plus écrite à côté.
  //
  // Le `min-w-[820px]` d'avant était SOUS la somme réelle des pistes (940 px sur
  // Meta) : la grille débordait de son cadre au lieu de le faire défiler, et la
  // dernière colonne se retrouvait coupée sans qu'aucune barre n'apparaisse —
  // `scrollWidth` valait `clientWidth`. Personne ne l'avait vu parce qu'un écran
  // de bureau offre 976 px, juste assez pour 940. La colonne d'écart en ajoute
  // 124 et faisait franchir le seuil : mesuré à 1 280 × 900, l'en-tête
  // s'arrêtait sur « Dépensé » et « Écart » n'était atteignable par aucun geste.
  const NOM_MIN = 220;
  const COLS = isMeta
    ? [150, 90, 90, 80, 70, 70, 70, 100] // thème · impr. · portée · clics · CTR · CPM · CPC · dépensé
    : [150, 90, 80, 70, 70, 70, 100];    // idem sans la portée (Google ne la suit pas)
  const cols = e ? [...COLS, 124] : COLS;
  const grid = `minmax(${NOM_MIN}px,2.4fr) ${cols.map((c) => `${c}px`).join(" ")}`;
  // + 24 : le `px-3` que chaque rangée porte de part et d'autre de la grille.
  // L'oublier laissait la dernière colonne mordre de 24 px sur le bord du cadre.
  const largeurMin = NOM_MIN + cols.reduce((a, b) => a + b, 0) + 24;

  const Nums = ({
    impressions, reach, clicks, ctr, cpm, cpc, spend, strong = false,
  }: {
    impressions: number; reach?: number; clicks: number; ctr: number;
    cpm: number | null; cpc: number; spend: number; strong?: boolean;
  }) => (
    <>
      <span className="text-right font-mono text-muted px-2">{fmtCHF(impressions)}</span>
      {isMeta && (
        <span className="text-right font-mono text-muted px-2">
          {reach && reach > 0 ? fmtCHF(reach) : "—"}
        </span>
      )}
      <span className={`text-right font-mono px-2 ${strong ? "text-ink" : "text-muted"}`}>
        {fmtCHF(clicks)}
      </span>
      <span className="text-right font-mono text-muted px-2">{ctr.toFixed(2)} %</span>
      <span className="text-right font-mono text-muted px-2">
        {cpm !== null && cpm > 0 ? cpm.toFixed(2) : "—"}
      </span>
      <span className="text-right font-mono text-muted px-2">
        {cpc > 0 ? cpc.toFixed(2) : "—"}
      </span>
      <span className={`text-right font-mono px-2 ${strong ? "text-ink font-medium" : "text-muted"}`}>
        {fmtCHF(spend)} CHF
      </span>
    </>
  );

  return (
    <>
    {enTete(
      trie
        ? `classées par écart · ${e!.reference} en référence`
        : `triées par ${(METRIQUES_ECART[d.metric] ?? METRIQUES_ECART.spend).titre.toLowerCase()}`
    )}
    {/* `.defile-x` : cette table dépassait déjà la largeur de la page, et la
        colonne d'écart lui ajoute 124 px. Une rangée coupée à droite se lit
        comme une mise en page ratée tant que rien ne dit qu'elle glisse. */}
    <div className="bg-white border border-line rounded-xl shadow-card defile-x">
      <div className="max-h-[440px] overflow-y-auto" style={{ minWidth: `${largeurMin}px` }}>
        {/* En-tête collé */}
        <div
          className="grid items-center text-[10px] uppercase tracking-wide text-faint font-semibold px-3 py-3 sticky top-0 bg-white border-b border-line z-10"
          style={{ gridTemplateColumns: grid }}
        >
          <span className="px-2">Campagne</span>
          <span className="px-2">Thème</span>
          <span className="text-right px-2">Impr.</span>
          {isMeta && <span className="text-right px-2">Portée</span>}
          <span className="text-right px-2">Clics</span>
          <span className="text-right px-2">CTR</span>
          <span className="text-right px-2">CPM</span>
          <span className="text-right px-2">CPC</span>
          <span className="text-right px-2">Dépensé</span>
          {/* L'en-tête n'est pas dans un `<summary>` : pas de `SummaryStop` ici,
              il annulerait le clic du lien de tri (`preventDefault`). */}
          {e && (
            <span className="text-right px-2">
              <EnteteEcart path={path} sp={d.params} metriqueParDefaut="spend" trie={trie} />
            </span>
          )}
        </div>

        <div className="divide-y divide-line">
          {campagnes.map((c) => {
            const deroulable = c.adsets.length > 0;
            // Le contenu de la ligne de tête est le même dans les deux cas ;
            // seul le conteneur change — `<summary>` quand il y a quelque chose
            // à ouvrir, une simple ligne sinon.
            const tete = (
              <>
                <span className="px-2 flex items-center gap-2 min-w-0">
                  {deroulable ? (
                    <span className="text-faint text-[10px] shrink-0 transition-transform group-open:rotate-90">
                      ▶
                    </span>
                  ) : (
                    <span
                      className="w-[10px] shrink-0 text-center text-faint/50 text-[10px] leading-none"
                      title={`Pas de détail par ${groupWord} pour cette campagne`}
                    >
                      ·
                    </span>
                  )}
                  <span className="text-ink font-medium leading-snug truncate" title={c.name}>
                    {c.name}
                  </span>
                  <StatusChip status={c.status} />
                </span>
                <SummaryStop className="px-2">
                  <CampaignLabelSelect
                    channel={channel}
                    campaignKey={c.key}
                    campaignName={c.name}
                    current={c.label}
                    labels={d.labels}
                    source={c.labelSource}
                  />
                </SummaryStop>
                <Nums
                  impressions={c.impressions}
                  reach={c.reach}
                  clicks={c.clicks}
                  ctr={c.ctr}
                  cpm={c.cpm}
                  cpc={c.cpc}
                  spend={c.spend}
                  strong
                />
                {e && (
                  <span className="text-right px-2">
                    <CelluleEcart e={e.ligne(c.key, valeur(c))} l={e} />
                  </span>
                )}
              </>
            );

            if (!deroulable)
              return (
                <div
                  key={c.key}
                  className="grid items-center px-3 py-3 text-[12.5px]"
                  style={{ gridTemplateColumns: grid }}
                >
                  {tete}
                </div>
              );

            return (
            <details key={c.key} className="group">
              <summary
                className="grid items-center px-3 py-3 text-[12.5px] cursor-pointer select-none hover:bg-black/[0.015] list-none"
                style={{ gridTemplateColumns: grid }}
              >
                {tete}
              </summary>

              {/* Déroulé : adsets/groupes → annonces, colonnes alignées */}
              {c.adsets.map((s) => (
                <div key={s.name} className="bg-black/[0.015]">
                  <div
                    className="grid items-center px-3 py-2 text-[11.5px]"
                    style={{ gridTemplateColumns: grid }}
                  >
                    <span className="px-2 pl-7 font-semibold text-muted truncate" title={s.name}>
                      ▸ {s.name}
                      <span className="text-faint font-normal text-[10px]"> · {groupWord}</span>
                    </span>
                    <span />
                    <Nums
                      impressions={s.impressions}
                      clicks={s.clicks}
                      ctr={s.ctr}
                      cpm={null}
                      cpc={s.cpc}
                      spend={s.spend}
                    />
                    {/* L'écart se lit au niveau de la CAMPAGNE : la référence
                        n'est pas ventilée par {groupWord}. Une cellule vide se
                        lirait comme une panne — le point dit qu'il n'y a rien
                        à y mettre, et son titre dit pourquoi. */}
                    {e && <EcartSansDetail mot={groupWord} />}
                  </div>
                  {s.ads.length > 0 &&
                    s.ads[0].name !== "—" &&
                    s.ads.map((a) => (
                      <div
                        key={a.name}
                        className="grid items-center px-3 py-1.5 text-[11px]"
                        style={{ gridTemplateColumns: grid }}
                      >
                        <span className="px-2 pl-12 text-muted truncate" title={a.name}>
                          {a.name}
                        </span>
                        <span />
                        <Nums
                          impressions={a.impressions}
                          clicks={a.clicks}
                          ctr={a.ctr}
                          cpm={null}
                          cpc={a.cpc}
                          spend={a.spend}
                        />
                        {e && <EcartSansDetail mot={groupWord} />}
                      </div>
                    ))}
                </div>
              ))}
            </details>
            );
          })}
        </div>
      </div>
      {/* Le pied dit ce qui est VRAI de cette table-ci, pas ce qui devrait
          l'être. Une phrase générique qui promet un dépliage impossible est
          pire qu'une phrase absente : elle fait chercher une panne. */}
      <p className="text-[10.5px] text-faint px-5 py-2.5 border-t border-line leading-relaxed">
        {deroulables === 0 ? (
          <>
            Aucune campagne ne se déplie : le détail par {groupWord} n&apos;a pas été récolté
            {isMeta ? "" : " pour Google Ads"}. Les totaux ci-dessus, eux, sont complets — ils
            viennent du niveau campagne.
          </>
        ) : deroulables === d.campaigns.length ? (
          <>
            Clique une campagne pour dérouler ses {groupWord}s et annonces — la liste scrolle
            à l&apos;intérieur du cadre.
          </>
        ) : (
          <>
            {deroulables} campagne{deroulables > 1 ? "s" : ""} sur {d.campaigns.length} se
            déplie{deroulables > 1 ? "nt" : ""} en {groupWord}s et annonces (▶) ; pour les
            autres, ce détail n&apos;a pas été récolté.
          </>
        )}
        {/* UN SEUL PIED, jamais deux : la phrase de l'écart rejoint celle du
            dépliage au lieu d'ouvrir un second paragraphe. */}
        {e && ` ${phraseEcart(e, disparues, trie, { ligne: "campagne", lignes: "campagnes" })}`}
      </p>
    </div>
    </>
  );
}

/** La cellule d'écart d'une ligne de DÉTAIL (adset, groupe, annonce) : il n'y en
 *  a pas. La référence est ventilée par campagne — descendre d'un cran
 *  demanderait de reparcourir la table du drill-down sur toute la fenêtre de
 *  référence, et la question posée à cette table est « quelle CAMPAGNE a bougé ».
 *  Le point reprend le signe déjà employé par la colonne « Campagne » pour dire
 *  « rien à ouvrir ici » ; une cellule vide se lirait comme une panne. */
function EcartSansDetail({ mot }: { mot: string }) {
  return (
    <span
      className="text-right px-2 text-faint/50 text-[10px]"
      title={`L'écart se lit au niveau de la campagne : la période de référence n'est pas ventilée par ${mot}.`}
    >
      ·
    </span>
  );
}

// ── LA COURBE DES ABONNÉS (Instagram) ────────────────────────────────────────
//
// Elle vit ICI et non dans `app/instagram/page.tsx` pour la raison déjà écrite
// dans la grammaire à propos de `couts-modules` et `hors-theme` : un module
// dessiné dans une page protégée par `middleware.ts` n'est vérifiable qu'en
// production. Une page compose, elle ne dessine pas.
//
// ELLE REJOINT LE STYLE COMMUN. C'était le dernier graphe fait main de l'app :
// un `viewBox` en `w-full` sans hauteur, donc tout à l'échelle de la largeur —
// exactement le défaut que `components/line-chart.tsx` a été écrit pour
// supprimer (texte à 4,5 px sur téléphone, 17 px sur écran). Il n'avait ni axe
// des dates, ni info-bulle, ni point survolable, et son échelle n'était écrite
// nulle part.
//
// UNE PARTICULARITÉ EMPÊCHAIT L'ALIGNEMENT COMPLET, et elle est réelle : le
// nombre d'abonnés est un CUMUL, pas un flux. Les autres courbes portent ce qui
// s'est passé CE jour-là (une dépense, des clics) et partent donc légitimement
// de zéro. Un stock qui va de 4 120 à 4 244 sur un axe partant de zéro est un
// trait plat : les 124 abonnés gagnés valent 3 % de la hauteur du cadre, et on
// ne verrait rien de la croissance qu'on vient lire.
//
// Plutôt que de forcer, `LineChart` gagne `socle="bas"` : l'axe part du point le
// plus bas, et ses DEUX bornes sont écrites aux coins. Le dégradé sous le
// trait reste (retour de David, TASK-033 : cette courbe le portait comme
// toutes les autres, l'exception qui le retirait n'avait plus lieu d'être). Le
// défaut reste « zéro » — aucune autre courbe ne bouge.
const MOIS_AXE = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function jourCourt(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS_AXE[d.getMonth()]}`;
}

export function CourbeAbonnes({ series }: { series: { date: string; followers: number }[] }) {
  if (series.length < 2) return null;
  const vals = series.map((p) => p.followers);
  const depart = vals[0];
  const gain = vals[vals.length - 1] - depart;
  // Le rang 3 du module est le GAIN, pas le stock : le stock est déjà dans la
  // tuile « Abonnés » au-dessus, et c'est la croissance que la courbe raconte.
  const s = sensPente(depart > 0 ? (gain / depart) * 100 : null, false, 0.5);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Croissance des abonnés{" "}
        <span className="normal-case tracking-normal font-normal">
          · {jourCourt(series[0].date)} → {jourCourt(series[series.length - 1].date)}
        </span>
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {gain >= 0 ? "+" : "−"}
          {fmtCHF(Math.abs(gain))}
          <span className="text-[15px] text-faint"> abonnés</span>
        </span>
        <span className="text-[11px] text-faint">sur la fenêtre relevée</span>
        {depart > 0 && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}
            style={{ background: s.fond }}
            title="Du premier au dernier relevé d'abonnés"
          >
            {s.plat ? (
              "≈ stable"
            ) : (
              <>
                <Triangle sens={s.monte ? "haut" : "bas"} /> {gain > 0 ? "+" : ""}
                {((gain / depart) * 100).toFixed(1)} %
              </>
            )}
          </span>
        )}
      </div>

      <LineChart
        labels={series.map((p) => jourCourt(p.date))}
        series={[{ name: "Abonnés", color: "#7b4fff", values: vals }]}
        fmt={fmtCHF}
        socle="bas"
        ariaLabel="Évolution du nombre d'abonnés"
      />

      <p className="text-[10.5px] text-faint leading-relaxed pt-3 mt-1 border-t border-line">
        Un nombre d&apos;abonnés est un cumul : l&apos;axe part de {fmtCHF(Math.min(...vals))}, pas
        de zéro — les deux bornes sont écrites sur le cadre. Sinon la croissance d&apos;un compte
        établi se lirait comme une ligne droite.
      </p>
    </div>
  );
}
