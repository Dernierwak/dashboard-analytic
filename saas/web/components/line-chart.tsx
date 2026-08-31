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
  // hauteur. L'axe part alors du plus bas point, ET UNE CHOSE SUIT, sans quoi
  // l'axe tronqué mentirait : les deux bornes sont ÉCRITES aux coins. Le
  // dégradé sous la courbe, lui, reste dans les deux cas (retour de David,
  // TASK-033 : le dégradé est une grammaire commune à toutes les courbes de
  // l'app, tronquées ou non — l'exception d'origine n'a plus lieu d'être).
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
  // Le point doit rester un point à haute densité, pas fusionner en bandeau —
  // ET rester au moins aussi grand que le trait qu'il marque, sinon il ne sert
  // à rien (rejet du checker, TASK-033 : un point de 2 px sous un trait de
  // 2,5 px `non-scaling-stroke` disparaît, avalé par la ligne, dès n=92).
  //
  // Ces points sont en HTML (voir l'en-tête du fichier), donc dimensionnés en
  // PIXELS RÉELS — indépendants de l'échelle du SVG. On mesure l'espacement
  // entre deux points consécutifs au plus étroit conteneur documenté par ce
  // fichier (téléphone ≈ 327 px, cf. plus haut) : SANS mesure réelle du
  // conteneur (l'architecture du fichier s'interdit le JS de mise en page,
  // voir l'en-tête), c'est la seule valeur qui garantit qu'aucun écran plus
  // large ne fusionne — un point sûr sur le plus étroit conteneur reste sûr
  // sur un plus large, juste pas dimensionné au mieux de la place disponible.
  //
  // Diamètre = 75 % de cet espacement, borné à [3, 7] px. Le plancher (3 px)
  // passe AVANT le calcul d'espacement quand les deux se contredisent — au-delà
  // de n≈108, l'espacement au pire cas mobile (2,7 px à n=120) devient plus
  // étroit que le plancher de visibilité : les points se recouvrent alors très
  // légèrement (≤ 0,3 px à n=120), un compromis choisi et documenté plutôt
  // qu'un point invisible. Le plafond (7 px) borne la taille sur les courbes
  // peu denses, où l'espacement calculé serait démesuré.
  const espacementPx = 327 * (largeurCol / 100);
  const taillePoint = Math.max(3, Math.min(7, espacementPx * 0.75));
  // L'anneau — 30 % du diamètre en bordure, donc 40 % en blanc central
  // (`D − 2×0,3D`) — RESTE VISIBLE À TOUTE TAILLE, y compris au plancher de
  // 3 px (bordure 0,9 px, blanc 1,2 px) : plus de bordure fixe qui mange tout
  // le disque en dessous de 5 px (bug du tour précédent). Même proportion
  // (30/70) que `Sparkline`, cf. sa note sur l'unification du point.
  const bordurePoint = taillePoint * 0.3;

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
                {/* Le dégradé descend jusqu'au bas du cadre dans tous les cas
                    — y compris un axe tronqué (`socle="bas"`) : toutes les
                    courbes de l'app portent la même grammaire (TASK-033). */}
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
              </g>
            );
          })}
        </svg>

        {/* ── Couche HTML : tout ce qui se lit ─────────────────────────── */}

        {/* Les points. Ronds parce qu'ils sont en HTML — un cercle SVG dans un
            cadre étiré sans rapport uniforme serait un ovale. Un point sur
            CHAQUE valeur, quel que soit n (retour de David, TASK-033) — voir
            le calcul de `taillePoint` plus haut pour la lisibilité à haute
            densité. */}
        {series.map((s) =>
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
                  border: `${bordurePoint}px solid ${s.color}`,
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

// Version minuscule — juste la forme, glissée dans une tuile pour transformer
// un chiffre nu en tendance lisible d'un coup.
//
// A PORTÉ UNE COUCHE HTML AU-DESSUS DU SVG (TASK-037) — ce qu'elle n'avait
// jamais eu jusque-là (« pas de texte ici, donc pas besoin de la couche HTML »,
// disait l'ancienne note). Deux retours de David l'ont rendue nécessaire :
// « les points sont énormes et on peut pas hover ». Le second à lui seul
// l'imposait déjà — une bulle est du texte, donc de la couche HTML, par la
// règle de tête de fichier. Le premier confirme que la couche SVG seule ne
// pouvait de toute façon plus suffire : voir pourquoi juste en dessous.
//
// LA TAILLE DU POINT DEVIENT UN NOMBRE DE PIXELS RÉELS — plus une proportion
// de l'espacement DANS LE VIEWBOX. C'est le cœur du bug rapporté : l'ancienne
// formule plafonnait l'ENCRE (rayon×2 + bordure) à 70 % de l'espacement
// mesuré en unités du viewBox (100 de large, quel que soit n). Cette unité
// n'a pas de taille fixe à l'écran : elle vaut ce que le NAVIGATEUR décide en
// étalant ces 100 unités sur la largeur réelle de la tuile. Sur une tuile
// étroite (téléphone, ~180 px) une unité valait ~1,8 px et le point restait
// petit ; sur une tuile large (bureau, un `sm:grid-cols-3` peut donner
// ~350 px à la carte) la MÊME unité valait ~3,5 px, et le même point plafonné
// à 4,4 unités faisait ~15 px de diamètre — un point qui domine la courbe
// qu'il est censé illustrer. Exactement ce que David a vu. `LineChart` n'a
// pas ce défaut parce que SES points sont déjà en HTML, dimensionnés en
// pixels réels constants (cf. sa note sur `327`) — c'est la même correction
// qu'on applique ici, à l'identique dans l'esprit, avec une largeur de
// référence et des bornes propres à ce composant, plus petit.
//
// LA HAUTEUR RENDUE DE LA FORME, ELLE, N'A PAS CHANGÉ ET NE DEVAIT PAS
// CHANGER — seule la taille du point était en cause. Le SVG d'origine
// (`w-full`, sans hauteur CSS) suivait le ratio intrinsèque du viewBox
// (`W:H`, soit `10:3` pour `H=30`) : sur une tuile mesurée à 312 px de large
// (Meta/Google) ou 355 px (Coûts), la forme rend ≈ 94 à 106 px de haut — PAS
// 26 à 30 px. La boîte qui porte la couche HTML (plus bas) reproduit ce même
// ratio via `aspectRatio` plutôt qu'une hauteur fixée en pixels, pour ne pas
// racourcir la forme d'un facteur ~3 (voir la note sur le retour du checker,
// juste avant le `return`).
//
// LA LARGEUR DE RÉFÉRENCE POUR L'ESPACEMENT ENTRE POINTS EST 180 PX — pas les
// 327 px de `LineChart`. Ce n'est pas un pire cas théorique qu'aucune tuile
// n'atteindrait : c'est le rendu MOBILE RÉEL. `chiffre.tsx` pose
// `min-w-[180px] shrink-0` sous le point de rupture `sm:` ; en dessous de
// `sm:`, le contenu `max-content` d'une tuile (titre ~10 px + chiffre ~30 px
// + `Pente` ~11 px + le padding de la carte) reste plus étroit que 180 px, donc
// c'est le `min-width` qui gouverne — la tuile fait EXACTEMENT 180 px, pas
// « au moins ». Et ce cas n'a rien d'un cas limite qu'on n'atteindrait jamais :
// `PeriodPills` propose 7 j, ce qui donne `n = 7` sur `d.daily`, et
// `taillePoint = clamp(180/6 × 0,75, 2, 4) = 4 px` s'y applique réellement, pas
// en théorie.
//
// Au-delà de `sm:`, la grille passe à `sm:grid-cols-3` avec `sm:min-w-0` :
// AU POINT DE RUPTURE EXACT (viewport 640 px), le conteneur de page fait
// 640 − 48 px de padding = 592 px (`app/meta/page.tsx`), et `sm:grid-cols-3
// gap-3` donne `(592 − 2×12) / 3 ≈ 189,3 px` par carte — un peu plus que
// 180 px, donc le plancher mobile reste le pire cas, mais de peu (≈ 9 px, pas
// les ~20 px qu'un calcul arrondi à « ~200 px » aurait suggéré). Au-delà de ce
// point de rupture le conteneur ne fait que s'élargir, donc 180 px reste bien
// le pire cas documenté sur toute la plage, comme `LineChart` prend le sien
// sur le plus étroit conteneur qu'il liste. Sans mesure réelle du conteneur
// (l'architecture s'interdit le JS de mise en page, voir l'en-tête du
// fichier), un point sûr au pire cas documenté reste sûr sur toute tuile plus
// large — juste pas dimensionné au mieux de la place disponible là où il y en
// a plus. CE PIRE CAS NE BORNE QUE L'ESPACEMENT ENTRE POINTS, PAS LA HAUTEUR
// affichée — celle-ci suit toujours la largeur RÉELLE du conteneur, cf. le
// paragraphe précédent.
//
// LE CALCUL, POUR DES VALEURS DE `daily` PLAFONNÉES À 120 (`lib/channels.ts`,
// `chiffre.tsx` lit la même série que `channel-dash.tsx`) :
//   espacementPx = 180 / (n − 1)
//   taillePoint  = clamp(espacementPx × 0,75, 2, 4)   — diamètre, en pixels réels
//   bordurePoint = taillePoint × 0,3                  — même proportion que
//                                                        `LineChart`
// Le plancher (2 px) est EXACTEMENT la largeur du trait (`strokeWidth="2"`
// plus bas) : sous ce plancher le point serait plus fin que la ligne qu'il
// marque et s'y ferait avaler (même raison que `LineChart`, cf. sa note). Le
// plafond (4 px) est la moitié de celui de `LineChart` (7 px) — vérifié
// contre la hauteur RÉELLE (voir plus haut), pas contre les 26-30 px qu'on
// aurait pu croire de mémoire (CLAUDE.md §7) : sur les tuiles larges mesurées
// (94 à 106 px de haut), un point de 4 px vaut 3,8 à 4,3 % de la hauteur, du
// même ordre que les 3,7 % de `LineChart` (7 px sur 190 px). Sur la tuile
// mobile de 180 px (ci-dessus — RÉELLEMENT rendue, pas un pire cas écarté),
// la hauteur vaut 54 px et le même point y pèse 7,4 % — plus que `LineChart`,
// mais encore un point net, pas un disque qui avale la courbe ; assumé, pas
// annulé par une largeur qu'on ne rencontrerait jamais.
//
// LE RECOUVREMENT, à ce plancher, commence quand `2 > 180/(n−1)`, soit
// n > 91 — DONC À PARTIR DE n = 92. Au maximum réellement servi (n = 120),
// l'espacement au pire cas (180 px) vaut 180/119 ≈ 1,513 px contre un point
// plancher de 2 px : un recouvrement de ≈ 0,487 px entre deux points voisins,
// UN PEU PLUS que celui accepté par `LineChart` (≤ 0,3 px à n = 120) parce que
// son pire cas (327 px) est presque deux fois plus large que celui-ci
// (180 px) — la même physique, sur une tuile deux fois plus étroite. Comme
// pour `LineChart`, c'est un compromis choisi et documenté : en dessous du
// plancher de lisibilité, un point invisible serait pire qu'un point qui
// touche à peine son voisin.
//
// LA BULLE AU SURVOL reprend le principe de `LineChart` (une zone HTML par
// colonne, une bulle qui s'affiche au survol ET au focus — ce dernier ajouté
// ici en s'inspirant de `BarChart`, TASK-031, pour répondre aussi au clavier
// et au doigt qui ne « survole » jamais). Elle montre la valeur — au minimum
// exigé — et la date quand l'appelant la fournit (`labels`, le `label` du
// `DayPoint` correspondant) ; sans elle, la bulle se contente de la valeur.
export function Sparkline({
  values,
  color = "#1a56ff",
  height = 26,
  labels,
  unite,
  fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2)),
}: {
  values: (number | null)[];
  color?: string;
  height?: number;
  /** Le libellé de chaque colonne — une date, le plus souvent (`DayPoint.label`
   *  côté appelant). Affiché dans la bulle au survol quand fourni. */
  labels?: string[];
  /** Ajouté après la valeur dans la bulle (« CHF », « % »…) — le même que celui
   *  affiché en tête de la tuile par `Chiffre`. */
  unite?: string;
  fmt?: (v: number) => string;
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
    .map((v, i) => (v === null ? null : { x: x(i), y: y(v) }))
    .filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 2) return null;
  const uid = `${n}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const chemin = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");

  // Voir la note plus haut pour le détail du calcul et son recouvrement
  // documenté au-delà de n = 91.
  const LARGEUR_MIN_TUILE = 180;
  const espacementPx = LARGEUR_MIN_TUILE / (n - 1);
  const taillePoint = Math.max(2, Math.min(4, espacementPx * 0.75));
  const bordurePoint = taillePoint * 0.3;
  // `x(i)` est déjà un pourcentage (`W` vaut 100) ; seul `y(v)` a besoin d'être
  // ramené en pourcentage de `H`.
  const topPct = (v: number) => (y(v) / H) * 100;
  const largeurColPct = 100 / (n - 1);

  return (
    // `aspectRatio`, pas une hauteur CSS fixe : L'ANCIEN SVG (`w-full`, sans
    // hauteur) suivait déjà le ratio intrinsèque du viewBox (`W:H`, donc
    // `10:3` pour `H=30`) — sur une tuile de 312 px de large (Meta/Google) ou
    // 355 px (Coûts), la forme rendait ≈ 94 à 106 px de haut, jamais 26-30 px.
    // Fixer `height: H` ici aurait DIVISÉ CETTE HAUTEUR PAR ~3 : un
    // changement visuel non demandé par la tâche (qui ne portait que sur les
    // points et le survol), qui raccourcit chaque tuile d'environ 70 px et
    // réduit d'autant la zone de survol. `aspect-ratio` reproduit exactement
    // le comportement précédent — la boîte suit `W/H`, sa hauteur réelle
    // découle de la largeur du conteneur — tout en donnant à la couche HTML
    // une boîte dont les pourcentages coïncident avec ceux du SVG.
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`spk-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M${pts[0].x.toFixed(1)},${H} L${chemin} L${pts[pts.length - 1].x.toFixed(1)},${H} Z`}
          fill={`url(#spk-${uid})`}
        />
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Les points — en HTML, en pixels réels (voir la note plus haut). */}
      {values.map((v, i) =>
        v === null ? null : (
          <span
            key={i}
            className="absolute rounded-full bg-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${x(i)}%`,
              top: `${topPct(v)}%`,
              width: taillePoint,
              height: taillePoint,
              border: `${bordurePoint}px solid ${color}`,
            }}
          />
        )
      )}

      {/* La bulle au survol — une colonne par valeur, comme `LineChart` et
          `BarChart`. `left-1/2` pose son ancre au CENTRE de la colonne (donc
          au-dessus du point qu'elle commente, pas au bord gauche de la
          colonne) ; `ancrage(x(i))` retranslate ensuite selon la position du
          point près des bords, exactement comme `LineChart`/`BarChart`
          l'utilisent ensemble (cf. leurs classes respectives). Posée
          AU-DESSUS de la forme (`bottom-full`) plutôt que dedans, pour ne
          jamais recouvrir le point qu'elle commente. La carte qui la
          contient a de la marge au-dessus (titre, chiffre, delta) : elle ne
          se fait pas couper par l'`overflow-hidden` de la tuile
          (`chiffre.tsx`). */}
      {values.map((v, i) =>
        v === null ? null : (
          <div
            key={`h-${i}`}
            tabIndex={0}
            className="group absolute top-0 bottom-0 outline-none"
            style={{ left: `${x(i) - largeurColPct / 2}%`, width: `${largeurColPct}%` }}
          >
            <span
              className={`pointer-events-none absolute bottom-full left-1/2 mb-1 z-10 hidden group-hover:block group-focus-within:block rounded-lg bg-ink text-white text-[10.5px] font-semibold px-2 py-1 whitespace-nowrap shadow-card ${ancrage(x(i))}`}
            >
              {labels?.[i] ? `${labels[i]} — ` : ""}
              {fmt(v)}
              {unite ? ` ${unite}` : ""}
            </span>
          </div>
        )
      )}
    </div>
  );
}
