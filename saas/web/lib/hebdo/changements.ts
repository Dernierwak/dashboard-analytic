// `payload.canaux[c].changements` — ticket 06 (`blocs/changements.py`).
//
// Sans directive : la carte (serveur) le lit, et une constante exportée d'un
// `"use client"` se lirait côté serveur comme un proxy (`CLAUDE.md` §8).
import { lienMeta } from "@/lib/meta/liens";

/** Les catégories de la spec hebdo (user story 23), dans l'ordre d'affichage.
 *  `blocs/changements.py CATEGORIES` les écrit ; `statut` et `creation` de la
 *  base y arrivent déjà rangés sous `autre`. */
export const CATEGORIES_HEBDO = [
  "budget",
  "enchere",
  "audience",
  "creatif",
  "objectif",
  "motcle",
  "diffusion",
  "calendrier",
  "autre",
] as const;

export type CategorieHebdo = (typeof CATEGORIES_HEBDO)[number];

export const MOT_CATEGORIE_HEBDO: Record<CategorieHebdo, string> = {
  budget: "Budget",
  enchere: "Enchère",
  audience: "Audience",
  creatif: "Créatif",
  objectif: "Objectif",
  motcle: "Mot-clé",
  diffusion: "Diffusion",
  calendrier: "Calendrier",
  autre: "Autre",
};

export type ChangementHebdo = {
  /** Le jour du compte, « 2026-10-26 ». */
  jour: string;
  categorie: CategorieHebdo;
  campaign_id: string | null;
  campagne: string | null;
  /** Hors campagne : « Compte publicitaire » au niveau du compte, sinon le
   *  nom de l'élément touché ; `null` quand la plateforme ne le dit pas. */
  objet: string | null;
  resume: string;
};

/** Les changements rangés par catégorie, dans l'ordre de la spec. Une
 *  catégorie inconnue (payload d'une version à venir) tombe sous « Autre ». */
export function parCategorie(changements: ChangementHebdo[]): { categorie: CategorieHebdo; lignes: ChangementHebdo[] }[] {
  const groupes = new Map<CategorieHebdo, ChangementHebdo[]>();
  for (const c of changements) {
    const categorie = (CATEGORIES_HEBDO as readonly string[]).includes(c.categorie) ? c.categorie : "autre";
    groupes.set(categorie, [...(groupes.get(categorie) ?? []), c]);
  }
  return CATEGORIES_HEBDO.filter((k) => groupes.has(k)).map((categorie) => ({ categorie, lignes: groupes.get(categorie)! }));
}

/** « lun. 26 oct. » — le jour est déjà celui du compte : lu en UTC pour ne
 *  pas le décaler une seconde fois. */
export function jourCourt(jour: string): string {
  const d = new Date(`${jour}T00:00:00Z`);
  if (isNaN(d.getTime())) return jour;
  return d.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** « journal → » : le journal du canal ouvert sur la même semaine. Le lien
 *  part de la page hebdo, il ne garde donc aucun paramètre de `/meta` et
 *  n'énumère que ce qu'il change (`CLAUDE.md` §8) — `from` et `to`, que lit
 *  `periodeDe`, et l'onglet que lit `ongletDemandeDe`. `null` pour un canal
 *  dont la page n'a pas encore de journal. */
export function lienJournal(canal: string, semaine: { debut: string; fin: string } | null | undefined): string | null {
  if (canal !== "meta" || !semaine) return null;
  return lienMeta({}, { from: semaine.debut, to: semaine.fin, panneau: "changements" });
}
