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

function PostsTable({ posts, histReach }: { posts: InstaPost[]; histReach: number }) {
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <table className="w-full min-w-[680px] text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="text-left font-semibold px-5 py-3">Post</th>
            <th className="text-left font-semibold px-2 py-3">Format</th>
            <th className="text-right font-semibold px-2 py-3">Portée</th>
            <th className="text-right font-semibold px-2 py-3">Vues</th>
            <th className="text-right font-semibold px-2 py-3">J&apos;aime</th>
            <th className="text-right font-semibold px-2 py-3">Comm.</th>
            <th className="text-right font-semibold px-2 py-3">Enreg.</th>
            <th className="text-right font-semibold px-5 py-3">Engagement</th>
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
                      <div className="text-[10.5px] text-faint mt-0.5">
                        {fmtDate(p.date)}
                        {p.labels.length > 0 && (
                          <span className="text-brand"> · {p.labels.join(" · ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
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
  );
}

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getInstaDash(searchParams);

  const engDiff =
    d.postsEng !== null && d.avgEng > 0 ? ((d.postsEng - d.avgEng) / d.avgEng) * 100 : null;
  const maxCell = Math.max(...d.heatmap.flat().map((c) => c.avgReach), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <SiteHeader email={d.email} active="instagram" />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#7b4fff" }}>◎</span> Instagram.
          </h1>
          <PeriodPillsInsta days={d.days} />
        </div>
      </div>

      {/* ── TA PAGE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">Ta page</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-line rounded-xl p-4">
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
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Croissance 30 j
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {d.growth30 !== null ? `${d.growth30 >= 0 ? "+" : ""}${fmtCHF(d.growth30)}` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">nouveaux abonnés</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
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
        <div className="bg-white border border-line rounded-xl shadow-card px-5 py-4 flex items-center gap-6 flex-wrap">
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
                  portée {fmtCHF(f.avgReach)}
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
            · portée moyenne par jour et créneau (ton historique)
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
                          title={c.count > 0 ? `${c.count} post(s) · portée moyenne ${fmtCHF(c.avgReach)}` : "aucun post"}
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
              — {fmtCHF(d.bestSlot.avgReach)} de portée moyenne sur {d.bestSlot.count} posts.
              Publie quand TON audience est active, pas selon les « meilleures heures » génériques.
            </p>
          )}
        </div>
      </div>

      {/* ── TOP 3 POSTS ── */}
      {d.topPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Top 3 posts <span className="text-faint font-normal">· par portée</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {d.topPosts.map((p, i) => (
              <div key={i} className="bg-white border border-line rounded-xl shadow-card p-4">
                <div className="flex items-center gap-3 mb-2.5">
                  {p.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.mediaUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-black/[0.04] border border-line shrink-0" />
                  )}
                  <div>
                    <div className="font-mono text-[11px] text-faint">n°{i + 1} · {p.type}</div>
                    <div className="text-[12.5px] font-medium text-ink leading-snug line-clamp-2">
                      {p.caption || "(sans légende)"}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-between text-[11.5px]">
                  <span className="font-mono text-ink font-semibold">{fmtCHF(p.reach)} portée</span>
                  <span className="font-mono text-muted">{p.eng.toFixed(1)} % eng.</span>
                  <span className="text-faint">{fmtDate(p.date)}</span>
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
            Performance par label <span className="text-faint font-normal">· posts labellisés</span>
          </h2>
          <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
            {d.byLabel.map((l) => (
              <div key={l.label} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[13px] font-semibold text-brand">{l.label}</span>
                <span className="text-[11.5px] text-faint">{l.count} post{l.count > 1 ? "s" : ""}</span>
                <span className="ml-auto font-mono text-[12.5px] text-muted">
                  portée {fmtCHF(l.avgReach)}
                </span>
                <span className="font-mono text-[12.5px] text-muted w-24 text-right">
                  eng. {l.avgEng.toFixed(1)} %
                </span>
              </div>
            ))}
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
          <PostsTable posts={d.posts} histReach={d.histReach} />
        </div>
      )}

      {/* ── VUE GLOBALE ── */}
      <details className="mb-4">
        <summary className="text-[12.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
          ▸ Vue globale — tous tes posts ({d.allPosts.length})
        </summary>
        <div className="mt-3">
          <PostsTable posts={d.allPosts} histReach={d.histReach} />
        </div>
      </details>

      <p className="text-[11.5px] text-faint leading-relaxed">
        Portée en vert = au-dessus de ton post moyen ({fmtCHF(d.histReach)}). Engagement =
        (j&apos;aime + commentaires + enregistrements) / portée.
      </p>
    </main>
  );
}
