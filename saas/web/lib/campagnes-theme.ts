// CE QU'ON A LE DROIT DE DIRE DES CAMPAGNES D'UN THÈME — un seul endroit.
//
// `ThemeFocus.campaigns` est un EXTRAIT : le worker n'en publie que les huit
// plus grosses dépenses (`build_report.py`, `_CAMPAGNES_PUBLIEES`). Deux écrans
// s'en servaient comme d'un tout, et se trompaient chacun à sa façon :
//
//   · la carte du thème écrivait « Ses campagnes (8) » sur un thème qui en
//     porte douze — un chiffre qui n'est pas le nombre de campagnes du thème,
//     présenté comme s'il l'était (`CLAUDE.md` §7) ;
//   · la porte vers la plateforme déduisait de cet extrait les régies où le
//     thème tourne — or les huit gardées sont les huit plus GROSSES, donc une
//     régie où il dépense peu disparaît, et sa porte ne s'ouvre pas.
//
// Les deux se lisent maintenant sur `summary`, qui porte le compte entier
// (ticket 34). Ce module ne fait que le lire et retomber proprement sur
// l'extrait quand le payload est antérieur au ticket — auquel cas il ne
// PRÉTEND rien : `n` vaut `null`, « on ne sait pas », jamais un nombre deviné.
import type { ThemeFocus } from "@/lib/report";

/** Les deux régies. `Canal` (`lib/liens.ts`) porte aussi Instagram, qui ne
 *  fait pas de campagnes — les compter ensemble n'aurait aucun sens. */
export type Regie = "meta" | "google";

const REGIES: readonly Regie[] = ["meta", "google"] as const;

/**
 * Les régies où ce thème porte au moins une campagne, dans l'ordre de lecture
 * des pages, avec leur compte EXACT — ou `null` quand le payload ne le porte
 * pas encore.
 */
export function regiesDuTheme(theme: ThemeFocus): { canal: Regie; n: number | null }[] {
  const exact = theme.summary?.n_campaigns_canal;
  if (exact) {
    return REGIES.filter((r) => (exact[r] ?? 0) > 0).map((r) => ({
      canal: r,
      n: exact[r] as number,
    }));
  }
  // Payload d'avant le ticket : l'extrait est tout ce qu'on a. Il peut taire
  // une régie, et c'est un défaut connu qu'on ne peut pas réparer après coup —
  // mais il ne doit pas non plus se mettre à énoncer un nombre.
  const vues = new Set(theme.campaigns.map((c) => c.channel));
  return REGIES.filter((r) => vues.has(r)).map((r) => ({ canal: r, n: null }));
}

/**
 * Combien ce thème porte de campagnes, combien la carte en montre, et combien
 * il en manque. `manquantes > 0` est la seule chose qui autorise un écran à
 * dire que la liste est un extrait.
 */
export function compteCampagnes(theme: ThemeFocus): {
  total: number;
  affichees: number;
  manquantes: number;
} {
  const affichees = theme.campaigns.length;
  // `??`, parce que la question posée est « le payload porte-t-il ce compte ? »
  // et pas « ce compte est-il non nul » : zéro campagne est une RÉPONSE, une
  // clé absente n'en est pas une. Les deux opérateurs rendent le même nombre
  // sur tous les payloads qu'on sait produire (vérifié dans le harnais 34) —
  // c'est l'intention qui les sépare, et c'est elle qui se relit.
  const total = theme.summary?.n_campaigns ?? affichees;
  // Jamais négatif : un payload incohérent doit faire disparaître la phrase,
  // pas écrire « les -2 autres campagnes ».
  return { total, affichees, manquantes: Math.max(0, total - affichees) };
}
