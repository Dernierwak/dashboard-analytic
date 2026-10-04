"use client";

import { useState } from "react";
import { ORANGE_REPERE } from "@/lib/palette";

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
// point isolé entre deux trous reste visible sous forme de rond. Sans une seule
// valeur, il n'y a ni axe ni graduation, seulement une phrase qui le dit.
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
//
// LES REPÈRES. Un jour peut porter un repère cliquable posé sur la série
// principale (la page Meta y met les jours où le compte a changé), en
// `ORANGE_REPERE` (`lib/palette.ts`, qui dit pourquoi cet orange). Un repère se clique sur toute la hauteur du jour, pas seulement sur ses
// 8 px, et c'est un vrai bouton pour qui navigue au clavier.

export type SerieCourbe = {
  nom: string;
  valeurs: (number | null)[];
  /** La date de chaque point, telle qu'on la lit dans la bulle. */
  etiquettes: string[];
  pointille?: boolean;
  /** L'identité d'une série parmi plusieurs (la Comparaison) : une teinte
   *  validée par l'appelant. Absente, la série est le bleu maison. */
  couleur?: string;
};

const BLEU = "#1a56ff";
const GRIS = "#8b8e98";
const W = 1000;

export type Repere = {
  /** La place du jour dans les séries. */
  index: number;
  /** Ce que la bulle et le lecteur d'écran disent du repère. */
  libelle: string;
};

const teinte = (s: SerieCourbe) => (s.pointille ? GRIS : s.couleur ?? BLEU);

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
  reperes = [],
  onRepere,
}: {
  series: SerieCourbe[];
  format: (v: number) => string;
  hauteur?: number;
  /** Nom accessible du graphe. */
  titre: string;
  reperes?: Repere[];
  onRepere?: (index: number) => void;
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

  const repereSurvole = survol === null ? undefined : reperes.find((r) => r.index === survol);
  // Sur un jour vide, le repère se pose sur l'axe : une mise en pause rend
  // justement les jours suivants vides, et c'est le changement qu'on cherche.
  const yRepere = (i: number) => {
    const v = principale?.valeurs[i];
    return yPct(v === null || v === undefined ? 0 : v);
  };

  const bouge = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setSurvol(i >= 0 && i < n ? i : null);
  };

  // Sans une seule valeur, l'échelle tomberait de 0 à 0 et l'axe écrirait
  // « 0,00 CHF » : un zéro lu là où rien n'est mesuré (ticket 18). Une phrase
  // à la hauteur du graphe, pour que le graphe voisin d'une grille ne saute pas.
  if (toutes.length === 0) {
    return (
      <figure className="m-0 min-w-0" aria-label={titre}>
        <p className="flex items-center justify-center rounded-xl bg-canvas px-4 text-center text-[12.5px] text-muted" style={{ height: hauteur }}>
          Aucun chiffre à tracer sur cette période.
        </p>
      </figure>
    );
  }

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
          className={`relative flex-1 min-w-0 touch-pan-y ${repereSurvole && onRepere ? "cursor-pointer" : "cursor-crosshair"}`}
          style={{ height: hauteur }}
          onClick={() => repereSurvole && onRepere?.(repereSurvole.index)}
          onPointerMove={bouge}
          onPointerDown={bouge}
          onPointerLeave={() => setSurvol(null)}
        >
          <svg viewBox={`0 0 ${W} ${hauteur}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={titre}>
            {ticks.map((t) => (
              <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#dddcd6" : "#f0efeb"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {/* Clés par INDEX de série, pas par nom : deux annonces homonymes
                sont deux séries (user story 35). */}
            {series.map((s, si) =>
              troncons(s.valeurs).map((tr, k) =>
                tr.length > 1 ? (
                  <polyline
                    key={`${si}-${k}`}
                    points={tr.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={teinte(s)}
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
          {series.map((s, si) =>
            troncons(s.valeurs).flatMap((tr) =>
              tr.length === 1 || survol !== null
                ? tr
                    .filter((p) => tr.length === 1 || p.i === survol)
                    .map((p) => (
                      <span
                        key={`${si}-${p.i}`}
                        className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                        style={{ left: `${xPct(p.i)}%`, top: `${yPct(p.v)}%`, background: teinte(s) }}
                      />
                    ))
                : []
            )
          )}

          {reperes.map((r) => (
            <button
              key={r.index}
              type="button"
              aria-label={r.libelle}
              onClick={(e) => {
                // Le conteneur ouvre déjà le jour survolé : sans ça, un clic
                // sur le point l'ouvrirait deux fois.
                e.stopPropagation();
                onRepere?.(r.index);
              }}
              className="group absolute z-[5] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              style={{ left: `${xPct(r.index)}%`, top: `${yRepere(r.index)}%` }}
            >
              <span
                className={`block h-2 w-2 rounded-full ring-2 ring-white transition-transform duration-150 motion-reduce:transition-none group-hover:scale-150 group-focus-visible:scale-150 ${survol === r.index ? "scale-150" : ""}`}
                style={{ background: ORANGE_REPERE }}
              />
            </button>
          ))}

          {survol !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-xl bg-ink/95 px-3 py-2.5 text-white shadow-xl"
              style={{ left: `${xPct(survol)}%`, transform: xPct(survol) > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              {/* La période regardée d'abord, celle d'avant ensuite. */}
              {/* Une date ne s'écrit qu'une fois quand plusieurs séries la
                  partagent (la Comparaison) — quatre fois la même se lirait mal. */}
              {[...series].sort((a, b) => Number(!!a.pointille) - Number(!!b.pointille)).map((s, k, triees) => {
                const v = s.valeurs[survol];
                const date = s.etiquettes[survol];
                return (
                  <div key={k} className="py-0.5">
                    {(k === 0 || triees[k - 1].etiquettes[survol] !== date) && <p className="text-[11px] text-white/60">{date}</p>}
                    <p className="flex min-w-0 items-center gap-2">
                      <span className={`w-3 shrink-0 ${s.pointille ? "border-t border-dashed" : "h-[2px] rounded-full"}`} style={s.pointille ? { borderColor: GRIS } : { background: teinte(s) }} />
                      <span className="text-[13px] font-semibold tabular-nums">{v === null || v === undefined ? "—" : format(v)}</span>
                      <span className="truncate text-[11px] text-white/60">{s.nom}</span>
                    </p>
                  </div>
                );
              })}
              {repereSurvole && (
                <p className="mt-1.5 flex items-center gap-1.5 border-t border-white/10 pt-1.5 text-[11.5px] text-white/80">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ORANGE_REPERE }} />
                  {repereSurvole.libelle}
                </p>
              )}
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
