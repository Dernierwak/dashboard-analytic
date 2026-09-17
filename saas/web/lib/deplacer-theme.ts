// CE QU'UN THÈME PORTE AILLEURS QUE DANS UNE COLONNE `label`.
//
// Renommer un thème, c'est écrire son nouveau nom partout où l'ancien était
// écrit. La plupart des tables le portent dans une colonne ordinaire
// (`meta_campaign_config.label`, `suivi_actions.theme`…) : un UPDATE suffit, et
// deux lignes ne peuvent pas se gêner. Deux endroits ne marchent pas comme ça —
// le nom y est DANS UNE CLÉ D'UNICITÉ, et ce sont exactement les deux qui
// décident de ce que Pulse conseille :
//
//   · `reco_feedback` — unique (user_id, reco_key, week_start, theme). Un « pas
//     pour moi » est muselé par (conseil, thème) depuis TASK-025 : si le thème
//     dérive, le musellement ne s'applique plus et le conseil écarté revient.
//   · `insight_feedback` — unique (user_id, insight_key), où l'étoile « thème
//     prioritaire » vit sous la clé `priority_label:<nom>` (voir
//     `togglePriorityLabel`). `CLAUDE.md` §1 : Pulse ne conseille QUE dans les
//     thèmes étoilés. Une étoile perdue au renommage, c'est un thème qui cesse
//     silencieusement d'être conseillé.
//
// PAR UPDATE, JAMAIS PAR DELETE + INSERT : `created_at` porte le RANG de
// l'étoile (l'ordre d'ancienneté dans lequel elles ont été posées décide des
// trois thèmes que l'IA rédige — `_THEMES_CONSEILLES`, `build_report.py`).
// Recréer la ligne renverrait le thème en dernière position sans qu'il ait rien
// demandé.
//
// ── POURQUOI CE MODULE EXISTE AU LIEU DE DEUX BLOCS DANS `actions.ts` ───────
//
// La fusion (`_fusionnerLabels`) traitait déjà ces deux tables ; le renommage
// simple, non — c'est le défaut du ticket 45. Recopier les blocs aurait posé
// deux fois la même logique de conflit, donc deux fois l'occasion de diverger.
// Ici elle n'existe qu'UNE fois, et les deux chemins appellent la même.
//
// C'est aussi la seule forme JOUABLE hors ligne : `actions.ts` porte
// `"use server"` et ouvre une connexion Supabase au chargement, donc rien de ce
// fichier ne s'exécute dans un harnais. Ce module-ci ne connaît pas Supabase —
// il REÇOIT le client — et n'importe que des types, effacés à l'exécution. Même
// raison que `lib/cascade.ts` au ticket 19.
import type { createClient } from "@/lib/supabase/server";
import type { Panne } from "@/lib/cascade";

type Client = ReturnType<typeof createClient>;

// ── DÉPLACER UN THÈME SUR LUI-MÊME N'EST PAS UN DÉPLACEMENT ────────────────
//
// `de === vers` arrive pour de bon : `renameLabel` TRIME le nouveau nom, donc
// « Soldes » renommé en « Soldes  » (une espace en trop) passe le garde de
// l'écran — qui compare les noms AVANT le trim — et descend par le chemin
// simple avec les deux noms devenus identiques. Sans le retour sec de chaque
// fonction, la ligne de départ serait sa propre ligne d'arrivée : le code de
// conflit la verrait « déjà prise » et l'EFFACERAIT. Une faute de frappe
// coûterait l'étoile du thème et tous ses retours de conseils.
//
// `_fusionnerLabels` ne peut pas tomber dessus (il n'est appelé que sur deux
// noms différents), mais le garde vit ici pour que ce soit vrai de tous les
// appelants, présents et à venir.

/** POSTGREST PLAFONNE UNE LECTURE À 1 000 LIGNES, ET IL TRONQUE EN SILENCE
 *  (`CLAUDE.md` §8). Ici la troncature ne se verrait pas non plus, et elle
 *  coûterait DEUX fois :
 *
 *    · les lignes au-delà de la page resteraient sur l'ancien nom du thème —
 *      très exactement le défaut que ce module corrige, revenu en silence, et
 *      seulement chez les comptes qui ont assez d'historique pour y arriver ;
 *    · la liste d'arrivée serait incomplète, donc une ligne qui se heurte
 *      passerait par l'UPDATE, heurterait la contrainte d'unicité, et la
 *      cascade s'arrêterait là — sans rien avoir changé, donc en échouant à
 *      l'identique à chaque relance.
 *
 *  `lot.length < PAGE` arrête la boucle : une dernière page pleine est suivie
 *  d'une page vide, jamais d'une lecture infinie. */
const PAGE = 1000;

async function lireTout<T>(
  page: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: Panne }>
): Promise<{ data: T[]; error: Panne }> {
  const tout: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const r = await page(debut, debut + PAGE - 1);
    if (r.error) return { data: [], error: r.error };
    const lot = r.data ?? [];
    tout.push(...lot);
    if (lot.length < PAGE) return { data: tout, error: null };
  }
}

/** La clé sous laquelle l'étoile d'un thème est rangée dans `insight_feedback`.
 *  Lue sous cette forme par `app/page.tsx`, `lib/channels.ts`, `lib/constats.ts`
 *  et `saas/traitement/build_report.py` : elle ne se compose qu'ici. */
export function cleEtoile(theme: string): string {
  return `priority_label:${theme}`;
}

/** UNE CIBLE PEUT DÉJÀ EXISTER, MÊME SUR UN RENOMMAGE SIMPLE.
 *
 *  En fusion c'est évident : la cible est un thème vivant, qui a ses propres
 *  lignes. Sur un renommage simple, le nom d'arrivée n'est porté par aucun
 *  thème — `renameLabel` route vers la fusion quand il l'est. Mais une ligne,
 *  elle, peut SURVIVRE à son thème : c'est l'autre moitié du ticket 45 (une
 *  suppression laissait son étoile derrière elle), et ces orphelines-là sont
 *  déjà en base. Sans ce garde, un UPDATE aveugle heurterait la contrainte
 *  d'unicité, la cascade s'arrêterait là — et relancer échouerait à l'identique,
 *  le thème restant renommé à moitié pour toujours.
 *
 *  Quand les deux existent, la ligne de la CIBLE gagne et celle du départ est
 *  écartée : elle porte un nom que plus aucun thème ne porte, la garder
 *  reviendrait à laisser l'orpheline que ce ticket supprime — et côté client
 *  rien ne se perd, le thème reste étoilé sous son nouveau nom. C'est
 *  l'arbitrage déjà retenu par `_fusionnerLabels`. */
export async function deplacerEtoile(
  supabase: Client,
  uid: string,
  de: string,
  vers: string
): Promise<Panne> {
  if (de === vers) return null;
  const cleDepart = cleEtoile(de);
  const cleArrivee = cleEtoile(vers);
  const [depart, arrivee] = await Promise.all([
    supabase.from("insight_feedback").select("id")
      .eq("user_id", uid).eq("insight_key", cleDepart).limit(1),
    supabase.from("insight_feedback").select("id")
      .eq("user_id", uid).eq("insight_key", cleArrivee).limit(1),
  ]);
  if (depart.error) return depart.error;
  if (arrivee.error) return arrivee.error;
  // Pas d'étoile au départ : il n'y a rien à déplacer, et surtout rien à
  // toucher à l'arrivée. Une orpheline qui traîne sous le nom d'arrivée n'est
  // pas à nous — l'effacer serait un geste destructeur sur des données
  // existantes, et il se décide avec David (`CLAUDE.md` §7).
  if ((depart.data ?? []).length === 0) return null;
  if ((arrivee.data ?? []).length > 0) {
    const r = await supabase.from("insight_feedback").delete()
      .eq("user_id", uid).eq("insight_key", cleDepart);
    return r.error;
  }
  // ON RELIT CE QU'ON VIENT D'ÉCRIRE. Un refus RLS sur un update ne rend
  // AUCUNE erreur — il touche zéro ligne (`CLAUDE.md` §8), et sans `.select`
  // PostgREST ne dit même pas combien il en a touché. La ligne existe : on
  // vient de la lire deux lignes plus haut. Zéro ligne écrite ne peut donc pas
  // vouloir dire « rien à faire », et l'étape a le droit de le dire — sinon la
  // cascade se déclare verte sur une étoile restée sur l'ancien nom, ce qui est
  // le défaut même que ce module corrige.
  const r = await supabase.from("insight_feedback")
    .update({ insight_key: cleArrivee })
    .eq("user_id", uid).eq("insight_key", cleDepart)
    .select("id");
  if (r.error) return r.error;
  if ((r.data ?? []).length === 0) return { message: "zéro ligne sur l'étoile du thème" };
  return null;
}

/** Retire l'étoile d'un thème qui disparaît.
 *
 *  Sans ça, la clé survit au thème : `build_report.py` la compte parmi les
 *  thèmes prioritaires (il lit les CLÉS, sans vérifier qu'un thème les porte
 *  encore), donc un thème effacé consomme en silence une des trois places où
 *  Pulse conseille. Le client ne comprend pas pourquoi son troisième thème n'a
 *  pas de conseils. */
export async function retirerEtoile(
  supabase: Client,
  uid: string,
  theme: string
): Promise<Panne> {
  const r = await supabase.from("insight_feedback").delete()
    .eq("user_id", uid).eq("insight_key", cleEtoile(theme));
  return r.error;
}

/** Les retours sur les conseils suivent le thème qui les a reçus.
 *
 *  Même gestion de conflit que `deplacerEtoile`, et même arbitrage : deux
 *  lignes peuvent se heurter sur (reco_key, week_start) sous le nom d'arrivée,
 *  celle de la cible gagne — le musellement du conseil reste posé sous le
 *  nouveau nom, qui est tout ce qui compte pour le client.
 *
 *  Ligne à ligne et non en un seul UPDATE : PostgREST n'a pas de `ON CONFLICT`
 *  sur un update, et une seule collision ferait échouer l'écriture entière. */
export async function deplacerRetoursConseils(
  supabase: Client,
  uid: string,
  de: string,
  vers: string
): Promise<Panne> {
  if (de === vers) return null;
  const [depart, arrivee] = await Promise.all([
    lireTout((debut, fin) =>
      supabase.from("reco_feedback").select("id, reco_key, week_start")
        .eq("user_id", uid).eq("theme", de).range(debut, fin)),
    lireTout((debut, fin) =>
      supabase.from("reco_feedback").select("reco_key, week_start")
        .eq("user_id", uid).eq("theme", vers).range(debut, fin)),
  ]);
  if (depart.error) return depart.error;
  if (arrivee.error) return arrivee.error;
  const prises = new Set(
    (arrivee.data ?? []).map((r) => `${r.reco_key}::${r.week_start}`)
  );
  for (const ligne of depart.data ?? []) {
    const r = prises.has(`${ligne.reco_key}::${ligne.week_start}`)
      ? await supabase.from("reco_feedback").delete().eq("id", ligne.id)
      : await supabase.from("reco_feedback").update({ theme: vers }).eq("id", ligne.id);
    if (r.error) return r.error;
  }
  return null;
}
