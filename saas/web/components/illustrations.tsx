import { COULEURS as C } from "@/lib/couleurs";

// LES DESSINS DE PULSE — trois scènes, toutes tirées du même carnet de relevés
// que le reste de l'identité (`docs/identite-visuelle.md`) : papier, encre
// bleue, surligneur, et le stylo rouge de celui qui relit.
//
// AUCUN CHIFFRE DANS UN DESSIN. Un nombre posé sur une feuille qui ressemble à
// un rapport se lit comme une donnée — et ce serait une donnée fabriquée
// (`CLAUDE.md` §7). Les lignes de texte sont des traits gris, la courbe n'a
// pas d'axe gradué.
//
// Décoratifs par nature : `aria-hidden`, et la page dit en texte tout ce
// qu'ils montrent.
//
// `id` PRÉFIXE LES IDENTIFIANTS SVG (motif, filtre) et doit différer entre deux
// dessins de la même page. Sinon le second `url(#…)` pointe vers le premier —
// et si le premier est masqué (`display: none`, la version téléphone), le
// filtre ne se résout plus et la feuille entière disparaît. Constaté sur
// `/login` au premier rendu.

const TRAIT = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** La feuille de la semaine, relue et annotée — la page de connexion. */
export function FeuilleRelevee({ className = "", id = "fr" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 400 344" className={className} aria-hidden focusable="false">
      <defs>
        <pattern id={`${id}-milli`} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke={C.encre} strokeOpacity="0.07" strokeWidth="0.8" />
        </pattern>
        <filter id={`${id}-ombre`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor={C.graphite} floodOpacity="0.12" />
        </filter>
      </defs>

      {/* La semaine d'avant, déjà rangée dessous. */}
      <g transform="rotate(-6 190 170)">
        <rect x="62" y="46" width="236" height="258" rx="6" fill={C.feuille} stroke={C.axe} strokeWidth="0.8" filter={`url(#${id}-ombre)`} />
        <rect x="84" y="70" width="90" height="7" rx="3.5" fill={C.quadrillage} />
      </g>

      {/* La feuille de cette semaine. */}
      <g transform="rotate(2.5 190 170)">
        <rect x="70" y="34" width="236" height="262" rx="6" fill={C.feuille} stroke={C.axe} strokeWidth="0.8" filter={`url(#${id}-ombre)`} />
        <rect x="92" y="58" width="58" height="6" rx="3" fill={C.axe} />
        <text
          x="92"
          y="96"
          fill={C.graphite}
          style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: 27, letterSpacing: "-0.02em" }}
        >
          Ta semaine.
        </text>

        {/* La phrase qui compte, surlignée à la main. */}
        <path d="M90 121.5 L204 118.5 L205 128 L91 130.5 Z" fill={C.surligneur} opacity="0.9" />
        <rect x="93" y="115" width="106" height="8" rx="4" fill={C.graphite} opacity="0.78" />
        <rect x="93" y="136" width="172" height="6" rx="3" fill={C.quadrillage} />
        <rect x="93" y="148" width="128" height="6" rx="3" fill={C.quadrillage} />

        {/* La frise : un fond millimétré et une courbe qui bouge une fois. */}
        <rect x="92" y="170" width="192" height="98" rx="4" fill={`url(#${id}-milli)`} />
        <path
          d="M92 250 L116 242 L138 246 L160 232 L182 238 L204 196 L228 214 L252 206 L284 212 L284 268 L92 268 Z"
          fill={C.encre}
          opacity="0.08"
        />
        <path
          {...TRAIT}
          d="M92 250 L116 242 L138 246 L160 232 L182 238 L204 196 L228 214 L252 206 L284 212"
          stroke={C.encre}
          strokeWidth="2.2"
        />
        <circle cx="204" cy="196" r="3.4" fill={C.feuille} stroke={C.encre} strokeWidth="2" />

        {/* Le stylo rouge : un cercle qui ne se referme pas tout à fait. */}
        <path
          {...TRAIT}
          d="M190 186 C 194 176, 216 174, 220 188 C 223 200, 208 210, 196 205 C 188 201, 187 193, 193 187"
          stroke={C.neg}
          strokeWidth="1.8"
        />
      </g>

      {/* L'annotation en marge, et sa flèche vers ce qu'elle désigne. */}
      <text
        x="286"
        y="120"
        fill={C.neg}
        transform="rotate(-8 330 118)"
        style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 23 }}
      >
        ce qui a bougé
      </text>
      <path
        {...TRAIT}
        d="M318 130 C 312 150, 262 158, 232 176 M232 176 l 11 -2 M232 176 l 3 -10.5"
        stroke={C.neg}
        strokeWidth="1.6"
      />

      {/* Le trombone, qui tient les deux semaines ensemble. */}
      <path
        {...TRAIT}
        d="M112 18 V 58 a 7 7 0 0 0 14 0 V 22 a 4.5 4.5 0 0 0 -9 0 V 54"
        stroke={C.gris}
        strokeWidth="2.2"
        transform="rotate(4 118 40)"
      />
    </svg>
  );
}

/** Un carnet encore vierge — ce qui n'a pas été relevé, sans le dramatiser. */
export function CarnetVierge({ className = "", id = "cv" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} aria-hidden focusable="false">
      <defs>
        <pattern id={`${id}-milli`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke={C.encre} strokeOpacity="0.08" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x="28" y="12" width="104" height="86" rx="6" fill={C.feuille} stroke={C.axe} />
      <rect x="28" y="12" width="104" height="86" rx="6" fill={`url(#${id}-milli)`} />
      {/* La spirale du carnet. */}
      {[24, 38, 52, 66, 80].map((y) => (
        <path key={y} {...TRAIT} d={`M22 ${y} a 6 5 0 0 1 12 0`} stroke={C.gris} strokeWidth="1.6" />
      ))}
      {/* Une courbe en pointillé : ce qui SERA mesuré, pas encore mesuré. */}
      <path
        {...TRAIT}
        d="M44 70 C 60 70, 66 52, 82 56 S 104 44, 118 46"
        stroke={C.encre}
        strokeOpacity="0.45"
        strokeWidth="1.8"
        strokeDasharray="2 5"
      />
      {/* Le crayon, posé en travers. */}
      <g transform="rotate(-32 118 84)">
        <rect x="96" y="80" width="40" height="8" rx="1.5" fill={C.surligneur} stroke={C.graphite} strokeOpacity="0.5" />
        <path d="M136 80 L146 84 L136 88 Z" fill={C.feuille} stroke={C.graphite} strokeOpacity="0.5" strokeLinejoin="round" />
        <path d="M143 82.8 L146 84 L143 85.2 Z" fill={C.graphite} />
        <rect x="92" y="80" width="5" height="8" rx="1" fill={C.neg} opacity="0.7" />
      </g>
    </svg>
  );
}

/** Une prise débranchée — une source qui n'a pas répondu, à rebrancher. */
export function PriseDebranchee({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" className={className} aria-hidden focusable="false">
      {/* Le câble et sa fiche. */}
      <path {...TRAIT} d="M4 52 C 20 52, 26 36, 42 36" stroke={C.gris} strokeWidth="2.4" />
      <rect x="42" y="27" width="16" height="18" rx="4" fill={C.feuille} stroke={C.graphite} strokeOpacity="0.7" strokeWidth="1.6" />
      <path {...TRAIT} d="M58 31.5 h 7 M58 40.5 h 7" stroke={C.graphite} strokeOpacity="0.7" strokeWidth="2" />
      {/* L'écart : trois traits, le seul signe de « ça ne passe plus ». */}
      <path {...TRAIT} d="M73 25 l 3 -5 M75 36 h 6 M73 47 l 3 5" stroke={C.warn} strokeWidth="1.8" />
      {/* La prise murale. */}
      <rect x="86" y="18" width="28" height="36" rx="7" fill={C.warn} fillOpacity="0.1" stroke={C.warn} strokeWidth="1.6" />
      <circle cx="95" cy="36" r="2" fill={C.warn} />
      <circle cx="105" cy="36" r="2" fill={C.warn} />
    </svg>
  );
}
