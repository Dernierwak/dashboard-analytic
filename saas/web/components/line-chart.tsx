import type { CSSProperties } from "react";

// Courbe réutilisable — un seul rendu pour tous les graphes de l'app.
//
// LE SVG PORTE LA GÉOMÉTRIE, LE HTML PORTE TOUS LES CARACTÈRES.
//
// C'est la règle de fond, et elle vient d'un défaut mesuré. Le graphe était un
// `viewBox="0 0 720 150"` en `w-full` sans hauteur : le navigateur mettait donc
// tout à l'échelle de la largeur disponible. Sur un téléphone (conteneur ≈ 327
// px) le facteur vaut 0,45 — les dates de l'axe, écrites en `fontSize="10"`, se
// rendaient à 4,5 px. Sur un écran de bureau le même texte faisait 17 px. Aucun
// caractère de nos courbes n'avait de taille décidée.
//
// La correction n'est pas de fixer les tailles une par une : c'est de sortir le
// texte du SVG. Le SVG s'étire librement (`preserveAspectRatio="none"`) pour
// remplir une boîte dont la hauteur est en pixels CSS ; tout ce qui se lit —
// dates, étiquettes d'action, noms de zones, infobulles — est posé PAR-DESSUS
// en HTML absolu, positionné en pourcentages calculés avec la même arithmétique.
// Les deux couches coïncident donc au pixel près, et le texte cesse de dépendre
// de la largeur de l'écran.
//
// Trois conséquences, toutes bonnes :
//  · les points deviennent des ronds HTML — un cercle SVG étiré sans rapport
//    d'aspect uniforme donnerait un œuf ;
//  · l'infobulle est une vraie bulle stylée, immédiate, au lieu du `<title>`
//    natif qui met une seconde à venir et n'existe pas au doigt.
//
// Le trait, lui, garde `vectorEffect="non-scaling-stroke"` : sans ça il
// s'amincit jusqu'à disparaître sur mobile.

export type Serie = { name: string; color: string; values: (number | null)[] };

/** Une zone nommée en fond de courbe — « tu perds » / « sain » / « scalable ». */
export type BandeZone = { max: number | null; label: string; tone: "neg" | "warn" | "pos" };

/** Un repère d'action, avec ce qu'on en écrit. Le libellé est composé par
 *  l'appelant : lui seul sait si c'est une semaine ou un jour. */
export type Marqueur = { i: number; label: string };

export const TON_ZONE: Record<string, string> = {
  neg: "#c0392b",
  warn: "#b86b00",
  pos: "#1a7a4a",
};

// LES REPÈRES D'ACTION (points pleins sur la ligne du haut, cf. git blame
// pour l'ancienne mise en œuvre) NE SE DESSINENT PLUS SUR LA COURBE.
//
// Retiré à la demande de David (retour du 24 août 2026, TASK-008) : sur une
// carte de thème, ils ressortaient comme deux points noirs pleins au milieu
// des points bleus de la série et brouillaient la lecture de la courbe. La
// même information (quelle semaine porte une action, laquelle) reste
// disponible dans « Ton historique d'actions » — ce n'était donc pas la
// seule vue possible sur ce fait, juste celle qui vivait ici. `markers` /
// `marqueurs` restent acceptés pour ne pas casser les appelants existants,
// mais ne produisent plus rien à l'écran.

// Où poser un texte dont l'ancre est à `pct` % de la largeur, sans qu'il sorte
// du cadre. Aux bords on cale le texte contre le bord au lieu de le centrer.
function ancrage(pct: number): string {
  if (pct < 15) return "translate-x-0";
  if (pct > 85) return "-translate-x-full";
  return "-translate-x-1/2";
}

export function LineChart({
  labels,
  series,
  height = 190,
  fmt = (v: number) => String(Math.round(v)),
  unit = "",
  ariaLabel,
  repere,
  markers,
  marqueurs,
  bandes,
  socle = "zero",
}: {
  labels: string[];
  series: Serie[];
  /** Hauteur en pixels CSS sur grand écran ; 80 % de celle-ci sur téléphone. */
  height?: number;
  fmt?: (v: number) => string;
  unit?: string;
  ariaLabel: string;
  // Ligne de référence horizontale — le budget du jour, par exemple. Une
  // courbe sans seuil ne dit pas si ce qu'on voit est normal ou anormal.
  repere?: { value: number; label: string; color?: string };
  // Index des colonnes où une action a été appliquée — ne se dessine plus
  // (voir la note plus haut sur les repères d'action retirés).
  markers?: number[];
  /** Les mêmes repères, mais NOMMÉS — ne se dessinent plus non plus. */
  marqueurs?: Marqueur[];
  // Les zones de qualité, en fond de courbe. Elles remplacent la jauge séparée :
  // une jauge dit « où tu es maintenant », le fond dit « où tu es ET depuis
  // quand » — on voit le trait passer de moyen à bon entre deux semaines.
  // Absentes pour les indicateurs sans seuil de référence, et on ne leur en
  // invente pas : un CPC de 0,42 CHF est excellent ici et ruineux ailleurs.
  bandes?: BandeZone[];
  // OÙ COMMENCE L'AXE. Par défaut à ZÉRO, et c'est la seule valeur juste pour
  // un FLUX : une dépense de 40 CHF/jour contre 20 la veille, c'est le double,
  // et l'œil doit pouvoir le lire dans la hauteur du trait.
  //
  // `"bas"` est réservé aux CUMULS — le nombre d'abonnés, par exemple. Un stock
  // qui passe de 4 120 à 4 244 est une vraie croissance, mais sur un axe partant
  // de zéro c'est un trait plat : les 124 abonnés gagnés valent 3 % de la
  // hauteur. L'axe part alors du plus bas point, ET DEUX CHOSES SUIVENT, sans
  // quoi l'axe tronqué mentirait : les deux bornes sont ÉCRITES aux coins, et
  // l'aplat sous la courbe disparaît (une aire posée sur un socle arbitraire
  // exagère ce qu'elle remplit).
  //
  // La valeur par défaut vaut « rien ne change » : les dix-sept autres courbes
  // de l'app n'ont pas à être touchées.
  socle?: "zero" | "bas";
}) {
  const n = labels.length;
  if (n < 2 || series.length === 0) return null;

  const W = 720;
  const H = height;
  const PAD_L = 6, PAD_R = 6, PAD_B = 22;
  const PAD_T = 10;
  const plotH = H - PAD_T - PAD_B;

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  // Le repère entre dans l'échelle : sinon un seuil au-dessus du plus haut
  // point sortirait du cadre, et un seuil jamais atteint resterait invisible.
  // La dernière borne de zone aussi — sans quoi une courbe qui vit dans
  // « moyen » n'aurait jamais « bon » au-dessus d'elle, et la zone la plus
  // haute ne serait qu'un mot sans surface.
  const derniereBorne = (bandes ?? [])
    .map((b) => b.max)
    .filter((m): m is number => m !== null)
    .pop();
  const max = Math.max(
    ...all,
    repere?.value ?? 0,
    derniereBorne ? derniereBorne * 1.15 : 0,
    1
  );

  // Le socle « bas » n'a de sens que sur une courbe nue : dès qu'il y a des
  // zones nommées ou un seuil, ceux-ci portent l'échelle et la tronquer les
  // déplacerait sous les valeurs qu'ils commentent.
  const tronque = socle === "bas" && !bandes?.length && !repere && all.length > 0;
  const minReel = all.length ? Math.min(...all) : 0;
  // Une marge, sinon le plus bas point se colle à l'axe et le plus haut au bord.
  // Le plancher de 0,5 sert la série plate : sans lui, haut − bas vaudrait zéro.
  const marge = Math.max((max - minReel) * 0.08, 0.5);
  const bas = tronque ? minReel - marge : 0;
  const haut = tronque ? max + marge : max;
  const etendue = Math.max(haut - bas, 1e-9);

  const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / (n - 1);
  // Hors socle tronqué, c'est mot pour mot l'ancienne formule — `bas` vaut 0 et
  // `etendue` vaut `max`. Une courbe existante ne bouge pas d'un pixel.
  const y = (v: number) =>
    PAD_T +
    (1 - ((tronque ? Math.min(Math.max(v, bas), haut) : Math.min(v, max)) - bas) / etendue) * plotH;
  // Les deux couches se repèrent en pourcentage de la même boîte.
  const px = (i: number) => (x(i) / W) * 100;
  const py = (v: number) => (y(v) / H) * 100;
  const step = Math.max(1, Math.ceil(n / 8));
  const uid = labels.join("|").length + series.length; // id stable pour le dégradé
  const largeurCol = ((W - PAD_L - PAD_R) / (n - 1) / W) * 100;
  const montrerPoints = n <= 60;
  const taillePoint = n > 45 ? 5 : 7;

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
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.name} id={`lc-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* Les zones, en fond. Aplat très dilué : elles doivent se sentir
              sans jamais passer devant le trait qu'elles commentent. */}
          {(bandes ?? []).map((b, i) => {
            const bas = i === 0 ? 0 : bandes![i - 1].max ?? 0;
            const haut = b.max ?? max;
            if (haut <= bas) return null;
            return (
              <rect
                key={`z-${b.label}`}
                x={PAD_L}
                y={y(haut)}
                width={W - PAD_L - PAD_R}
                height={Math.max(0, y(bas) - y(haut))}
                fill={TON_ZONE[b.tone] ?? TON_ZONE.warn}
                opacity="0.09"
              />
            );
          })}

          {/* Le trait de séparation entre deux zones. Il n'est pas décoratif :
              « bon » et « excellent » sont tous les deux verts (ce sont deux
              bonnes nouvelles), donc sans lui la frontière entre les deux —
              c'est-à-dire le seuil — est invisible. */}
          {(bandes ?? []).slice(0, -1).map((b) =>
            b.max !== null && b.max < max ? (
              <line
                key={`zl-${b.label}`}
                x1={PAD_L}
                y1={y(b.max)}
                x2={W - PAD_R}
                y2={y(b.max)}
                stroke={TON_ZONE[b.tone] ?? TON_ZONE.warn}
                strokeOpacity="0.28"
                vectorEffect="non-scaling-stroke"
              />
            ) : null
          )}

          {/* Repères horizontaux : sans eux l'œil n'a aucune échelle. Ils
              disparaissent quand les zones sont là — deux quadrillages
              superposés ne se lisent plus ni l'un ni l'autre. */}
          {(bandes?.length ? [] : [0.5, 1]).map((f) => (
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

          {repere && repere.value > 0 && (
            <line
              x1={PAD_L}
              y1={y(repere.value)}
              x2={W - PAD_R}
              y2={y(repere.value)}
              stroke={repere.color ?? "#b86b00"}
              strokeWidth="1.5"
              strokeDasharray="6 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {series.map((s, si) => {
            const pts = s.values
              .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
              .filter(Boolean) as string[];
            if (pts.length < 2) return null;
            const first = s.values.findIndex((v) => v !== null);
            const last = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null);
            return (
              <g key={s.name}>
                {/* Pas d'aplat quand l'axe est tronqué : l'aire mesurerait la
                    distance à un socle arbitraire, pas à zéro. */}
                {!tronque && (
                  <path
                    d={`M${x(first).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${pts.join(" L")} L${x(last).toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`}
                    fill={`url(#lc-${uid}-${si})`}
                  />
                )}
                <polyline
                  points={pts.join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* ── Couche HTML : tout ce qui se lit ─────────────────────────── */}

        {/* Les points. Ronds parce qu'ils sont en HTML — un cercle SVG dans un
            cadre étiré sans rapport uniforme serait un ovale. */}
        {montrerPoints &&
          series.map((s) =>
            s.values.map((v, i) =>
              v === null ? null : (
                <span
                  key={`${s.name}-${i}`}
                  className="absolute rounded-full bg-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${px(i)}%`,
                    top: `${py(v)}%`,
                    width: taillePoint,
                    height: taillePoint,
                    border: `2px solid ${s.color}`,
                  }}
                />
              )
            )
          )}

        {/* Le haut de l'échelle. Sans lui une courbe n'a aucun ordre de
            grandeur : elle monte, mais de quoi à quoi ? Les zones nommées
            jouent ce rôle quand elles sont là — inutile de l'écrire deux fois. */}
        {!bandes?.length && !(repere && repere.value >= max) && (
          <span
            className="absolute left-0 text-[9.5px] text-faint pointer-events-none"
            style={{ top: `${(PAD_T / H) * 100}%` }}
          >
            {fmt(max)}
            {unit}
          </span>
        )}

        {/* LE BAS DE L'ÉCHELLE, écrit — et il n'est écrit QUE là où il ne vaut
            pas zéro. Un axe tronqué dont on ne lit pas le plancher fait passer
            +3 % pour un décollage : c'est le même défaut qu'une jauge sans sa
            cible, et il se corrige de la même façon. */}
        {tronque && (
          <span
            className="absolute left-0 text-[9.5px] text-faint pointer-events-none"
            style={{ top: `${((PAD_T + plotH) / H) * 100}%`, transform: "translateY(-100%)" }}
          >
            {fmt(minReel)}
            {unit}
          </span>
        )}

        {/* Le seuil est souvent le point le plus haut du cadre — un budget
            jamais atteint, par exemple. Son étiquette se pose alors SOUS le
            trait : au-dessus elle sortirait du cadre, et à cheval elle se
            ferait barrer par le trait qu'elle nomme. */}
        {repere && repere.value > 0 && (
          <span
            className="absolute right-0 text-[9.5px] font-semibold pointer-events-none"
            style={{
              top: `${py(repere.value)}%`,
              transform:
                py(repere.value) < 12 ? "translateY(3px)" : "translateY(calc(-100% - 3px))",
              color: repere.color ?? "#b86b00",
            }}
          >
            {repere.label}
          </span>
        )}

        {/* L'axe des dates. */}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <span
              key={`ax-${i}`}
              className={`absolute bottom-0 text-[10px] text-faint whitespace-nowrap pointer-events-none ${ancrage(px(i))}`}
              style={{ left: `${px(i)}%` }}
            >
              {l}
            </span>
          ) : null
        )}

        {/* Chaque colonne répond : viser un point de 3 px est impossible, et le
            `<title>` natif met une seconde à venir. La bulle est immédiate. */}
        {labels.map((l, i) => (
          <div
            key={`h-${i}`}
            className="group absolute top-0 bottom-0"
            style={{ left: `${px(i) - largeurCol / 2}%`, width: `${largeurCol}%` }}
          >
            <span
              className={`pointer-events-none absolute top-0 left-1/2 z-10 hidden group-hover:block rounded-lg bg-ink text-white text-[10.5px] font-semibold px-2 py-1 whitespace-nowrap shadow-card ${ancrage(px(i))}`}
            >
              {l} —{" "}
              {series
                .map(
                  (s2) =>
                    `${s2.name} ${s2.values[i] === null ? "—" : fmt(s2.values[i] as number)}${unit}`
                )
                .join(" · ")}
            </span>
          </div>
        ))}

      </div>

      {/* Les noms de zones, à droite du tracé, chacun en face de sa bande.
          Colonne de largeur FIXE en pixels : c'est ce qui les garde lisibles
          quelle que soit la largeur de l'écran. */}
      {bandes && bandes.length > 0 && (
        <div className="relative w-[52px] shrink-0">
          {bandes.map((b, i) => {
            const bas = i === 0 ? 0 : bandes[i - 1].max ?? 0;
            const haut = b.max ?? max;
            if (haut <= bas) return null;
            return (
              <span
                key={`nz-${b.label}`}
                className="absolute left-0 text-[9.5px] font-semibold leading-tight -translate-y-1/2"
                style={{
                  top: `${(py(bas) + py(haut)) / 2}%`,
                  color: TON_ZONE[b.tone] ?? TON_ZONE.warn,
                }}
                title={b.label}
              >
                {b.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
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
