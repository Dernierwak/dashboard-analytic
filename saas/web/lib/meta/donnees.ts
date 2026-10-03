import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { fetchCanauxMuets, type CanalMuetLive } from "@/lib/canaux-muets";
import { jourDeTravailDuCompte } from "@/lib/jour-compte";
import { dernierJourDeTravail, enFrancais, horodatage } from "@/lib/jour-de-travail";
import {
  contenuPage,
  lireToutesLesPages,
  periodeDe,
  type Commandes,
  type ContenuPage,
  type LigneMeta,
} from "@/lib/meta/lecture";
import { tableauDe, type Tableau } from "@/lib/meta/tableau";

// ── CE QUE LA PAGE META LIT DANS SUPABASE ────────────────────────────────────
//
// La seule couche de la page qui touche la base ; tout le calcul est dans
// `lecture.ts`, testé hors ligne. Elle ne déclenche aucun appel à Meta : le
// client ne déclenche rien (spec, § « La lecture des données côté web »).
//
// LE COMPTE REGARDÉ, JAMAIS LE MIEN. Un Membre invité lit `compte.uid`, et la
// règle de partage de la base lui ouvre les mêmes lignes. Rien ici ne lit
// `connected_accounts` : les jetons ne sont jamais à portée de cette page
// (`CLAUDE.md` §7).

export type DonneesMeta = ContenuPage & {
  /** « Chiffres Meta au lundi 5 octobre, 07:02 » — ou ce qui empêche de le dire. */
  lecture: string;
  /** La récolte Meta a échoué au dernier passage (`lib/canaux-muets.ts`) :
   *  la période s'est arrêtée au dernier jour lu, et la page le dit. */
  muet: CanalMuetLive | null;
  /** L'image de chaque annonce de la Comparaison, par son ID : celle que la
   *  récolte des créas (ticket 05) a déposée dans Storage. */
  vignettes: Record<string, string>;
  /** Le Tableau détaillé (ticket 09), tiré des mêmes lignes que le reste. */
  tableau: Tableau;
};

/**
 * Les vignettes des annonces listées. Un échec de lecture ne coûte que les
 * images — la Comparaison montre alors des cases neutres — jamais la page :
 * ses chiffres viennent d'une autre table.
 */
async function lireVignettes(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const out: Record<string, string> = {};
  // Par paquets : un `in.(…)` de centaines d'IDs dépasserait la longueur
  // d'URL que PostgREST accepte.
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("meta_ads_creatives")
      .select("ad_id, vignette_url, image_url")
      .eq("user_id", uid)
      .in("ad_id", ids.slice(i, i + 200));
    if (error) return {};
    for (const r of (data ?? []) as { ad_id: string; vignette_url: string | null; image_url: string | null }[]) {
      const url = r.vignette_url ?? r.image_url;
      if (url) out[r.ad_id] = url;
    }
  }
  return out;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Les colonnes d'identité (`campaign_id`, `adset_id`) viennent du `000` du
// ticket 02 : sur une base qui ne l'a pas joué, la requête refuse et la page
// tombe sur son erreur, plutôt que d'afficher des « — » sans cause.
const COLONNES =
  "date_start, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks";

type LigneBase = {
  date_start: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  spend: number | string | null;
  impressions: number | null;
  clicks: number | null;
};

function versLigne(r: LigneBase): LigneMeta {
  return {
    date: String(r.date_start).slice(0, 10),
    campagneId: r.campaign_id || null,
    campagneNom: r.campaign_name ?? "",
    groupeId: r.adset_id || null,
    groupeNom: r.adset_name ?? "",
    annonceId: r.ad_id || null,
    annonceNom: r.ad_name ?? "",
    // `spend`, `impressions` et `clicks` sont NOT NULL DEFAULT 0 en base : un
    // zéro y est un zéro rendu par Meta, pas une absence.
    depense: Number(r.spend) || 0,
    impressions: Number(r.impressions) || 0,
    clics: Number(r.clicks) || 0,
  };
}

/**
 * La date à laquelle Pulse a lu Meta, lue dans le dernier passage du worker
 * (`fetch_progress`, canal `meta`). Une ligne par canal, réécrite à chaque
 * passage : quand le dernier n'a pas réussi, la date du précédent est perdue,
 * et la phrase dit pourquoi au lieu d'en inventer une.
 *
 * L'heure est celle du DÉPART du passage (`run_id`), en UTC comme le cron :
 * une relance à la main à 14:10 s'écrit 14:10, pas 07:00.
 */
function phraseLecture(l: { etat: string; run_id: string } | null): string {
  if (!l) return "Pulse n'a pas encore lu Meta pour ce compte";
  if (l.etat === "attente" || l.etat === "en_cours") return "Pulse est en train de relire Meta";
  if (l.etat !== "fini") return "Le dernier passage n'a pas pu lire Meta";
  const d = horodatage(l.run_id);
  if (!d) return "Date de lecture de Meta illisible";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const annee = d.getUTCFullYear() !== new Date().getUTCFullYear() ? ` ${d.getUTCFullYear()}` : "";
  return `Chiffres Meta au ${enFrancais(d)}${annee}, ${hh}:${mm} UTC`;
}

export async function getDonneesMeta(c: Commandes): Promise<DonneesMeta> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const maintenant = new Date();
  // Le canal muet AVANT la période : c'est lui qui la borne quand la récolte a
  // échoué (ticket 48 ; `periodeDe`).
  const muet = (await fetchCanauxMuets(supabase, uid)).find((m) => m.canal === "meta") ?? null;
  const ctx = {
    aujourdhui: iso(maintenant),
    dernierJourDeTravail: iso(dernierJourDeTravail(await jourDeTravailDuCompte(), maintenant)),
    dernierJourLu: muet?.depuis ?? null,
  };
  // La période d'abord, pour ne lire que ses lignes et celles d'avant.
  const p = periodeDe(c, ctx);

  const [brutes, progres] = await Promise.all([
    lireToutesLesPages<LigneBase>((de, a) =>
      supabase
        .from("meta_ads_insights")
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
    supabase.from("fetch_progress").select("etat, run_id").eq("user_id", uid).eq("canal", "meta").limit(1),
  ]);

  const lignes = brutes.map(versLigne);
  const contenu = contenuPage(lignes, c, ctx);
  const ligneProgres = progres.error ? null : (progres.data?.[0] as { etat: string; run_id: string } | undefined) ?? null;
  const annonces = contenu.comparaison.elements.flatMap((e) => (e.annonceId ? [e.annonceId] : []));
  return {
    ...contenu,
    lecture: phraseLecture(ligneProgres),
    muet,
    vignettes: await lireVignettes(supabase, uid, annonces),
    tableau: tableauDe(lignes, c, ctx),
  };
}
