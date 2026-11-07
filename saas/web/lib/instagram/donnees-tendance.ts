import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { lireToutesLesPages } from "@/lib/meta/lecture";
import type { LigneAbonnesHistorique, Post } from "@/lib/instagram/lecture";
import {
  tendanceDe,
  type LigneJourCompte,
  type LignePeriodeCompte,
  type PeriodeTendance,
  type Tendance,
} from "@/lib/instagram/tendance";

// ── CE QUE LA TENDANCE « TA PAGE » LIT DANS SUPABASE ─────────────────────────
//
// À côté de `donnees.ts` plutôt que dedans : la Tendance a ses trois tables
// (spec § La page — Tendance), et le calcul est dans `tendance.ts`, testé hors
// ligne. Aucun appel à Meta : le client ne déclenche rien (`CLAUDE.md` §9).
//
// LE COMPTE REGARDÉ (`compte.uid`) : les deux tables de la section 23 sont
// lisibles par `a_acces(user_id)`, donc le Membre invité voit la même
// Tendance (user story 5). Rien ici ne lit `connected_accounts` (`CLAUDE.md` §7).
//
// Une table illisible (section 23 pas encore jouée) ne fait pas tomber la
// page : elle arrive `null`, et la Tendance l'écrit en trous et en phrases —
// jamais en zéros. `followers_history` illisible se lit vide : la courbe des
// abonnés y a des trous, le compte la porte depuis le premier passage.

/** `posts` : ceux que `getDonneesInstagram` a déjà lus (les jours de
 *  publication) ; `periode` : celle de `periodeDe`, comme le reste de la page. */
export async function getTendanceInstagram(posts: Post[], periode: PeriodeTendance): Promise<Tendance> {
  const supabase = createClient();
  const { uid } = await getCompteActif();
  const illisible = (table: string) => (e: unknown) => {
    console.error(`[instagram] ${table} illisible`, e);
    return null;
  };

  const [jours, historique, periodes] = await Promise.all([
    // Seuls les jours des deux périodes : 90 jours remontés par compte au
    // premier passage, puis un par jour. `jour` est la clé avec `user_id` :
    // l'ordre est total.
    lireToutesLesPages<LigneJourCompte>((de, a) =>
      supabase
        .from("instagram_compte_jours")
        .select("jour, reach, total_interactions, abonnes, gagnes, perdus, reach_ad, interactions_ad")
        .eq("user_id", uid)
        .gte("jour", periode.avantDebut)
        .lte("jour", periode.fin)
        .order("jour", { ascending: true })
        .range(de, a)
    ).catch(illisible("instagram_compte_jours")),
    // Le premier morceau de la courbe des abonnés, figé au 2026-09-04
    // (spec § La base) ; borné aux deux périodes, la fin incluse jusqu'à minuit.
    lireToutesLesPages<LigneAbonnesHistorique>((de, a) =>
      supabase
        .from("followers_history")
        .select("fetched_at, followers")
        .eq("user_id", uid)
        .gte("fetched_at", `${periode.avantDebut}T00:00:00Z`)
        .lte("fetched_at", `${periode.fin}T23:59:59.999Z`)
        .order("fetched_at", { ascending: true })
        .range(de, a)
    ).catch((e) => illisible("followers_history")(e) ?? []),
    // Toutes : la plus ancienne dit depuis quand la portée d'une semaine est
    // relevée, quand celle demandée manque. Une ligne par jour de passage.
    lireToutesLesPages<LignePeriodeCompte>((de, a) =>
      supabase
        .from("instagram_compte_periodes")
        .select("debut, fin, reach")
        .eq("user_id", uid)
        .order("debut", { ascending: true })
        .order("fin", { ascending: true })
        .range(de, a)
    ).catch(illisible("instagram_compte_periodes")),
  ]);

  return tendanceDe({ jours, historique, periodes, posts, periode, maintenant: new Date().toISOString() });
}
