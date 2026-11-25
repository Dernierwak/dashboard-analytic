// ── CE QUE LA PAGE INSTAGRAM LIT DES STORIES ─────────────────────────────────
//
// Spec `.scratch/instagram-stories/spec.md`, § La base : `instagram_stories`,
// `instagram_compte_jours.reach_story` et le bucket privé `instagram-stories`.
// Le calcul est dans `stories.ts` ; ici, la base seulement.
//
// TABLE, COLONNE OU BUCKET ABSENTS (section 27 pas encore jouée) : la page
// reste juste, sans rangée Story et sans erreur affichée. Chaque lecture
// ratée rend « rien » et part dans les journaux du serveur — jamais un zéro.
// `reach_story` se lit À PART de la Tendance : nommée dans le `select` de
// `donnees.ts`, une colonne absente ferait tomber toute la Tendance.
//
// LE COMPTE REGARDÉ (`uid`) : la table et `storage.objects` du bucket sont
// lisibles par `a_acces(user_id)` — le Membre invité voit les mêmes stories.
// Les URL sont signées avec le client de SESSION : aucune clé de service côté
// web, la règle de lecture du bucket fait foi. Rien ici ne lit
// `connected_accounts` (`CLAUDE.md` §7).
//
// Sans directive ; le client Supabase arrive en paramètre (type seulement),
// pour que le harnais le simule sans Next.
import type { createClient } from "../supabase/server";
import { lireToutesLesPages } from "../meta/lecture";
import { cheminsASigner, journeesDe, porteeParJourDe, type LigneReachStory, type LigneStory } from "./stories";
import type { Post } from "./lecture";

type Client = Pick<ReturnType<typeof createClient>, "from" | "storage">;

export const BUCKET_STORIES = "instagram-stories";
/** Une heure : la page est rendue à chaque visite (`force-dynamic`), une URL
 *  n'a pas à survivre à la lecture de la page. */
export const DUREE_URL_SECONDES = 3600;

const COLONNES =
  "story_id, publiee_a, media_type, permalink, image_path, vue_le, releve_a, age_heures, reach, views, shares, total_interactions, follows, profile_visits, link_clicks, nav_tap_forward, nav_tap_back, nav_tap_exit, nav_swipe_forward";

async function lireLignes(supabase: Client, uid: string): Promise<LigneStory[]> {
  try {
    // Paginé avec un ordre TOTAL — `story_id` complète la clé `(user_id,
    // story_id)` : PostgREST tronque à 1 000 lignes en silence (`CLAUDE.md` §8).
    return await lireToutesLesPages<LigneStory>((de, a) =>
      supabase
        .from("instagram_stories")
        .select(COLONNES)
        .eq("user_id", uid)
        .order("publiee_a", { ascending: true })
        .order("story_id", { ascending: true })
        .range(de, a) as unknown as PromiseLike<{ data: LigneStory[] | null; error: unknown }>
    );
  } catch (e) {
    console.error("[instagram] instagram_stories illisible — pas de rangée Story", e);
    return [];
  }
}

async function lirePortees(supabase: Client, uid: string): Promise<Record<string, number>> {
  try {
    const lignes = await lireToutesLesPages<LigneReachStory>((de, a) =>
      supabase
        .from("instagram_compte_jours")
        .select("jour, reach_story")
        .eq("user_id", uid)
        .order("jour", { ascending: true })
        .range(de, a) as unknown as PromiseLike<{ data: LigneReachStory[] | null; error: unknown }>
    );
    return porteeParJourDe(lignes);
  } catch (e) {
    // Colonne absente : chaque portée du jour s'écrit « – ».
    console.error("[instagram] reach_story illisible — portée du jour en « – »", e);
    return {};
  }
}

async function signer(supabase: Client, chemins: string[]): Promise<Record<string, string>> {
  if (chemins.length === 0) return {};
  try {
    const { data, error } = await supabase.storage.from(BUCKET_STORIES).createSignedUrls(chemins, DUREE_URL_SECONDES);
    if (error) throw error;
    const out: Record<string, string> = {};
    for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out[d.path] = d.signedUrl;
    return out;
  } catch (e) {
    // Bucket absent ou refus : les vignettes manquent, pas les chiffres.
    console.error("[instagram] vignettes des stories non signées", e);
    return {};
  }
}

/** Les journées de stories du compte, en `Post` de format `story` ; `[]`
 *  sans table ou sans story. `idOuvert` : le `?post=` de l'URL — toutes les
 *  vignettes de cette journée sont signées, pour le Panneau. */
export async function lireJourneesStories(supabase: Client, uid: string, maintenant: string, idOuvert: string | null): Promise<Post[]> {
  const lignes = await lireLignes(supabase, uid);
  if (lignes.length === 0) return [];
  const [portees, images] = await Promise.all([lirePortees(supabase, uid), signer(supabase, cheminsASigner(lignes, idOuvert))]);
  return journeesDe(lignes, portees, maintenant, images);
}
