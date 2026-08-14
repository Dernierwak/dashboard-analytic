// Dashboard Instagram organique — même base que l'onglet Streamlit :
// Ta page (abonnés, courbe, croissance 30 j) · Tes moyennes par post ·
// Tes formats · Quand publier ? (jour × créneau) · Top 3 posts ·
// Posts de la période vs ton post moyen · Par label · Vue globale.
import {
  getInstaDash,
  INSTA_DAYS,
  INSTA_SLOTS,
  type DashParams,
  type InstaPost,
} from "@/lib/channels";
import { fmtCHF } from "@/lib/report";
import { DateRange } from "@/components/date-range";
import { PostLabelSelect } from "@/components/post-label-select";
import { ScrollList } from "@/components/scroll-list";
import { LineChart } from "@/components/line-chart";
import {
  CourbeAbonnes,
  MoyenneMensuelle,
  moisDeLaPeriode,
  type ChiffreMensuel,
} from "@/components/channel-dash";

import { getCompteActif } from "@/lib/account";
import { Triangle, sensPente } from "@/components/pente";

export const dynamic = "force-dynamic";

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

// Changer de période ne doit pas effacer les autres réglages : la métrique
// suivie et le tri des tables survivent au clic. Seule la période sur mesure
// disparaît — c'est justement ce qu'on remplace.
function PeriodPillsInsta({
  days,
  metric,
  sort,
}: {
  days: number;
  metric: string;
  sort: string;
}) {
  const opts = [
    { v: 7, label: "7 j" },
    { v: 14, label: "14 j" },
    { v: 30, label: "30 j" },
    { v: 90, label: "90 j" },
    { v: 0, label: "Tout" },
  ];
  const lien = (v: number) => {
    const q = new URLSearchParams();
    if (v !== 7) q.set("d", String(v));
    if (metric !== "reach") q.set("m", metric);
    if (sort !== "date") q.set("s", sort);
    const s = q.toString();
    return s ? `/instagram?${s}` : "/instagram";
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {opts.map((o) => (
        <a
          key={o.v}
          href={lien(o.v)}
          className={`text-[11.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            days === o.v
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

const INSTA_METRICS: { key: string; label: string; unit: string }[] = [
  { key: "reach", label: "Portée", unit: "" },
  { key: "views", label: "Vues", unit: "" },
  { key: "likes", label: "J'aime", unit: "" },
  { key: "comments", label: "Comm.", unit: "" },
  { key: "saved", label: "Enreg.", unit: "" },
  { key: "eng", label: "Engagement", unit: "%" },
];

// Évolution de tes posts — un bar par post, métrique au choix (comme Meta/Google).
function PostsMetricChart({
  posts,
  metric,
  days,
}: {
  posts: InstaPost[];
  metric: string;
  days: number;
}) {
  const pts = [...posts].reverse(); // plus ancien → plus récent
  if (pts.length < 2) return null;
  const meta = INSTA_METRICS.find((m) => m.key === metric) ?? INSTA_METRICS[0];
  const val = (p: InstaPost): number =>
    metric === "views" ? p.views
    : metric === "likes" ? p.likes
    : metric === "comments" ? p.comments
    : metric === "saved" ? p.saved
    : metric === "eng" ? p.eng
    : p.reach;
  const vals = pts.map(val);
  const max = Math.max(...vals, 0.001);
  const fmtV = (v: number) => (metric === "eng" ? v.toFixed(1) : fmtCHF(v));
  const dq = days === 7 ? "" : `d=${days}&`;

  // Ce module ouvrait sur un surtitre et une rangée de boutons, puis un graphe :
  // aucun chiffre avant sa forme, et le sélecteur au-dessus de ce qu'il pilote.
  // Deux écarts à la grammaire (docs/03-grammaire-des-modules.md, rangs 3 et 8),
  // et surtout deux fois la MÊME question posée différemment de Meta et Google.
  // Il suit maintenant exactement la forme de `MetricChart`.
  const taux = metric === "eng";
  const valeur = taux
    ? vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.filter((v) => v > 0).length)
    : vals.reduce((a, b) => a + b, 0);

  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const mi = Math.floor(vals.length / 2);
  const av = moy(vals.slice(0, mi));
  const ap = moy(vals.slice(mi));
  const ec = av > 0 ? ((ap - av) / av) * 100 : null;
  const sp = sensPente(ec, false, 8);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Tes posts, un par un <span className="text-ink">· {meta.label}</span>
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtV(valeur)}
          <span className="text-[15px] text-faint"> {meta.unit}</span>
        </span>
        <span className="text-[11px] text-faint">{taux ? "en moyenne" : "au total"}</span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sp.cls}`}
          style={{ background: sp.fond }}
          title="Seconde moitié de la période comparée à la première"
        >
          {sp.plat ? (
            "≈ stable"
          ) : (
            <>
              <Triangle sens={sp.monte ? "haut" : "bas"} /> {ec! > 0 ? "+" : ""}
              {Math.round(ec!)} % sur la période
            </>
          )}
        </span>
      </div>

      <LineChart
        labels={pts.map((p) => fmtDate(p.date).slice(0, 6))}
        series={[{ name: meta.label, color: "#7b4fff", values: pts.map(val) }]}
        fmt={fmtV}
        unit={meta.unit}
        ariaLabel={`${meta.label} par post`}
      />

      {/* Le sélecteur passe SOUS le graphe, comme sur Meta et Google : il pilote
          ce module, il ne le précède pas. */}
      <div className="flex items-center gap-1 overflow-x-auto pt-3 mt-1 border-t border-line">
        {INSTA_METRICS.map((m) => (
          <a
            key={m.key}
            href={`/instagram?${dq}${m.key === "reach" ? "" : `m=${m.key}`}`}
            className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${
              metric === m.key
                ? "bg-ink text-white border-ink"
                : "border-line text-muted hover:bg-black/[0.03] bg-white"
            }`}
          >
            {m.label}
          </a>
        ))}
        <span className="ml-auto shrink-0 text-[10.5px] text-faint pl-3">
          max {fmtV(max)}{meta.unit} · {pts.length} posts
        </span>
      </div>
    </div>
  );
}

// Tri des posts par métrique : clique un en-tête de colonne.
const SORTS: { key: string; label: string }[] = [
  { key: "date", label: "Post" },
  { key: "reach", label: "Portée" },
  { key: "views", label: "Vues" },
  { key: "likes", label: "J'aime" },
  { key: "comments", label: "Comm." },
  { key: "saved", label: "Enreg." },
  { key: "eng", label: "Engagement" },
];

function sortPosts(posts: InstaPost[], sort: string): InstaPost[] {
  if (sort === "date") return posts; // déjà du plus récent au plus ancien
  const val = (p: InstaPost): number =>
    sort === "views" ? p.views
    : sort === "likes" ? p.likes
    : sort === "comments" ? p.comments
    : sort === "saved" ? p.saved
    : sort === "eng" ? p.eng
    : p.reach;
  return [...posts].sort((a, b) => val(b) - val(a));
}

function PostsTable({
  posts,
  histReach,
  sort,
  baseQs,
  labels,
}: {
  posts: InstaPost[];
  histReach: number;
  sort: string;
  baseQs: string;
  labels: string[];
}) {
  const th = (s: { key: string; label: string }, align: string, px: string) => (
    <th
      key={s.key}
      className={`${align} font-semibold ${px} py-3 sticky top-0 bg-white z-10 border-b border-line`}
    >
      <a
        href={`/instagram?${baseQs}${s.key === "date" ? "" : `&s=${s.key}`}`}
        className={sort === s.key ? "text-ink" : "hover:text-muted"}
        title={s.key === "date" ? "Trier par date" : `Trier par ${s.label}`}
      >
        {s.label}
        {sort === s.key && s.key !== "date" && " ↓"}
      </a>
    </th>
  );
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <div className="max-h-[440px] overflow-y-auto min-w-[680px]">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            {th(SORTS[0], "text-left", "px-5")}
            <th className="text-left font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">Thème</th>
            <th className="text-left font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">Format</th>
            {th(SORTS[1], "text-right", "px-2")}
            {th(SORTS[2], "text-right", "px-2")}
            {th(SORTS[3], "text-right", "px-2")}
            {th(SORTS[4], "text-right", "px-2")}
            {th(SORTS[5], "text-right", "px-2")}
            {th(SORTS[6], "text-right", "px-5")}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {posts.map((p, i) => {
            const above = histReach > 0 && p.reach >= histReach;
            return (
              <tr key={i}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.mediaUrl}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-black/[0.04] border border-line shrink-0" />
                    )}
                    <div>
                      <div className="text-ink font-medium leading-snug max-w-[220px] truncate">
                        {p.caption || "(sans légende)"}
                      </div>
                      <div className="text-[10.5px] text-faint mt-0.5">{fmtDate(p.date)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <PostLabelSelect
                    postId={p.id}
                    current={p.labels[0] ?? null}
                    labels={labels}
                    source={p.labelSource}
                  />
                </td>
                <td className="px-2 py-3 text-muted">{p.type}</td>
                <td className="px-2 py-3 text-right font-mono">
                  <span className={above ? "text-pos font-semibold" : "text-ink"}>
                    {fmtCHF(p.reach)}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-mono text-muted">
                  {p.views > 0 ? fmtCHF(p.views) : "—"}
                </td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.likes)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.comments)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.saved)}</td>
                <td className="px-5 py-3 text-right font-mono text-ink">{p.eng.toFixed(1)} %</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// LA MOYENNE MENSUELLE D'INSTAGRAM.
//
// Même module, même règle et même composant que Meta et Google — c'est le but :
// trois pages canal qui posent la même question doivent la poser de la même
// façon. Ce qui change, c'est l'unité observée : là-bas des jours de dépense,
// ici des publications.
//
// Elle ne remplace pas « Tes moyennes par post », qui répond à autre chose : ce
// que vaut UNE publication. Celle-ci répond au RYTHME — ce qu'un mois produit.
// Deux dénominateurs, deux questions, et chacun porte le sien à l'écran.
//
// La fenêtre court du premier post relevé au dernier jour PLEIN (hier). Le mois
// du premier post est donc écarté comme le mois en cours : on ne l'observe que
// depuis le 12, et un mois vu aux deux tiers pèserait comme un mois entier.
function moyenneMensuelleInsta(posts: InstaPost[]) {
  if (posts.length === 0) return null;
  const dates = posts.map((p) => String(p.date).slice(0, 10)).sort();
  const hier = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const mois = moisDeLaPeriode(
    posts.map((p) => ({ ...p, date: String(p.date).slice(0, 10) })),
    { debut: dates[0], fin: hier }
  );
  const complets = mois.filter((m) => m.complet);
  const som = (ps: InstaPost[], f: (p: InstaPost) => number) => ps.reduce((a, p) => a + f(p), 0);

  const chiffres: ChiffreMensuel[] = [
    {
      titre: "Publications", nature: "somme", fmt: (v) => v.toFixed(1),
      parMois: complets.map((m) => m.pts.length),
    },
    {
      titre: "Portée", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.reach)),
    },
    {
      titre: "J'aime", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.likes)),
    },
    {
      titre: "Enregistrements", nature: "somme", fmt: fmtCHF,
      parMois: complets.map((m) => som(m.pts, (p) => p.saved)),
    },
    {
      titre: "Engagement", unite: "%", nature: "taux", fmt: (v) => v.toFixed(1),
      // Le taux du mois se calcule sur les totaux du mois : moyenner les
      // engagements de chaque post donnerait le même poids à un post vu par
      // 40 personnes et à un reel vu par 12 000.
      parMois: complets.map((m) => {
        const r = som(m.pts, (p) => p.reach);
        return r > 0
          ? (som(m.pts, (p) => p.likes + p.comments + p.saved) / r) * 100
          : null;
      }),
    },
  ];
  return { mois, chiffres };
}

// Le libellé de la métrique qui pilote la page — évite d'écrire « portée » en
// dur alors que l'utilisateur a filtré sur les vues.
function metricLabel(key: string): string {
  return (INSTA_METRICS.find((m) => m.key === key) ?? INSTA_METRICS[0]).label.toLowerCase();
}

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getInstaDash(searchParams);
  const compte = await getCompteActif();
  const metric = ["reach", "views", "likes", "comments", "saved", "eng"].includes(
    searchParams?.m ?? ""
  )
    ? (searchParams!.m as string)
    : "reach";
  // Graphe : posts de la fenêtre, sinon les 20 derniers (pour toujours voir la tendance)
  const chartPosts = d.posts.length >= 2 ? d.posts : d.allPosts.slice(0, 20);

  // Tri des tables (?s=) + query de base pour les liens d'en-tête
  const sort = ["date", "reach", "views", "likes", "comments", "saved", "eng"].includes(
    searchParams?.s ?? ""
  )
    ? (searchParams!.s as string)
    : "date";
  const qsParts: string[] = [];
  if (d.days !== 7 && !searchParams?.from) qsParts.push(`d=${d.days}`);
  if (searchParams?.from && searchParams?.to)
    qsParts.push(`from=${searchParams.from}`, `to=${searchParams.to}`);
  if (metric !== "reach") qsParts.push(`m=${metric}`);
  const baseQs = qsParts.join("&");
  const sortedPosts = sortPosts(d.posts, sort);
  const sortedAll = sortPosts(d.allPosts, sort);

  // Le rythme mensuel se lit sur TOUT l'historique, pas sur la période filtrée :
  // une moyenne mensuelle calculée sur sept jours n'aurait aucun mois complet.
  const mensuel = moyenneMensuelleInsta(d.allPosts);

  const engDiff =
    d.postsEng !== null && d.avgEng > 0 ? ((d.postsEng - d.avgEng) / d.avgEng) * 100 : null;
  const maxCell = Math.max(...d.heatmap.flat().map((c) => c.avgReach), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#7b4fff" }}>◎</span> Instagram.
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodPillsInsta days={d.days} metric={metric} sort={sort} />
            <DateRange from={searchParams?.from} to={searchParams?.to} />
          </div>
        </div>
      </div>

      {/* ── TA PAGE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">Ta page</h2>
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Abonnés
          </div>
          <div className="font-mono text-xl font-medium text-ink">{fmtCHF(d.followers)}</div>
          {d.followersDelta !== null && (
            <div
              className={`text-[11px] font-semibold mt-1.5 ${
                d.followersDelta >= 0 ? "text-pos" : "text-neg"
              }`}
            >
              <Triangle sens={d.followersDelta >= 0 ? "haut" : "bas"} />{" "}
              {d.followersDelta >= 0 ? "+" : "−"}
              {fmtCHF(Math.abs(d.followersDelta))}{" "}
              <span className="text-faint font-normal">sur la période</span>
            </div>
          )}
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Croissance 30 j
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {d.growth30 !== null ? `${d.growth30 >= 0 ? "+" : ""}${fmtCHF(d.growth30)}` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">nouveaux abonnés</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Engagement du compte
          </div>
          <div className="font-mono text-xl font-medium text-ink">{d.avgEng.toFixed(1)} %</div>
          <div className="text-[11px] text-faint mt-1">
            portée moyenne {fmtCHF(d.histReach)} / post
          </div>
        </div>
      </div>
      <CourbeAbonnes series={d.followersSeries} />

      {/* ── TES MOYENNES PAR POST ── */}
      <div className="mb-8">
        <h2 className="text-[14px] font-semibold text-ink mb-3">
          Tes moyennes par post{" "}
          <span className="text-faint font-normal">· tout l&apos;historique ({d.allPosts.length} posts)</span>
        </h2>
        <div className="bg-white border border-line rounded-xl shadow-card px-5 py-4 flex items-center gap-6 overflow-x-auto sm:flex-wrap">
          {[
            { label: "Portée", v: fmtCHF(d.histReach) },
            { label: "Vues", v: d.avgViews > 0 ? fmtCHF(d.avgViews) : "—" },
            { label: "J'aime", v: fmtCHF(d.avgLikes) },
            { label: "Commentaires", v: d.avgComments.toFixed(1) },
            { label: "Enregistrements", v: d.avgSaved.toFixed(1) },
            { label: "Engagement", v: `${d.avgEng.toFixed(1)} %` },
          ].map((k) => (
            <div key={k.label}>
              <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
                {k.label}
              </div>
              <div className="font-mono text-[15px] text-ink mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TES MOYENNES PAR MOIS — le rythme, avant la forme ── */}
      {mensuel && (
        <MoyenneMensuelle
          titre="Tes moyennes par mois"
          chiffres={mensuel.chiffres}
          mois={mensuel.mois}
        />
      )}

      {/* ── ÉVOLUTION DES POSTS (métrique au choix) ── */}
      <PostsMetricChart posts={chartPosts} metric={metric} days={d.days} />

      {/* ── FORMATS ── */}
      {d.formats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Ce qui marche pour toi{" "}
            <span className="text-faint font-normal">
              · par format
              {d.scope === "historique" ? " (tout l'historique)" : " (période filtrée)"}
            </span>
          </h2>
          <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
            {d.formats.map((f, i) => (
              <div key={f.type} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                <span className="text-[13px] font-semibold text-ink w-24">{f.type}</span>
                <span className="text-[11.5px] text-faint">
                  {f.count} post{f.count > 1 ? "s" : ""}
                </span>
                <span className="ml-auto font-mono text-[12.5px] text-muted">
                  {metricLabel(d.topMetric)} {fmtCHF(f.avgReach)}
                </span>
                <span className="font-mono text-[12.5px] text-muted w-24 text-right">
                  eng. {f.avgEng.toFixed(1)} %
                </span>
                {i === 0 && (
                  <span className="text-[10px] font-bold text-pos bg-pos/10 rounded-full px-2 py-0.5">
                    ton meilleur
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── QUAND PUBLIER ? ── */}
      <div className="mb-8">
        <h2 className="text-[14px] font-semibold text-ink mb-3">
          Quand publier ?{" "}
          <span className="text-faint font-normal">
            · {metricLabel(d.topMetric)} moyenne par jour et créneau
            {d.scope === "historique"
              ? " (période trop vide → tout l'historique)"
              : " (période filtrée)"}
          </span>
        </h2>
        <div className="bg-white border border-line rounded-xl shadow-card p-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[11px]">
            <thead>
              <tr>
                <th className="w-12"></th>
                {INSTA_SLOTS.map((s) => (
                  <th key={s} className="text-center font-semibold text-faint pb-2">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INSTA_DAYS.map((day, di) => (
                <tr key={day}>
                  <td className="font-semibold text-muted pr-2 py-0.5">{day}</td>
                  {INSTA_SLOTS.map((_, si) => {
                    const c = d.heatmap[di][si];
                    const isBest = d.bestSlot?.day === di && d.bestSlot?.slot === si;
                    const intensity = c.count > 0 ? 0.12 + 0.55 * (c.avgReach / maxCell) : 0;
                    return (
                      <td key={si} className="p-0.5">
                        <div
                          className={`rounded-md text-center py-1.5 font-mono ${
                            isBest ? "ring-2 ring-pos" : ""
                          } ${c.count > 0 ? "text-ink" : "text-faint/50"}`}
                          style={{ background: c.count > 0 ? `rgba(123,79,255,${intensity})` : "rgba(14,15,18,0.02)" }}
                          title={c.count > 0 ? `${c.count} post(s) · ${metricLabel(d.topMetric)} moyenne ${fmtCHF(c.avgReach)}` : "aucun post"}
                        >
                          {c.count > 0 ? fmtCHF(c.avgReach) : "·"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {d.bestSlot && (
            <p className="text-[11.5px] text-muted mt-3">
              Ton meilleur créneau :{" "}
              <strong className="text-ink">
                {["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][d.bestSlot.day]}{" "}
                {INSTA_SLOTS[d.bestSlot.slot]}
              </strong>{" "}
              — {fmtCHF(d.bestSlot.avgReach)} de {metricLabel(d.topMetric)} en moyenne sur {d.bestSlot.count} posts.
              Publie quand TON audience est active, pas selon les « meilleures heures » génériques.
            </p>
          )}
        </div>
      </div>

      {/* ── TOP 3 POSTS — grandes images, scroll horizontal si besoin ── */}
      {d.topPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Top 3 posts{" "}
            <span className="text-faint font-normal">
              · par {(INSTA_METRICS.find((m) => m.key === d.topMetric) ?? INSTA_METRICS[0]).label.toLowerCase()}
              {d.scope === "historique" ? " (tout l'historique)" : " (période filtrée)"}
            </span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {d.topPosts.map((p, i) => (
              <div
                key={i}
                className="bg-white border border-line rounded-xl shadow-card overflow-hidden shrink-0 w-[260px] sm:w-[300px]"
              >
                {p.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaUrl} alt="" className="w-full h-52 object-cover" />
                ) : (
                  <div className="w-full h-52 bg-black/[0.04]" />
                )}
                <div className="p-4">
                  <div className="font-mono text-[11px] text-faint mb-1">
                    n°{i + 1} · {p.type} · {fmtDate(p.date)}
                  </div>
                  <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2 mb-2.5">
                    {p.caption || "(sans légende)"}
                  </div>
                  {/* On montre d'abord la métrique sur laquelle ce top est classé */}
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="font-mono text-ink font-semibold">
                      {d.topMetric === "eng"
                        ? `${p.eng.toFixed(1)} % eng.`
                        : `${fmtCHF(
                            d.topMetric === "views" ? p.views
                            : d.topMetric === "likes" ? p.likes
                            : d.topMetric === "comments" ? p.comments
                            : d.topMetric === "saved" ? p.saved
                            : p.reach
                          )} ${(INSTA_METRICS.find((m) => m.key === d.topMetric) ?? INSTA_METRICS[0]).label.toLowerCase()}`}
                    </span>
                    <span className="font-mono text-muted">
                      {d.topMetric === "reach"
                        ? `${p.eng.toFixed(1)} % eng.`
                        : `${fmtCHF(p.reach)} portée`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PAR LABEL ── */}
      {d.byLabel.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Performance par thème{" "}
            <span className="text-faint font-normal">
              · moyennes par post · triée par {metricLabel(d.topMetric)}
              {d.scope === "historique" ? " · tout l'historique" : " · période filtrée"}
            </span>
          </h2>
          <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
            <div className="max-h-[46vh] overflow-y-auto min-w-[640px]">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-faint">
                    {["Thème", "Posts", "Portée", "Vues", "J'aime", "Comm.", "Enreg.", "Eng."].map((h, hi) => (
                      <th
                        key={h}
                        className={`${hi === 0 ? "text-left px-5" : "text-right px-2"} ${hi === 7 ? "pr-5" : ""} font-semibold py-3 sticky top-0 bg-white z-10 border-b border-line`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.byLabel.map((l) => (
                    <tr key={l.label}>
                      <td className="px-5 py-3 font-semibold text-brand">{l.label}</td>
                      <td className="px-2 py-3 text-right font-mono text-muted">{l.count}</td>
                      <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.mReach)}</td>
                      <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(l.mViews)}</td>
                      <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mLikes)}</td>
                      <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mComments)}</td>
                      <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(l.mSaved)}</td>
                      <td className="px-2 pr-5 py-3 text-right font-mono text-ink">{l.avgEng.toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── POSTS DE LA PÉRIODE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Posts de la période{" "}
        <span className="text-faint font-normal">· comparés à ton post moyen</span>
      </h2>
      {engDiff !== null && Math.abs(engDiff) >= 10 && (
        <p className={`text-[12px] font-semibold mb-3 ${engDiff > 0 ? "text-pos" : "text-warn"}`}>
          <Triangle sens={engDiff > 0 ? "haut" : "bas"} /> Tes posts de la période engagent{" "}
          {engDiff > 0 ? "+" : ""}
          {engDiff.toFixed(0)} % vs ton habitude ({d.postsEng!.toFixed(1)} % contre{" "}
          {d.avgEng.toFixed(1)} %).
        </p>
      )}
      {d.posts.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center mb-4">
          <p className="text-[13px] text-muted">
            Aucun post sur la période — ton compte porte d&apos;habitude à{" "}
            {fmtCHF(d.histReach)} par post.
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <PostsTable posts={sortedPosts} histReach={d.histReach} sort={sort} baseQs={baseQs} labels={d.labels} />
        </div>
      )}

      {/* ── VUE GLOBALE ── */}
      <details className="mb-4">
        <summary className="text-[12.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
          ▸ Vue globale — tous tes posts ({d.allPosts.length})
        </summary>
        <div className="mt-3">
          <PostsTable posts={sortedAll} histReach={d.histReach} sort={sort} baseQs={baseQs} labels={d.labels} />
        </div>
      </details>

      <p className="text-[11.5px] text-faint leading-relaxed">
        Portée en vert = au-dessus de ton post moyen ({fmtCHF(d.histReach)}). Engagement =
        (j&apos;aime + commentaires + enregistrements) / portée.
      </p>
    </main>
  );
}
