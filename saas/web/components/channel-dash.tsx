// Blocs partagés des dashboards par canal (server components).
// Même base que les onglets Streamlit : hero + 7 KPIs (coûts « baisse = bon »),
// graphe journalier à métrique sélectionnable, campagnes avec statut et
// drill-down adset/groupe → annonce, vue Par thème.
import { fmtCHF } from "@/lib/report";
import type { ChannelDash } from "@/lib/channels";
import { CampaignLabelSelect } from "@/components/campaign-label-select";

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

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  if (Math.abs(value) < 0.5)
    return <div className="text-[11px] text-faint font-medium mt-1.5">≈ stable</div>;
  const up = value > 0;
  const good = invert ? !up : up;
  return (
    <div className={`text-[11px] font-semibold mt-1.5 ${good ? "text-pos" : "text-neg"}`}>
      {up ? "▲ +" : "▼ "}
      {value.toFixed(0)} % <span className="text-faint font-normal">vs période préc.</span>
    </div>
  );
}

// Hero (impressions) + 3 KPIs perf + 3-4 KPIs coût — la hiérarchie du Streamlit.
export function AdsKpis({ d }: { d: ChannelDash }) {
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
          <Delta value={d.imprDelta} />
        </div>
      </div>
      {/* Perf */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {[
          { label: "Portée", value: d.reach > 0 ? fmtCHF(d.reach) : "—", delta: d.reach > 0 ? d.reachDelta : null, invert: false },
          { label: "Clics", value: fmtCHF(d.clicks), delta: d.clicksDelta, invert: false },
          { label: "CTR moyen", value: `${d.ctr.toFixed(2)} %`, delta: d.ctrDelta, invert: false },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-line rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
              {k.label}
            </div>
            <div className="font-mono text-lg font-medium text-ink">{k.value}</div>
            <Delta value={k.delta} invert={k.invert} />
          </div>
        ))}
      </div>
      {/* Coût — baisse = bon (vert) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Dépensé", value: `${fmtCHF(d.spend)} CHF`, delta: d.spendDelta, invert: false },
          { label: "CPM moyen", value: d.cpm > 0 ? `${d.cpm.toFixed(2)} CHF` : "—", delta: d.cpm > 0 ? d.cpmDelta : null, invert: true },
          { label: "CPC moyen", value: d.cpc > 0 ? `${d.cpc.toFixed(2)} CHF` : "—", delta: d.cpc > 0 ? d.cpcDelta : null, invert: true },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-line rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
              {k.label}
            </div>
            <div className="font-mono text-lg font-medium text-ink">{k.value}</div>
            <Delta value={k.delta} invert={k.invert} />
          </div>
        ))}
      </div>
    </div>
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
  const W = 640, H = 130, PAD = 4;
  const bw = (W - PAD * 2) / pts.length;
  const step = Math.max(1, Math.ceil(pts.length / 8));
  const fmtV = (v: number) => (v >= 100 ? fmtCHF(v) : v.toFixed(2));
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Évolution quotidienne
        </div>
        <div className="flex items-center gap-1">
          {METRICS.map((m) => (
            <a
              key={m.key}
              href={`${path}${qs({ d: d.days === 7 ? undefined : d.days, m: m.key, ...keepFilters(d) })}`}
              className={`text-[10.5px] font-semibold rounded-full px-2.5 py-0.5 border ${
                d.metric === m.key
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:bg-black/[0.03] bg-white"
              }`}
            >
              {m.label}
            </a>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`${meta.label} par jour`}>
        {pts.map((p, i) => {
          const v = val(p);
          const h = Math.max(v > 0 ? 2 : 0, (v / max) * (H - 8));
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
                <title>{`${p.label} — ${fmtV(v)} ${meta.unit}`}</title>
              </rect>
              {i % step === 0 && (
                <text x={PAD + i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="#8b8e98">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[10.5px] text-faint mt-1 text-right">
        max {fmtV(max)} {meta.unit} / jour
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
  const groupWord = channel === "meta" ? "adset" : "groupe";
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <table className="w-full min-w-[760px] text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="text-left font-semibold px-5 py-3">Campagne</th>
            <th className="text-left font-semibold px-2 py-3">Thème</th>
            <th className="text-right font-semibold px-2 py-3">Impr.</th>
            {channel === "meta" && <th className="text-right font-semibold px-2 py-3">Portée</th>}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-ink font-medium leading-snug">{c.name}</span>
                  <StatusChip status={c.status} />
                </div>
                {c.adsets.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="text-[10.5px] text-faint cursor-pointer select-none hover:text-muted">
                      ▸ {c.adsets.length} {groupWord}
                      {c.adsets.length > 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 space-y-2.5">
                      {c.adsets.map((s) => (
                        <div key={s.name} className="pl-2.5 border-l-2 border-line">
                          <div className="text-[11.5px] font-semibold text-muted leading-snug">
                            {s.name}
                            <span className="text-faint font-normal">
                              {" "}· {fmtCHF(s.spend)} CHF · {fmtCHF(s.clicks)} clics · CTR{" "}
                              {s.ctr.toFixed(2)} %
                            </span>
                          </div>
                          {s.ads.length > 0 && s.ads[0].name !== "—" && (
                            <div className="mt-1 space-y-0.5">
                              {s.ads.map((a) => (
                                <div key={a.name} className="text-[11px] text-muted leading-snug pl-2.5">
                                  {a.name}
                                  <span className="text-faint">
                                    {" "}· {fmtCHF(a.spend)} CHF · {fmtCHF(a.clicks)} clics · CTR{" "}
                                    {a.ctr.toFixed(2)} % · CPC {a.cpc > 0 ? a.cpc.toFixed(2) : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
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
              {channel === "meta" && (
                <td className="px-2 py-3 text-right font-mono text-muted">
                  {c.reach > 0 ? fmtCHF(c.reach) : "—"}
                </td>
              )}
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
