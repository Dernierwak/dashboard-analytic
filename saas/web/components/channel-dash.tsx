// Blocs partagés des dashboards par canal (server components).
import { fmtCHF } from "@/lib/report";
import type { ChannelDash } from "@/lib/channels";
import { CampaignLabelSelect } from "@/components/campaign-label-select";

export function PeriodPills({ path, days }: { path: string; days: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[7, 14, 30].map((d) => (
        <a
          key={d}
          href={`${path}?d=${d}`}
          className={`text-[11.5px] font-semibold rounded-full px-3 py-1 border transition-colors ${
            days === d
              ? "bg-ink text-white border-ink"
              : "border-line text-muted hover:bg-black/[0.03] bg-white"
          }`}
        >
          {d} j
        </a>
      ))}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  if (Math.abs(value) < 0.5)
    return <div className="text-[11px] text-faint font-medium mt-1.5">≈ stable</div>;
  const up = value > 0;
  return (
    <div className={`text-[11px] font-semibold mt-1.5 ${up ? "text-pos" : "text-neg"}`}>
      {up ? "▲ +" : "▼ "}
      {value.toFixed(0)} % <span className="text-faint font-normal">vs période préc.</span>
    </div>
  );
}

export function AdsKpis({ d }: { d: ChannelDash }) {
  const cards = [
    { label: "Dépensé", value: `${fmtCHF(d.spend)} CHF`, sub: "", delta: d.spendDelta },
    { label: "Clics", value: fmtCHF(d.clicks), sub: `CTR ${d.ctr.toFixed(2)} %`, delta: d.clicksDelta },
    { label: "CPC moyen", value: d.cpc > 0 ? `${d.cpc.toFixed(2)} CHF` : "—", sub: `${fmtCHF(d.impressions)} impressions`, delta: null },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
      {cards.map((k) => (
        <div key={k.label} className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            {k.label}
          </div>
          <div className="font-mono text-xl font-medium text-ink">{k.value}</div>
          {k.sub && <div className="text-[11px] text-faint mt-1">{k.sub}</div>}
          <Delta value={k.delta} />
        </div>
      ))}
    </div>
  );
}

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
        <p className="text-[13px] text-muted">Aucune campagne sur la période.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <table className="w-full min-w-[560px] text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="text-left font-semibold px-5 py-3">Campagne</th>
            <th className="text-left font-semibold px-2 py-3">Thème</th>
            <th className="text-right font-semibold px-2 py-3">Dépensé</th>
            <th className="text-right font-semibold px-2 py-3">Clics</th>
            <th className="text-right font-semibold px-2 py-3">CTR</th>
            <th className="text-right font-semibold px-5 py-3">CPC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {d.campaigns.map((c) => (
            <tr key={c.key}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  {c.status === "ACTIVE" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pos shrink-0" title="Active" />
                  )}
                  <span className="text-ink font-medium leading-snug">{c.name}</span>
                </div>
              </td>
              <td className="px-2 py-3">
                <CampaignLabelSelect
                  channel={channel}
                  campaignKey={c.key}
                  campaignName={c.name}
                  current={c.label}
                  labels={d.labels}
                />
              </td>
              <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(c.spend)} CHF</td>
              <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(c.clicks)}</td>
              <td className="px-2 py-3 text-right font-mono text-muted">{c.ctr.toFixed(2)} %</td>
              <td className="px-5 py-3 text-right font-mono text-muted">
                {c.cpc > 0 ? `${c.cpc.toFixed(2)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
