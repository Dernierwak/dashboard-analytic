// LES CATÉGORIES D'UN CHANGEMENT DÉCLARÉ (`platform_changes.categorie`).
//
// La seule liste côté web : le type en découle, et chaque table typée
// `Record<CategorieChangement, …>` fait échouer `tsc` quand une catégorie lui
// manque — `diffusion` (ticket 19) a dû être ajoutée à la main à cinq endroits.
//
// ELLE CHANGE AVEC deux listes hors de ce dossier, que `tsc` ne voit pas :
//   · le CHECK `platform_changes_categorie_check` de
//     `saas/data/supabase/migrations/000_run_me_all.sql` — une catégorie
//     absente fait refuser TOUT le lot de changements au passage du worker ;
//   · `_ACTIVITES` de `saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`,
//     qui range chaque activité Meta dans une catégorie.
//
// Sans directive ni import : lue par le serveur, le navigateur et les harnais
// Node (`CLAUDE.md` §8).

export const CATEGORIES_CHANGEMENT = [
  "budget",
  "motcle",
  "enchere",
  "statut",
  "audience",
  "creatif",
  "creation",
  "objectif",
  "calendrier",
  "diffusion",
  "autre",
] as const;

export type CategorieChangement = (typeof CATEGORIES_CHANGEMENT)[number];
