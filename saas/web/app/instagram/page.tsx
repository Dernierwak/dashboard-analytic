// Dashboard Instagram organique — page + posts de la période vs ton post moyen.
import { getInstaDash, periodDays } from "@/lib/channels";
import { fmtCHF } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { PeriodPills } from "@/components/channel-dash";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  VIDEO: "Reel",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrousel",
  IMAGE: "Image",
};

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
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
            Posts publiés
          </div>
          <div className="font-mono text-xl font-medium text-ink">{d.posts.length}</div>
          <div className="text-[11px] text-faint mt-1">
            {d.postsReach !== null
              ? `portée moyenne ${fmtCHF(d.postsReach)}`
              : "aucun sur la période"}
          </div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Engagement
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {d.postsEng !== null ? `${d.postsEng.toFixed(1)} %` : `${d.avgEng.toFixed(1)} %`}
          </div>
          <div className="text-[11px] text-faint mt-1">
            {d.postsEng !== null
              ? `ta moyenne : ${d.avgEng.toFixed(1)} %`
              : "moyenne du compte"}
          </div>
          {engDiff !== null && Math.abs(engDiff) >= 10 && (
            <div
              className={`text-[11px] font-semibold mt-1.5 ${
                engDiff > 0 ? "text-pos" : "text-warn"
              }`}
            >
              {engDiff > 0 ? "▲ " : "▼ "}
              {engDiff.toFixed(0)} % vs ton habitude
            </div>
          )}
        </div>
      </div>

      {/* Posts de la période */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Posts de la période{" "}
        <span className="text-faint font-normal">· comparés à ton post moyen</span>
      </h2>
      {d.posts.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[13px] text-muted">
            Aucun post sur la période — ton compte a l&apos;habitude de porter à{" "}
            {fmtCHF(d.histReach)} de portée par post.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="text-left font-semibold px-5 py-3">Post</th>
                <th className="text-left font-semibold px-2 py-3">Format</th>
                <th className="text-right font-semibold px-2 py-3">Portée</th>
                <th className="text-right font-semibold px-2 py-3">J&apos;aime</th>
                <th className="text-right font-semibold px-2 py-3">Comm.</th>
                <th className="text-right font-semibold px-5 py-3">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.posts.map((p, i) => {
                const above = d.histReach > 0 && p.reach >= d.histReach;
                return (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <div className="text-ink font-medium leading-snug max-w-[220px] truncate">
                        {p.caption || "(sans légende)"}
                      </div>
                      <div className="text-[10.5px] text-faint mt-0.5">{fmtDate(p.date)}</div>
                    </td>
                    <td className="px-2 py-3 text-muted">{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td className="px-2 py-3 text-right font-mono">
                      <span className={above ? "text-pos font-semibold" : "text-ink"}>
                        {fmtCHF(p.reach)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.likes)}</td>
                    <td className="px-2 py-3 text-right font-mono text-muted">
                      {fmtCHF(p.comments)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-ink">
                      {p.eng.toFixed(1)} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11.5px] text-faint mt-3 leading-relaxed">
        Portée en vert = au-dessus de ton post moyen ({fmtCHF(d.histReach)}).
      </p>
    </main>
  );
}
