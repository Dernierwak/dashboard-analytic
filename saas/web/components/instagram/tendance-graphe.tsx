"use client";

import Link from "next/link";
import { useState } from "react";
import type { Publication } from "@/lib/instagram/tendance";

// ── LE GRAPHE D'UNE CARTE DE LA TENDANCE ─────────────────────────────────────
//
// Pourquoi pas `components/courbe.tsx` : la Tendance Instagram a besoin de
// trois choses qu'elle n'a pas — des barres gagnés / perdus sous la courbe, sur
// le même axe des jours (spec : « jamais de double axe ») ; les jours de
// publication SOUS l'axe, pas posés sur la ligne ; et les 48 dernières heures
// marquées. La brique neutre (ADR 0011) n'est pas touchée : la page Meta la
// partage.
//
// Les règles reprises de `courbe.tsx`, pour la même raison mesurée : le SVG
// porte la géométrie et s'étire, le HTML porte les caractères ; un `null`
// COUPE le tracé (un jour sans donnée est un trou, user story 9) ; un point
// isolé entre deux trous reste dessiné ; sans aucune valeur, ni axe ni zéro,
// une phrase. Aucun `Intl` ni `toLocaleString` dans le rendu (hydratation) :
// le format arrive de l'appelant.
//
// Couleurs : la période en violet Instagram `#7b4fff` (`lib/palette.ts`,
// `SERIES`), la période d'avant en gris `#8b8e98` pointillé — comme `courbe.tsx`,
// distinguée par le trait et la légende, jamais par la seule teinte. Gagnés en
// vert `#1a7a4a` (`text-pos`), perdus en rouge `#c0392b` (`text-neg`) : le sens
// est aussi porté par la direction de la barre.

const VIOLET = "#7b4fff";
const GRIS = "#8b8e98";
const VERT = "#1a7a4a";
const ROUGE = "#c0392b";
const W = 1000;

export type BarresGraphe = { gagnes: (number | null)[]; perdus: (number | null)[] };

/** Un pas « rond » (1, 2, 5 × 10ⁿ). */
function pasRond(etendue: number): number {
  if (etendue <= 0) return 1;
  const p10 = Math.pow(10, Math.floor(Math.log10(etendue / 3)));
  return [1, 2, 5, 10].map((k) => k * p10).find((k) => etendue / k <= 4) ?? 10 * p10;
}

/** Bornes de l'axe. Depuis zéro pour une portée ou des interactions ; serrées
 *  sur les valeurs pour un total d'abonnés, qu'un axe depuis zéro aplatirait
 *  (1 800 abonnés qui bougent de 3 par jour). */
function echelle(valeurs: number[], depuisZero: boolean): { bas: number; haut: number; ticks: number[] } {
  const max = Math.max(...valeurs);
  const min = depuisZero ? 0 : Math.min(...valeurs);
  const pas = pasRond(max - min || Math.max(1, Math.abs(max)));
  const bas = depuisZero ? 0 : Math.floor(min / pas) * pas;
  let haut = Math.ceil(max / pas) * pas;
  if (haut === bas) haut = bas + pas;
  return { bas, haut, ticks: Array.from({ length: Math.round((haut - bas) / pas) + 1 }, (_, k) => bas + k * pas) };
}

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

export function TendanceGraphe({
  titre,
  etiquettes,
  etiquettesAvant,
  serie,
  serieAvant,
  format,
  depuisZero = true,
  hauteur = 140,
  barres,
  recents,
  publications,
  lienDuPost,
}: {
  /** Nom accessible du graphe. */
  titre: string;
  /** La date lisible de chaque jour, période puis période d'avant. */
  etiquettes: string[];
  etiquettesAvant: string[];
  serie: (number | null)[];
  serieAvant: (number | null)[];
  format: (v: number | null) => string;
  depuisZero?: boolean;
  hauteur?: number;
  /** Les abonnés gagnés et perdus, sous la courbe, même axe des jours. */
  barres?: BarresGraphe;
  /** Index des jours qui peuvent encore changer (48 dernières heures). */
  recents: number[];
  publications: Publication[];
  lienDuPost: (id: string) => string;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const n = etiquettes.length;
  const toutes = [...serie, ...serieAvant].filter((v): v is number => v !== null);
  const mouvements = barres ? [...barres.gagnes, ...barres.perdus].filter((v): v is number => v !== null) : [];

  // Les jours en bandes : une barre et un point tiennent au centre de leur jour.
  const xPct = (i: number) => ((i + 0.5) / Math.max(1, n)) * 100;
  const largeurPct = 100 / Math.max(1, n);
  const pub = (i: number) => publications.find((p) => p.index === i);
  const estRecent = (i: number) => recents.includes(i);

  const bouge = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    setSurvol(i >= 0 && i < n ? i : null);
  };

  const ech = toutes.length ? echelle(toutes, depuisZero) : null;
  const yPct = (v: number) => (ech ? (1 - (v - ech.bas) / (ech.haut - ech.bas)) * 100 : 50);
  const maxMouv = Math.max(1, ...mouvements);
  const hBarres = 56;

  const bulleAGauche = (i: number) => xPct(i) > 55;

  return (
    <figure className="m-0 min-w-0" aria-label={titre}>
      <div className="flex min-w-0">
        <div className="relative w-14 shrink-0" style={{ height: hauteur }} aria-hidden>
          {ech?.ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums text-faint" style={{ top: `${yPct(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div
          className="relative min-w-0 flex-1 touch-pan-y cursor-crosshair"
          style={{ height: hauteur }}
          onPointerMove={bouge}
          onPointerDown={bouge}
          onPointerLeave={() => setSurvol(null)}
        >
          {/* Les 48 dernières heures : une bande hachurée, derrière tout. */}
          {recents.map((i) => (
            <span
              key={`r-${i}`}
              aria-hidden
              className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#f3f2ee_0_4px,transparent_4px_8px)]"
              style={{ left: `${xPct(i) - largeurPct / 2}%`, width: `${largeurPct}%` }}
            />
          ))}
          {ech ? (
            <svg viewBox={`0 0 ${W} ${hauteur}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={titre}>
              {ech.ticks.map((t) => (
                <line key={t} x1={0} x2={W} y1={(yPct(t) / 100) * hauteur} y2={(yPct(t) / 100) * hauteur} stroke={t === 0 ? "#dddcd6" : "#f0efeb"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {(
                [
                  [serieAvant, true],
                  [serie, false],
                ] as const
              ).map(([valeurs, avant]) =>
                troncons(valeurs).map((tr, k) =>
                  tr.length > 1 ? (
                    <polyline
                      key={`${avant ? "a" : "p"}-${k}`}
                      points={tr.map((p) => `${((xPct(p.i) / 100) * W).toFixed(1)},${((yPct(p.v) / 100) * hauteur).toFixed(1)}`).join(" ")}
                      fill="none"
                      stroke={avant ? GRIS : VIOLET}
                      strokeWidth={avant ? 1.5 : 2.25}
                      strokeDasharray={avant ? "4 4" : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null
                )
              )}
              {survol !== null && (
                <line x1={(xPct(survol) / 100) * W} x2={(xPct(survol) / 100) * W} y1={0} y2={hauteur} stroke="#0e0f12" strokeOpacity={0.14} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              )}
            </svg>
          ) : (
            <p className="absolute inset-0 flex items-center justify-center rounded-xl bg-canvas/70 px-4 text-center text-[12.5px] text-muted">
              Aucun chiffre à tracer sur cette période.
            </p>
          )}
          {/* Les points en HTML : un cercle SVG étiré serait un œuf. Un point
              isolé entre deux trous est toujours dessiné. */}
          {ech &&
            (
              [
                [serieAvant, GRIS],
                [serie, VIOLET],
              ] as const
            ).flatMap(([valeurs, couleur], s) =>
              troncons(valeurs).flatMap((tr) =>
                tr
                  .filter((p) => tr.length === 1 || p.i === survol)
                  .map((p) => (
                    <span
                      key={`${s}-${p.i}`}
                      className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                      style={{ left: `${xPct(p.i)}%`, top: `${yPct(p.v)}%`, background: couleur }}
                    />
                  ))
              )
            )}
          {survol !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[180px] rounded-xl bg-ink/95 px-3 py-2.5 text-white shadow-xl"
              style={{ left: `${xPct(survol)}%`, transform: bulleAGauche(survol) ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              <p className="text-[11px] text-white/60">{etiquettes[survol]}</p>
              <p className="flex items-center gap-2">
                <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: VIOLET }} />
                <span className="text-[13px] font-semibold tabular-nums">{format(serie[survol] ?? null)}</span>
              </p>
              {barres && (
                <p className="mt-0.5 text-[12px] tabular-nums text-white/80">
                  gagnés {format(barres.gagnes[survol] ?? null)} · perdus {format(barres.perdus[survol] ?? null)}
                </p>
              )}
              <p className="mt-1 text-[11px] text-white/60">{etiquettesAvant[survol]}</p>
              <p className="flex items-center gap-2">
                <span className="w-3 shrink-0 border-t border-dashed" style={{ borderColor: GRIS }} />
                <span className="text-[13px] font-semibold tabular-nums">{format(serieAvant[survol] ?? null)}</span>
                <span className="text-[11px] text-white/60">période d&apos;avant</span>
              </p>
              {estRecent(survol) && <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11.5px] text-white/80">◔ Peut encore changer : Meta complète les chiffres jusqu&apos;à 48 h après.</p>}
              {pub(survol) && <p className="mt-1 text-[11.5px] text-white/80">{pub(survol)!.posts.length === 1 ? "1 post publié" : `${pub(survol)!.posts.length} posts publiés`} ce jour-là</p>}
            </div>
          )}
        </div>
      </div>

      {barres && (
        <div className="mt-3 flex min-w-0" aria-label="Abonnés gagnés (vers le haut) et perdus (vers le bas), jour par jour">
          {/* L'échelle des barres, la sienne : ce sont des mouvements, pas des
              totaux — un repère haut et bas, jamais posé sur l'axe des totaux. */}
          <div className="relative w-14 shrink-0 text-[11px] tabular-nums" style={{ height: hBarres }} aria-hidden>
            {mouvements.length > 0 && (
              <>
                <span className="absolute right-2 top-0 text-pos">+{format(maxMouv)}</span>
                <span className="absolute bottom-0 right-2 text-neg">−{format(maxMouv)}</span>
              </>
            )}
          </div>
          <div className="relative min-w-0 flex-1" style={{ height: hBarres }}>
            <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-line" />
            {barres.gagnes.map((v, i) =>
              v ? (
                <span
                  key={`g-${i}`}
                  className="absolute bottom-1/2 rounded-t-sm"
                  style={{ left: `${xPct(i) - largeurPct * 0.3}%`, width: `${largeurPct * 0.6}%`, height: `${(v / maxMouv) * 50}%`, background: VERT, opacity: 0.85 }}
                />
              ) : null
            )}
            {barres.perdus.map((v, i) =>
              v ? (
                <span
                  key={`p-${i}`}
                  className="absolute top-1/2 rounded-b-sm"
                  style={{ left: `${xPct(i) - largeurPct * 0.3}%`, width: `${largeurPct * 0.6}%`, height: `${(v / maxMouv) * 50}%`, background: ROUGE, opacity: 0.85 }}
                />
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Sous l'axe : les jours de publication, le seul pont vers les posts
          (spec). Un post : un lien. Plusieurs : la liste s'ouvre. */}
      <div className="relative ml-14 mt-1 h-6">
        {publications.map((p) =>
          p.posts.length === 1 ? (
            <Link
              key={p.index}
              href={lienDuPost(p.posts[0].id)}
              scroll={false}
              aria-label={`${etiquettes[p.index]} · ${p.posts[0].format} · ouvrir le post`}
              title={`${p.posts[0].format} — ${p.posts[0].legende || "sans légende"}`}
              className="group absolute top-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              style={{ left: `${xPct(p.index)}%` }}
            >
              <span className="block h-2 w-2 rounded-full ring-2 ring-white transition-transform group-hover:scale-150" style={{ background: VIOLET }} />
            </Link>
          ) : (
            <span key={p.index} className="absolute top-0 -translate-x-1/2" style={{ left: `${xPct(p.index)}%` }}>
              <button
                type="button"
                onClick={() => setOuvert((x) => (x === p.index ? null : p.index))}
                aria-expanded={ouvert === p.index}
                aria-label={`${etiquettes[p.index]} · ${p.posts.length} posts publiés`}
                className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10.5px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="rounded-full px-1.5 leading-4" style={{ background: VIOLET }}>{p.posts.length}</span>
              </button>
              {ouvert === p.index && (
                <span
                  className={`absolute top-full z-20 mt-1 w-[min(280px,calc(100vw-32px))] rounded-xl border border-line bg-white p-1.5 shadow-card ${bulleAGauche(p.index) ? "right-0" : "left-0"}`}
                >
                  {p.posts.map((x) => (
                    <Link
                      key={x.id}
                      href={lienDuPost(x.id)}
                      scroll={false}
                      onClick={() => setOuvert(null)}
                      className="block rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink hover:bg-canvas"
                    >
                      <span className="font-medium">{x.format}</span>
                      <span className="block truncate text-[11.5px] text-muted">{x.legende || "sans légende"}</span>
                    </Link>
                  ))}
                </span>
              )}
            </span>
          )
        )}
      </div>

      <div className="relative ml-14 h-5" aria-hidden>
        {(n <= 3 ? Array.from({ length: n }, (_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]).map((i) => (
          <span
            key={i}
            className={`absolute whitespace-nowrap text-[11px] text-faint ${i === 0 && n > 1 ? "" : i === n - 1 && n > 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: i === 0 && n > 1 ? "0%" : i === n - 1 && n > 1 ? "100%" : `${xPct(i)}%` }}
          >
            {etiquettes[i]}
            {estRecent(i) ? " ◔" : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
