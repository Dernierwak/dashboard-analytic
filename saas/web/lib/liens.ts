import type { DashParams } from "@/lib/channels";

// ── LES LIENS D'UNE PAGE CANAL, EN UN SEUL ENDROIT ───────────────────────────
//
// Il y avait SIX constructeurs de liens sur les trois pages : les pastilles de
// période (pub), le sélecteur de métrique (pub), le lien « passe sur Tout » des
// moyennes, les pastilles de période (Instagram), le sélecteur de métrique
// (Instagram) et les en-têtes de tri. Chacun rebâtissait la query à la main.
//
// LE DÉFAUT N'ÉTAIT PAS QU'ILS ÉTAIENT SIX, C'EST QU'ILS ÉNUMÉRAIENT CE QU'ILS
// GARDENT. Un constructeur qui liste les paramètres à recopier perd, par
// construction, tout paramètre ajouté après lui — et il le perd en silence, en
// produisant une URL parfaitement valide. C'est exactement ce qui est arrivé à
// `cmp` / `cfrom` / `cto` : on posait « l'an dernier », on cliquait « 30 j », et
// la comparaison redevenait « période précédente » sans que rien ne l'annonce.
// Le sélecteur de métrique d'Instagram perdait en plus le tri et la période sur
// mesure, depuis bien avant.
//
// Ici on énumère CE QU'ON CHANGE. Le reste passe parce qu'il était là. Un
// septième paramètre ajouté demain traversera les six liens sans qu'on ait à y
// penser — c'est la seule forme de correction qui ne se redéfait pas.

/**
 * `d` (preset) et `from`/`to` (plage libre) désignent la même chose : la
 * période affichée. `customWindow` prime sur `makeWindow`, donc les laisser
 * cohabiter rendrait les pastilles de période inertes — on clique « 7 j », la
 * plage libre continue de gouverner, et le bouton a l'air cassé. Poser l'un
 * efface l'autre, dans les deux sens.
 */
function exclusifs(base: DashParams, patch: Partial<DashParams>): void {
  // `"d" in patch` et non `patch.d !== undefined` : la pastille « 7 j » pose
  // volontairement `d: undefined` pour sortir le paramètre de l'URL, et c'est
  // un CHANGEMENT de période comme un autre.
  if ("d" in patch) {
    base.from = undefined;
    base.to = undefined;
  }
  if ("from" in patch || "to" in patch) base.d = undefined;
}

/**
 * Un lien vers la même page, avec un réglage changé et tous les autres gardés.
 *
 * `sp` EST TYPÉ `DashParams`, MAIS CE TYPE NE FILTRE RIEN. Ce qui arrive ici
 * est l'objet que Next passe à la page : TOUS les paramètres de l'URL, y
 * compris ceux que `DashParams` ne déclare pas. La boucle ci-dessous parcourt
 * les clés réelles, donc un paramètre inconnu du type traverse quand même le
 * lien — vérifié, et c'est bien ce qu'on veut (on énumère ce qu'on CHANGE). Le
 * type est une DESCRIPTION de ce qu'on manipule, jamais la liste de ce qui
 * passe : ne pas conclure de sa lecture qu'un paramètre non listé est perdu.
 *
 * `metriqueParDefaut` diffère d'un canal à l'autre (`spend` en publicité,
 * `reach` sur Instagram) : c'est la seule chose que la fonction ne peut pas
 * deviner, et la seule qu'elle demande.
 */
export function lienDash(
  path: string,
  sp: DashParams | undefined,
  patch: Partial<DashParams>,
  metriqueParDefaut: string
): string {
  const base: DashParams = { ...(sp ?? {}), ...patch };
  exclusifs(base, patch);

  // Une valeur qui EST le défaut ne s'écrit pas : `/meta` et
  // `/meta?d=7&m=spend&s=date` sont la même page, et la première se partage.
  const defaut: Record<string, string> = { d: "7", s: "date", m: metriqueParDefaut };

  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    // UN PARAMÈTRE RÉPÉTÉ DOIT SURVIVRE AU LIEN. `?l=a&l=b` arrive ici comme un
    // tableau ; `String(["a","b"])` l'aurait aplati en `l=a,b`, soit un thème
    // fantôme nommé « a,b » — la même perte silencieuse que celle décrite
    // ci-dessus, sous une autre forme.
    if (Array.isArray(v)) {
      for (const x of v) if (x) q.append(k, String(x));
      continue;
    }
    const s = v === undefined || v === null ? "" : String(v);
    if (!s || defaut[k] === s) continue;
    q.set(k, s);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

// ── L'ANCRE D'UNE CARTE DE THÈME ─────────────────────────────────────────────
//
// Elle vivait dans `components/theme-card.tsx`, qui la posait et l'utilisait.
// Elle en sort parce qu'une page canal en a besoin pour renvoyer vers la carte
// d'où l'on vient (`components/retour-rapport.tsx`) : importer `theme-card`
// depuis `/meta` ferait entrer tout l'arbre du rapport — courbe, rail, notes —
// dans le graphe d'une page qui n'en rend aucun morceau. Une adresse est un
// lien, et les liens se tiennent ici.

/** L'ancre de la carte d'un thème, pour y renvoyer d'ailleurs — `#theme-mon-sujet`. */
export function ancreTheme(label: string): string {
  return (
    "theme-" +
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

// ── LA PORTE VERS LA PLATEFORME ──────────────────────────────────────────────
//
// Le rapport n'avait aucun lien sortant vers `/meta`, `/google` ou
// `/instagram` : on atteignait les trois pages canal par la colonne de gauche
// seulement, donc en quittant le fil de la semaine sans emporter ce qu'on était
// en train de lire. C'est le cul-de-sac que ce constructeur ferme
// (`.scratch/construction/issues/14-la-porte-vers-la-plateforme.md`).
//
// LA PORTE EMPORTE LE THÈME **ET** LA FENÊTRE, et les deux ensemble. La carte
// d'un thème affiche « 4 520 CHF dépensé » sur la fenêtre du bilan ; une page
// canal s'ouvre par défaut sur ses 7 derniers jours et afficherait « 103 CHF »
// pour le même thème. Le chiffre n'est faux ni d'un côté ni de l'autre, mais
// l'écart au clic se lit comme un bug — et une porte qui a l'air cassée ne se
// franchit qu'une fois.
//
// `l` ET NON `label` : le ticket parlait de `?label=`, qui était le vocabulaire
// des pages canal au moment où il a été écrit. Depuis, le bandeau de commandes
// a tranché un nom unique pour les quatre pages — `l`, répété — et `label` est
// devenu un ANCIEN nom qu'on lit encore mais qu'on n'écrit plus jamais
// (`lib/commandes.ts`, `themesChoisis`). Écrire `label` ici ferait de la porte
// le seul producteur d'un paramètre qu'on a décidé d'éteindre.

export type Canal = "meta" | "google" | "instagram";

/** La métrique par défaut de chaque page — la seule chose que `lienDash` ne
 *  peut pas deviner, et la seule qu'il demande. */
const METRIQUE_PAR_DEFAUT: Record<Canal, string> = {
  meta: "spend",
  google: "spend",
  instagram: "reach",
};

/**
 * Le lien d'une carte de thème vers la page de la plateforme où il tourne.
 *
 * `de` porte le thème D'OÙ L'ON VIENT, et c'est autre chose que `l` qui filtre :
 * `l` est un réglage, la personne le change en arrivant ; `de` est un fil
 * d'Ariane, il dit d'où on est parti et reste vrai même quand le filtre bouge.
 * Aucun calcul ne le lit — seul `RetourRapport` l'affiche.
 */
export function porteVersCanal(
  canal: Canal,
  theme: string,
  fenetre: { from: string; to: string }
): string {
  return lienDash(
    `/${canal}`,
    undefined,
    { l: theme, from: fenetre.from, to: fenetre.to, de: theme },
    METRIQUE_PAR_DEFAUT[canal]
  );
}
