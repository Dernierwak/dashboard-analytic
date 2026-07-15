// Blocs partagés des dashboards par canal (server components).
// Même base que les onglets Streamlit : 7 KPIs, graphe journalier,
// campagnes avec drill-down par annonce, vue Par label.
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

// Strip complet — les 7 mesures de l'onglet Streamlit.
export function AdsKpis({ d }: { d: ChannelDash }) {
  const main = [
    { label: "Dépensé", value: `${fmtCHF(d.spend)} CHF`, sub: "", delta: d.spendDelta },
    { label: "Clics", value: fmtCHF(d.clicks), sub: `CTR ${d.ctr.toFixed(2)} %`, delta: d.clicksDelta },
    { label: "Impressions", value: fmtCHF(d.impressions), sub: d.reach > 0 ? `portée ${fmtCHF(d.reach)}` : "", delta: d.imprDelta },
  ];
  const secondary = [
    { label: "CPC", value: d.cpc > 0 ? `${d.cpc.toFixed(2)} CHF` : "—" },
    { label: "CPM", value: d.cpm > 0 ? `${d.cpm.toFixed(2)} CHF` : "—" },
    { label: "CTR", value: d.ctr > 0 ? `${d.ctr.toFixed(2)} %` : "—" },
    ...(d.reach > 0 ? [{ label: "Portée", value: fmtCHF(d.reach) }] : []),
  ];
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {main.map((k) => (
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
      <div className="flex items-center gap-5 px-1 flex-wrap">
        {secondary.map((k) => (
          <span key={k.label} className="text-[11.5px] text-faint">
            <span className="uppercase tracking-wide font-semibold text-[10px]">{k.label}</span>{" "}
            <span className="font-mono text-muted">{k.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Graphe journalier — barres de dépense (SVG pur, zéro dépendance).
export function DailyChart({ d }: { d: ChannelDash }) {
  const pts = d.daily;
  if (pts.length === 0 || d.spend <= 0) return null;
  const W = 640, H = 130, PAD = 4;
  const max = Math.max(...pts.map((p) => p.spend), 1);
  const bw = (W - PAD * 2) / pts.length;
  const step = Math.max(1, Math.ceil(pts.length / 8)); // ~8 étiquettes max
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Dépense par jour
        </div>
        <div className="text-[10.5px] text-faint">
          max {fmtCHF(max)} CHF / jour
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Dépense par jour">
        {pts.map((p, i) => {
          const h = Math.max(p.spend > 0 ? 2 : 0, (p.spend / max) * (H - 8));
          return (
            <g key={p.date}>
              <rect
                x={PAD + i * bw + bw * 0.15}
                y={H - h}
                width={bw * 0.7}
                height={h}
                rx={2}
                fill="#1a56ff"
                opacity={0.85}
              >
                <title>{`${p.label} — ${p.spend.toFixed(0)} CHF · ${p.clicks} clics`}</title>
              </rect>
              {i % step === 0 && (
                <text
                  x={PAD + i * bw + bw / 2}
                  y={H + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#8b8e98"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Vue Par label — l'agrégat cross-campagnes (quand des thèmes sont assignés).
export function ByLabelTable({ d }: { d: ChannelDash }) {
  if (d.byLabel.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Par thème{" "}
        <span className="text-faint font-normal">· période filtrée · {d.periodLabel}</span>
      </h2>
      <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className="text-left font-semibold px-5 py-3">Thème</th>
              <th className="text-right font-semibold px-2 py-3">Dépensé</th>
              <th className="text-right font-semibold px-2 py-3">Clics</th>
              <th className="text-right font-semibold px-2 py-3">CTR</th>
              <th className="text-right font-semibold px-5 py-3">CPC</th>
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
      <table className="w-full min-w-[680px] text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="text-left font-semibold px-5 py-3">Campagne</th>
            <th className="text-left font-semibold px-2 py-3">Thème</th>
            <th className="text-right font-semibold px-2 py-3">Impr.</th>
            <th className="text-right font-semibold px-2 py-3">Clics</th>
            <th className="text-right font-semibold px-2 py-3">CTR</th>
            <th className="text-right font-semibold px-2 py-3">CPM</th>
            <th className="text-right font-semibold px-2 py-3">CPC</th>
            <th className="text-right font-semibold px-5 py-3">Dépensé</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {d.campaigns.map((c) => (
            <tr key={c.key} className="align-top">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  {c.status === "ACTIVE" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pos shrink-0" title="Active" />
                  )}
                  <span className="text-ink font-medium leading-snug">{c.name}</span>
                </div>
                {c.ads.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10.5px] text-faint cursor-pointer select-none hover:text-muted">
                      ▸ {c.ads.length} annonce{c.ads.length > 1 ? "s" : ""}
                    </summary>
                    <div className="mt-1.5 space-y-1">
                      {c.ads.map((a) => (
                        <div key={a.name} className="text-[11px] text-muted leading-snug pl-2 border-l border-line">
                          {a.name}
                          <span className="text-faint">
                            {" "}· {fmtCHF(a.spend)} CHF · {fmtCHF(a.clicks)} clics · CTR{" "}
                            {a.ctr.toFixed(2)} % · CPC {a.cpc > 0 ? a.cpc.toFixed(2) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
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
              <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(c.impressions)}</td>
              <td className="px-2 py-3 text-right font-mono text-ink">{fmtCHF(c.clicks)}</td>
              <td className="px-2 py-3 text-right font-mono text-muted">{c.ctr.toFixed(2)} %</td>
              <td className="px-2 py-3 text-right font-mono text-muted">
                {c.cpm > 0 ? c.cpm.toFixed(2) : "—"}
              </td>
              <td className="px-2 py-3 text-right font-mono text-muted">
                {c.cpc > 0 ? c.cpc.toFixed(2) : "—"}
              </td>
              <td className="px-5 py-3 text-right font-mono text-ink font-medium">
                {fmtCHF(c.spend)} CHF
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
