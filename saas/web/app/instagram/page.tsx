// Dashboard Instagram organique — même base que l'onglet Streamlit :
// Page (abonnés, courbe, croissance 30 j) · Formats · Posts de la période
// vs ton post moyen · Vue globale (tous les posts).
import { getInstaDash, periodDays, type InstaPost } from "@/lib/channels";
import { fmtCHF } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { PeriodPills } from "@/components/channel-dash";

export const dynamic = "force-dynamic";

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

// Courbe d'abonnés (SVG pur) — l'évolution de la page.
function FollowersChart({
  series,
}: {
  series: { date: string; followers: number }[];
}) {
  if (series.length < 2) return null;
  const W = 640, H = 110, PAD = 6;
  const vals = series.map((p) => p.followers);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const x = (i: number) => PAD + (i / (series.length - 1)) * (W - PAD * 2);
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.followers).toFixed(1)}`).join(" ");
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Abonnés — évolution
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
        <span className="text-ink font-semibold">{fmtCHF(series[series.length - 1].followers)}</span>
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
                      <div className="text-ink font-medium leading-snug max-w-[200px] truncate">
                        {p.caption || "(sans légende)"}
                      </div>
                      <div className="text-[10.5px] text-faint mt-0.5">{fmtDate(p.date)}</div>
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
  searchParams: { d?: string };
}) {
  const days = periodDays(searchParams);
  const d = await getInstaDash(days);

  const engDiff =
    d.postsEng !== null && d.avgEng > 0 ? ((d.postsEng - d.avgEng) / d.avgEng) * 100 : null;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <SiteHeader email={d.email} active="instagram" />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {d.periodLabel}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
            <span style={{ color: "#7b4fff" }}>◎</span> Instagram.
          </h1>
          <PeriodPills path="/instagram" days={days} />
        </div>
      </div>

      {/* ── LA PAGE ── */}
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

      {/* ── FORMATS ── */}
      {d.formats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Tes formats{" "}
            <span className="text-faint font-normal">· tout l&apos;historique</span>
          </h2>
          <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
            {d.formats.map((f, i) => (
              <div key={f.type} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[13px] font-semibold text-ink w-24">{f.type}</span>
                <span className="text-[11.5px] text-faint">
                  {f.count} post{f.count > 1 ? "s" : ""}
                </span>
                <span className="ml-auto font-mono text-[12.5px] text-muted">
                  portée {fmtCHF(f.avgReach)}
                </span>
                <span className="font-mono text-[12.5px] text-muted w-28 text-right">
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

      {/* ── POSTS DE LA PÉRIODE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Posts de la période{" "}
        <span className="text-faint font-normal">· comparés à ton post moyen</span>
      </h2>
      {engDiff !== null && Math.abs(engDiff) >= 10 && (
        <p
          className={`text-[12px] font-semibold mb-3 ${engDiff > 0 ? "text-pos" : "text-warn"}`}
        >
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
