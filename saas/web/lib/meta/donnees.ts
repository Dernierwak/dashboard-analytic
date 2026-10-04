import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { fetchCanauxMuets, type CanalMuetLive } from "@/lib/canaux-muets";
import { jourDeTravailDuCompte } from "@/lib/jour-compte";
import { dernierJourDeTravail, enFrancais, horodatage } from "@/lib/jour-de-travail";
import {
  annonceDe,
  annonceOuverteDe,
  type AnnonceOuverte,
  type ContenuAnnonce,
  type LigneAsset,
  type LigneCrea,
} from "@/lib/meta/annonce";
import { changementDe, type ChangementMeta, type LigneChangement } from "@/lib/meta/changements";
import {
  cleCampagne,
  contenuPage,
  decaler,
  lireToutesLesPages,
  periodeDe,
  resultatsDe,
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
  /** Les changements que Meta déclare sur la période (ticket 11). `null` =
   *  le journal n'a pas pu être lu : la page le dit, au lieu de montrer une
   *  courbe sans point qu'on lirait « rien n'a changé ». */
  journal: ChangementMeta[] | null;
  /** L'annonce lue dans le Panneau latéral (ticket 12) ; `null` = aucune, ou
   *  une annonce inconnue de la sélection, qui ne s'ouvre pas. */
  annonce: AnnonceLue | null;
};

export type AnnonceLue = {
  ouverte: AnnonceOuverte;
  /** `absente` = la récolte des créas n'a pas (encore) lu cette annonce ;
   *  `illisible` = la lecture a échoué. Le panneau dit lequel, au lieu de
   *  montrer une annonce vide qu'on lirait « elle n'a pas de texte ». */
  contenu: ContenuAnnonce | "absente" | "illisible";
  /** Quand la récolte a lu la créa (`recolte_le`) : le contenu est celui de
   *  ce jour-là, pas forcément celui que Meta diffuse maintenant. */
  lueLe: string | null;
};

/**
 * Le contenu d'une annonce : sa créa et ses assets, lus seulement quand le
 * panneau s'ouvre. Rien n'y est paginé : une créa est une ligne, et ses
 * assets sont plafonnés par Meta à quelques dizaines (10 images, 10 vidéos,
 * 5 textes, 5 titres ; un carrousel de 2 à 5 cartes — sources citées au
 * `000`, § 0bis), loin des 1 000 lignes où PostgREST tronque.
 */
async function lireAnnonce(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  ouverte: AnnonceOuverte
): Promise<AnnonceLue> {
  const [crea, assets] = await Promise.all([
    supabase
      .from("meta_ads_creatives")
      .select("montage, titre, texte, description, lien_url, call_to_action, image_url, video_id, vignette_url, recolte_le")
      .eq("user_id", uid)
      .eq("ad_id", ouverte.id)
      .maybeSingle(),
    supabase
      .from("meta_ads_creative_assets")
      .select("provenance, asset_kind, rang, texte, image_url, video_id, vignette_url, lien_url")
      .eq("user_id", uid)
      .eq("ad_id", ouverte.id)
      .order("rang", { ascending: true }),
  ]);
  if (crea.error || assets.error) return { ouverte, contenu: "illisible", lueLe: null };
  if (!crea.data) return { ouverte, contenu: "absente", lueLe: null };
  const ligne = crea.data as LigneCrea & { recolte_le: string | null };
  const origine = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return {
    ouverte,
    contenu: annonceDe(ligne, (assets.data ?? []) as LigneAsset[], origine),
    lueLe: ligne.recolte_le,
  };
}

/**
 * Le journal des changements Meta de la période, paginé (`CLAUDE.md` §8 : un
 * compte actif dépasse vite 1 000 changements). La période seulement : les
 * points ne se posent que sur la courbe de la période, pas sur celle d'avant.
 */
async function lireJournal(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  debut: string,
  fin: string
): Promise<ChangementMeta[] | null> {
  try {
    const lignes = await lireToutesLesPages<LigneChangement>((de, a) =>
      supabase
        .from("platform_changes")
        .select("change_id, occurred_at, categorie, campaign_id, campaign_name, resume, fuseau")
        .eq("user_id", uid)
        .eq("channel", "meta")
        // Un jour de plus de chaque côté : `changementDe` découpe le jour dans
        // le fuseau du compte, et aucun fuseau n'est à plus d'un jour de l'UTC
        // (UTC−12 à UTC+14). Ce qui déborde ne pose aucun point —
        // `joursMarques` ne marque que `dates`, le panneau qu'un jour de la
        // période.
        .gte("occurred_at", `${decaler(debut, -1)}T00:00:00Z`)
        .lt("occurred_at", `${decaler(fin, 2)}T00:00:00Z`)
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

// Les colonnes d'identité (`campaign_id`, `adset_id`), `results` et
// `attribution_setting` viennent du `000` du ticket 02 : sur une base qui ne
// l'a pas joué, la requête refuse et la page tombe sur son erreur, plutôt que
// d'afficher des « — » sans cause.
const COLONNES =
  "date_start, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, spend, impressions, clicks, results, attribution_setting";

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
  results: unknown;
  attribution_setting: string | null;
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
    // NULL reste NULL (non lu), `[]` reste `[]` : la récolte les distingue
    // (ticket 03), la vue Conversion aussi.
    resultats: resultatsDe(r.results),
    attribution: r.attribution_setting || null,
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

/** `annonce` : l'ID lu dans l'URL, à ouvrir dans le Panneau latéral. */
export async function getDonneesMeta(c: Commandes, annonce?: string): Promise<DonneesMeta> {
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

  const [brutes, progres, journal] = await Promise.all([
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
    lireJournal(supabase, uid, p.debut, p.fin),
  ]);

  const lignes = brutes.map(versLigne);
  const contenu = contenuPage(lignes, c, ctx);
  const ligneProgres = progres.error ? null : (progres.data?.[0] as { etat: string; run_id: string } | undefined) ?? null;
  const annonces = contenu.comparaison.elements.flatMap((e) => (e.annonceId ? [e.annonceId] : []));
  const ouverte = annonceOuverteDe(annonce, lignes, {
    debut: p.debut,
    fin: p.fin,
    campagne: (l) => !c.campagne || cleCampagne(l) === c.campagne,
  });
  return {
    ...contenu,
    lecture: phraseLecture(ligneProgres),
    muet,
    vignettes: await lireVignettes(supabase, uid, annonces),
    tableau: tableauDe(lignes, c, ctx),
    journal,
    annonce: ouverte && (await lireAnnonce(supabase, uid, ouverte)),
  };
}
