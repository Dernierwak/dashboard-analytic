// ── LE BANDEAU DE COMMANDES : SON VOCABULAIRE ────────────────────────────────
//
// Ce que le bandeau porte, comment se nomme une période, et comment se lisent
// les thèmes posés dans l'URL. Le rendu est dans `components/bandeau-commandes.tsx`.
//
// CE FICHIER N'A PAS DE DIRECTIVE, ET C'EST VOULU. Les pages sont des composants
// SERVEUR et lisent `PRESETS` et `themesChoisis` ; exportées depuis le module
// `"use client"` voisin, ces valeurs y arriveraient en référence client et
// `PRESETS.find(...)` lèverait « Attempted to call find() from the server ».
// Ni `tsc` ni `npm run build` ne le voient — les pages canal sont en
// `force-dynamic`, donc aucune n'est exécutée à la construction. Voir
// `CLAUDE.md` §8, et la leçon payée en `.scratch/refonte/issues/15`.

/** Ce que le bandeau affiche. Tout est optionnel sauf le titre et les thèmes :
 *  un contrôle sans choix ne s'affiche pas (ticket 12 §3), et une page sans
 *  fenêtre à choisir (`/labels`, `/conversions`) n'a pas de période. */
export type Commandes = {
  /** Le titre de la page : le bandeau l'absorbe, la page ne le dessine plus. */
  titre: string;
  glyphe?: string;
  couleur?: string;
  /** Absent = cette page n'a pas de période à choisir. */
  periode?: {
    /** Les bornes de la fenêtre affichée, telles que la page les écrivait. */
    fenetre: string;
    jours: number;
    from?: string;
    to?: string;
  };
  /** Le vocabulaire complet du compte. Vide = pas de contrôle de thème. */
  themes: string[];
  themesActifs: string[];
  /** Propres aux pages payantes. */
  statuts?: string[];
  statutActif?: string;
  campagnes?: { key: string; name: string }[];
  campActive?: string;
};

export const PRESETS = [
  { v: 7, long: "7 derniers jours", court: "7 j" },
  { v: 14, long: "14 derniers jours", court: "14 j" },
  { v: 30, long: "30 derniers jours", court: "30 j" },
  { v: 90, long: "90 derniers jours", court: "90 j" },
  { v: 0, long: "Depuis le début", court: "Tout" },
];

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-08-05 » → « 5 août ». Une plage choisie à la main se lit ; `05/08/2026`
 *  demande un effort qu'aucun autre écran de Pulse ne demande. */
function jour(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MOIS[Number(m) - 1] ?? m}`;
}

/** Le nom de la période affichée, long ou court selon la place disponible. */
export function nomPeriode(p: NonNullable<Commandes["periode"]>, court = false): string {
  if (p.from && p.to) return `${jour(p.from)} → ${jour(p.to)}`;
  const preset = PRESETS.find((x) => x.v === p.jours);
  return court ? preset?.court ?? `${p.jours} j` : preset?.long ?? `${p.jours} derniers jours`;
}

export const nomStatut = (s: string) =>
  s === "ACTIVE" ? "Actives" : s === "PAUSED" ? "En pause" : s;

/**
 * LES THÈMES POSÉS DANS L'URL.
 *
 * `l`, répété (`?l=a&l=b`) et non séparé par des virgules : un thème peut
 * contenir une virgule, la liste deviendrait deux thèmes fantômes — même
 * raison que sur `/couts`, dont le filtre propre a été retiré par le ticket 28.
 *
 * `label` (singulier, une seule valeur) est l'ANCIEN nom des pages canal. Il
 * reste LU pour qu'aucun favori ni lien partagé ne casse, mais plus rien ne
 * l'écrit : le vieux nom s'éteint de lui-même (ticket 12 §5).
 */
export function themesChoisis(
  sp: { l?: string | string[]; label?: string } | undefined
): string[] {
  const brut = sp?.l;
  const multi = Array.isArray(brut) ? brut : brut ? [brut] : [];
  const retenus = multi.filter(Boolean);
  if (retenus.length) return retenus;
  return sp?.label ? [sp.label] : [];
}
