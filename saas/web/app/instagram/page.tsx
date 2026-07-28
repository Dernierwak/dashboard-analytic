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
import { SiteHeader } from "@/components/site-header";
import { DateRange } from "@/components/date-range";
import { PostLabelSelect } from "@/components/post-label-select";
import { ScrollList } from "@/components/scroll-list";

export const dynamic = "force-dynamic";

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function PeriodPillsInsta({ days }: { days: number }) {
  const opts = [
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
          href={o.v === 7 ? "/instagram" : `/instagram?d=${o.v}`}
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

function FollowersChart({ series }: { series: { date: string; followers: number }[] }) {
  if (series.length < 2) return null;
  const W = 640, H = 110, PAD = 6;
  const vals = series.map((p) => p.followers);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const x = (i: number) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.followers).toFixed(1)}`)
    .join(" ");
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Croissance des abonnés
        </div>
        <div className="text-[10.5px] text-faint">
          {fmtDate(series[0].date)} → {fmtDate(series[series.length - 1].date)}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution des abonnés">
        <path d={path} fill="none" stroke="#7b4fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].followers)} r="4" fill="#7b4fff" />
      </svg>
      <div className="flex justify-between text-[10.5px] text-faint font-mono mt-1">
        <span>{fmtCHF(series[0].followers)}</span>
        <span className="text-ink font-semibold">
          {fmtCHF(series[series.length - 1].followers)}
        </span>
      </div>
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
  const W = 640, H = 130, PAD = 8;
  const step = Math.max(1, Math.ceil(pts.length / 8));
  const cx = (i: number) => PAD + (pts.length === 1 ? (W - PAD * 2) / 2 : (i * (W - PAD * 2)) / (pts.length - 1));
  const cy = (v: number) => H - Math.max(v > 0 ? 2 : 0, (v / max) * (H - 12));
  const fmtV = (v: number) => (metric === "eng" ? v.toFixed(1) : fmtCHF(v));
  const dq = days === 7 ? "" : `d=${days}&`;
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Tes posts, un par un
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {INSTA_METRICS.map((m) => (
            <a
              key={m.key}
              href={`/instagram?${dq}${m.key === "reach" ? "" : `m=${m.key}`}`}
              className={`text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border ${
                metric === m.key
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:bg-black/[0.03] bg-white"
              }`}
            >
              {m.label}
            </a>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`${meta.label} par post`}>
        <polyline
          points={pts.map((p, i) => `${cx(i)},${cy(val(p))}`).join(" ")}
          fill="none"
          stroke="#7b4fff"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={cx(i)} cy={cy(val(p))} r={pts.length > 40 ? 1.8 : 3} fill="#7b4fff">
              <title>{`${fmtDate(p.date)} · ${p.type} — ${meta.label} ${fmtV(val(p))}${meta.unit} · « ${(p.caption || "").slice(0, 50)} »`}</title>
            </circle>
            {i % step === 0 && (
              <text x={cx(i)} y={H + 14} textAnchor="middle" fontSize="10" fill="#8b8e98">
                {fmtDate(p.date).slice(0, 6)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="text-[10.5px] text-faint mt-1 text-right">
        max {fmtV(max)}{meta.unit} · {pts.length} posts
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

  const engDiff =
    d.postsEng !== null && d.avgEng > 0 ? ((d.postsEng - d.avgEng) / d.avgEng) * 100 : null;
  const maxCell = Math.max(...d.heatmap.flat().map((c) => c.avgReach), 1);

  return (
    <main className="w-full px-4 sm:px-6 lg:px-10 py-8">
      <SiteHeader email={d.email} active="instagram" />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#7b4fff" }}>◎</span> Instagram.
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodPillsInsta days={d.days} />
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
              {d.followersDelta >= 0 ? "▲ +" : "▼ "}
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
      <FollowersChart series={d.followersSeries} />

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

      {/* ── ÉVOLUTION DES POSTS (métrique au choix) ── */}
      <PostsMetricChart posts={chartPosts} metric={metric} days={d.days} />

      {/* ── FORMATS ── */}
      {d.formats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Ce qui marche pour toi{" "}
            <span className="text-faint font-normal">· par format</span>
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
            {d.heatmapScope === "historique"
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
              {d.heatmapScope === "historique" ? " (tout l'historique)" : " (période filtrée)"}
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
          <ScrollList
            title="Performance par thème · posts labellisés"
            count={d.byLabel.length}
            maxH="max-h-[46vh]"
          >
            {d.byLabel.map((l) => (
              <div key={l.label} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[13px] font-semibold text-brand">{l.label}</span>
                <span className="text-[11.5px] text-faint">{l.count} post{l.count > 1 ? "s" : ""}</span>
                <span className="ml-auto font-mono text-[12.5px] text-muted">
                  {metricLabel(d.topMetric)} {fmtCHF(l.avgReach)}
                </span>
                <span className="font-mono text-[12.5px] text-muted w-24 text-right">
                  eng. {l.avgEng.toFixed(1)} %
                </span>
              </div>
            ))}
          </ScrollList>
        </div>
      )}

      {/* ── POSTS DE LA PÉRIODE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Posts de la période{" "}
        <span className="text-faint font-normal">· comparés à ton post moyen</span>
      </h2>
      {engDiff !== null && Math.abs(engDiff) >= 10 && (
        <p className={`text-[12px] font-semibold mb-3 ${engDiff > 0 ? "text-pos" : "text-warn"}`}>
          {engDiff > 0 ? "▲" : "▼"} Tes posts de la période engagent {engDiff > 0 ? "+" : ""}
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
