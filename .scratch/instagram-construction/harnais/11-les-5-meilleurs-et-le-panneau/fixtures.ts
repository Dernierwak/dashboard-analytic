// Fixtures partagées du harnais 11 — même forme que celles du ticket 10.
import { postDe, type LigneBase, type Post } from "@/lib/instagram/lecture";

export const ctx = { maintenant: "2026-11-07T08:00:00.000Z" };
export const SEMAINE = { debut: "2026-10-26", fin: "2026-11-01" };

let id = 0;
/** Un post mûr (relevé 10 jours après, sauf `releve_a` donné), une image. */
export function post(date: string, sur: Partial<LigneBase> = {}): Post {
  id += 1;
  const releve = new Date(Date.parse(date) + 10 * 86_400_000).toISOString();
  return postDe(
    {
      post_id: id,
      date,
      type: "IMAGE",
      media_product_type: "FEED",
      caption: `post ${id}`,
      reach: 100,
      views: 200,
      likes: 1,
      comments: 0,
      saved: 0,
      shares: 0,
      follows: 1,
      profile_visits: 1,
      releve_a: releve,
      ...sur,
    },
    {}
  );
}

/** Six images, j'aime 1…6, de mars à août 2026 : la référence de l'année
 *  (quartiles exclusifs 1,75 / 3,5 / 5,25, contrôle de la spec). */
export function sixImages(): Post[] {
  return [1, 2, 3, 4, 5, 6].map((v, i) => post(`2026-0${3 + i}-10T09:00:00Z`, { likes: v }));
}
