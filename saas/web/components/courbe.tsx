"use client";

import { useState } from "react";

// ── LA COURBE, BRIQUE NEUTRE ────────────────────────────────────────────────
//
// ADR 0011 : seules des briques visuelles neutres se partagent entre les pages
// de régie ; celle-ci ne sait rien de Meta. Elle trace des séries jour par jour,
// la période d'avant en pointillé, et rien d'autre.
//
// Pourquoi pas `line-chart.tsx` : il relie les points PAR-DESSUS les jours sans
// valeur (une `polyline` des seuls points présents). Ici un jour sans donnée
// est un TROU (spec, user story 28) : relier les deux bords dessinerait une
// pente que personne n'a mesurée. Le tracé se coupe donc à chaque `null`, et un
// point isolé entre deux trous reste visible sous forme de rond.
//
// Même principe de fond que `line-chart.tsx`, et pour la même raison mesurée :
// LE SVG PORTE LA GÉOMÉTRIE, LE HTML PORTE LES CARACTÈRES. Le SVG s'étire
// (`preserveAspectRatio="none"`), le texte posé par-dessus garde sa taille
// quelle que soit la largeur de l'écran.
//
// Couleurs (skill `dataviz`, validateur lancé sur fond blanc) : la série
// courante en bleu maison `#1a56ff`, la période d'avant en gris `#8b8e98`. Le
// gris échoue au plancher de chroma, et c'est voulu : il n'est pas une identité
// mais un fond de comparaison (motif « une en couleur, le reste en gris ») ;
// il se distingue par le pointillé et par la légende, jamais par la seule
// teinte. Contraste ≥ 3:1 pour les deux.

export type SerieCourbe = {
  nom: string;
  valeurs: (number | null)[];
  /** La date de chaque point, telle qu'on la lit dans la bulle. */
  etiquettes: string[];
  pointille?: boolean;
};

const BLEU = "#1a56ff";
const GRIS = "#8b8e98";
const W = 1000;

/** Un pas « rond » (1, 2, 5 × 10ⁿ) qui découpe le maximum en trois ou quatre. */
function graduation(max: number): { haut: number; pas: number } {
  if (max <= 0) return { haut: 1, pas: 1 };
  const p10 = Math.pow(10, Math.floor(Math.log10(max / 3)));
  const pas = [1, 2, 5, 10].map((k) => k * p10).find((k) => max / k <= 4) ?? 10 * p10;
  return { haut: Math.ceil(max / pas) * pas, pas };
}

/** Les morceaux continus d'une série : un `null` coupe le tracé. */
function troncons(valeurs: (number | null)[]): { i: number; v: number }[][] {
  const out: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  valeurs.forEach((v, i) => {
    if (v === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push({ i, v });
  });
  if (cur.length) out.push(cur);
  return out;
}

export function Courbe({
  series,
  format,
  hauteur = 200,
  titre,
}: {
  series: SerieCourbe[];
  format: (v: number) => string;
  hauteur?: number;
  /** Nom accessible du graphe. */
  titre: string;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const n = Math.max(0, ...series.map((s) => s.valeurs.length));
  const toutes = series.flatMap((s) => s.valeurs.filter((v): v is number => v !== null));
  const { haut, pas } = graduation(Math.max(0, ...toutes));
  const ticks = Array.from({ length: Math.round(haut / pas) + 1 }, (_, k) => k * pas);

  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => (1 - v / haut) * 100;
  const x = (i: number) => (xPct(i) / 100) * W;
  const y = (v: number) => (yPct(v) / 100) * hauteur;

  const principale = series.find((s) => !s.pointille) ?? series[0];
  const repereDates = n <= 1 ? [0] : n <= 3 ? Array.from({ length: n }, (_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  const bouge = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setSurvol(i >= 0 && i < n ? i : null);
  };

  if (n === 0) return null;

  return (
    <figure className="m-0 min-w-0">
      <div className="flex min-w-0">
        {/* L'axe des valeurs, en HTML : sa taille ne dépend pas de l'écran. */}
        <div className="relative w-16 shrink-0" style={{ height: hauteur }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 text-[11px] text-faint tabular-nums whitespace-nowrap" style={{ top: `${yPct(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>

        <div
          className="relative flex-1 min-w-0 cursor-crosshair touch-pan-y"
          style={{ height: hauteur }}
          onPointerMove={bouge}
          onPointerDown={bouge}
          onPointerLeave={() => setSurvol(null)}
        >
          <svg viewBox={`0 0 ${W} ${hauteur}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={titre}>
            {ticks.map((t) => (
              <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#dddcd6" : "#f0efeb"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {series.map((s) =>
              troncons(s.valeurs).map((tr, k) =>
                tr.length > 1 ? (
                  <polyline
                    key={`${s.nom}${k}`}
                    points={tr.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={s.pointille ? GRIS : BLEU}
                    strokeWidth={s.pointille ? 1.5 : 2}
                    strokeDasharray={s.pointille ? "4 4" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="courbe-apparait"
                  />
                ) : null
              )
            )}
            {survol !== null && (
              <line x1={x(survol)} x2={x(survol)} y1={0} y2={hauteur} stroke="#0e0f12" strokeOpacity={0.14} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {/* Les points en HTML : un cercle SVG étiré serait un œuf. Un point
              isolé entre deux trous est TOUJOURS dessiné — sinon un jour
              mesuré seul disparaîtrait de la courbe. */}
          {series.map((s) =>
            troncons(s.valeurs).flatMap((tr) =>
              tr.length === 1 || survol !== null
                ? tr
                    .filter((p) => tr.length === 1 || p.i === survol)
                    .map((p) => (
                      <span
                        key={`${s.nom}-${p.i}`}
                        className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                        style={{ left: `${xPct(p.i)}%`, top: `${yPct(p.v)}%`, background: s.pointille ? GRIS : BLEU }}
                      />
                    ))
                : []
            )
          )}

          {survol !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-xl bg-ink/95 px-3 py-2.5 text-white shadow-xl"
              style={{ left: `${xPct(survol)}%`, transform: xPct(survol) > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              {/* La période regardée d'abord, celle d'avant ensuite. */}
              {[...series].sort((a, b) => Number(!!a.pointille) - Number(!!b.pointille)).map((s) => {
                const v = s.valeurs[survol];
                return (
                  <div key={s.nom} className="py-0.5">
                    <p className="text-[11px] text-white/60">{s.etiquettes[survol]}</p>
                    <p className="flex min-w-0 items-center gap-2">
                      <span className={`w-3 shrink-0 ${s.pointille ? "border-t border-dashed" : "h-[2px] rounded-full"}`} style={s.pointille ? { borderColor: GRIS } : { background: BLEU }} />
                      <span className="text-[13px] font-semibold tabular-nums">{v === null || v === undefined ? "—" : format(v)}</span>
                      <span className="truncate text-[11px] text-white/60">{s.nom}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative ml-16 h-5 mt-1" aria-hidden>
        {repereDates.map((i) => (
          <span
            key={i}
            className={`absolute text-[11px] text-faint whitespace-nowrap ${i === 0 && n > 1 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${xPct(i)}%` }}
          >
            {principale.etiquettes[i]}
          </span>
        ))}
      </div>
    </figure>
  );
}
