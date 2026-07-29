// Courbe réutilisable — un seul rendu pour tous les graphes de l'app.
//
// Deux détails font toute la différence de lisibilité, et c'est pour ça qu'ils
// sont ici plutôt que recopiés à chaque fois :
//  · vectorEffect="non-scaling-stroke" — le SVG s'étire à la largeur du
//    conteneur ; sans ça le trait s'amincit sur mobile jusqu'à disparaître.
//  · une aire dégradée sous la courbe — elle donne du poids au trait et rend
//    la tendance lisible même quand les valeurs sont proches les unes des autres.

export type Serie = { name: string; color: string; values: (number | null)[] };

export function LineChart({
  labels,
  series,
  height = 150,
  fmt = (v: number) => String(Math.round(v)),
  unit = "",
  ariaLabel,
}: {
  labels: string[];
  series: Serie[];
  height?: number;
  fmt?: (v: number) => string;
  unit?: string;
  ariaLabel: string;
}) {
  const n = labels.length;
  if (n < 2 || series.length === 0) return null;

  const W = 720;
  const H = height;
  const PAD_L = 6, PAD_R = 6, PAD_T = 10, PAD_B = 20;
  const plotH = H - PAD_T - PAD_B;

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = Math.max(...all, 1);

  const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / (n - 1);
  const y = (v: number) => PAD_T + (1 - v / max) * plotH;
  const step = Math.max(1, Math.ceil(n / 8));
  const uid = labels.join("|").length + series.length; // id stable pour le dégradé

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        {series.map((s, si) => (
          <linearGradient key={s.name} id={`lc-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Repères horizontaux : sans eux l'œil n'a aucune échelle */}
      {[0.5, 1].map((f) => (
        <line
          key={f}
          x1={PAD_L}
          y1={PAD_T + (1 - f) * plotH}
          x2={W - PAD_R}
          y2={PAD_T + (1 - f) * plotH}
          stroke="#e6e6e9"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={PAD_L}
        y1={PAD_T + plotH}
        x2={W - PAD_R}
        y2={PAD_T + plotH}
        stroke="#d8d8de"
        vectorEffect="non-scaling-stroke"
      />

      {series.map((s, si) => {
        const pts = s.values
          .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
          .filter(Boolean) as string[];
        if (pts.length < 2) return null;
        const first = s.values.findIndex((v) => v !== null);
        const last = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null);
        return (
          <g key={s.name}>
            <path
              d={`M${x(first).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${pts.join(" L")} L${x(last).toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`}
              fill={`url(#lc-${uid}-${si})`}
            />
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r={n > 45 ? 1.6 : 2.8}
                  fill="#fff"
                  stroke={s.color}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{`${labels[i]} — ${s.name} ${fmt(v)}${unit}`}</title>
                </circle>
              )
            )}
          </g>
        );
      })}

      {labels.map((l, i) =>
        i % step === 0 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 5}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="10"
            fill="#8b8e98"
          >
            {l}
          </text>
        ) : null
      )}
    </svg>
  );
}

// Version minuscule et nue — pas d'axe, pas de point, juste la forme. Glissée
// dans une tuile, elle transforme un chiffre nu en tendance lisible d'un coup.
export function Sparkline({
  values,
  color = "#1a56ff",
  height = 26,
}: {
  values: (number | null)[];
  color?: string;
  height?: number;
}) {
  const reels = values.filter((v): v is number => v !== null);
  if (reels.length < 2) return null;
  const W = 100, H = height, PAD = 2;
  const max = Math.max(...reels), min = Math.min(...reels);
  const span = Math.max(max - min, 1e-9);
  const n = values.length;
  const x = (i: number) => (i * W) / (n - 1);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const pts = values
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean) as string[];
  const dernier = values.length - 1 - [...values].reverse().findIndex((v) => v !== null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(dernier)} cy={y(values[dernier] as number)} r="2.5" fill={color}
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
