import type { ThemeSeries } from "@/lib/report";

// La frise : la métrique du thème sur 10 semaines, avec un repère ▲ à chaque
// semaine où une action a été lancée. Sa place est juste sous « Ce que tu dois
// faire » : c'est là qu'elle répond à la seule question qui compte pour elle —
// est-ce que ce que j'ai fait a bougé la courbe ?
export function ThemeTimeline({
  series,
  label,
}: {
  series: ThemeSeries;
  label?: string;
}) {
  const W = 640, H = 74, PAD = 6, base = H - 14;
  const vals = series.points.map((p) => p.value);
  const max = Math.max(...vals, 1);
  const n = vals.length;
  if (n < 2) return null;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (n - 1);
  const y = (v: number) => 6 + (1 - v / max) * (base - 6);
  const line = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M${x(0)},${base} L${vals.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${x(n - 1)},${base} Z`;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5 gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          {label ? `${label} · ` : ""}
          {series.metric_label} · 10 semaines
        </span>
        {series.markers.length > 0 && (
          <span className="text-[10px] text-brand font-semibold">▲ tes actions</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Évolution de ${series.metric_label}${label ? ` du thème ${label}` : ""} sur 10 semaines`}>
        <line x1={PAD} y1={base} x2={W - PAD} y2={base} stroke="var(--color-line, #e6e6e9)" />
        <path d={area} fill="#1a56ff" opacity="0.08" />
        <polyline points={line} fill="none" stroke="#1a56ff" strokeWidth="2" strokeLinejoin="round" />
        {series.markers.map((mi) => (
          <g key={mi}>
            <line x1={x(mi)} y1={2} x2={x(mi)} y2={base} stroke="#1a7a4a" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={x(mi)} cy={y(vals[mi])} r="3.5" fill="#fff" stroke="#1a7a4a" strokeWidth="2" />
          </g>
        ))}
        <text x={PAD} y={H - 2} fontSize="9" fill="#8b8e98">{series.points[0]?.label}</text>
        <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="9" fill="#8b8e98">
          {series.points[n - 1]?.label}
        </text>
      </svg>
    </div>
  );
}
