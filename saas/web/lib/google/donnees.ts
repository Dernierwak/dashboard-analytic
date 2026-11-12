import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { fetchCanauxMuets, type CanalMuetLive } from "@/lib/canaux-muets";
import { jourDeTravailDuCompte } from "@/lib/jour-compte";
import { dernierJourDeTravail, enFrancais, horodatage } from "@/lib/jour-de-travail";
import { changementDe, type ChangementGoogle, type LigneChangementGoogle } from "@/lib/google/changements";
import { comparaisonDe, type CommandesComparaison, type Comparaison } from "@/lib/google/comparaison";
import { contenuPage, decaler, lireToutesLesPages, periodeDe, type ContenuPage, type LigneGoogle } from "@/lib/google/lecture";
import { tableauDe, type LigneAnnonceGoogle, type LigneGroupeElementsGoogle, type Tableau } from "@/lib/google/tableau";
import { groupesDeTermes, type CommandesGroupes, type GroupesDeTermes, type LigneClusterGoogle, type LigneTermeGoogle } from "@/lib/google/termes";
import type { Repartition } from "@/lib/google/valeur";

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
  tableau: Tableau;
  comparaison: Comparaison;
  /** Le journal des changements de la période ; `null` = il n'a pas pu être
   *  lu : la page le dit, au lieu de montrer une période sans point. */
  journal: ChangementGoogle[] | null;
  /** Depuis quand le journal est tenu sans trou (`aideJournal`) ; `null` = on
   *  ne sait pas. */
  debutJournal: string | null;
  /** Le module Groupes de termes (`lib/google/termes.ts`). */
  groupes: GroupesDeTermes;
};

// `ctr` et `avg_cpc_micros` ne sont PAS lus : les taux se recalculent total ÷
// total (`lecture.ts`), un taux récolté par ligne ne s'additionne pas.
// `advertising_channel_type` exige la section 25 du `000` jouée : sans elle,
// PostgREST refuse la lecture et la page lève (`lireToutesLesPages`) — de même
// pour `conversions_value`, de la même section.
const COLONNES = "date_start, campaign_id, campaign_name, advertising_channel_type, impressions, clicks, cost_micros, conversions, conversions_value";

type LigneBase = {
  date_start: string;
  campaign_id: string | null;
  campaign_name: string | null;
  advertising_channel_type: string | null;
  impressions: number | null;
  clicks: number | null;
  cost_micros: number | string | null;
  conversions: number | string | null;
  conversions_value: number | string | null;
};

/** Un nombre lu tel quel : NULL reste `null`, jamais 0 (`CLAUDE.md` §7). */
function nombreOuNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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
    // Nullable (section 25) : NULL = pas lu, la somme de la période devient « — ».
    valeurConversion: nombreOuNull(r.conversions_value),
  };
}

// Le détail par annonce, déjà récolté (étape 6 de `ads/sync.py`) : Google n'y
// écrit que les annonces qui ont eu des impressions, et rien pour PMax.
const COLONNES_ANNONCES = "date_start, campaign_id, campaign_name, ad_group_id, ad_group_name, ad_id, ad_name, impressions, clicks, cost_micros, conversions";

type LigneBaseAnnonce = Omit<LigneBase, "advertising_channel_type" | "conversions_value"> & {
  ad_group_id: string | null;
  ad_group_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
};

function versLigneAnnonce(r: LigneBaseAnnonce): LigneAnnonceGoogle {
  return {
    // Le type n'est pas sur cette table : le Tableau le lit sur la campagne.
    // La valeur de conversion non plus (`google_ads_ad_insights` ne la récolte
    // pas) : `null`, donc « — » avec sa raison, jamais 0.
    ...versLigne({ ...r, advertising_channel_type: null, conversions_value: null }),
    groupeId: r.ad_group_id || null,
    groupeNom: r.ad_group_name ?? "",
    annonceId: r.ad_id || null,
    annonceNom: r.ad_name ?? "",
  };
}

// Les Groupes d'éléments PMax (section 3quinquies du `000`, ticket 05) : le
// seul détail d'une campagne Performance Max, que Google ne range pas dans
// `ad_group_ad`.
const COLONNES_GROUPES_ELEMENTS = "date_start, campaign_id, asset_group_id, asset_group_name, impressions, clicks, cost_micros, conversions, conversions_value";

type LigneBaseGroupeElements = {
  date_start: string;
  campaign_id: string | null;
  asset_group_id: string | null;
  asset_group_name: string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  cost_micros: number | string | null;
  conversions: number | string | null;
  conversions_value: number | string | null;
};

function versLigneGroupeElements(r: LigneBaseGroupeElements): LigneGroupeElementsGoogle {
  const micros = nombreOuNull(r.cost_micros);
  return {
    date: String(r.date_start).slice(0, 10),
    campagneId: r.campaign_id || null,
    groupeId: r.asset_group_id || null,
    groupeNom: r.asset_group_name ?? "",
    // Toutes nullables en base : NULL reste `null`, le Tableau refuse de le
    // compter pour zéro (`lib/google/tableau.ts`).
    cout: micros === null ? null : micros / MICROS,
    impressions: nombreOuNull(r.impressions),
    clics: nombreOuNull(r.clicks),
    conversions: nombreOuNull(r.conversions),
    valeurConversion: nombreOuNull(r.conversions_value),
  };
}

/** Les Groupes d'éléments de la période et de celle d'avant, paginés. En cas
 *  d'échec — section 3quinquies pas encore jouée, par exemple — `null` : chaque
 *  campagne PMax dit que ses groupes n'ont pas pu être lus, la page ne lève pas. */
async function lireGroupesElements(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  debut: string,
  fin: string
): Promise<LigneGroupeElementsGoogle[] | null> {
  try {
    const lignes = await lireToutesLesPages<LigneBaseGroupeElements>((de, a) =>
      supabase
        .from("google_ads_asset_group_insights")
        .select(COLONNES_GROUPES_ELEMENTS)
        .eq("user_id", uid)
        .gte("date_start", debut)
        .lte("date_start", fin)
        .order("date_start", { ascending: true })
        .order("id", { ascending: true })
        .range(de, a)
    );
    return lignes.map(versLigneGroupeElements);
  } catch {
    return null;
  }
}

// Les termes de recherche (section 3sexies du `000`, ticket 09). La période
// seulement : le module ne compare pas à la période d'avant.
const COLONNES_TERMES = "date_start, campaign_id, ad_group_id, search_term, keyword_text, keyword_match_type, search_term_match_type, impressions, clicks, cost_micros, conversions";

type LigneBaseTerme = {
  date_start: string;
  campaign_id: string;
  ad_group_id: string;
  search_term: string;
  keyword_text: string | null;
  keyword_match_type: string | null;
  search_term_match_type: string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  cost_micros: number | string | null;
  conversions: number | string | null;
};

function versLigneTerme(r: LigneBaseTerme): LigneTermeGoogle {
  const micros = nombreOuNull(r.cost_micros);
  return {
    date: String(r.date_start).slice(0, 10),
    campagneId: r.campaign_id,
    groupeId: r.ad_group_id,
    terme: r.search_term,
    motCle: r.keyword_text ?? "",
    motCleType: r.keyword_match_type ?? "",
    appariement: r.search_term_match_type ?? "",
    // Nullables en base : NULL reste `null`, jamais 0 (`CLAUDE.md` §7).
    impressions: nombreOuNull(r.impressions),
    clics: nombreOuNull(r.clicks),
    cout: micros === null ? null : micros / MICROS,
    conversions: nombreOuNull(r.conversions),
  };
}

/** Les termes de la période, paginés (≈ 10 000 lignes sur 90 jours chez A,
 *  carte issue 19), et le plus ancien jour en base — la part masquée ne se
 *  calcule que sur une période entièrement couverte. En cas d'échec (section
 *  3sexies pas encore jouée, par exemple) : `null`, le module le dit et la page
 *  ne lève pas. */
async function lireTermes(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  debut: string,
  fin: string
): Promise<{ termes: LigneTermeGoogle[] | null; debutTermes: string | null }> {
  try {
    const [lignes, premier] = await Promise.all([
      lireToutesLesPages<LigneBaseTerme>((de, a) =>
        supabase
          .from("google_ads_search_terms")
          .select(COLONNES_TERMES)
          .eq("user_id", uid)
          .gte("date_start", debut)
          .lte("date_start", fin)
          .order("date_start", { ascending: true })
          .order("id", { ascending: true })
          .range(de, a)
      ),
      supabase.from("google_ads_search_terms").select("date_start").eq("user_id", uid).order("date_start", { ascending: true }).limit(1),
    ]);
    if (premier.error) throw premier.error;
    const d = (premier.data?.[0] as { date_start: string } | undefined)?.date_start;
    return { termes: lignes.map(versLigneTerme), debutTermes: d ? String(d).slice(0, 10) : null };
  } catch {
    return { termes: null, debutTermes: null };
  }
}

// Les Clusters de Google (section 3septies du `000`, ticket 10) : une ligne
// par niveau × cluster, sur la fenêtre de 90 jours de la récolte — pas de
// filtre de date, la fenêtre se choisit dans `termes.ts` (dernier passage de
// chaque niveau). ≈ 960 clusters au compte chez A + ≈ 25 par campagne Search
// (carte, issue 19) : paginé.
const COLONNES_CLUSTERS = "campaign_id, cluster_id, category_label, impressions, clicks, conversions, terms, window_start, window_end";

type TermeBase = { term?: string; impressions?: number | string | null; clicks?: number | string | null; conversions?: number | string | null };
type LigneBaseCluster = {
  campaign_id: string | null;
  cluster_id: string;
  category_label: string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  conversions: number | string | null;
  terms: TermeBase[] | null;
  window_start: string;
  window_end: string;
};

function versLigneCluster(r: LigneBaseCluster): LigneClusterGoogle {
  return {
    campagneId: r.campaign_id ?? "",
    clusterId: r.cluster_id,
    libelle: r.category_label ?? "",
    // Nullables en base : NULL reste `null`, jamais 0 (`CLAUDE.md` §7).
    impressions: nombreOuNull(r.impressions),
    clics: nombreOuNull(r.clicks),
    conversions: nombreOuNull(r.conversions),
    termes: (Array.isArray(r.terms) ? r.terms : [])
      .filter((t) => typeof t?.term === "string" && t.term !== "")
      .map((t) => ({
        texte: t.term as string,
        impressions: nombreOuNull(t.impressions ?? null),
        clics: nombreOuNull(t.clicks ?? null),
        conversions: nombreOuNull(t.conversions ?? null),
      })),
    debut: String(r.window_start).slice(0, 10),
    fin: String(r.window_end).slice(0, 10),
  };
}

/** En cas d'échec (section 3septies pas encore jouée, par exemple) : `null`,
 *  le module le dit et la page ne lève pas. */
async function lireClusters(supabase: ReturnType<typeof createClient>, uid: string): Promise<LigneClusterGoogle[] | null> {
  try {
    const lignes = await lireToutesLesPages<LigneBaseCluster>((de, a) =>
      supabase
        .from("google_ads_search_term_clusters")
        .select(COLONNES_CLUSTERS)
        .eq("user_id", uid)
        .order("id", { ascending: true })
        .range(de, a)
    );
    return lignes.map(versLigneCluster);
  } catch {
    return null;
  }
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

/**
 * Les actions de conversion et la répartition par action de la période et de
 * celle d'avant (`000_run_me_all.sql`, section 3quater), pour la règle « sans
 * valeur » (`lib/google/valeur.ts`). En cas d'échec — section pas encore jouée,
 * par exemple — `undefined` : la valeur s'affiche « — » avec la raison « pas
 * encore lu », plutôt qu'une page qui lève ou un comptage pris pour un montant.
 */
async function lireRepartition(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  debut: string,
  fin: string
): Promise<Repartition | undefined> {
  try {
    const [actions, parAction] = await Promise.all([
      lireToutesLesPages<{ conversion_action_id: string; name: string | null; always_use_default_value: boolean | null; default_value: number | string | null }>(
        (de, a) =>
          supabase
            .from("google_ads_conversion_actions")
            .select("conversion_action_id, name, always_use_default_value, default_value")
            .eq("user_id", uid)
            .order("conversion_action_id", { ascending: true })
            .range(de, a)
      ),
      lireToutesLesPages<{ date_start: string; campaign_id: string; conversion_action_id: string; conversions: number | string | null }>(
        (de, a) =>
          supabase
            .from("google_ads_conversions_by_action")
            .select("date_start, campaign_id, conversion_action_id, conversions")
            .eq("user_id", uid)
            .gte("date_start", debut)
            .lte("date_start", fin)
            .order("date_start", { ascending: true })
            .order("id", { ascending: true })
            .range(de, a)
      ),
    ]);
    return {
      actions: actions.map((r) => ({
        id: r.conversion_action_id,
        nom: r.name ?? "",
        toujoursDefaut: r.always_use_default_value,
        valeurDefaut: nombreOuNull(r.default_value),
      })),
      parAction: parAction.map((r) => ({
        date: String(r.date_start).slice(0, 10),
        campagneId: r.campaign_id,
        actionId: r.conversion_action_id,
        conversions: nombreOuNull(r.conversions),
      })),
    };
  } catch {
    return undefined;
  }
}

/** `g` : les commandes du module Groupes de termes (`gm`, `gc`, `gt`) ; la
 *  campagne du Bandeau, qui préremplit `gc`, vient de `c`. */
export async function getDonneesGoogle(c: CommandesComparaison, g: Omit<CommandesGroupes, "campagne"> = {}): Promise<DonneesGoogle> {
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

  const [brutes, brutesAnnonces, progres, journal, debutJournal, repartition, groupesElements, termes, clusters] = await Promise.all([
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
    // Paginé comme les campagnes : annonces × jours dépasse vite 1 000 lignes.
    lireToutesLesPages<LigneBaseAnnonce>((de, a) =>
      supabase
        .from("google_ads_ad_insights")
        .select(COLONNES_ANNONCES)
        .eq("user_id", uid)
        .gte("date_start", p.avantDebut)
        .lte("date_start", p.fin)
        .order("date_start", { ascending: true })
        .order("id", { ascending: true })
        .range(de, a)
    ),
    supabase.from("fetch_progress").select("etat, run_id").eq("user_id", uid).eq("canal", "google").limit(1),
    lireJournal(supabase, uid, p.debut, p.fin),
    lireDebutJournal(supabase, uid),
    lireRepartition(supabase, uid, p.avantDebut, p.fin),
    lireGroupesElements(supabase, uid, p.avantDebut, p.fin),
    lireTermes(supabase, uid, p.debut, p.fin),
    // Lus seulement quand le module les montre : en mode Mots-clés, rien ne s'en sert.
    g.gm === "clusters" ? lireClusters(supabase, uid) : Promise.resolve(null),
  ]);

  const ligneProgres = progres.error ? null : (progres.data?.[0] as { etat: string; run_id: string } | undefined) ?? null;
  const lignes = brutes.map(versLigne);
  const annonces = brutesAnnonces.map(versLigneAnnonce);
  const contenu = contenuPage(lignes, c, ctx, repartition);
  return {
    ...contenu,
    tableau: tableauDe(lignes, annonces, c, ctx, repartition, groupesElements),
    comparaison: comparaisonDe({ campagnes: lignes, annonces, groupesElements, repartition }, c, ctx),
    lecture: phraseLecture(ligneProgres),
    muet,
    journal,
    debutJournal,
    groupes: groupesDeTermes(
      { ...termes, clusters, insights: lignes, campagnes: contenu.campagnes, periode: contenu.periode, aujourdhui: ctx.aujourdhui },
      { ...g, campagne: c.campagne }
    ),
  };
}
