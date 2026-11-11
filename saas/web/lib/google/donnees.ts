import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { fetchCanauxMuets, type CanalMuetLive } from "@/lib/canaux-muets";
import { jourDeTravailDuCompte } from "@/lib/jour-compte";
import { dernierJourDeTravail, enFrancais, horodatage } from "@/lib/jour-de-travail";
import { changementDe, type ChangementGoogle, type LigneChangementGoogle } from "@/lib/google/changements";
import { contenuPage, decaler, lireToutesLesPages, periodeDe, type Commandes, type ContenuPage, type LigneGoogle } from "@/lib/google/lecture";

// ── CE QUE LA PAGE GOOGLE LIT DANS SUPABASE ──────────────────────────────────
//
// La seule couche de la page qui touche la base ; tout le calcul est dans
// `lecture.ts`, testé hors ligne. Elle ne déclenche aucun appel à Google : le
// client ne déclenche rien (spec, § « La fraîcheur »).
//
// LE COMPTE REGARDÉ, JAMAIS LE MIEN. Un Membre invité lit `compte.uid`, et la
// règle de partage de la base lui ouvre les mêmes lignes. Rien ici ne lit
// `connected_accounts` : les jetons ne sont jamais à portée de cette page
// (`CLAUDE.md` §7).

export type DonneesGoogle = ContenuPage & {
  /** « Chiffres Google au lundi 5 octobre, 07:02 UTC » — ou ce qui empêche de le dire. */
  lecture: string;
  /** La récolte Google a échoué au dernier passage (`lib/canaux-muets.ts`) :
   *  la période s'est arrêtée au dernier jour lu, et la page le dit. */
  muet: CanalMuetLive | null;
  /** Le journal des changements de la période ; `null` = il n'a pas pu être
   *  lu : la page le dit, au lieu de montrer une période sans point. */
  journal: ChangementGoogle[] | null;
  /** Depuis quand le journal est tenu sans trou (`aideJournal`) ; `null` = on
   *  ne sait pas. */
  debutJournal: string | null;
};

// `ctr` et `avg_cpc_micros` ne sont PAS lus : les taux se recalculent total ÷
// total (`lecture.ts`), un taux récolté par ligne ne s'additionne pas.
// `advertising_channel_type` exige la section 25 du `000` jouée : sans elle,
// PostgREST refuse la lecture et la page lève (`lireToutesLesPages`).
const COLONNES = "date_start, campaign_id, campaign_name, advertising_channel_type, impressions, clicks, cost_micros, conversions";

type LigneBase = {
  date_start: string;
  campaign_id: string | null;
  campaign_name: string | null;
  advertising_channel_type: string | null;
  impressions: number | null;
  clicks: number | null;
  cost_micros: number | string | null;
  conversions: number | string | null;
};

/** Google rend le coût en millionièmes de la devise du compte. Converti ICI,
 *  une seule fois (spec, § « Les vues et leurs métriques »). */
const MICROS = 1_000_000;

function versLigne(r: LigneBase): LigneGoogle {
  return {
    date: String(r.date_start).slice(0, 10),
    campagneId: r.campaign_id || null,
    campagneNom: r.campaign_name ?? "",
    // Brut : c'est `lecture.ts` qui le nomme. NULL = pas lu, jamais deviné.
    typeCampagne: r.advertising_channel_type || null,
    // Toutes NOT NULL DEFAULT 0 en base (`000_run_me_all.sql`) : un zéro y
    // est celui qu'a écrit la récolte, pas une absence.
    cout: (Number(r.cost_micros) || 0) / MICROS,
    impressions: Number(r.impressions) || 0,
    clics: Number(r.clicks) || 0,
    conversions: Number(r.conversions) || 0,
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * La date à laquelle Pulse a lu Google, lue dans le dernier passage du worker
 * (`fetch_progress`, canal `google`). Même phrase que Meta (`lib/meta/donnees.ts`) :
 * l'heure est celle du DÉPART du passage (`run_id`), en UTC comme le cron.
 * Quand le dernier passage n'a pas réussi, la phrase dit pourquoi au lieu
 * d'inventer une date.
 */
function phraseLecture(l: { etat: string; run_id: string } | null): string {
  if (!l) return "Pulse n'a pas encore lu Google pour ce compte";
  if (l.etat === "attente" || l.etat === "en_cours") return "Pulse est en train de relire Google";
  if (l.etat !== "fini") return "Le dernier passage n'a pas pu lire Google";
  const d = horodatage(l.run_id);
  if (!d) return "Date de lecture de Google illisible";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const annee = d.getUTCFullYear() !== new Date().getUTCFullYear() ? ` ${d.getUTCFullYear()}` : "";
  return `Chiffres Google au ${enFrancais(d)}${annee}, ${hh}:${mm} UTC`;
}

/**
 * Le journal des changements Google de la période, paginé (`CLAUDE.md` §8).
 * La période seulement : les points ne se posent que sur sa courbe.
 */
async function lireJournal(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  debut: string,
  fin: string
): Promise<ChangementGoogle[] | null> {
  try {
    const lignes = await lireToutesLesPages<LigneChangementGoogle>((de, a) =>
      supabase
        .from("platform_changes")
        .select("change_id, occurred_at, categorie, campaign_id, campaign_name, resume")
        .eq("user_id", uid)
        .eq("channel", "google")
        // L'heure du compte est rangée telle quelle dans le `timestamptz`
        // (`lib/google/changements.ts`) : la journée du compte est donc la
        // journée UTC de la colonne, sans marge de fuseau.
        .gte("occurred_at", `${debut}T00:00:00Z`)
        .lt("occurred_at", `${decaler(fin, 1)}T00:00:00Z`)
        // Un ordre TOTAL, sinon deux pages se recouvrent sur un même instant.
        .order("occurred_at", { ascending: true })
        .order("change_id", { ascending: true })
        .range(de, a)
    );
    return lignes.flatMap((r) => changementDe(r) ?? []);
  } catch {
    return null;
  }
}

/** `sans_trou_depuis` du journal Google (`couverture_recolte`). La table n'est
 *  lisible que par son propriétaire (`000_run_me_all.sql`, section 14septies) :
 *  pour un Membre invité la lecture rend zéro ligne, et la « ⓘ » dit qu'elle
 *  ne sait pas — jamais une date devinée. */
async function lireDebutJournal(supabase: ReturnType<typeof createClient>, uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("couverture_recolte")
    .select("sans_trou_depuis")
    .eq("user_id", uid)
    .eq("source", "google")
    .eq("flux", "journal")
    .limit(1);
  if (error) return null;
  const debut = (data?.[0] as { sans_trou_depuis: string | null } | undefined)?.sans_trou_depuis;
  return debut ? String(debut).slice(0, 10) : null;
}

export async function getDonneesGoogle(c: Commandes): Promise<DonneesGoogle> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const maintenant = new Date();
  // Le canal muet AVANT la période : c'est lui qui la borne quand la récolte a
  // échoué (`periodeDe`).
  const muet = (await fetchCanauxMuets(supabase, uid)).find((m) => m.canal === "google") ?? null;
  const ctx = {
    aujourdhui: iso(maintenant),
    dernierJourDeTravail: iso(dernierJourDeTravail(await jourDeTravailDuCompte(), maintenant)),
    dernierJourLu: muet?.depuis ?? null,
  };
  // La période d'abord, pour ne lire que ses lignes et celles d'avant.
  const p = periodeDe(c, ctx);

  const [brutes, progres, journal, debutJournal] = await Promise.all([
    lireToutesLesPages<LigneBase>((de, a) =>
      supabase
        .from("google_ads_insights")
        .select(COLONNES)
        .eq("user_id", uid)
        .gte("date_start", p.avantDebut)
        .lte("date_start", p.fin)
        // Un ordre TOTAL : sans `id`, deux pages pourraient se recouvrir sur des
        // lignes de même date et en perdre d'autres.
        .order("date_start", { ascending: true })
        .order("id", { ascending: true })
        .range(de, a)
    ),
    supabase.from("fetch_progress").select("etat, run_id").eq("user_id", uid).eq("canal", "google").limit(1),
    lireJournal(supabase, uid, p.debut, p.fin),
    lireDebutJournal(supabase, uid),
  ]);

  const ligneProgres = progres.error ? null : (progres.data?.[0] as { etat: string; run_id: string } | undefined) ?? null;
  return {
    ...contenuPage(brutes.map(versLigne), c, ctx),
    lecture: phraseLecture(ligneProgres),
    muet,
    journal,
    debutJournal,
  };
}
