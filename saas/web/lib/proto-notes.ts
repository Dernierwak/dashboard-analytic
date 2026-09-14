// PROTOTYPE — À JETER. Ce que les notes du client deviennent une fois posées
// sur la courbe d'une page canal. Ticket 19 de `.scratch/refonte/`.
//
// CE FICHIER N'A PAS DE DIRECTIVE, ET C'EST VOULU. `VARIANTES_NOTES` est lu
// PAR LA PAGE, donc côté serveur ; une constante exportée depuis un module
// `"use client"` devient une référence client, la valeur lue est un proxy, et
// rien ne lève (`CLAUDE.md` §8). Les variantes dessinées vivent donc dans
// `components/proto-notes-courbe.tsx`, qui est client ; ce qui se lit des deux
// côtés vit ici.
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { themesChoisis } from "@/lib/commandes";
import type { DashParams, DayPoint } from "@/lib/channels";

export const VARIANTES_NOTES = [
  { cle: "A", nom: "A — le rideau" },
  { cle: "B", nom: "B — le peigne" },
  { cle: "C", nom: "C — la date qui appelle" },
  { cle: "D", nom: "D — la liste commande" },
];

/** Une note, rattachée à SA colonne de la courbe. `i` est un index de `daily`,
 *  jamais une approximation : `DayPoint.date` est un jour ISO plein et une note
 *  porte un jour ISO plein. Les deux tombent l'un sur l'autre ou pas du tout. */
export type NoteMarque = {
  id: string;
  i: number;
  date: string;
  titre: string;
  theme: string | null;
};

export type NotesCourbe = {
  marques: NoteMarque[];
  /** Notes du compte qui existent mais ne tombent pas dans la fenêtre affichée.
   *  Écrit à l'écran : sans ça, « 2 notes » sur un compte qui en a douze se lit
   *  comme un bug. */
  horsFenetre: number;
  /** Les thèmes cochés au bandeau, s'il y en a — ils filtrent aussi les notes. */
  themesFiltres: string[];
  /** La campagne cochée au bandeau. Elle ne filtre RIEN ici, et c'est le point
   *  dur du ticket : `suivi_actions` n'a pas de colonne de campagne. L'écran
   *  doit l'écrire plutôt que laisser la proximité le suggérer (`CLAUDE.md` §7). */
  campActive: string | null;
};

/** Les notes du compte, rattachées aux colonnes de `daily`.
 *
 *  Le filtre de THÈME du bandeau s'applique — une note porte un thème, la
 *  jointure est exacte. Le filtre de CAMPAGNE ne s'applique pas : rien en base
 *  ne relie une note à une campagne. On ne devine pas ce lien à partir de la
 *  date, ce serait fabriquer précisément ce que le module prétend montrer. */
export async function getNotesCourbe(
  daily: DayPoint[],
  sp: DashParams | undefined
): Promise<NotesCourbe> {
  const themesFiltres = themesChoisis(sp);
  const campActive = sp?.camp || null;
  const vide: NotesCourbe = { marques: [], horsFenetre: 0, themesFiltres, campActive };
  if (daily.length < 2) return vide;

  const supabase = createClient();
  const compte = await getCompteActif();

  const r = await supabase
    .from("suivi_actions")
    .select("id, title, theme, decided_at, kind")
    .eq("user_id", compte.uid)
    .eq("kind", "note")
    // UNE LIGNE PAS ENCORE COCHÉE NE MARQUE RIEN. Depuis le module « À faire »,
    // une Note peut naître `running` — ce qu'on COMPTE faire, pas ce qu'on a
    // fait. Elle ne se date qu'au moment où on la coche (`CONTEXT.md`, entrée
    // Note) : la marquer avant placerait sur la courbe un fait qui n'a pas eu
    // lieu (`CLAUDE.md` §7).
    .neq("status", "running")
    .order("decided_at", { ascending: true })
    .limit(500);
  // La table peut ne pas porter `kind` (migration §19 pas passée) : la courbe
  // s'affiche alors sans marque, comme avant. Un prototype qui explose sur une
  // migration manquante ne se juge pas.
  if (r.error) return vide;

  const colonne = new Map<string, number>();
  daily.forEach((p, i) => colonne.set(p.date.slice(0, 10), i));

  const marques: NoteMarque[] = [];
  let horsFenetre = 0;
  for (const row of r.data ?? []) {
    const theme = (row.theme as string | null) ?? null;
    if (themesFiltres.length && !(theme && themesFiltres.includes(theme))) continue;
    const jour = String(row.decided_at ?? "").slice(0, 10);
    const i = colonne.get(jour);
    if (i === undefined) {
      horsFenetre += 1;
      continue;
    }
    marques.push({ id: String(row.id), i, date: jour, titre: String(row.title ?? ""), theme });
  }

  return { marques, horsFenetre, themesFiltres, campActive };
}
