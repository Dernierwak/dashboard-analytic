// Blocs partagés des dashboards par canal (server components).
// Même base que les onglets Streamlit : hero + 7 KPIs (coûts « baisse = bon »),
// graphe journalier à métrique sélectionnable, campagnes avec statut et
// drill-down adset/groupe → annonce, vue Par thème.
import { fmtCHF } from "@/lib/report";
import { LineChart } from "@/components/line-chart";
import { Chiffre } from "@/components/chiffre";
import type { ChannelDash } from "@/lib/channels";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { SummaryStop } from "@/components/summary-stop";
import { Pente, Triangle, sensPente } from "@/components/pente";

function qs(base: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && v !== "" && !(k === "m" && v === "spend")) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

function keepFilters(d: ChannelDash): Record<string, string | undefined> {
  return {
    status: d.filters.status || undefined,
    camp: d.filters.camp || undefined,
    label: d.filters.label || undefined,
  };
}

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
          href={`${path}${qs({ d: o.v === 7 ? undefined : o.v, m: d.metric, ...keepFilters(d) })}`}
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
          grand
        />
        <Chiffre
          titre="Clics"
          valeur={fmtCHF(d.clicks)}
          delta={d.clicksDelta}
          serie={d.daily.map((p) => p.clicks)}
          grand
        />
        <Chiffre
          titre="CTR moyen"
          valeur={`${d.ctr.toFixed(2)}`}
          unite="%"
          delta={d.ctrDelta}
          serie={d.daily.map((p) => (p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0))}
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

// ── LA MOYENNE MENSUELLE ─────────────────────────────────────────────────────
//
// Le module qui manquait au-dessus des courbes, et qui existait déjà sur
// Instagram sous « Tes moyennes par post ». La forme est reprise telle quelle,
// avec la règle qu'elle porte, parce que c'est elle qui la rend honnête :
//
//   UNE MOYENNE POUR CE QUI EST UN TAUX, UN TOTAL POUR CE QUI S'ADDITIONNE.
//
// Un CTR moyen se lit ; une « dépense moyenne » entre deux dépenses n'a aucun
// sens — ce qu'on veut de la dépense, c'est ce qu'un mois coûte. La valeur du
// MOIS se fabrique donc différemment selon la nature du chiffre (somme des
// jours, ou taux du mois calculé sur ses totaux), et c'est seulement ENTRE les
// mois qu'on moyenne.
//
// LE MOIS EN COURS EST ÉCARTÉ, et c'est écrit à l'écran.
// Treize jours d'août pesés comme un mois plein tirent toute la moyenne vers le
// bas, et rien ne le dirait. C'est exactement la règle déjà en vigueur sur les
// deltas — « toute comparaison exclut le jour en cours, parce qu'il est
// incomplet » (docs/03-grammaire-des-modules.md) — appliquée d'un cran plus
// haut. Elle vaut aussi pour le PREMIER mois de la fenêtre : un mois qu'on
// n'observe qu'à partir du 12 est incomplet par l'autre bout.
//
// Le test est unique et ne connaît pas « aujourd'hui » : un mois compte s'il
// est ENTIÈREMENT couvert par la fenêtre affichée. Le mois en cours l'échoue
// mécaniquement, sans qu'on ait à le nommer.

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

export type ChiffreMensuel = {
  titre: string;
  unite?: string;
  /** `somme` = la valeur du mois est un total · `taux` = c'est un rapport. */
  nature: "somme" | "taux";
  /** Une valeur par mois complet. `null` quand le mois n'a rien à mesurer —
   *  un CTR sans impression n'est pas 0 %, il est indéfini, et le compter
   *  comme un zéro ferait baisser la moyenne d'un mois sans campagne. */
  parMois: (number | null)[];
  fmt: (v: number) => string;
};

function moyenne(xs: (number | null)[]): { v: number; n: number } | null {
  const reels = xs.filter((x): x is number => x !== null && isFinite(x));
  if (reels.length === 0) return null;
  return { v: reels.reduce((a, b) => a + b, 0) / reels.length, n: reels.length };
}

export function MoyenneMensuelle({
  titre,
  chiffres,
  mois,
  tete = 0,
  elargir,
}: {
  titre: string;
  chiffres: ChiffreMensuel[];
  /** Tous les mois de la fenêtre, complets ou non — le module fait le tri. */
  mois: { cle: string; nom: string; complet: boolean }[];
  /** Lequel des chiffres porte le rang 3. Les autres forment le bilan. */
  tete?: number;
  /** Où aller chercher plus de mois quand la fenêtre est trop courte. */
  elargir?: { href: string; texte: string };
}) {
  const complets = mois.filter((m) => m.complet);
  const ecartes = mois.filter((m) => !m.complet);
  const n = complets.length;
  // Le nom du mois ouvre la phrase : « septembre 2026 est écarté » commençait
  // en minuscule au milieu d'un pied par ailleurs rédigé.
  const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const phraseEcartes =
    ecartes.length === 0
      ? null
      : ecartes.length === 1
        ? `${maj(ecartes[0].nom)} est écarté : la période ne le couvre pas en entier.`
        : `${ecartes.length} mois sont écartés (${ecartes
            .map((m) => m.nom)
            .join(", ")}) : la période ne les couvre pas en entier.`;

  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        {titre}{" "}
        <span className="text-faint font-normal">
          {n === 0
            ? "· aucun mois complet dans la période"
            : n === 1
              ? `· un seul mois complet · ${complets[0].nom}`
              : `· ${n} mois complets · ${complets[0].nom} → ${complets[n - 1].nom}`}
        </span>
      </h2>

      <div className="bg-white border border-line rounded-xl shadow-card p-5">
        {n === 0 ? (
          // Un vide se dit en toutes lettres, et il dit quoi faire. Zéro serait
          // un chiffre faux : ce n'est pas « la moyenne vaut 0 », c'est « il
          // n'y a pas encore de mois à moyenner ».
          <p className="text-[12.5px] text-muted leading-relaxed">
            Aucun mois n&apos;est couvert du 1<sup>er</sup> au dernier jour par la période
            affichée — il n&apos;y a donc pas de moyenne mensuelle à calculer.
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
              const t = chiffres[Math.min(tete, chiffres.length - 1)];
              const m = moyenne(t.parMois);
              return (
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
                    {m ? t.fmt(m.v) : "—"}
                    {t.unite && <span className="text-[15px] text-faint"> {t.unite}</span>}
                  </span>
                  <span className="text-[11px] text-faint">
                    de {t.titre.toLowerCase()} par mois, en moyenne
                    {t.nature === "somme" ? " · le mois est un total" : " · le mois est un taux"}
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
                  {chiffres.map((c, i) =>
                    i === Math.min(tete, chiffres.length - 1) ? null : (
                      <div key={c.titre} className="shrink-0">
                        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
                          {c.titre}
                        </div>
                        <div className="font-mono text-[19px] leading-tight text-ink mt-0.5">
                          {(() => {
                            const m = moyenne(c.parMois);
                            return m ? c.fmt(m.v) : "—";
                          })()}
                          {c.unite && <span className="text-[11px] text-faint"> {c.unite}</span>}
                        </div>
                        <div className="text-[10px] text-faint mt-0.5">
                          {c.nature === "somme" ? "total du mois" : "taux du mois"}
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
            moyenne honnête : sa fenêtre, et ce qu'on en a retiré. */}
        <p className="text-[10.5px] text-faint leading-relaxed mt-3">
          {n === 1
            ? `Un seul mois entier dans la période (${complets[0].nom}) : ce n'est pas encore une moyenne, c'est ce mois-là.`
            : n > 1
              ? `Moyenne des ${n} mois entièrement couverts par la période affichée, de ${complets[0].nom} à ${complets[n - 1].nom}.`
              : ""}{" "}
          {phraseEcartes}
          {phraseEcartes && " Un mois en cours compté comme un mois plein tirerait la moyenne vers le bas sans qu'on le voie."}
        </p>
      </div>
    </div>
  );
}

// La moyenne mensuelle des dashboards publicitaires (Meta, Google, et toute
// régie qui suivra). Elle lit la MÊME série journalière que la courbe posée
// juste dessous, donc la même fenêtre : c'est ce qui permet de les lire l'une
// après l'autre sans se demander de quoi on parle.
export function MoyenneMensuelleAds({ d, path }: { d: ChannelDash; path: string }) {
  if (d.daily.length === 0) return null;
  const couverture = { debut: d.daily[0].date, fin: d.daily[d.daily.length - 1].date };
  const mois = moisDeLaPeriode(d.daily, couverture);
  const complets = mois.filter((m) => m.complet);

  const som = (pts: typeof d.daily, f: (p: (typeof d.daily)[0]) => number) =>
    pts.reduce((a, p) => a + f(p), 0);

  const chiffres: ChiffreMensuel[] = [
    {
      titre: "Dépense", unite: "CHF", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.spend)),
    },
    {
      titre: "Clics", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.clicks)),
    },
    {
      titre: "Impressions", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.impressions)),
    },
    {
      titre: "CTR", unite: "%", nature: "taux", fmt: (v) => v.toFixed(2),
      // Le taux du mois se calcule sur les TOTAUX du mois, jamais en moyennant
      // trente taux quotidiens : un dimanche à 12 impressions pèserait autant
      // qu'un mardi à 4 000.
      parMois: complets.map((m) => {
        const i = som(m.pts, (p) => p.impressions);
        return i > 0 ? (som(m.pts, (p) => p.clicks) / i) * 100 : null;
      }),
    },
    {
      titre: "CPC", unite: "CHF", nature: "taux", fmt: (v) => v.toFixed(2),
      parMois: complets.map((m) => {
        const c = som(m.pts, (p) => p.clicks);
        return c > 0 ? som(m.pts, (p) => p.spend) / c : null;
      }),
    },
  ];

  // La tête suit la métrique choisie SOUS la courbe : le sélecteur pilote les
  // deux modules à la fois, et il reste en bas des deux (rang 8).
  const ordre = ["spend", "clicks", "impressions", "ctr", "cpc"];
  const tete = Math.max(0, ordre.indexOf(d.metric));

  return (
    <MoyenneMensuelle
      titre="Tes moyennes par mois"
      chiffres={chiffres}
      mois={mois}
      tete={tete}
      elargir={{
        href: `${path}${qs({ d: 0, m: d.metric, ...keepFilters(d) })}`,
        texte: "Passe la période sur « Tout »",
      }}
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
            href={`${path}${qs({ d: d.days === 7 ? undefined : d.days, m: m.key, ...keepFilters(d) })}`}
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

export function ByLabelTable({ d }: { d: ChannelDash }) {
  if (d.byLabel.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par thème{" "}
        <span className="text-faint font-normal">· période filtrée · {d.periodLabel}</span>
      </h2>
      {/* Règle maison : une liste longue scrolle DANS sa boîte, jamais la page. */}
      <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
        <div className="max-h-[46vh] overflow-y-auto min-w-[480px]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className="text-left font-semibold px-5 py-3 sticky top-0 bg-white z-10 border-b border-line">Thème</th>
              <th className="text-right font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">Dépensé</th>
              <th className="text-right font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">Clics</th>
              <th className="text-right font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">CTR</th>
              <th className="text-right font-semibold px-5 py-3 sticky top-0 bg-white z-10 border-b border-line">CPC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {d.byLabel.map((l) => (
              <tr key={l.label}>
                <td className="px-5 py-3 font-semibold text-brand">{l.label}</td>
                <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.spend)} CHF</td>
                <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.clicks)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{l.ctr.toFixed(2)} %</td>
                <td className="px-5 py-3 text-right font-mono text-muted">
                  {l.cpc > 0 ? l.cpc.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
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
// C'est la correction du « on ne peut plus déplier les campagnes Google ». Le
// dépliage se nourrit d'une table dédiée, `google_ads_ad_insights`, alimentée
// autrefois par le passage Streamlit et qui ne l'est plus depuis que la récolte
// est autonome (`saas/worker/fetch_all.py`, `_fetch_google`, ne demande que le
// niveau CAMPAGNE ; Meta, lui, récolte au niveau annonce et sert les deux). La
// vraie réparation est dans le worker, hors de ce périmètre.
//
// Ce qui est réparable ICI, et qui est la moitié visible du défaut : la ligne
// restait un `<details>` avec son curseur de main et son fond au survol, on
// cliquait, elle s'ouvrait — SUR RIEN. Un pied écrivait même « clique une
// campagne pour dérouler ses groupes ». On promettait un geste qui ne pouvait
// pas aboutir, et le silence se lisait comme une panne d'interface.
// Sans détail, la ligne redevient une ligne, et le pied DIT pourquoi.
export function CampaignTable({
  d,
  channel,
}: {
  d: ChannelDash;
  channel: "meta" | "google";
}) {
  if (d.campaigns.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
        <p className="text-[13px] text-muted">Aucune campagne sur la période (ou filtre trop strict).</p>
      </div>
    );
  }
  const isMeta = channel === "meta";
  // Combien de campagnes ont réellement un détail à ouvrir. Zéro sur Google
  // tant que `google_ads_ad_insights` n'est pas alimentée — voir le commentaire
  // au-dessus du composant.
  const deroulables = d.campaigns.filter((c) => c.adsets.length > 0).length;
  const grid = isMeta
    ? "minmax(220px,2.4fr) 150px 90px 90px 80px 70px 70px 70px 100px"
    : "minmax(220px,2.4fr) 150px 90px 80px 70px 70px 70px 100px";
  const groupWord = isMeta ? "adset" : "groupe";

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
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <div className="min-w-[820px] max-h-[440px] overflow-y-auto">
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
        </div>

        <div className="divide-y divide-line">
          {d.campaigns.map((c) => {
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
      </p>
    </div>
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
// plus bas, ses DEUX bornes sont écrites aux coins, et l'aplat sous le trait
// disparaît. Le défaut reste « zéro » — aucune autre courbe ne bouge.
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
