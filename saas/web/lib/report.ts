import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { JOUR_DEFAUT } from "@/lib/jour-de-travail";
import type { PayloadHebdo } from "@/lib/hebdo/payload";

// Couche données du rapport hebdo : le dernier payload publié par le worker
// (`weekly_report/builder.py`), et ce que la page lit du profil. Aucune mesure
// ne se calcule ici — elles sont toutes dans le payload.

/**
 * UN CHANGEMENT DÉDUIT DE LA DÉPENSE QUOTIDIENNE — la forme qu'écrivait
 * l'ancien payload hebdo, sorti au ticket 10 du chantier hebdo. Seul
 * `components/changements.tsx` la lit encore (gardé sans lecteur, décision du
 * coordinateur) ; la page hebdo lit `canaux[c].changements`.
 */
export type ChangementPlateforme = {
  date: string;
  canal: string;
  campagne: string;
  /**
   * `planifiee` = son début est À VENIR. `jamais_lancee` = son début est passé
   * et elle n'a jamais rien dépensé — deux faits opposés.
   */
  type: "lancee" | "arretee" | "reprise" | "planifiee" | "jamais_lancee" | "depense";
  detail?: string | null;
};

// Les clés du chantier hebdo (`semaine`, `sources`, `canaux`, `frise`…) se
// déclarent dans `lib/hebdo/`, un fichier par bloc. LES PAYLOADS DÉJÀ PUBLIÉS
// GARDENT LEURS CLÉS MORTES (verdict, boussole, ancienne frise…) : rien ne les
// lit, et la page n'affiche que le dernier, que le prochain passage remplace.
export type ReportPayload = PayloadHebdo & {
  version?: number;
  /** `FriseHebdo`, sauf dans les payloads publiés avant le ticket 07 qui
   *  portent l'ancienne forme : la page passe toujours par `estFriseHebdo`. */
  frise?: unknown;
  /** La ligne sous laquelle le worker a écrit ce payload. Aucun écran ne s'en
   *  sert — le rapport se date par `semaine`. */
  week_start?: string | null;
  /** La fenêtre des payloads publiés avant le ticket 01, qui n'ont pas
   *  `semaine`. Plus écrite depuis le ticket 10. */
  since?: string;
  until?: string;
};

export type WeeklyData = {
  report: ReportPayload | null;
  /** `weekly_reports.updated_at` — la date de PUBLICATION de ce payload.
   *  `null` tant qu'aucun rapport n'existe (ou si la colonne n'a pas pu être
   *  lue) : on n'écrit alors aucune date plutôt qu'une date approchée
   *  (`CLAUDE.md` §7). */
  publieLe: string | null;
  /** Le Jour de travail du compte regardé (`profiles.fetch_schedule`), en
   *  anglais comme en base. */
  jourDeTravail: string;
  onboarded: boolean;
};

export function fmtCHF(n: number): string {
  return n.toLocaleString("fr-CH", { maximumFractionDigits: 0 }).replace(/ /g, " ");
}

export async function getWeeklyData(): Promise<WeeklyData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [reportRes, profileRes] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("week_start, payload, updated_at")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(1),
    // `fetch_schedule` est la colonne que `_due_today` lit pour décider qui
    // est récolté (`saas/data/fetch_data/orchestration/fetch_all.py`) : une
    // base qui ne l'aurait pas ne publierait aucun rapport. Le repli
    // ci-dessous ne la redemande pas — on retombe alors sur lundi, le défaut
    // du worker lui-même.
    supabase
      .from("profiles")
      .select("objectif, business_type, fetch_schedule")
      .eq("id", uid)
      .limit(1),
  ]);

  // null si la table est absente (migration pas encore passée) ou si le
  // worker n'a pas encore publié pour ce compte : la page montre la carte du
  // compte neuf dans les deux cas.
  const report: ReportPayload | null =
    (reportRes.data?.[0]?.payload as ReportPayload | undefined) ?? null;
  // `updated_at` bouge à chaque republication : « voilà la version que tu lis ».
  const publieLe: string | null =
    (reportRes.data?.[0]?.updated_at as string | undefined) ?? null;

  // Si la colonne business_type n'existe pas encore (migration §7 pas passée),
  // la requête combinée échoue → on retombe sur objectif seul, onboarding masqué.
  let profRow: {
    objectif?: string | null;
    business_type?: string | null;
    fetch_schedule?: string | null;
  } | null = profileRes.data?.[0] ?? null;
  const migrated = !profileRes.error;
  if (profileRes.error) {
    const retry = await supabase.from("profiles").select("objectif").eq("id", uid).limit(1);
    profRow = retry.data?.[0] ?? null;
  }
  // LE JOUR DE TRAVAIL DU COMPTE REGARDÉ, jamais celui de la personne qui
  // regarde : un Membre invité lit les dates du compte dont il voit les
  // chiffres, et c'est `user_id` que le worker compare (`_due_today`).
  const jourDeTravail: string = profRow?.fetch_schedule || JOUR_DEFAUT;
  // Onboarded si déjà répondu — ou si la migration n'est pas passée (pas de formulaire cassé)
  const onboarded: boolean =
    !migrated || Boolean(profRow?.objectif) || Boolean(profRow?.business_type);

  return { report, publieLe, jourDeTravail, onboarded };
}
