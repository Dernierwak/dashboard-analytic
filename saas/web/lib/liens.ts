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
    const s = v === undefined || v === null ? "" : String(v);
    if (!s || defaut[k] === s) continue;
    q.set(k, s);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
