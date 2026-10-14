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
// valeur, il n'y a ni axe ni graduation, seulement une phrase qui le dit — et
// les repères, alignés en frise.
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
//
// LES POINTS D'UNE SÉRIE (la Comparaison, ticket 13 de `.scratch/journal-meta/`).
// Une série peut porter ses propres jours marqués, de sa couleur, posés sur SA
// ligne. Ils ne se cliquent pas tous à la fois : deux éléments changés le même
// jour posaient deux zones de clic superposées, et la dernière dessinée
// gagnait — on visait mal (ticket 10). D'abord on CHOISIT une ligne (clic sur
// elle ou sur un de ses points creux) ; elle passe devant, les autres
// s'effacent, et seuls ses points, pleins et pulsants, ouvrent quelque chose.
// L'état du choix appartient à l'appelant : il vaut pour ses deux graphes.

export type SerieCourbe = {
  nom: string;
  valeurs: (number | null)[];
  /** La date de chaque point, telle qu'on la lit dans la bulle. */
  etiquettes: string[];
  pointille?: boolean;
  /** L'identité d'une série parmi plusieurs (la Comparaison) : une teinte
   *  validée par l'appelant. Absente, la série est le bleu maison. */
  couleur?: string;
  /** Les jours (index) qui portent un point sur la ligne. Un jour sans valeur
   *  le pose sur l'axe : le changement existe, la courbe n'a simplement pas de
   *  chiffre ce jour-là. */
  marques?: number[];
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

/** Le point orange d'un repère. Le bouton fait 24 px pour le doigt, le point
 *  8 px pour l'œil. Il est partagé par la courbe et par la frise d'une fenêtre
 *  vide, pour qu'un repère ait le même aspect et le même geste dans les deux.
 *  Sans `onClick`, il n'ouvre rien : il reste un point qui se lit, pas un
 *  bouton qui prend le focus pour ne rien faire. */
function BoutonRepere({ actif, className = "", onClick, ...attributs }: React.HTMLAttributes<HTMLElement> & { actif: boolean }) {
  const classes = `group absolute z-[5] flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${className}`;
  const point = (
    <span
      className={`block h-2 w-2 rounded-full ring-2 ring-white transition-transform duration-150 motion-reduce:transition-none group-hover:scale-150 group-focus-visible:scale-150 ${actif ? "scale-150" : ""}`}
      style={{ background: ORANGE_REPERE }}
    />
  );
  return onClick ? (
    <button type="button" {...attributs} onClick={onClick} className={classes}>
      {point}
    </button>
  ) : (
    <span role="img" {...attributs} className={classes}>
      {point}
    </span>
  );
}

/** La ligne d'un repère dans la bulle : le point, puis ce qu'il dit. */
function PastilleRepere({ libelle, className }: { libelle: string; className: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11.5px] text-white/80 ${className}`}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ORANGE_REPERE }} />
      {libelle}
    </p>
  );
}

/** Un point d'une série. Au repos, un anneau : « il s'est passé quelque
 *  chose ». Sur la ligne choisie, plein, plus gros, avec un halo : « clique-
 *  moi ». Sur une ligne effacée, un petit anneau gris. */
function PointSerie({
  etat,
  couleur,
  className = "",
  ...attributs
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { etat: "repos" | "choisi" | "efface"; couleur: string }) {
  return (
    <button
      type="button"
      {...attributs}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${
        etat === "choisi" ? "z-[7] h-7 w-7" : "z-[6] h-5 w-5"
      } ${className}`}
    >
      {etat === "choisi" && <span className="halo-pulse absolute h-3.5 w-3.5 rounded-full" style={{ background: couleur }} aria-hidden />}
      <span
        aria-hidden
        className={`relative block rounded-full ${etat === "choisi" ? "h-3.5 w-3.5 ring-[2.5px] ring-white" : etat === "repos" ? "h-2.5 w-2.5 border-2 bg-white" : "h-2 w-2 border-[1.5px] bg-white opacity-70"}`}
        style={etat === "choisi" ? { background: couleur } : { borderColor: etat === "repos" ? couleur : GRIS }}
      />
    </button>
  );
}

export function Courbe({
  series,
  format,
  hauteur = 200,
  titre,
  reperes = [],
  onRepere,
  choisie = null,
  onSerie,
  onMarque,
}: {
  series: SerieCourbe[];
  format: (v: number) => string;
  hauteur?: number;
  /** Nom accessible du graphe. */
  titre: string;
  reperes?: Repere[];
  onRepere?: (index: number) => void;
  /** La série mise en avant (son index), `null` = aucune. */
  choisie?: number | null;
  /** Un clic sur une ligne ou sur un point d'une ligne non choisie. */
  onSerie?: (serie: number) => void;
  /** Un clic sur un point de la ligne choisie : le jour `index`. */
  onMarque?: (serie: number, index: number) => void;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [survolSerie, setSurvolSerie] = useState<number | null>(null);
  // La ligne qui passe devant : la choisie, sinon celle qu'on survole.
  const accent = choisie ?? survolSerie;
  const opacite = (si: number) => (accent === null || accent === si ? 1 : choisie !== null ? 0.18 : 0.35);
  // La ligne en avant se dessine en dernier, par-dessus les autres.
  const ordre = series.map((_, si) => si).sort((a, b) => Number(a === accent) - Number(b === accent));
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

  // Sur la moitié droite, la bulle bascule à gauche pour ne pas sortir du cadre.
  const bulleAGauche = (i: number) => xPct(i) > 55;
  const repereSurvole = survol === null ? undefined : reperes.find((r) => r.index === survol);
  // Sur un jour vide, le repère se pose sur l'axe : une mise en pause rend
  // justement les jours suivants vides, et c'est le changement qu'on cherche.
  const yRepere = (i: number) => {
    const v = principale?.valeurs[i];
    return yPct(v === null || v === undefined ? 0 : v);
  };

  // Les deux rendus d'un repère disent la même chose au lecteur d'écran — le
  // jour, puis ce qui a changé — et ouvrent leur bulle au focus clavier : un
  // libellé seul (« 2 changements ») ne dit pas de quel jour il s'agit.
  const accesRepere = (r: Repere) => ({
    actif: survol === r.index,
    "aria-label": `${principale.etiquettes[r.index]} · ${r.libelle}`,
    onFocus: () => setSurvol(r.index),
    onBlur: () => setSurvol(null),
  });

  const bouge = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setSurvol(i >= 0 && i < n ? i : null);
  };

  const ligneDates = (marge: string) => (
    <div className={`relative ${marge} h-5 mt-1`} aria-hidden>
      {repereDates.map((i) => (
        <span
          key={i}
          className={`absolute text-[11px] text-faint whitespace-nowrap ${n <= 1 ? "-translate-x-1/2" : i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
          style={{ left: `${xPct(i)}%` }}
        >
          {principale.etiquettes[i]}
        </span>
      ))}
    </div>
  );

  // Sans une seule valeur, l'échelle tomberait de 0 à 0 et l'axe écrirait
  // « 0,00 CHF » : un zéro lu là où rien n'est mesuré (ticket 18). Une phrase
  // à la hauteur du graphe, pour que le graphe voisin d'une grille ne saute pas.
  //
  // Les repères restent, en frise sans axe des valeurs (ticket 23) : une
  // campagne en pause avant la fenêtre la rend entièrement vide, et le jour où
  // elle a changé est justement ce qu'on vient chercher. Pas de ligne de base
  // non plus — sans graduation, elle se lirait comme un zéro.
  if (toutes.length === 0) {
    const frise = n > 0 && reperes.length > 0;
    return (
      <figure className="m-0 min-w-0" aria-label={titre}>
        <div className="flex flex-col items-center justify-center rounded-xl bg-canvas px-4" style={{ height: hauteur }}>
          <p className="text-center text-[12.5px] text-muted">Aucun chiffre à tracer sur cette période.</p>
          {/* Sous la phrase, pas au pied du cadre : en bas, là où la courbe
              pose le zéro, la frise se lirait comme une valeur nulle. */}
          {frise && (
            <div className="mt-4 w-full">
              <div className="relative h-6">
                {reperes.map((r) => (
                  <BoutonRepere
                    key={r.index}
                    {...accesRepere(r)}
                    onClick={onRepere && (() => onRepere(r.index))}
                    onPointerEnter={() => setSurvol(r.index)}
                    onPointerLeave={() => setSurvol(null)}
                    className="top-0"
                    style={{ left: `${xPct(r.index)}%` }}
                  />
                ))}
                {repereSurvole && (
                  <div
                    className="pointer-events-none absolute bottom-full z-10 mb-1 min-w-[170px] rounded-xl bg-ink/95 px-3 py-2.5 text-white shadow-xl"
                    style={{ left: `${xPct(repereSurvole.index)}%`, transform: bulleAGauche(repereSurvole.index) ? "translateX(-100%)" : undefined }}
                  >
                    <p className="text-[11px] text-white/60">{principale.etiquettes[repereSurvole.index]}</p>
                    <PastilleRepere libelle={repereSurvole.libelle} className="mt-0.5" />
                  </div>
                )}
              </div>
              {ligneDates("")}
            </div>
          )}
        </div>
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
            {ordre.map((si) =>
              troncons(series[si].valeurs).map((tr, k) =>
                tr.length > 1 ? (
                  <polyline
                    key={`${si}-${k}`}
                    points={tr.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={teinte(series[si])}
                    strokeWidth={series[si].pointille ? 1.5 : accent === si ? 3.5 : 2}
                    strokeOpacity={opacite(si)}
                    strokeDasharray={series[si].pointille ? "4 4" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                    className="courbe-apparait transition-[stroke-opacity] duration-200 motion-reduce:transition-none"
                  />
                ) : null
              )
            )}
            {/* La zone de clic d'une ligne : un trait invisible de 16 px, pour
                qu'on n'ait pas à viser les 2 px du tracé. */}
            {onSerie &&
              ordre.map((si) =>
                troncons(series[si].valeurs).map((tr, k) =>
                  tr.length > 1 ? (
                    <polyline
                      key={`zone-${si}-${k}`}
                      data-garde-choix
                      points={tr.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="stroke"
                      className="cursor-pointer"
                      onClick={() => onSerie(si)}
                      onPointerEnter={() => setSurvolSerie(si)}
                      onPointerLeave={() => setSurvolSerie(null)}
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
                        style={{ left: `${xPct(p.i)}%`, top: `${yPct(p.v)}%`, background: teinte(s), opacity: opacite(si) }}
                      />
                    ))
                : []
            )
          )}

          {ordre.flatMap((si) => {
            const s = series[si];
            const etat = choisie === null ? "repos" : choisie === si ? "choisi" : "efface";
            return (s.marques ?? []).map((i) => {
              const v = s.valeurs[i];
              return (
                <PointSerie
                  key={`marque-${si}-${i}`}
                  etat={etat}
                  couleur={teinte(s)}
                  data-garde-choix
                  aria-label={`${s.nom}, ${s.etiquettes[i]} : ${etat === "choisi" ? "voir ce qui a changé" : "a changé. Mettre la ligne en avant"}`}
                  onClick={() => (etat === "choisi" ? onMarque?.(si, i) : onSerie?.(si))}
                  onPointerEnter={() => setSurvolSerie(si)}
                  onPointerLeave={() => setSurvolSerie(null)}
                  onFocus={() => setSurvol(i)}
                  onBlur={() => setSurvol(null)}
                  style={{ left: `${xPct(i)}%`, top: `${yPct(v === null || v === undefined ? 0 : v)}%` }}
                />
              );
            });
          })}

          {reperes.map((r) => (
            <BoutonRepere
              key={r.index}
              {...accesRepere(r)}
              onClick={
                onRepere &&
                ((e) => {
                  // Le conteneur ouvre déjà le jour survolé : sans ça, un clic
                  // sur le point l'ouvrirait deux fois.
                  e.stopPropagation();
                  onRepere(r.index);
                })
              }
              className="-translate-y-1/2"
              style={{ left: `${xPct(r.index)}%`, top: `${yRepere(r.index)}%` }}
            />
          ))}

          {survol !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[170px] rounded-xl bg-ink/95 px-3 py-2.5 text-white shadow-xl"
              style={{ left: `${xPct(survol)}%`, transform: bulleAGauche(survol) ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
            >
              {/* Sur une ligne ou un de ses points, la bulle ne dit que son nom :
                  on vise une ligne, pas un jour (ticket 13 de
                  `.scratch/journal-meta/`, David : « bulle avec le nom seul »). */}
              {survolSerie !== null ? (
                <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                  <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: teinte(series[survolSerie]) }} />
                  <span className="truncate">{series[survolSerie].nom}</span>
                </p>
              ) : (
              <>
              {/* La période regardée d'abord, celle d'avant ensuite. */}
              {/* Une date ne s'écrit qu'une fois quand plusieurs séries la
                  partagent (la Comparaison) — quatre fois la même se lirait mal. */}
              {[...series].sort((a, b) => Number(!!a.pointille) - Number(!!b.pointille)).map((s, k, triees) => {
                const v = s.valeurs[survol];
                const date = s.etiquettes[survol];
                return (
                  <div key={k} className={`py-0.5 ${accent !== null && series.indexOf(s) !== accent ? "opacity-50" : ""}`}>
                    {(k === 0 || triees[k - 1].etiquettes[survol] !== date) && <p className="text-[11px] text-white/60">{date}</p>}
                    <p className="flex min-w-0 items-center gap-2">
                      <span className={`w-3 shrink-0 ${s.pointille ? "border-t border-dashed" : "h-[2px] rounded-full"}`} style={s.pointille ? { borderColor: GRIS } : { background: teinte(s) }} />
                      <span className="text-[13px] font-semibold tabular-nums">{v === null || v === undefined ? "—" : format(v)}</span>
                      <span className="truncate text-[11px] text-white/60">{s.nom}</span>
                    </p>
                  </div>
                );
              })}
              {repereSurvole && <PastilleRepere libelle={repereSurvole.libelle} className="mt-1.5 border-t border-white/10 pt-1.5" />}
              </>
              )}
            </div>
          )}
        </div>
      </div>

      {ligneDates("ml-16")}
    </figure>
  );
}
