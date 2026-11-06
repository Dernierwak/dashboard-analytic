// PROTOTYPE JETABLE — ticket « Le carré de sélection, en maquette »
// (.scratch/instagram/issues/12-le-carre-en-maquette.md). Ne part jamais sur
// `main` : il vit sur la branche `prototype/instagram-selection`.
//
// Le calcul de la foule tel que les tickets l'ont tranché, pour que la
// maquette montre des places VRAIES sur les posts du compte :
//  - la place d'un post se lit parmi les posts DE SON FORMAT, sur la période,
//    lui compris, sur la métrique choisie (ticket 06) ;
//  - quartiles en méthode « exclusive », celle de l'hebdo
//    (`blocs/canaux.py`, `statistics.quantiles(method="exclusive")`) ;
//  - hors norme au-delà de 1,5 × l'écart interquartile, fixe (tickets 06, 11) ;
//  - pas de place sous 6 posts du format (ticket 06) ;
//  - moins de 48 h : hors de la foule, la latence Meta (ticket 07). L'âge égal
//    de 48 h à 7 jours exige des relevés qui n'existent pas encore : la
//    maquette le signale par l'icône, sans le simuler ;
//  - « sans les hors norme » : Tukey en une passe (ticket 08).
import { valeurDe, type InstaPost } from "@/lib/channels";

export const METRIQUES = [
  { cle: "reach", nom: "Portée", court: "portée" },
  { cle: "likes", nom: "J'aime", court: "j'aime" },
  { cle: "comments", nom: "Commentaires", court: "comm." },
  { cle: "saved", nom: "Enregistrements", court: "enreg." },
  { cle: "views", nom: "Vues", court: "vues" },
  { cle: "eng", nom: "Engagement", court: "eng." },
] as const;

export const FORMATS = ["Reel", "Carrousel", "Image", "Vidéo du fil"] as const;
export const MINIMUM = 6;
const JEUNE_H = 48;
const RECENT_H = 7 * 24;

export type Place = "en dessous" | "bas de tes habitudes" | "haut de tes habitudes" | "au-dessus";

export type PostLu = {
  post: InstaPost;
  valeur: number | null;
  ageH: number;
  /** 48 h → 7 jours : « peut encore changer ». */
  recent: boolean;
  place: Place | null;
  horsNorme: "haut" | "bas" | null;
  /** Hors de la foule, et pourquoi. */
  dehors: string | null;
  /** Sorti par un filtre de lecture — il reste visible, grisé. */
  ecarte: boolean;
};

export type Foule = {
  format: string;
  lus: PostLu[];
  /** Les valeurs qui font la moustache. */
  valeurs: number[];
  /** Avant le filtre « sans les hors norme ». */
  nAvant: number;
  q: { q1: number; med: number; q3: number } | null;
};

// statistics.quantiles(data, n=4, method="exclusive") de Python.
function quartiles(v: number[]): { q1: number; med: number; q3: number } | null {
  if (v.length < MINIMUM) return null;
  const d = [...v].sort((a, b) => a - b);
  const m = d.length + 1;
  const q = [1, 2, 3].map((i) => {
    const j = Math.floor((i * m) / 4);
    const delta = i * m - j * 4;
    return (d[j - 1] * (4 - delta) + d[j] * delta) / 4;
  });
  return { q1: q[0], med: q[1], q3: q[2] };
}

function lire(p: InstaPost, cle: string): number | null {
  const v = valeurDe(p, cle);
  // La récolte écrit 0 pour une vue que l'API n'a pas rendue : la table
  // actuelle l'affiche déjà « — ».
  if (cle === "views" && v === 0) return null;
  // Les Reels n'ont aucun j'aime en base : la récolte ne les demande pas et
  // écrit 0 (ticket 02, « vidéo du fil sans `likes` »). Un 0 ici est une
  // absence, et la maquette ne doit pas en tirer un « post type 0 ».
  if (cle === "likes" && p.type === "Reel" && v === 0) return null;
  return v;
}

export function foules(posts: InstaPost[], cle: string, sansHorsNorme: boolean, maintenant: number): Foule[] {
  return FORMATS.map((format) => {
    const lus: PostLu[] = posts
      .filter((p) => (p.type === format))
      .map((p) => {
        const ageH = (maintenant - new Date(p.date).getTime()) / 3_600_000;
        const valeur = lire(p, cle);
        return {
          post: p,
          valeur,
          ageH,
          recent: ageH >= JEUNE_H && ageH < RECENT_H,
          place: null,
          horsNorme: null,
          dehors: ageH < JEUNE_H ? "moins de 48 h" : valeur === null ? "pas mesuré" : null,
          ecarte: false,
        };
      });
    const dedans = lus.filter((l) => l.dehors === null);
    const nAvant = dedans.length;
    let q = quartiles(dedans.map((l) => l.valeur!));
    const bornes = (qq: NonNullable<typeof q>) => {
      const ecart = 1.5 * (qq.q3 - qq.q1);
      return { bas: qq.q1 - ecart, haut: qq.q3 + ecart };
    };
    if (q) {
      const b = bornes(q);
      for (const l of dedans) {
        l.horsNorme = l.valeur! > b.haut ? "haut" : l.valeur! < b.bas ? "bas" : null;
        if (sansHorsNorme && l.horsNorme) l.ecarte = true;
      }
      if (sansHorsNorme) q = quartiles(dedans.filter((l) => !l.ecarte).map((l) => l.valeur!));
    }
    const valeurs = dedans.filter((l) => !l.ecarte).map((l) => l.valeur!);
    if (q) {
      for (const l of dedans) {
        const v = l.valeur!;
        l.place = v < q.q1 ? "en dessous" : v < q.med ? "bas de tes habitudes" : v <= q.q3 ? "haut de tes habitudes" : "au-dessus";
      }
    }
    return { format, lus, valeurs, nAvant, q };
  });
}

export type Mode = "haut" | "bas" | "recents" | "main";
export const MODES: { cle: Mode; nom: string }[] = [
  { cle: "haut", nom: "Les 5 meilleurs" },
  { cle: "bas", nom: "Les 5 moins bons" },
  { cle: "recents", nom: "Les 5 plus récents" },
  { cle: "main", nom: "À la main" },
];

export function selection(fs: Foule[], mode: Mode, choisis: string[], n: number): PostLu[] {
  const tous = fs.flatMap((f) => f.lus);
  if (mode === "main") return choisis.map((id) => tous.find((l) => l.post.id === id)).filter((l): l is PostLu => !!l);
  if (mode === "recents") return [...tous].sort((a, b) => b.post.date.localeCompare(a.post.date)).slice(0, n);
  // Les écartés ne sont pas candidats : « les 5 meilleurs » parmi ceux qui restent (ticket 08).
  const candidats = tous.filter((l) => l.valeur !== null && l.dehors === null && !l.ecarte);
  candidats.sort((a, b) => (mode === "haut" ? b.valeur! - a.valeur! : a.valeur! - b.valeur!));
  return candidats.slice(0, n);
}

export function fmt(v: number | null, cle: string): string {
  if (v === null) return "–";
  if (cle === "eng") return `${v.toFixed(1)} %`;
  return Math.round(v).toLocaleString("fr-CH").replace(/ | /g, " ");
}

export function age(h: number): string {
  if (h < 48) return `${Math.max(1, Math.floor(h))} h`;
  return `J+${Math.floor(h / 24)}`;
}

/** La place écrite, ou pourquoi il n'y en a pas. */
export function placeEcrite(l: PostLu, f: Foule | undefined): string {
  if (l.dehors) return l.dehors === "moins de 48 h" ? "trop jeune pour être placé (moins de 48 h)" : "pas mesuré sur cette métrique";
  if (!f?.q) return `pas de place — ${f ? f.valeurs.length : 0} ${l.post.type}${(f?.valeurs.length ?? 0) > 1 ? "s" : ""} sur la période, il en faut ${MINIMUM}`;
  if (l.horsNorme) return l.ecarte ? `hors norme ${l.horsNorme === "haut" ? "(au-dessus)" : "(en dessous)"} — écarté` : `hors norme ${l.horsNorme === "haut" ? "au-dessus" : "en dessous"}`;
  return l.place!;
}
