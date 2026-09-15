// LE VOCABULAIRE DE LA PAGE THÈMES — types et mise en forme, rien d'autre.
//
// Pourquoi un fichier à part plutôt qu'un coin de `labels-listes.tsx` : les
// listes sont un composant CLIENT (elles portent des champs et des sélecteurs),
// le module de couverture est un composant SERVEUR. Les deux parlent des mêmes
// objets. Sans point commun neutre, l'un des deux devrait importer l'autre — et
// un composant serveur importé depuis un composant client bascule tout entier
// dans le paquet du navigateur.
//
// `fmtCHF` est recopié de `lib/report.ts` pour la même raison, et c'est la
// seule duplication assumée du lot : `lib/report` importe le client Supabase
// serveur, donc `next/headers` — l'importer depuis un composant client casse le
// build. Une ligne recopiée contre une dépendance impossible.

export type CanalLabel = "meta" | "google" | "instagram";

/** Un objet étiquetable : une campagne Meta, une campagne Google, un post. */
export type ElementLabel = {
  /** meta : campaign_name · google : campaign_id · instagram : uuid de la ligne */
  cle: string;
  canal: CanalLabel;
  /** nom de campagne, ou début de légende pour un post */
  nom: string;
  /** ce qui situe la ligne : une date, un statut. Jamais un chiffre. */
  sous: string | null;
  /** dépense sur la fenêtre du module. Toujours 0 sur Instagram : une
   *  publication organique ne coûte rien, et ce zéro-là est un fait, pas une
   *  mesure manquante — les lignes Instagram ne l'affichent donc pas. */
  depense: number;
  /** LES thèmes de l'élément, jamais LE thème. Une publication Instagram en
   *  porte plusieurs (`instagram_organic_posts.labels`), une campagne au plus
   *  un — la liste est le seul modèle qui dise vrai pour les deux. Elle est
   *  vide quand l'élément n'est pas étiqueté, et c'est ce vide-là qui le range
   *  dans « Sans thème ».
   *
   *  ELLE NE S'APLATIT PAS AVANT UN FILTRE. Un filtre par thème se lit
   *  `labels.some(...)` — voir `filtreParThemes` dans `lib/commandes.ts`. Un
   *  `labels[0]` posé là faisait disparaître de « Déjà étiqueté » un post
   *  étiqueté « Marque » ET « Promo » dès qu'on cochait « Promo », pendant que
   *  `/instagram` continuait de l'afficher : deux pages du même produit
   *  répondaient l'inverse à la même question
   *  (`.scratch/construction/issues/29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md`).
   *  `labels[0]` reste légitime pour AFFICHER un thème unique — un sélecteur
   *  n'a qu'une valeur — jamais pour décider ce qu'on garde. */
  labels: string[];
  /** 'user' | 'ai' | null — pilote la pastille IA des sélecteurs existants. */
  source: string | null;
  /** page d'arrivée (campagnes seulement, null sur Instagram) */
  landing: string | null;
};

/** Ce que le module de couverture mesure, sur UNE fenêtre annoncée. */
export type Couverture = {
  /** « 90 derniers jours pleins » — ce qui se colle au chiffre */
  fenetreCourte: string;
  /** « 15 mai → 12 aoû 2026 » — ce qui va au pied */
  fenetreLongue: string;
  depenseSansTheme: number;
  depenseTotale: number;
  metaSansTheme: number;
  googleSansTheme: number;
  postsSansTheme: number;
  /** nombre d'éléments sans thème, tous canaux — l'historique entier */
  sansTheme: number;
  total: number;
  /** false quand AUCUNE dépense n'a été relevée sur la fenêtre. Le module
   *  bascule alors son rang 3 sur un comptage et le DIT : « 0 CHF » écrit là
   *  où rien n'a été mesuré serait un chiffre faux. */
  mesurable: boolean;
  /** La dépense (fenêtre) et le nombre d'éléments (tout l'historique, tous
   *  canaux) rattachés à chaque thème — les parts du camembert de
   *  `labels-couverture`. Le « sans thème » n'y figure pas : il se construit
   *  à partir de `depenseSansTheme` et `sansTheme` ci-dessus, sa propre part. */
  parTheme: { label: string; depense: number; nb: number }[];
};

export function fmtCHF(n: number): string {
  return n.toLocaleString("fr-CH", { maximumFractionDigits: 0 }).replace(/ /g, " ");
}

/** Le glyphe de la source, dans sa couleur — même table que `etat-action`. */
export const GLYPHE: Record<CanalLabel, { signe: string; couleur: string; nom: string }> = {
  meta: { signe: "▣", couleur: "#1a56ff", nom: "Meta" },
  google: { signe: "◆", couleur: "#1a7a4a", nom: "Google" },
  instagram: { signe: "◎", couleur: "#7b4fff", nom: "Instagram" },
};
