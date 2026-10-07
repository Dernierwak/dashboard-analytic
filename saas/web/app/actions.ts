"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompteActif, COOKIE_COMPTE } from "@/lib/account";
import { etatDernierRun, type EtatRun } from "@/lib/github-workflow";
import { enchainer, arretCascade } from "@/lib/cascade";


type Client = ReturnType<typeof createClient>;


// POURQUOI ZÉRO LIGNE SUR `profiles`, DIT SANS LE DEVINER.
//
// On RELIT avant de parler — affirmer « tu n'as pas le droit » sans l'avoir lu
// serait un fait fabriqué (`CLAUDE.md` §7), et les deux causes ne se ressemblent
// pas : `partage_select` ouvre la lecture à tout membre (`a_acces`) quand
// `partage_update` réserve l'écriture aux « Peut agir » (`peut_editer`). Un
// profil LISIBLE mais non écrit est donc un refus d'écriture ; un profil
// illisible est un compte qu'on ne regarde plus.
//
// Même patron que `pourquoiRien` pour les notes, sur l'autre table.
async function profilMuet(supabase: Client, uid: string): Promise<string> {
  const r = await supabase.from("profiles").select("id").eq("id", uid).limit(1);
  if (r.error || (r.data ?? []).length === 0)
    return "Ce compte n'est plus accessible — recharge la page.";
  return "Rien enregistré : ce compte ne t'autorise pas à écrire. Demande « Peut agir » à son propriétaire.";
}

// Objectif principal du compte ('ventes' | 'notoriete' | 'engagement' | null).
// Re-pondère les conseils — pris en compte à la prochaine publication du rapport.
export async function saveObjectif(objectif: string | null) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  // Le `RETURNING` ne peut pas bloquer cette écriture : `peut_editer(cible)` est
  // EXACTEMENT `a_acces(cible)` plus `AND m.role = 'editor'` (§12 du SQL), donc
  // `partage_select` est strictement plus large que `partage_update`.
  //
  // `.select("id")` N'EST PAS DÉCORATIF. L'écriture visait le profil du COMPTE
  // regardé, qui n'est pas forcément le mien : sur un compte partagé, c'est la
  // RLS qui tranche, et un refus RLS ne lève aucune erreur — il touche zéro
  // ligne (`CLAUDE.md` §8). Sans compte de lignes, un invité recevait
  // « enregistré » et une date de prise en compte pour un objectif que la base
  // n'avait jamais accepté. `compte.peutEditer` au-dessus lit l'écran, pas la
  // base : les deux peuvent diverger (rôle changé depuis l'ouverture de la
  // page, section 15 du SQL pas jouée sur ce projet).
  const maj = await supabase
    .from("profiles")
    .update({ objectif: objectif || null })
    .eq("id", user.id)
    .select("id");
  if (maj.error) return { ok: false, message: "Enregistrement impossible — réessaie." };
  if ((maj.data ?? []).length === 0) return { ok: false, message: await profilMuet(supabase, user.id) };
  revalidatePath("/");
  // Réglable aussi sur /conversions depuis que le rapport est passé en lecture
  // seule.
  revalidatePath("/conversions");
  return { ok: true };
}


// Budget mensuel d'un canal (carry-forward pour les mois suivants).
// month omis → mois en cours.
export async function saveBudget(channel: string, amount: number, monthIso?: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const now = new Date();
  const month =
    monthIso && /^\d{4}-\d{2}-01$/.test(monthIso)
      ? monthIso
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  // L'ERREUR SE LIT, MÊME SUR UN UPSERT. Le compte de lignes n'apprendrait rien
  // ici — un upsert en écrit toujours une — mais un refus RLS sur une INSERTION,
  // lui, lève bien une erreur (contrairement à l'UPDATE du §8), et l'écran
  // affichait « ✓ enregistré » par-dessus.
  const r = await supabase.from("channel_budgets").upsert(
    {
      user_id: user.id,
      channel,
      month,
      amount: Number(amount) || 0,
    },
    { onConflict: "user_id,channel,month" }
  );
  if (r.error) return { ok: false, message: "Budget non enregistré — réessaie." };
  revalidatePath("/couts");
  return { ok: true };
}

// UN FILET, ET C'EST ICI QU'IL COMPTE LE PLUS.
//
// Cette action est appelée depuis le TOUT PREMIER écran du produit, à la fin
// d'un parcours de cinq étapes. `getCompteActif` suppose un utilisateur
// (`user!.id`) : si la session a expiré pendant les trente secondes de
// l'onboarding, elle jetait — la frontière d'erreur démontait la carte, l'écran
// devenait blanc, et les cinq réponses déjà données partaient avec, sans un mot.
// Une action qui jette ne peut rien dire ; une action qui REND un refus laisse
// la carte debout, ses réponses dedans, et la personne réessaie.
//
// L'écriture est vérifiée pour la même raison : un refus de la base passait en
// silence et la personne croyait son profil enregistré.
export async function saveOnboarding(answers: {
  objectif: string;
  business_type: string;
  budget_range: string;
  time_budget: string;
  frustration: string;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  let compte;
  try {
    compte = await getCompteActif();
  } catch {
    return { ok: false, message: "Ta session a expiré — reconnecte-toi." };
  }
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const ecrit = await supabase
    .from("profiles")
    .update({
      objectif: answers.objectif || null,
      business_type: answers.business_type || null,
      budget_range: answers.budget_range || null,
      time_budget: answers.time_budget || null,
      frustration: answers.frustration || null,
    })
    .eq("id", user.id);
  if (ecrit.error)
    return { ok: false, message: "Enregistrement impossible — réessaie dans un instant." };

  revalidatePath("/");
  return { ok: true };
}

// ── Les catégories de conversions (page /conversions) ───────────────────────
//
// Une catégorie est stockée par son NOM : la renommer ou la supprimer doit donc
// propager dans `ga4_event_categories.category` (l'événement, lui, ne bouge
// jamais).

// L'erreur est RENDUE, pas avalée. Un SELECT en
// échec replié sur `[]` ferait croire qu'aucune catégorie ne porte déjà ce nom,
// et créerait le doublon que le contrôle juste au-dessus existe pour empêcher.
async function _categories(
  supabase: ReturnType<typeof createClient>,
  uid: string
): Promise<{ data: string[]; error: { message: string } | null }> {
  const r = await supabase.from("conversion_categories").select("name").eq("user_id", uid);
  return {
    data: (r.data ?? []).map((row) => String(row.name)).sort((a, b) => a.localeCompare(b, "fr")),
    error: r.error,
  };
}

// POURQUOI ZÉRO LIGNE SUR `conversion_categories`, DIT SANS LE DEVINER.
//
// Une catégorie se vise par son NOM, pas par un identifiant : zéro ligne veut
// dire qu'aucune ne s'appelle plus comme ça — un autre onglet l'a renommée ou
// supprimée — OU que l'écriture a été refusée. Les deux se lisent (§7, §8), et
// ils n'appellent pas le même geste : recharger dans un cas, demander un droit
// dans l'autre. Même patron que `pourquoiRien` et `profilMuet`.
async function categorieMuette(supabase: Client, uid: string, nom: string): Promise<string> {
  const r = await supabase.from("conversion_categories").select("name")
    .eq("user_id", uid).eq("name", nom).limit(1);
  if (r.error || (r.data ?? []).length === 0)
    return `Aucune catégorie ne s'appelle plus « ${nom} » — recharge la page.`;
  return "Ta liste de catégories n'a pas bougé : ce compte n'a pas accepté cette écriture-là.";
}

export async function createConversionCategory(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom vide." };
  const { data: current, error: lectureError } = await _categories(supabase, user.id);
  if (lectureError)
    return { ok: false, message: "Impossible de lire tes catégories — réessaie." };
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  const r = await supabase.from("conversion_categories").insert({ user_id: user.id, name: clean });
  if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  revalidatePath("/conversions");
  return { ok: true, message: `« ${clean} » créée.` };
}

export async function renameConversionCategory(oldName: string, newName: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = newName.trim();
  if (!clean) return { ok: false, message: "Nouveau nom vide." };
  const { data: current, error: lectureError } = await _categories(supabase, user.id);
  if (lectureError)
    return { ok: false, message: "Impossible de lire tes catégories — réessaie." };
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  // MÊME ENCHAÎNEMENT QUE `renameLabel`, pour la même raison : deux tables,
  // aucune transaction, et la propagation vers les événements était une
  // écriture NUE — une panne y laissait la catégorie renommée d'un côté et pas
  // de l'autre, sous un « renommée partout ».
  //
  // LES ÉVÉNEMENTS D'ABORD, LA LISTE MAÎTRESSE ENSUITE. L'ordre inverse rendait
  // l'arrêt IRRATTRAPABLE : `conversion_categories` déjà renommée, plus aucune
  // ligne ne répond à `name = oldName`, et relancer ne pouvait plus finir le
  // travail. Dans cet ordre-ci, un arrêt laisse `oldName` dans la liste, donc
  // relançable.
  let listeRefusee = false;
  const renomme = await enchainer([
    {
      nom: "événements classés",
      ecrire: async () =>
        (await supabase.from("ga4_event_categories").update({ category: clean })
          .eq("user_id", user.id).eq("category", oldName)).error,
    },
    {
      // L'étape maîtresse COMPTE ses lignes : sans ça, une catégorie renommée
      // ou supprimée depuis un autre onglet rendait les deux étapes vertes sur
      // zéro ligne chacune, et l'écran répondait « renommée partout » à un
      // geste qui n'avait rien écrit du tout.
      nom: "liste des catégories",
      ecrire: async () => {
        const maj = await supabase.from("conversion_categories")
          .update({ name: clean }).eq("user_id", user.id).eq("name", oldName)
          .select("name");
        if (maj.error) return maj.error;
        if ((maj.data ?? []).length === 0) {
          listeRefusee = true;
          return { message: "zéro ligne sur conversion_categories" };
        }
        return null;
      },
    },
  ]);
  revalidatePath("/conversions");
  if (!renomme.ok)
    return {
      ok: false,
      message: listeRefusee
        ? await categorieMuette(supabase, user.id, oldName)
        : arretCascade("Renommage incomplet", renomme.etape),
    };
  return { ok: true, message: `Renommée en « ${clean} » partout.` };
}

export async function deleteConversionCategory(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  let listeRefusee = false;
  const efface = await enchainer([
    {
      // La catégorie disparaît : les événements qui la portaient redeviennent
      // « non catégorisés » — l'absence de ligne EST cet état. En premier, pour que
      // l'arrêt laisse la catégorie dans la liste et donc relançable.
      nom: "événements classés",
      ecrire: async () =>
        (await supabase.from("ga4_event_categories").delete()
          .eq("user_id", user.id).eq("category", name)).error,
    },
    {
      nom: "liste des catégories",
      ecrire: async () => {
        const sup = await supabase.from("conversion_categories")
          .delete().eq("user_id", user.id).eq("name", name)
          .select("name");
        if (sup.error) return sup.error;
        if ((sup.data ?? []).length === 0) {
          listeRefusee = true;
          return { message: "zéro ligne sur conversion_categories" };
        }
        return null;
      },
    },
  ]);
  revalidatePath("/conversions");
  if (!efface.ok)
    return {
      ok: false,
      message: listeRefusee
        ? await categorieMuette(supabase, user.id, name)
        : arretCascade("Suppression incomplète", efface.etape),
    };
  return { ok: true, message: `« ${name} » supprimée partout.` };
}

// Pose ou retire la catégorie d'un événement GA4 — un choix qui vient d'un
// clic humain, donc toujours `category_source: 'user'`. La colonne distinguait
// ce choix de celui de la catégorisation IA ; cette IA est partie le
// 2026-09-21, et la colonne reste pour les lignes qu'elle a déjà écrites.
export async function saveCategoryForEvent(eventName: string, category: string | null) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const nom = eventName.trim();
  if (!nom) return { ok: false, message: "Événement vide." };

  if (category === null) {
    const r = await supabase.from("ga4_event_categories")
      .delete().eq("user_id", user.id).eq("event_name", nom);
    if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  } else {
    const r = await supabase.from("ga4_event_categories").upsert(
      { user_id: user.id, event_name: nom, category, category_source: "user" },
      { onConflict: "user_id,event_name" }
    );
    if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  }
  revalidatePath("/conversions");
  return { ok: true };
}

// ── LE SUIVI DE LA RÉCOLTE ──────────────────────────────────────────────────
//
// CE FICHIER NE DÉCLENCHE PLUS RIEN. `triggerFetch`, `triggerClassify`,
// `triggerCategorize` et `triggerReport` ont disparu avec les quatre boutons
// qui les appelaient : ce qui se RÉCOLTE ou se RÉDIGE attend le Jour de travail
// (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`).
// Le dispatch survit dans `lib/github-workflow.ts` pour ses deux appelants qui
// ne sont pas des boutons : la récolte d'amorçage d'une source qu'on vient de
// brancher, et GitHub Actions lui-même.
//
// CE QUI RESTE ICI EST L'AFFICHEUR, ET IL RESTE ENTIER. 08 tue le déclencheur,
// pas l'afficheur : une première récolte Instagram de seize minutes RÉUSSIT,
// et sans ces deux lectures le client resterait devant un écran muet pendant un
// quart d'heure — le cron du Jour de travail ne le prévient de rien.
//
// EST AUSSI PARTIE L'ANNULATION EN BLOC de ce que l'IA venait d'étiqueter
// (`compterEtiquettesIA` / `annulerEtiquettesIA` et leurs jumelles pour les
// catégories). Elle ne bornait son périmètre que par un `depuis` rendu par
// `triggerClassify` et gardé dans le `sessionStorage` de l'onglet qui avait
// cliqué : sans clic, plus de `depuis`, donc plus rien à compter ni à annuler.
// Le besoin, lui, grandit — le classement tourne désormais sans que personne
// ne le demande. C'est un ticket, pas un oubli :
// `.scratch/construction/issues/39-l-annulation-des-etiquettes-ia-a-perdu-son-declencheur.md`.

/** L'état du dernier run du workflow, pour le panneau de suivi de la récolte. */
export async function checkFetchStatus(): Promise<EtatRun> {
  return etatDernierRun();
}

// ── L'avancement RÉEL de la récolte ─────────────────────────────────────────
//
// `checkFetchStatus` ne sait qu'une chose : le run GitHub tourne-t-il. Tout le
// reste était mimé côté navigateur — une exponentielle sur le temps écoulé et
// une liste d'étapes horodatées à la main. Ça n'a jamais rien mesuré, et depuis
// que les canaux tournent en parallèle ces étapes sont fausses par construction.
//
// Le worker écrit désormais où il en est dans `fetch_progress` (une ligne par
// canal), et cette action la lit. Les deux se complètent et ne se remplacent
// pas : GitHub dit SI ça tourne, la table dit OÙ ÇA EN EST.
export type EtatCanal = "attente" | "en_cours" | "fini" | "echec" | "saute";

export type CanalRecolte = {
  canal: string;
  etat: EtatCanal;
  /** L'étape franchie DANS le canal, en clair. Jamais un pourcentage. */
  etape: string | null;
  motDeFin: string | null;
  debutA: string | null;
  finA: string | null;
};

export async function checkFetchProgress(): Promise<{
  canaux: CanalRecolte[];
  /** L'horodatage ISO du passage auquel ces lignes appartiennent. L'écran le
   *  compare à la date de départ du run GitHub : des lignes plus VIEILLES que
   *  le run en cours sont celles du passage précédent, et les afficher ferait
   *  passer « 5 / 5 terminées » d'hier pour l'avancement d'aujourd'hui. */
  runId: string | null;
  /** true = la table n'a pas répondu (migration fetch_progress.sql pas jouée,
   *  RLS, réseau). On le DIT à l'écran plutôt que d'afficher un panneau vide
   *  qui laisserait croire qu'il ne se passe rien. */
  indisponible: boolean;
}> {
  // L'ordre de lecture, le même que celui du journal du worker (`CANAUX` dans
  // saas/data/fetch_data/orchestration/supabase/fetch_state/state.py). Il vit ici et pas dans un export : un fichier
  // « use server » ne peut exporter que des fonctions asynchrones.
  const ordre = ["meta", "instagram", "google", "ga4", "rapport"];
  const supabase = createClient();
  const compte = await getCompteActif();
  try {
    const r = await supabase
      .from("fetch_progress")
      .select("canal, run_id, etat, etape, mot_de_fin, debut_a, fin_a")
      .eq("user_id", compte.uid);
    if (r.error) return { canaux: [], runId: null, indisponible: true };
    const lignes = r.data ?? [];
    if (lignes.length === 0) return { canaux: [], runId: null, indisponible: false };

    // ON NE GARDE QUE LE PASSAGE LE PLUS RÉCENT. `run_id` est l'horodatage ISO
    // du départ, en UTC : le tri texte donne donc le plus récent, sans parsing.
    // C'est ce filtre qui empêche la ligne « fini » d'hier de se faire passer
    // pour celle d'aujourd'hui.
    const dernier = lignes.reduce(
      (max, l) => ((l.run_id as string) > max ? (l.run_id as string) : max),
      ""
    );
    const canaux = lignes
      .filter((l) => l.run_id === dernier)
      .map((l) => ({
        canal: l.canal as string,
        etat: l.etat as EtatCanal,
        etape: (l.etape as string | null) ?? null,
        motDeFin: (l.mot_de_fin as string | null) ?? null,
        debutA: (l.debut_a as string | null) ?? null,
        finA: (l.fin_a as string | null) ?? null,
      }))
      .sort((a, b) => ordre.indexOf(a.canal) - ordre.indexOf(b.canal));
    return { canaux, runId: dernier || null, indisponible: false };
  } catch {
    return { canaux: [], runId: null, indisponible: true };
  }
}

// ── Partage d'accès ─────────────────────────────────────────────────────────
// Inviter, changer un rôle, révoquer : ces trois-là s'appliquent TOUJOURS à mon
// propre compte (compte.moi), jamais au compte que je suis en train de
// regarder. Un invité ne peut donc pas inviter à son tour sur le dashboard de
// quelqu'un d'autre — la base le refuserait de toute façon (policy dm_insert).

export type Membre = {
  id: string;
  member_email: string;
  role: "viewer" | "editor";
  accepted_at: string | null;
  created_at: string;
};

export async function listerMembres(): Promise<Membre[]> {
  const supabase = createClient();
  const compte = await getCompteActif();
  try {
    const r = await supabase
      .from("dashboard_members")
      .select("id, member_email, role, accepted_at, created_at")
      .eq("owner_id", compte.moi)
      .order("created_at", { ascending: true });
    return (r.data ?? []) as Membre[];
  } catch {
    return [];
  }
}

export async function inviterMembre(
  email: string,
  role: "viewer" | "editor"
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const propre = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(propre))
    return { ok: false, message: "Cette adresse e-mail n'a pas l'air valide." };
  if (propre === compte.email.toLowerCase())
    return { ok: false, message: "C'est ta propre adresse — tu as déjà tous les accès." };

  const r = await supabase.from("dashboard_members").upsert(
    {
      owner_id: compte.moi,
      owner_email: compte.email,
      member_email: propre,
      role,
    },
    { onConflict: "owner_id,member_email" }
  );
  if (r.error)
    return {
      ok: false,
      message: "Enregistrement impossible — as-tu joué le SQL equipe_partage.sql ?",
    };
  revalidatePath("/equipe");
  return {
    ok: true,
    message: `${propre} a l'accès. Il ou elle le verra en se connectant à Pulse avec cette adresse.`,
  };
}

// ── LES DEUX GESTES QUI VISENT UNE INVITATION PRÉCISE ───────────────────────
//
// Même garde que `resolveAction`, pour la même raison : `.eq("id", …)` vise UNE
// ligne, et si elle n'est plus là — l'accès vient d'être retiré depuis un autre
// onglet, une autre machine — PostgREST touche zéro ligne et ne lève AUCUNE
// erreur (`CLAUDE.md` §8). Sans `.select("id")`, l'écran répondait « c'est
// fait » à un geste qui n'a rien écrit.
//
// `.select("id")` n'ajoute aucun droit — et il faut vérifier qu'il n'en RETIRE
// pas : un `RETURNING` fait appliquer la politique de SELECT aux lignes visées,
// donc un SELECT plus étroit que l'UPDATE bloquerait une écriture qui passait
// avant. Ici `dm_select` couvre `auth.uid() = owner_id`, que `dm_update` et
// `dm_delete` exigent déjà — SELECT est plus large, pas plus étroit.
//
// Le message NOMME L'ÉTAT, pas une personne (ADR 0004) — et il ne l'invente
// pas : zéro ligne sur une invitation ciblée par son identifiant veut dire
// qu'elle n'est plus là, c'est tout ce qu'on affirme.
const PLUS_LA = "Cet accès n'existe plus — recharge la page pour voir qui a accès aujourd'hui.";

export async function changerRoleMembre(
  id: string,
  role: "viewer" | "editor"
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const r = await supabase
    .from("dashboard_members")
    .update({ role })
    .eq("id", id)
    .eq("owner_id", compte.moi)
    .select("id");
  if (r.error) return { ok: false, message: "Changement impossible — réessaie." };
  if ((r.data ?? []).length === 0) return { ok: false, message: PLUS_LA };
  revalidatePath("/equipe");
  return { ok: true };
}

export async function revoquerMembre(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const r = await supabase
    .from("dashboard_members")
    .delete()
    .eq("id", id)
    .eq("owner_id", compte.moi)
    .select("id");
  if (r.error) return { ok: false, message: "Révocation impossible — réessaie." };
  // Zéro ligne sur un retrait d'accès : il a DÉJÀ été retiré. Le résultat voulu
  // est là, mais ce clic-ci n'a rien fait — le dire plutôt que de s'en
  // attribuer le mérite, sinon la liste à l'écran reste fausse sans un mot.
  if ((r.data ?? []).length === 0)
    return { ok: false, message: "Cet accès avait déjà été retiré — recharge la page." };
  revalidatePath("/equipe");
  return { ok: true };
}

// Basculer d'un compte à l'autre : un simple cookie, relu par getCompteActif.
// Il ne DONNE aucun droit — si le compte n'est pas dans ma liste, il est ignoré.
export async function choisirCompte(id: string): Promise<{ ok: boolean }> {
  const compte = await getCompteActif();
  if (!compte.comptes.some((c) => c.id === id)) return { ok: false };
  cookies().set(COOKIE_COMPTE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
