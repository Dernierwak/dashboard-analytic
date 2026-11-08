import { createClient } from "@/lib/supabase/server";
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
// UNE SEULE LECTURE PAR TABLE POUR TOUTE LA PAGE (revue de code de
// instagram-construction) : `instagram_compte_jours` et `followers_history`
// sont lues une fois par `getDonneesInstagram`, en parallèle des posts, et
// la Tendance en reçoit les lignes — avant, elle les relisait après les posts,
// avec un second `getCompteActif`. Seule `instagram_compte_periodes` est à elle.
//
// LE COMPTE REGARDÉ (`compte.uid`) : les tables de la section 23 sont lisibles
// par `a_acces(user_id)`, donc le Membre invité voit la même Tendance (user
// story 5). Rien ici ne lit `connected_accounts` (`CLAUDE.md` §7).
//
// Une table illisible (section 23 pas encore jouée) ne fait pas tomber la
// page : elle arrive `null`, et la Tendance l'écrit en trous et en phrases —
// jamais en zéros. `followers_history` illisible se lit vide : la courbe des
// abonnés y a des trous, le compte la porte depuis le premier passage.

/** Toutes les périodes : la plus ancienne dit depuis quand la portée d'une
 *  semaine est relevée, quand celle demandée manque. Une ligne par jour de
 *  passage ; `(debut, fin)` est la clé avec `user_id` : l'ordre est total. */
export function lirePeriodesDuCompte(supabase: ReturnType<typeof createClient>, uid: string): Promise<LignePeriodeCompte[] | null> {
  return lireToutesLesPages<LignePeriodeCompte>((de, a) =>
    supabase
      .from("instagram_compte_periodes")
      .select("debut, fin, reach")
      .eq("user_id", uid)
      .order("debut", { ascending: true })
      .order("fin", { ascending: true })
      .range(de, a)
  ).catch((e) => {
    console.error("[instagram] instagram_compte_periodes illisible", e);
    return null;
  });
}

/** Les lignes lues pour toute la page → la Tendance. Bornées ici aux deux
 *  périodes, comme la lecture le faisait côté base : le « relevé du … » de
 *  la Tendance prend le `maj_a` le plus récent DES JOURS MONTRÉS. */
export function tendanceDuCompte(e: {
  jours: LigneJourCompte[] | null;
  historique: LigneAbonnesHistorique[];
  periodes: LignePeriodeCompte[] | null;
  posts: Post[];
  periode: PeriodeTendance;
}): Tendance {
  const { periode } = e;
  const jours = e.jours && e.jours.filter((l) => !!l.jour && l.jour.slice(0, 10) >= periode.avantDebut && l.jour.slice(0, 10) <= periode.fin);
  const debut = Date.parse(`${periode.avantDebut}T00:00:00Z`);
  const fin = Date.parse(`${periode.fin}T23:59:59.999Z`);
  const historique = e.historique.filter((h) => {
    const t = Date.parse(h.fetched_at ?? "");
    return Number.isFinite(t) && t >= debut && t <= fin;
  });
  return tendanceDe({ jours, historique, periodes: e.periodes, posts: e.posts, periode, maintenant: new Date().toISOString() });
}
