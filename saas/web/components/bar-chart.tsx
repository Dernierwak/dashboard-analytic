import type { CSSProperties } from "react";

// Barplot pour des événements DISCRETS — un post, une campagne, une annonce —
// par opposition à `LineChart` (`components/line-chart.tsx`), réservé aux
// séries continues (dépense quotidienne, abonnés dans le temps).
//
// Pourquoi ce composant est séparé plutôt qu'un mode ajouté à `LineChart` :
// `LineChart` est utilisé par dix-sept autres courbes de l'app (retour du
// 30 août 2026, TASK-031). Le toucher pour un seul module ferait courir le
// risque de casser une courbe ailleurs. `PostsMetricChart` (page Instagram,
// « Tes posts, un par un ») est le seul appelant : chaque post y est un
// événement, pas un point d'une tendance — relier des posts par une ligne
// laisse croire à une continuité qui n'existe pas, et deux posts publiés le
// même jour se confondaient visuellement sur la courbe. Une barre par post,
// jamais fusionnée, corrige les deux.
//
// Même fabrication que `LineChart` : LE SVG PORTE LA GÉOMÉTRIE, LE HTML PORTE
// TOUS LES CARACTÈRES — axe et info-bulle sont posés par-dessus en HTML
// absolu, positionnés en pourcentages de la même boîte que le SVG.

export type Barre = { label: string; name: string; value: number };

function ancrage(pct: number): string {
  if (pct < 15) return "translate-x-0";
  if (pct > 85) return "-translate-x-full";
  return "-translate-x-1/2";
}

export function BarChart({
  items,
  color = "#7b4fff",
  height = 190,
  fmt = (v: number) => String(Math.round(v)),
  unit = "",
  ariaLabel,
}: {
  /** Un élément par barre : chaque post est sa propre colonne, jamais
   *  fusionné avec un autre — même si deux posts partagent la même date. */
  items: Barre[];
  color?: string;
  /** Hauteur en pixels CSS sur grand écran ; 80 % de celle-ci sur téléphone. */
  height?: number;
  fmt?: (v: number) => string;
  unit?: string;
  ariaLabel: string;
}) {
  const n = items.length;
  if (n < 1) return null;

  const W = 720;
  const H = height;
  const PAD_L = 6, PAD_R = 6, PAD_B = 22;
  const PAD_T = 10;
  const plotH = H - PAD_T - PAD_B;

  const max = Math.max(...items.map((it) => it.value), 0.001);

  const colW = (W - PAD_L - PAD_R) / n;
  const barW = Math.max(colW * 0.6, 1.5);
  const xCol = (i: number) => PAD_L + i * colW;
  const xCenter = (i: number) => xCol(i) + colW / 2;
  const yTop = (v: number) => PAD_T + (1 - Math.min(v, max) / max) * plotH;
  const barH = (v: number) => PAD_T + plotH - yTop(v);

  const pxCenter = (i: number) => (xCenter(i) / W) * 100;
  const pctColW = (colW / W) * 100;
  const step = Math.max(1, Math.ceil(n / 8));

  const styleH = { "--lch": `${H}px` } as unknown as CSSProperties;

  return (
    <div className="flex gap-1.5 h-[calc(var(--lch)*0.8)] sm:h-[var(--lch)]" style={styleH}>
      <div className="relative flex-1 min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Repères horizontaux — sans eux l'œil n'a aucune échelle. */}
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

          {/* Une barre par post — jamais de ligne qui les relierait. */}
          {items.map((it, i) => (
            <rect
              key={`${it.label}-${i}`}
              x={xCenter(i) - barW / 2}
              y={yTop(it.value)}
              width={barW}
              height={Math.max(barH(it.value), 0)}
              fill={color}
              opacity="0.82"
              className="hover:opacity-100"
            />
          ))}
        </svg>

        {/* ── Couche HTML : tout ce qui se lit ─────────────────────────── */}

        {/* Le haut de l'échelle. */}
        <span
          className="absolute left-0 text-[9.5px] text-faint pointer-events-none"
          style={{ top: `${(PAD_T / H) * 100}%` }}
        >
          {fmt(max)}
          {unit}
        </span>

        {/* L'axe des dates — une étiquette sur `step` colonnes, comme
            `LineChart`, pour rester lisible même à 31 posts. */}
        {items.map((it, i) =>
          i % step === 0 ? (
            <span
              key={`ax-${i}`}
              className={`absolute bottom-0 text-[10px] text-faint whitespace-nowrap pointer-events-none ${ancrage(pxCenter(i))}`}
              style={{ left: `${pxCenter(i)}%` }}
            >
              {it.label}
            </span>
          ) : null
        )}

        {/* Chaque colonne répond au survol — nom du post, date, valeur.
            Viser une barre de quelques pixels est impossible ; la bulle
            immédiate (pas le `<title>` natif) répond à tout le coup et
            s'ouvre aussi sur `focus-within` pour le doigt. */}
        {items.map((it, i) => (
          <div
            key={`h-${i}`}
            tabIndex={0}
            className="group absolute top-0 bottom-0 outline-none"
            style={{ left: `${pxCenter(i) - pctColW / 2}%`, width: `${pctColW}%` }}
          >
            <span
              className={`pointer-events-none absolute top-0 left-1/2 z-10 hidden group-hover:block group-focus-within:block rounded-lg bg-ink text-white text-[10.5px] font-semibold px-2 py-1 whitespace-nowrap shadow-card max-w-[220px] ${ancrage(pxCenter(i))}`}
            >
              <span className="block truncate">{it.name}</span>
              <span className="block font-normal text-white/70">
                {it.label} — {fmt(it.value)}
                {unit}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
