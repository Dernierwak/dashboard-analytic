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
        <polyline points={line} fill="none" stroke="#1a56ff" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Un point par semaine : sans eux on ne sait pas où sont les relevés,
            et deux semaines plates ressemblent à une seule longue. */}
        {vals.map((v, i) => (
          <circle
            key={`p${i}`}
            cx={x(i)}
            cy={y(v)}
            r="3"
            fill="#fff"
            stroke="#1a56ff"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Repère d'échelle : sans lui, la courbe n'a pas d'ordre de grandeur */}
        <text x={PAD} y={11} fontSize="9" fill="#8b8e98">
          {Math.round(max).toLocaleString("fr-CH")}
        </text>

        {series.markers.map((mi) => (
          <g key={mi}>
            <line x1={x(mi)} y1={2} x2={x(mi)} y2={base} stroke="#1a7a4a" strokeDasharray="3 3" opacity="0.75" />
            <circle cx={x(mi)} cy={y(vals[mi])} r="4" fill="#fff" stroke="#1a7a4a" strokeWidth="2.5" />
            {/* L'action est nommée sur le graphe, pas seulement en légende */}
            <text
              x={Math.min(W - PAD - 44, Math.max(PAD, x(mi) - 20))}
              y={y(vals[mi]) - 9}
              fontSize="9"
              fontWeight="700"
              fill="#1a7a4a"
            >
              ▲ action
            </text>
          </g>
        ))}

        {/* La dernière valeur, écrite : « environ combien » sans survoler */}
        <text
          x={W - PAD}
          y={Math.max(16, y(vals[n - 1]) - 8)}
          textAnchor="end"
          fontSize="10"
          fontWeight="600"
          fill="#1a56ff"
        >
          {Math.round(vals[n - 1]).toLocaleString("fr-CH")}
        </text>
        <text x={PAD} y={H - 2} fontSize="9" fill="#8b8e98">{series.points[0]?.label}</text>
        <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="9" fill="#8b8e98">
          {series.points[n - 1]?.label}
        </text>
        {/* Bandes de survol : chaque semaine répond à la souris */}
        {series.points.map((pt, i) => {
          const bw = (W - PAD * 2) / (n - 1);
          const marque = series.markers.includes(i);
          return (
            <rect key={`h${i}`} x={x(i) - bw / 2} y={0} width={bw} height={H} fill="transparent">
              <title>
                {`Semaine du ${pt.label} — ${series.metric_label.toLowerCase()} ${Math.round(pt.value).toLocaleString("fr-CH")}${marque ? " · ▲ action lancée cette semaine-là" : ""}`}
              </title>
            </rect>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted leading-relaxed mt-2">
        <span className="font-semibold text-ink">Comment le lire — </span>
        {series.metric_label.toLowerCase()} de ce thème, semaine par semaine.
        {series.markers.length > 0
          ? " Chaque ▲ marque une semaine où tu as lancé une action : compare la courbe avant et après pour voir si elle a eu un effet."
          : " Quand tu lanceras une action sur ce thème, un ▲ marquera la semaine — tu verras si la courbe a suivi."}
      </p>
    </div>
  );
}
