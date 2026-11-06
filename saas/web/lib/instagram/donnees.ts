import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { lireToutesLesPages } from "@/lib/meta/lecture";
import {
  abonnesParJourDe,
  postDe,
  type Contexte,
  type LigneAbonnesHistorique,
  type LigneBase,
  type LigneCompteJour,
  type Post,
} from "@/lib/instagram/lecture";

// ── CE QUE LA PAGE INSTAGRAM LIT DANS SUPABASE ───────────────────────────────
//
// La seule couche de `lib/instagram/` qui touche la base ; tout le calcul est
// dans `lecture.ts` et `tableau.ts`, testé hors ligne. Elle ne déclenche aucun
// appel à Meta : le client ne déclenche rien (`CLAUDE.md` §9).
//
// LE COMPTE REGARDÉ, JAMAIS LE MIEN : un Membre invité lit `compte.uid`, et la
// règle de partage lui ouvre les mêmes lignes (`a_acces`, migration § 23).
// Rien ici ne lit `connected_accounts` : les jetons ne sont jamais à portée de
// cette page (`CLAUDE.md` §7).

export type DonneesInstagram = {
  /** Tout l'historique en base, du plus récent au plus ancien. */
  posts: Post[];
  ctx: Contexte;
};

export async function getDonneesInstagram(): Promise<DonneesInstagram> {
  const supabase = createClient();
  const { uid } = await getCompteActif();

  const [lignes, historique, jours] = await Promise.all([
    // `*` plutôt qu'une liste : une base où la section 23 n'est pas encore
    // jouée n'a ni `shares` ni `releve_a`, et une colonne nommée absente
    // ferait échouer toute la lecture. Absente, elle se lit « rien rendu ».
    // Paginé avec un ordre TOTAL (`id`) : 1 839 posts chez le compte de
    // l'essai, PostgREST tronque à 1 000 en silence (`CLAUDE.md` §8).
    lireToutesLesPages<LigneBase>((de, a) =>
      supabase
        .from("instagram_organic_posts")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(de, a)
    ),
    // Les abonnés ne servent qu'à « portée ÷ abonnés » : illisibles, ce ratio
    // s'écrit « – » et le reste de la page tient.
    lireToutesLesPages<LigneAbonnesHistorique>((de, a) =>
      supabase
        .from("followers_history")
        .select("fetched_at, followers")
        .eq("user_id", uid)
        // Pas d'`id` connu dans le schéma de cette table (créée avant la
        // migration unique) ; elle est figée à 176 lignes, une seule page.
        .order("fetched_at", { ascending: true })
        .range(de, a)
    ).catch((e) => {
      console.error("[instagram] followers_history illisible", e);
      return [];
    }),
    lireToutesLesPages<LigneCompteJour>((de, a) =>
      supabase
        .from("instagram_compte_jours")
        .select("jour, abonnes")
        .eq("user_id", uid)
        .order("jour", { ascending: true })
        .range(de, a)
    ).catch((e) => {
      // Table absente tant que la section 23 n'est pas jouée.
      console.error("[instagram] instagram_compte_jours illisible", e);
      return [];
    }),
  ]);

  const abonnes = abonnesParJourDe(historique, jours);
  return {
    posts: lignes.map((l) => postDe(l, abonnes)),
    ctx: { maintenant: new Date().toISOString() },
  };
}
