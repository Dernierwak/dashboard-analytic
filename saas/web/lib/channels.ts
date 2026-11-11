import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Couche données de la page /conversions : le catalogue des événements GA4 et
// leurs catégories. La lecture des dashboards Google Ads qui vivait ici
// (`getGoogleDash`) est partie avec l'ancienne page `/google`, remplacée par
// `lib/google/` (ticket 01 de `.scratch/google-ads/`).

// ── Le catalogue des événements GA4 (page /conversions) ─────────────────────
//
// Ce que la propriété GA4 émet (`profiles.ga4_event_catalog`, rempli par la
// récolte) et si une propriété est choisie. Le choix des événements PAR THÈME
// (`theme_ga4_events`) est parti avec le thème.

export type EvenementCatalogue = {
  nom: string;
  /** Occurrences sur les 90 derniers jours, telles que la récolte les a vues. */
  volume: number;
  /**
   * `true` si GA4 a déclaré cet événement comme ÉVÉNEMENT CLÉ (key event).
   * `null` quand l'API d'administration n'a pas pu être interrogée — auquel cas
   * l'écran n'affiche aucune marque, plutôt que d'afficher « pas clé » pour une
   * question qu'on n'a pas posée.
   */
  cle: boolean | null;
};

export type CatalogueGa4 = {
  /** Une propriété GA4 est-elle choisie sur ce compte ? */
  ga4Connecte: boolean;
  catalogue: EvenementCatalogue[];
  /**
   * La migration n'a pas été jouée : `profiles.ga4_event_catalog` n'existe pas.
   * À NE PAS confondre avec « jamais récolté » — c'est la confusion qui a coûté
   * le plus cher ici : l'écran envoyait relancer une récolte qui ne pouvait
   * rien écrire, indéfiniment.
   */
  migrationManquante: boolean;
};

export async function getCatalogueGa4(): Promise<CatalogueGa4> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [profRes, connRes] = await Promise.all([
    supabase.from("profiles").select("ga4_event_catalog").eq("id", uid).limit(1),
    supabase.from("connected_accounts").select("ga4_property_id").eq("user_id", uid),
  ]);

  // PGRST204 / PGRST205 : PostgREST refuse AVANT d'atteindre Postgres (colonne
  // ou table absente du cache de schéma). 42703 : `undefined_column` remonté
  // par Postgres lui-même. Les trois disent la même chose — la migration n'est
  // pas passée — et aucun n'est une panne : c'est une installation inachevée.
  const migrationManquante = ["PGRST204", "PGRST205", "42703"].includes(profRes.error?.code ?? "");

  // Le catalogue est un cache écrit par la récolte : on le lit défensivement.
  const brut = ((profRes.data?.[0] as { ga4_event_catalog?: unknown } | undefined)
    ?.ga4_event_catalog ?? {}) as {
    evenements?: { nom?: string; volume?: number; cle?: boolean | null }[];
  };
  const catalogue: EvenementCatalogue[] = (brut.evenements ?? [])
    .filter((e) => typeof e?.nom === "string" && e.nom.trim() !== "")
    .map((e) => ({
      nom: String(e.nom),
      volume: Number(e.volume ?? 0),
      cle: e.cle === true ? true : e.cle === false ? false : null,
    }));

  return {
    ga4Connecte: (connRes.data ?? []).some((l) => Boolean(l.ga4_property_id)),
    catalogue,
    migrationManquante,
  };
}

// ── Les catégories de conversions (page /conversions) ───────────────────────
//
// LA CATÉGORIE EST UNE PROPRIÉTÉ DE L'ÉVÉNEMENT : `purchase` veut dire la même
// chose partout. C'est ce qui permet au camembert de /conversions de compter
// « mes conversions par catégorie » sur tout le compte — voir l'en-tête de
// `conversion_categories.sql`.

export type ConversionCategoryRow = {
  name: string;
  /** Combien d'événements du catalogue portent cette catégorie. */
  evenements: number;
};

export type ConversionCategoriesData = {
  categories: ConversionCategoryRow[];
  /** { nom d'événement → catégorie }, uniquement les événements catégorisés. */
  parEvenement: Record<string, string>;
  peutEditer: boolean;
  /** `conversion_categories` ou `ga4_event_categories` absente. */
  migrationManquante: boolean;
};

export async function getConversionCategories(): Promise<ConversionCategoriesData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [catRes, mapRes] = await Promise.all([
    supabase.from("conversion_categories").select("name").eq("user_id", uid),
    supabase.from("ga4_event_categories").select("event_name, category").eq("user_id", uid),
  ]);

  const codeSchema = (e: { code?: string } | null | undefined) =>
    ["PGRST204", "PGRST205", "42703"].includes(e?.code ?? "");
  const migrationManquante = codeSchema(catRes.error) || codeSchema(mapRes.error);

  const parEvenement: Record<string, string> = {};
  const compteParCat = new Map<string, number>();
  for (const r of mapRes.data ?? []) {
    const nom = String(r.event_name ?? "");
    const cat = String(r.category ?? "");
    if (!nom || !cat) continue;
    parEvenement[nom] = cat;
    compteParCat.set(cat, (compteParCat.get(cat) ?? 0) + 1);
  }

  const noms = (catRes.data ?? []).map((r) => String(r.name ?? "")).filter(Boolean);
  const categories: ConversionCategoryRow[] = noms
    .map((name) => ({ name, evenements: compteParCat.get(name) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    categories,
    parEvenement,
    peutEditer: compte.peutEditer,
    migrationManquante,
  };
}
