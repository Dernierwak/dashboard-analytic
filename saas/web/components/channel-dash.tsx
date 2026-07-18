// Blocs partagés des dashboards par canal (server components).
// Même base que les onglets Streamlit : hero + 7 KPIs (coûts « baisse = bon »),
// graphe journalier à métrique sélectionnable, campagnes avec statut et
// drill-down adset/groupe → annonce, vue Par thème.
import { fmtCHF } from "@/lib/report";
import type { ChannelDash } from "@/lib/channels";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { SummaryStop } from "@/components/summary-stop";

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
      {/* Perf — carrousel horizontal sur téléphone */}
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-3 pb-1 sm:pb-0">
        {[
          { label: "Portée", value: d.reach > 0 ? fmtCHF(d.reach) : "—", delta: d.reach > 0 ? d.reachDelta : null, invert: false },
          { label: "Clics", value: fmtCHF(d.clicks), delta: d.clicksDelta, invert: false },
          { label: "CTR moyen", value: `${d.ctr.toFixed(2)} %`, delta: d.ctrDelta, invert: false },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-line rounded-xl p-4 min-w-[180px] shrink-0 sm:min-w-0 sm:shrink">
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
              {k.label}
            </div>
            <div className="font-mono text-lg font-medium text-ink">{k.value}</div>
            <Delta value={k.delta} invert={k.invert} />
          </div>
        ))}
      </div>
      {/* Coût — baisse = bon (vert) · carrousel horizontal sur téléphone */}
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 pb-1 sm:pb-0">
        {[
          { label: "Dépensé", value: `${fmtCHF(d.spend)} CHF`, delta: d.spendDelta, invert: false },
          { label: "CPM moyen", value: d.cpm > 0 ? `${d.cpm.toFixed(2)} CHF` : "—", delta: d.cpm > 0 ? d.cpmDelta : null, invert: true },
          { label: "CPC moyen", value: d.cpc > 0 ? `${d.cpc.toFixed(2)} CHF` : "—", delta: d.cpc > 0 ? d.cpcDelta : null, invert: true },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-line rounded-xl p-4 min-w-[180px] shrink-0 sm:min-w-0 sm:shrink">
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

// Table campagnes en accordéon : chaque campagne se DÉROULE en adsets/groupes,
// puis en annonces — chiffres alignés sur les mêmes colonnes à chaque niveau.
// Hauteur bornée : la table scrolle à l'intérieur, l'en-tête reste collé.
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
          {d.campaigns.map((c) => (
            <details key={c.key} className="group">
              <summary
                className="grid items-center px-3 py-3 text-[12.5px] cursor-pointer select-none hover:bg-black/[0.015] list-none"
                style={{ gridTemplateColumns: grid }}
              >
                <span className="px-2 flex items-center gap-2 min-w-0">
                  {c.adsets.length > 0 ? (
                    <span className="text-faint text-[10px] shrink-0 transition-transform group-open:rotate-90">
                      ▶
                    </span>
                  ) : (
                    <span className="w-[10px] shrink-0" />
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
          ))}
        </div>
      </div>
      <p className="text-[10.5px] text-faint px-5 py-2.5 border-t border-line">
        Clique une campagne pour dérouler ses {groupWord}s et annonces — la liste scrolle
        à l&apos;intérieur du cadre.
      </p>
    </div>
  );
}
