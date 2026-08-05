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

  // La valeur courante et la PENTE, en clair, avant la courbe. Elles étaient
  // dans le SVG en 10 px : le seul module de Pulse qui n'avait aucun chiffre
  // avant sa forme. Sur un téléphone, trois frises empilées de 74 px ne se
  // distinguent pas — une pastille de trois mots, si.
  const derniere = vals[n - 1];
  const fmt = (v: number) => Math.round(v).toLocaleString("fr-CH");
  // Quatre dernières semaines contre les quatre précédentes : une semaine seule
  // se laisse trop facilement emporter par un accident.
  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const recent = moy(vals.slice(-4));
  const avant = moy(vals.slice(-8, -4));
  const ecart = avant > 0 ? ((recent - avant) / avant) * 100 : null;
  const pente =
    ecart === null || Math.abs(ecart) < 8
      ? { texte: "≈ stable", cls: "text-muted", fond: "rgba(0,0,0,0.05)" }
      : ecart > 0
        ? { texte: `▲ en hausse de ${Math.round(ecart)} %`, cls: "text-pos", fond: "#1a7a4a14" }
        : { texte: `▼ en baisse de ${Math.round(-ecart)} %`, cls: "text-neg", fond: "#c0392b14" };
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

      <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
        <span className="font-mono text-[24px] leading-none font-medium text-ink">
          {fmt(derniere)}
        </span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pente.cls}`}
          style={{ background: pente.fond }}
          title="Moyenne des 4 dernières semaines comparée aux 4 précédentes"
        >
          {pente.texte}
        </span>
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

        {/* La dernière valeur n'est plus écrite ici : elle est en 24 px
            au-dessus du graphe, à sa place. */}
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
      {series.note && (
        <p className="text-[11px] text-warn leading-relaxed mt-1.5 bg-warn/[0.06] border border-warn/20 rounded-lg px-2.5 py-1.5">
          {series.note}
        </p>
      )}
    </div>
  );
}
