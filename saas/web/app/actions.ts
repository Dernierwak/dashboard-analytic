"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompteActif, COOKIE_COMPTE } from "@/lib/account";
import { etatDernierRun, type EtatRun } from "@/lib/github-workflow";
import { enchainer, arretCascade } from "@/lib/cascade";


type Client = ReturnType<typeof createClient>;


// Thème prioritaire — « on ne peut pas travailler sur tout » : le moteur
// concentre constats et conseils sur ces thèmes, modifiables à tout moment.
// Stocké dans insight_feedback (clé priority_label:<nom>) : zéro migration,
// permanent, RLS own-rows.
//
// LE PLAFOND DE TROIS ÉTAIT UN REFUS ; C'EST MAINTENANT UN AVERTISSEMENT.
//
// On rendait `{ ok: false, "3 priorités max" }` à partir de la quatrième, et
// l'étoile ne se posait pas. Le nombre trois n'était pourtant pas une limite de
// lecture : il tenait à ce qu'un thème coûte jusqu'à deux appels Gemini dans le
// worker. On a séparé les deux (voir `_THEMES_IA` dans
// `saas/traitement/build_report.py`) : toutes les étoiles produisent leur carte
// complète — chiffres, courbe, campagnes, conseils calculés — et seules les
// trois premières POSÉES reçoivent en plus des pistes rédigées par l'IA.
//
// L'action réussit donc toujours, et rend un message quand même : c'est le seul
// endroit où le client apprend ce que sa quatrième étoile aura de moins, au
// moment où il la pose. `message` ne signifie donc plus « échec » — les
// appelants l'affichent que `ok` soit vrai ou faux.
export async function togglePriorityLabel(
  name: string,
  active: boolean
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const key = `priority_label:${name}`;
  let message: string | undefined;
  if (active) {
    // Le retrait était nu, quand la pose juste en dessous lisait son erreur :
    // une étoile qu'on n'arrive pas à retirer revient au rechargement, et c'est
    // elle qui décide si Pulse conseille ce thème (`CLAUDE.md` §1).
    const r = await supabase
      .from("insight_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("insight_key", key);
    if (r.error) return { ok: false, message: "L'étoile n'a pas pu être retirée — réessaie." };
  } else {
    const existing = await supabase
      .from("insight_feedback")
      .select("insight_key")
      .eq("user_id", user.id)
      .like("insight_key", "priority_label:%");
    const rang = (existing.data ?? []).length + 1;
    // AU-DELÀ DE TROIS, PLUS AUCUN CONSEIL — ET C'EST UN AVERTISSEMENT, PAS UN
    // REFUS. Pulse conseille sur les trois thèmes que le client désigne, dans
    // l'ordre où il les a désignés (`_THEMES_CONSEILLES`, `build_report.py` ;
    // `CLAUDE.md` §1). Le message disait « pas de pistes rédigées par l'IA » :
    // les pistes n'existent plus, et ce qui se perd maintenant est TOUT le
    // conseil. Dire le contraire promettrait des conseils qui ne viendront pas.
    if (rang > 3) {
      message =
        `${rang}ᵉ étoile : ce thème aura sa carte et ses chiffres, mais aucun ` +
        `conseil — Pulse travaille sur tes 3 premières étoiles, et seulement ` +
        `elles. Retires-en une pour lui faire de la place.`;
    }
    const r = await supabase.from("insight_feedback").upsert(
      { user_id: user.id, insight_key: key, verdict: "agree" },
      { onConflict: "user_id,insight_key" }
    );
    if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  }
  revalidatePath("/labels");
  revalidatePath("/");
  return { ok: true, message };
}

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

// L'ÉTAPE QUI ÉCRIT LA LISTE MAÎTRESSE NE RENDAIT QUE SON ERREUR — donc elle
// portait encore, à elle seule, le piège que tout ce ticket corrige : un refus
// RLS sur `profiles` touche zéro ligne SANS erreur (`CLAUDE.md` §8), la cascade
// voyait sept étapes vertes, et l'écran disait « renommé partout ».
//
// Le message n'est pas celui d'un arrêt ordinaire, et c'est l'ordre des étapes
// qui le permet : la liste maîtresse étant LA DERNIÈRE, tout le reste EST écrit
// quand on arrive ici. On le dit, plutôt que de laisser croire qu'il faut tout
// relancer. On n'affirme pas non plus POURQUOI la base a refusé — on n'a lu que
// le compte de lignes (§7).
const LISTE_NON_ECRITE =
  "Tout le reste est écrit, mais ta liste de thèmes n'a pas bougé — ce compte n'a " +
  "pas accepté cette écriture-là. Recharge la page ; si rien n'a changé, demande " +
  "« Peut agir » à son propriétaire.";

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
  // Réglable aussi sur /conversions (module « Nos thèmes principaux », à côté
  // des objectifs par thème) depuis que le rapport est passé en lecture seule.
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

// MÊME FILET QUE `saveSiteClient`, ET C'EST ICI QU'IL COMPTE LE PLUS.
//
// Cette action est appelée depuis le TOUT PREMIER écran du produit, à la fin
// d'un parcours de six étapes. `getCompteActif` suppose un utilisateur
// (`user!.id`) : si la session a expiré pendant les trente secondes de
// l'onboarding, elle jetait — la frontière d'erreur démontait la carte, l'écran
// devenait blanc, et les six réponses déjà données partaient avec, sans un mot.
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

// ── Labels unifiés (liste maîtresse profiles.labels + assignations par canal) ─

// Le SELECT peut échouer (réseau, PostgREST) sans lever — supabase-js rend
// { data: null, error }. `error` est donc rendu à l'appelant plutôt qu'avalé :
// un appelant qui l'ignore garde l'ancien comportement (repli sur `[]`), mais
// `_fusionnerLabels` doit la vérifier avant d'écrire `profiles.labels` — une
// lecture ratée ne doit jamais se traduire par un UPDATE qui vide la liste.
async function _labels(
  supabase: ReturnType<typeof createClient>,
  uid: string
): Promise<{ data: string[]; error: { message: string } | null }> {
  const r = await supabase.from("profiles").select("labels").eq("id", uid).limit(1);
  return { data: (r.data?.[0]?.labels as string[] | null) ?? [], error: r.error };
}

export async function createLabel(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom vide." };
  const { data: current, error: lectureError } = await _labels(supabase, user.id);
  // Une lecture ratée replie sur `[]` : sans ce garde, elle écrirait la liste
  // réduite au seul thème qu'on vient de créer, et tous les autres tomberaient.
  if (lectureError) return { ok: false, message: "Impossible de lire tes thèmes — réessaie." };
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  // Même garde que `saveObjectif`, même table, même piège du §8 : sans compte
  // de lignes, « créé » s'affichait sur un thème que la base avait refusé.
  const maj = await supabase.from("profiles")
    .update({ labels: [...current, clean].sort() }).eq("id", user.id).select("id");
  if (maj.error) return { ok: false, message: "Création impossible — réessaie." };
  if ((maj.data ?? []).length === 0) return { ok: false, message: await profilMuet(supabase, user.id) };
  revalidatePath("/labels");
  return { ok: true, message: `« ${clean} » créé.` };
}

// Fusionne `oldName` dans `target` (déjà existant) : toutes les campagnes et
// posts qui portaient `oldName` portent désormais `target`, et `oldName`
// disparaît de la liste maîtresse — jamais deux labels avec le même nom.
//
// ORDRE : la liste maîtresse `profiles.labels` est retirée EN DERNIER, une fois
// TOUTES les autres tables migrées avec succès. Si une étape intermédiaire
// échoue (RLS, table absente, réseau), `oldName` reste visible dans la liste —
// donc rejouable — au lieu de disparaître avec des campagnes/posts orphelins
// qui pointent encore vers un label introuvable nulle part.
//
// `theme_ga4_events` (unique user_id+label+event_name), `theme_objectifs`
// (unique user_id+label) et `insight_feedback` (unique user_id+insight_key, où
// la priorité d'un thème est stockée sous la clé `priority_label:<nom>`)
// peuvent chacun avoir DÉJÀ une ligne sous `target` là où `oldName` en a une
// aussi — un
// simple UPDATE violerait la contrainte. La ligne de la cible gagne (déjà en
// place, donc déjà le réglage voulu), celle de l'absorbé est écartée plutôt
// que de faire échouer toute la fusion.
//
// Chaque étape vérifie `.error` avant de continuer : si une échoue, la fusion
// s'arrête et `renameLabel` NE répond PAS `ok:true` — l'appelant ne doit
// jamais afficher « fusionné » sans que ce soit vrai.
async function _fusionnerLabels(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  oldName: string,
  target: string
): Promise<{ ok: true } | { ok: false; etape: string }> {
  {
    const r = await supabase.from("meta_campaign_config").update({ label: target })
      .eq("user_id", uid).eq("label", oldName);
    if (r.error) return { ok: false, etape: "campagnes Meta" };
  }
  {
    const r = await supabase.from("google_campaign_config").update({ label: target })
      .eq("user_id", uid).eq("label", oldName);
    if (r.error) return { ok: false, etape: "campagnes Google" };
  }
  {
    const [oldEvents, targetEvents] = await Promise.all([
      supabase.from("theme_ga4_events").select("id, event_name")
        .eq("user_id", uid).eq("label", oldName),
      supabase.from("theme_ga4_events").select("event_name")
        .eq("user_id", uid).eq("label", target),
    ]);
    if (oldEvents.error || targetEvents.error) return { ok: false, etape: "événements GA4 du thème" };
    const targetEventNames = new Set((targetEvents.data ?? []).map((r) => r.event_name));
    for (const row of oldEvents.data ?? []) {
      const r = targetEventNames.has(row.event_name)
        ? await supabase.from("theme_ga4_events").delete().eq("id", row.id)
        : await supabase.from("theme_ga4_events").update({ label: target }).eq("id", row.id);
      if (r.error) return { ok: false, etape: "événements GA4 du thème" };
    }
  }
  {
    const targetObjectif = await supabase.from("theme_objectifs").select("id")
      .eq("user_id", uid).eq("label", target).limit(1);
    if (targetObjectif.error) return { ok: false, etape: "objectif du thème" };
    const r = (targetObjectif.data ?? []).length > 0
      ? await supabase.from("theme_objectifs").delete().eq("user_id", uid).eq("label", oldName)
      : await supabase.from("theme_objectifs").update({ label: target })
          .eq("user_id", uid).eq("label", oldName);
    if (r.error) return { ok: false, etape: "objectif du thème" };
  }
  {
    // L'étoile « thème prioritaire » vit dans insight_feedback sous la clé
    // priority_label:<nom> (voir togglePriorityLabel). En UPDATE-ant la ligne
    // (plutôt que delete+insert), `created_at` ne bouge pas : le rang de
    // priorité de l'absorbé (ordre d'ancienneté) passe intact à la cible.
    const oldKey = `priority_label:${oldName}`;
    const targetKey = `priority_label:${target}`;
    const [oldStar, targetStar] = await Promise.all([
      supabase.from("insight_feedback").select("id")
        .eq("user_id", uid).eq("insight_key", oldKey).limit(1),
      supabase.from("insight_feedback").select("id")
        .eq("user_id", uid).eq("insight_key", targetKey).limit(1),
    ]);
    if (oldStar.error || targetStar.error) return { ok: false, etape: "priorité du thème" };
    if ((oldStar.data ?? []).length > 0) {
      const r = (targetStar.data ?? []).length > 0
        ? await supabase.from("insight_feedback").delete()
            .eq("user_id", uid).eq("insight_key", oldKey)
        : await supabase.from("insight_feedback").update({ insight_key: targetKey })
            .eq("user_id", uid).eq("insight_key", oldKey);
      if (r.error) return { ok: false, etape: "priorité du thème" };
    }
  }
  {
    const posts = await supabase.from("instagram_organic_posts").select("id, labels")
      .eq("user_id", uid).contains("labels", [oldName]);
    if (posts.error) return { ok: false, etape: "posts Instagram" };
    for (const p of posts.data ?? []) {
      const merged = Array.from(
        new Set(((p.labels as string[]) ?? []).map((l) => (l === oldName ? target : l)))
      );
      const r = await supabase.from("instagram_organic_posts")
        .update({ labels: merged }).eq("id", p.id);
      if (r.error) return { ok: false, etape: "posts Instagram" };
    }
  }
  {
    // Liste maîtresse EN DERNIER — voir le commentaire d'en-tête. La lecture
    // qui précède l'UPDATE est vérifiée AVANT de construire l'UPDATE : sans
    // ça, un SELECT en échec (`data: null`, replié sur `[]`) écrirait
    // `labels: []` et ferait disparaître TOUS les thèmes du compte.
    const { data: current, error: lectureError } = await _labels(supabase, uid);
    if (lectureError) return { ok: false, etape: "lecture de la liste des thèmes" };
    const r = await supabase.from("profiles")
      .update({ labels: current.filter((l) => l !== oldName).sort() })
      .eq("id", uid);
    if (r.error) return { ok: false, etape: "liste des thèmes" };
  }
  return { ok: true };
}

// Renomme partout : liste maîtresse + assignations Meta/Google + posts Instagram.
// Si `newName` correspond à un label DÉJÀ existant, renomme ne fait rien tant que
// `confirmerFusion` n'est pas passé à true — le retour porte `collision: true`
// pour que l'appelant affiche l'alerte de confirmation avant de fusionner.
export async function renameLabel(oldName: string, newName: string, confirmerFusion = false) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = newName.trim();
  if (!clean) return { ok: false, message: "Nouveau nom vide." };
  // LA LECTURE SE VÉRIFIE AVANT DE DÉCIDER QUOI QUE CE SOIT. `_labels` replie
  // un SELECT en échec sur `[]` : sans ce garde, une lecture ratée ferait
  // croire qu'aucun thème ne porte déjà ce nom (donc pas de fusion à proposer),
  // puis écrirait `labels: []` plus bas et effacerait TOUS les thèmes du compte.
  const { data: current, error: lectureError } = await _labels(supabase, user.id);
  if (lectureError)
    return { ok: false, message: "Impossible de lire tes thèmes — réessaie." };
  if (current.includes(clean) && clean !== oldName) {
    if (!confirmerFusion) {
      return {
        ok: false,
        collision: true,
        message: `« ${clean} » existe déjà — les éléments de « ${oldName} » seront fusionnés dedans.`,
      };
    }
    const fusion = await _fusionnerLabels(supabase, user.id, oldName, clean);
    if (!fusion.ok) {
      revalidatePath("/labels");
      return { ok: false, message: arretCascade("Fusion incomplète", fusion.etape) };
    }
    revalidatePath("/labels");
    revalidatePath("/");
    return { ok: true, message: `« ${oldName} » fusionné dans « ${clean} ».` };
  }
  // LES HUIT ÉCRITURES S'ENCHAÎNENT, ET ELLES S'ARRÊTENT — les six
  // historiques étaient nues
  // (`await supabase…` sans `const r =`), donc une panne au milieu laissait le
  // thème à moitié renommé et l'écran répondait « renommé partout ». L'ordre
  // est celui de `_fusionnerLabels`, pour la même raison : la liste maîtresse
  // EN DERNIER, pour qu'un arrêt laisse `oldName` visible — donc relançable —
  // au lieu de le faire disparaître en laissant des campagnes pointer vers un
  // nom introuvable. Chaque étape est rejouable telle quelle : un
  // `label = clean WHERE label = oldName` déjà passé ne retrouve plus rien.
  let listeRefusee = false;
  const renomme = await enchainer([
    {
      nom: "campagnes Meta",
      ecrire: async () =>
        (await supabase.from("meta_campaign_config").update({ label: clean })
          .eq("user_id", user.id).eq("label", oldName)).error,
    },
    {
      nom: "campagnes Google",
      ecrire: async () =>
        (await supabase.from("google_campaign_config").update({ label: clean })
          .eq("user_id", user.id).eq("label", oldName)).error,
    },
    {
      // Même raison : `theme_ga4_events` porte le NOM du thème. Sans elle, le
      // thème renommé repartirait sans conversion, et la page n'aurait aucun
      // moyen de montrer ce qui reste en arrière.
      nom: "événements GA4 du thème",
      ecrire: async () =>
        (await supabase.from("theme_ga4_events").update({ label: clean })
          .eq("user_id", user.id).eq("label", oldName)).error,
    },
    {
      nom: "objectif du thème",
      ecrire: async () =>
        (await supabase.from("theme_objectifs").update({ label: clean })
          .eq("user_id", user.id).eq("label", oldName)).error,
    },
    {
      // UPDATE, jamais delete+insert : created_at porte l'ordre d'ancienneté
      // des priorités et doit survivre au renommage du thème.
      nom: "priorité du thème",
      ecrire: async () => {
        const avant = await supabase.from("insight_feedback").select("id")
          .eq("user_id", user.id).eq("insight_key", `priority_label:${oldName}`);
        if (avant.error) return avant.error;
        const ids = (avant.data ?? []).map((row) => row.id);
        if (ids.length === 0) return null;
        const maj = await supabase.from("insight_feedback")
          .update({ insight_key: `priority_label:${clean}` })
          .eq("user_id", user.id).in("id", ids).select("id");
        if (maj.error) return maj.error;
        return (maj.data ?? []).length === ids.length
          ? null
          : { message: "la priorité n'a pas été renommée" };
      },
    },
    {
      nom: "posts Instagram",
      ecrire: async () => {
        const posts = await supabase.from("instagram_organic_posts").select("id, labels")
          .eq("user_id", user.id).contains("labels", [oldName]);
        // Une LECTURE ratée ne vaut pas « aucun post » : sans ce garde, elle
        // laissait l'étape verte et le renommage se déclarait complet en ayant
        // sauté tous les posts.
        if (posts.error) return posts.error;
        for (const p of posts.data ?? []) {
          const r = await supabase.from("instagram_organic_posts")
            .update({ labels: ((p.labels as string[]) ?? []).map((l) => (l === oldName ? clean : l)) })
            .eq("id", p.id);
          if (r.error) return r.error;
        }
        return null;
      },
    },
    {
      // EN DERNIER, et sur une lecture FRAÎCHE et vérifiée : `current` date du
      // début de la fonction, et un SELECT en échec replié sur `[]` écrirait
      // `labels: []` — tous les thèmes du compte effacés d'un coup.
      nom: "liste des thèmes",
      ecrire: async () => {
        const { data: liste, error } = await _labels(supabase, user.id);
        if (error) return error;
        const maj = await supabase.from("profiles")
          .update({ labels: liste.map((l) => (l === oldName ? clean : l)).sort() })
          .eq("id", user.id)
          .select("id");
        if (maj.error) return maj.error;
        // Zéro ligne sur `.eq("id", …)` ne peut pas vouloir dire « rien à
        // faire » : la ligne de profil existe, ou elle n'est pas à nous. C'est
        // donc un refus, et il se dit autrement qu'un arrêt technique.
        if ((maj.data ?? []).length === 0) {
          listeRefusee = true;
          return { message: "zéro ligne sur profiles.labels" };
        }
        return null;
      },
    },
  ]);
  revalidatePath("/labels");
  if (!renomme.ok)
    return {
      ok: false,
      message: listeRefusee
        ? LISTE_NON_ECRITE
        : arretCascade("Renommage incomplet", renomme.etape),
    };
  return { ok: true, message: `Renommé en « ${clean} » partout.` };
}

// Supprime partout : liste maîtresse + désassigne Meta/Google + retire des posts.
export async function deleteLabel(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  // MÊME ENCHAÎNEMENT QUE `renameLabel`, et pour la même raison : les cinq
  // écritures historiques étaient nues, donc une panne au milieu laissait le thème
  // à moitié supprimé sous un « supprimé partout ». La liste maîtresse passe EN
  // DERNIER : un arrêt laisse le thème visible, donc relançable.
  let listeRefusee = false;
  const efface = await enchainer([
    {
      nom: "campagnes Meta",
      ecrire: async () =>
        (await supabase.from("meta_campaign_config").update({ label: null })
          .eq("user_id", user.id).eq("label", name)).error,
    },
    {
      nom: "campagnes Google",
      ecrire: async () =>
        (await supabase.from("google_campaign_config").update({ label: null })
          .eq("user_id", user.id).eq("label", name)).error,
    },
    {
      // Le thème disparaît : ses lignes d'événements n'ont plus de sujet. Elles
      // sont supprimées et non orphelinées — la contrainte d'unicité porte sur
      // (user_id, label, event_name), donc un thème recréé plus tard sous le
      // même nom retrouverait sinon des choix qu'il n'a jamais faits.
      nom: "événements GA4 du thème",
      ecrire: async () =>
        (await supabase.from("theme_ga4_events").delete()
          .eq("user_id", user.id).eq("label", name)).error,
    },
    {
      // Même raison : un thème recréé plus tard sous le même nom ne doit pas
      // retrouver un objectif qu'il n'a jamais choisi.
      nom: "objectif du thème",
      ecrire: async () =>
        (await supabase.from("theme_objectifs").delete()
          .eq("user_id", user.id).eq("label", name)).error,
    },
    {
      // Une priorité désigne un thème par son nom dans la clé. La retirer
      // avant la liste maîtresse empêche une étoile orpheline d'occuper l'une
      // des trois places de conseil.
      nom: "priorité du thème",
      ecrire: async () => {
        const avant = await supabase.from("insight_feedback").select("id")
          .eq("user_id", user.id).eq("insight_key", `priority_label:${name}`);
        if (avant.error) return avant.error;
        const ids = (avant.data ?? []).map((row) => row.id);
        if (ids.length === 0) return null;
        const suppression = await supabase.from("insight_feedback").delete()
          .eq("user_id", user.id).in("id", ids).select("id");
        if (suppression.error) return suppression.error;
        return (suppression.data ?? []).length === ids.length
          ? null
          : { message: "la priorité n'a pas été supprimée" };
      },
    },
    {
      nom: "posts Instagram",
      ecrire: async () => {
        const posts = await supabase.from("instagram_organic_posts").select("id, labels")
          .eq("user_id", user.id).contains("labels", [name]);
        if (posts.error) return posts.error;
        for (const p of posts.data ?? []) {
          const r = await supabase.from("instagram_organic_posts")
            .update({ labels: ((p.labels as string[]) ?? []).filter((l) => l !== name) })
            .eq("id", p.id);
          if (r.error) return r.error;
        }
        return null;
      },
    },
    {
      // EN DERNIER, sur une lecture vérifiée : `_labels` replie un SELECT en
      // échec sur `[]`, et `[].filter(…)` reste `[]` — on aurait effacé TOUS
      // les thèmes du compte en croyant en retirer un.
      nom: "liste des thèmes",
      ecrire: async () => {
        const { data: liste, error } = await _labels(supabase, user.id);
        if (error) return error;
        const maj = await supabase.from("profiles")
          .update({ labels: liste.filter((l) => l !== name) })
          .eq("id", user.id)
          .select("id");
        if (maj.error) return maj.error;
        if ((maj.data ?? []).length === 0) {
          listeRefusee = true;
          return { message: "zéro ligne sur profiles.labels" };
        }
        return null;
      },
    },
  ]);
  revalidatePath("/labels");
  if (!efface.ok)
    return {
      ok: false,
      message: listeRefusee
        ? LISTE_NON_ECRITE
        : arretCascade("Suppression incomplète", efface.etape),
    };
  return { ok: true, message: `« ${name} » supprimé partout.` };
}

// ── Les catégories de conversions (page /conversions) ───────────────────────
//
// MÊME PATRON QUE createLabel/renameLabel/deleteLabel, sur `conversion_categories`
// au lieu de `profiles.labels` : une catégorie est stockée par son NOM, et le
// renommer/la supprimer doit donc propager dans `ga4_event_categories.category`
// (l'événement, lui, ne bouge jamais).

// Même contrat que `_labels` : l'erreur est RENDUE, pas avalée. Un SELECT en
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
      // « non catégorisés » — l'absence de ligne EST cet état, comme pour
      // theme_ga4_events quand un thème est supprimé. En premier, pour que
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

// Rattache un événement GA4 à un thème, ou l'en retire.
//
// `rang` : "principal" — il porte le verdict et la courbe du thème ;
//          "secondaire" — il sert à comprendre, jamais à juger ;
//          null — on retire la ligne (l'absence de ligne EST le « non coché »,
//          il n'y a pas de troisième état à stocker).
//
// AUCUNE VALIDATION DU NOM D'ÉVÉNEMENT CONTRE LE CATALOGUE, ET C'EST VOULU.
// Le catalogue est une photo des 90 derniers jours prise à la dernière récolte.
// Refuser un nom absent de cette photo, ce serait refuser un événement qu'on
// vient de poser sur son site et qui n'a pas encore été récolté — exactement le
// moment où on veut pouvoir le cocher. La contrainte qui compte est en base
// (`theme_ga4_events_rang_ck`), et elle porte sur le rang, pas sur le nom.
export async function setThemeEvent(
  label: string,
  eventName: string,
  rang: "principal" | "secondaire" | null
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const lbl = label.trim();
  const nom = eventName.trim();
  if (!lbl || !nom) return { ok: false, message: "Thème ou événement vide." };

  if (rang === null) {
    const r = await supabase
      .from("theme_ga4_events")
      .delete()
      .eq("user_id", user.id)
      .eq("label", lbl)
      .eq("event_name", nom);
    if (r.error)
      return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  } else {
    const r = await supabase.from("theme_ga4_events").upsert(
      { user_id: user.id, label: lbl, event_name: nom, rang },
      { onConflict: "user_id,label,event_name" }
    );
    if (r.error)
      return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  }

  revalidatePath("/labels");
  // Le rapport ne bouge pas tant qu'il n'est pas régénéré — ce choix change ce
  // que la PROCHAINE récolte demande à GA4 et ce que le prochain rapport
  // mesure. On revalide quand même : la page d'accueil affiche l'état des
  // réglages, pas seulement le rapport.
  revalidatePath("/");
  revalidatePath("/conversions");
  return { ok: true };
}

// L'objectif propre d'un thème (voir `saveObjectif` pour celui du compte).
// `null` = pas de réglage propre : le thème retombe sur l'objectif du compte,
// et c'est l'ABSENCE de ligne dans `theme_objectifs` qui porte ce choix — même
// convention que `setThemeEvent` avec `rang: null`. Repondère l'indicateur
// suivi et l'ordre des conseils de CE thème — pris en compte à la prochaine
// publication du rapport.
export async function saveThemeObjectif(
  label: string,
  objectif: "ventes" | "notoriete" | "engagement" | null
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const lbl = label.trim();
  if (!lbl) return { ok: false, message: "Thème vide." };

  if (objectif === null) {
    const r = await supabase
      .from("theme_objectifs")
      .delete()
      .eq("user_id", user.id)
      .eq("label", lbl);
    if (r.error)
      return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  } else {
    const r = await supabase.from("theme_objectifs").upsert(
      { user_id: user.id, label: lbl, objectif },
      { onConflict: "user_id,label" }
    );
    if (r.error)
      return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  }

  revalidatePath("/labels");
  revalidatePath("/");
  revalidatePath("/conversions");
  return { ok: true };
}

// Assigne un label (ou aucun) à une campagne Meta ou Google.
export async function setCampaignLabel(
  channel: "meta" | "google",
  key: string,          // meta : campaign_name · google : campaign_id
  campaignName: string, // pour créer la ligne google si absente
  label: string | null
) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  // label_source='user' : un choix humain n'est jamais réécrit par l'IA.
  //
  // MAIS RETIRER UN THÈME N'EST PAS UN CHOIX HUMAIN À PROTÉGER.
  // Poser 'user' sur une ligne qu'on vient de VIDER la rendait invisible à
  // l'IA pour toujours : le worker saute tout ce qui porte 'user', y compris
  // sans label. On corrigeait une étiquette fausse en la supprimant, et on
  // condamnait la campagne à ne plus jamais en recevoir — exactement l'inverse
  // du geste. Un thème retiré rend la ligne au vide, et l'IA ne remplit que le
  // vide. La source repart donc à NULL avec lui.
  const source = label ? "user" : null;
  if (channel === "meta") {
    const r = await supabase.from("meta_campaign_config").upsert(
      { user_id: user.id, campaign_name: key, label, label_source: source },
      { onConflict: "user_id,campaign_name" }
    );
    if (r.error) {
      // repli sans la colonne si la migration n'est pas encore passée
      const repli = await supabase.from("meta_campaign_config").upsert(
        { user_id: user.id, campaign_name: key, label },
        { onConflict: "user_id,campaign_name" }
      );
      if (repli.error) return { ok: false, message: "Thème non enregistré — réessaie." };
    }
    revalidatePath("/meta");
  } else {
    const r = await supabase.from("google_campaign_config").upsert(
      { user_id: user.id, campaign_id: key, campaign_name: campaignName, label, label_source: source },
      { onConflict: "user_id,campaign_id" }
    );
    if (r.error) {
      const repli = await supabase.from("google_campaign_config").upsert(
        { user_id: user.id, campaign_id: key, campaign_name: campaignName, label },
        { onConflict: "user_id,campaign_id" }
      );
      if (repli.error) return { ok: false, message: "Thème non enregistré — réessaie." };
    }
    revalidatePath("/google");
  }
  revalidatePath("/labels");
  // `/couts` MANQUAIT, et c'est la page des coûts PAR THÈME : classer une
  // campagne y change la répartition à la lecture, sans rien recalculer
  // (`lib/couts.ts` joint `meta_campaign_config` / `google_campaign_config` à
  // chaque affichage). Seul `saveBudget` la rafraîchissait
  // (`.scratch/refonte/issues/13-entre-deux-jours-de-travail.md`, trois défauts
  // mesurés).
  revalidatePath("/couts");
  // `/` SE RAFRAÎCHIT, MAIS PAS LE RAPPORT LUI-MÊME, et le commentaire
  // d'origine prétendait le contraire — « le rapport regroupe les campagnes par
  // thème ». Les blocs par thème du rapport (`themes_focus`, `themes.rows`,
  // `themes_tips`, `top_recos`) sortent du JSON FIGÉ écrit par le worker :
  // relire la page relit le même JSON, et ce n'est pas ici que ça se répare
  // (ticket 04 de la construction, la vue SQL du regroupement). Ce que cet
  // appel rafraîchit vraiment, et qui suffit à le justifier : la couverture
  // (« N éléments sans thème »), l'alerte de couverture et l'étape 2 de la mise
  // en place, toutes trois lues en direct par `app/page.tsx`.
  revalidatePath("/");
  return { ok: true };
}

// Thème d'un post Instagram — un seul thème par post (labels = [thème] ou []).
export async function setPostLabel(postId: string, label: string | null) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  // Même règle que pour les campagnes : 'user' protège un CHOIX, pas un vide.
  // Un thème retiré rend le post à l'IA (voir setCampaignLabel).
  const r = await supabase
    .from("instagram_organic_posts")
    .update({ labels: label ? [label] : [], label_source: label ? "user" : null })
    .eq("id", postId)
    .eq("user_id", user.id);
  if (r.error) {
    // repli sans la colonne si la migration n'est pas encore passée
    const repli = await supabase
      .from("instagram_organic_posts")
      .update({ labels: label ? [label] : [] })
      .eq("id", postId)
      .eq("user_id", user.id);
    if (repli.error) return { ok: false, message: "Thème non enregistré — réessaie." };
  }
  revalidatePath("/instagram");
  revalidatePath("/labels");
  // `/` MANQUAIT ICI ALORS QU'IL ÉTAIT PRÉSENT SUR LES CAMPAGNES : un post
  // compte dans la couverture exactement comme une campagne, et c'est elle que
  // l'accueil relit en direct. Même limite que là-bas, pour la même raison :
  // les blocs par thème du rapport restent ceux du payload figé.
  revalidatePath("/");
  return { ok: true };
}

// ── La page d'arrivée d'une campagne ────────────────────────────────────────
//
// CE QU'ELLE SERVIRA : comprendre ce que la campagne VEND. Le nom d'une
// campagne ne le dit pas, et c'est ce qui plafonne les conseils aujourd'hui —
// on sait dire « ton CPC monte », pas « ta page d'arrivée demande cinq champs
// pour un produit à 39 CHF ».
//
// ON LA STOCKE, ON NE LA VISITE PAS. Aucun `fetch` serveur ne part vers cette
// adresse, ni ici ni ailleurs. Un champ libre que le serveur irait chercher
// tout seul, c'est une SSRF offerte : il suffirait d'y coller une adresse
// interne pour lui faire lire ce qu'il est le seul à pouvoir atteindre. Le jour
// où une reco devra vraiment lire la page, ce sera par un chemin explicite avec
// sa propre liste d'hôtes autorisés — pas en réutilisant ce champ en silence.
function urlPropre(brut: string): { ok: true; url: string } | { ok: false; message: string } {
  const t = (brut ?? "").trim();
  if (!t) return { ok: true, url: "" }; // vide = on efface l'adresse
  if (t.length > 2048) return { ok: false, message: "Cette adresse est trop longue." };
  // « boutique.ch/velos » sans schéma est ce que les gens tapent : on complète
  // en https plutôt que de leur renvoyer une erreur de syntaxe.
  const complet = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(complet);
  } catch {
    return { ok: false, message: "Cette adresse n'a pas l'air d'une URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, message: "Seules les adresses http:// et https:// sont acceptées." };
  if (u.username || u.password)
    return { ok: false, message: "Retire l'identifiant et le mot de passe de l'adresse." };
  // Un hôte sans point n'est pas un domaine public : c'est « localhost », un
  // nom de machine interne, ou une faute de frappe. Aucun des trois n'est la
  // page d'arrivée d'une campagne publicitaire.
  if (!u.hostname.includes(".") || u.hostname.endsWith("."))
    return { ok: false, message: "Il manque le nom de domaine (ex. boutique.ch)." };
  return { ok: true, url: u.toString() };
}

export async function setCampaignLanding(
  channel: "meta" | "google",
  key: string,          // meta : campaign_name · google : campaign_id
  campaignName: string, // pour créer la ligne google si absente
  url: string
): Promise<{ ok: boolean; message?: string; valeur?: string | null }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const v = urlPropre(url);
  if (!v.ok) return { ok: false, message: v.message };
  const landing_url = v.url || null;

  const r =
    channel === "meta"
      ? await supabase.from("meta_campaign_config").upsert(
          { user_id: compte.uid, campaign_name: key, landing_url },
          { onConflict: "user_id,campaign_name" }
        )
      : await supabase.from("google_campaign_config").upsert(
          { user_id: compte.uid, campaign_id: key, campaign_name: campaignName, landing_url },
          { onConflict: "user_id,campaign_id" }
        );
  if (r.error)
    return {
      ok: false,
      message: "Enregistrement impossible — rejoue le SQL campagne_landing.sql.",
    };

  revalidatePath("/labels");
  revalidatePath(channel === "meta" ? "/meta" : "/google");
  return { ok: true, valeur: landing_url };
}

// ── Le site du client ───────────────────────────────────────────────────────
//
// MÊME BESOIN QUE CI-DESSUS, UN CRAN AU-DESSUS. `setCampaignLanding` dit où une
// campagne ATTERRIT ; ici on dit où le client HABITE. L'onboarding demande déjà
// le secteur, mais « commerce local » est une case, pas une entreprise : le
// domaine, lui, porte la gamme, le prix, la langue, le pays et le ton d'un seul
// coup. C'est ce qui sépare un conseil générique d'un conseil qui parle de ce
// que la personne vend.
//
// FACULTATIF, ET ÇA SE VOIT DANS LA SIGNATURE. Une adresse vide est un succès
// (`urlPropre` renvoie ok sur le vide), pas une erreur : elle efface le site.
// L'appelant doit pouvoir terminer son parcours SANS jamais appeler cette
// action — un onboarding qui se referme sur un champ facultatif ne perd pas un
// champ, il perd le client.
//
// ON LE STOCKE, ON NE LE VISITE PAS. Aucun `fetch` serveur ne part vers cette
// adresse, ni ici ni ailleurs. C'est la même règle que pour la page d'arrivée
// d'une campagne, et pour la même raison : un champ libre que le serveur irait
// chercher tout seul est une SSRF offerte — il suffirait d'y coller une adresse
// interne (169.254.169.254, un service du réseau privé) pour lui faire lire ce
// qu'il est le seul à pouvoir atteindre. Le jour où une reco devra vraiment
// lire cette page, ce sera par un chemin explicite avec sa propre liste d'hôtes
// autorisés — pas en réutilisant ce champ en silence.
//
// LA VALIDATION EST CELLE DE `urlPropre` ci-dessus, pas une copie : un seul
// contrat d'URL dans l'application, sinon les deux divergent au premier
// correctif.
export async function saveSiteClient(
  url: string
): Promise<{ ok: boolean; message?: string; valeur?: string | null }> {
  // L'adresse est jugée AVANT le compte, à l'inverse des autres actions : c'est
  // un test pur, sans base ni réseau, et une saisie malformée n'a aucune raison
  // de coûter un aller-retour. L'écriture, elle, reste derrière l'autorisation.
  const v = urlPropre(url);
  if (!v.ok) return { ok: false, message: v.message };
  const site_url = v.url || null; // vide = le client retire son site

  // Une session peut expirer pendant les trente secondes de l'onboarding.
  // `getCompteActif` suppose un utilisateur : sans ce filet, elle jette et la
  // personne reçoit une page cassée au lieu d'une phrase.
  let compte;
  try {
    compte = await getCompteActif();
  } catch {
    return { ok: false, message: "Ta session a expiré — reconnecte-toi." };
  }
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const r = await supabaseUpdateSite(compte.uid, site_url);
  if (r) return { ok: false, message: r };

  revalidatePath("/");
  revalidatePath("/comptes");
  return { ok: true, valeur: site_url };
}

// Séparée pour que l'action reste lisible : renvoie un message d'erreur, ou
// null si l'écriture est passée.
async function supabaseUpdateSite(uid: string, site_url: string | null): Promise<string | null> {
  const supabase = createClient();
  const r = await supabase.from("profiles").update({ site_url }).eq("id", uid);
  return r.error
    ? "Enregistrement impossible — rejoue le SQL site_client.sql."
    : null;
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
  // saas/collecte/automatisation/suivi.py). Il vit ici et pas dans un export : un fichier
  // « use server » ne peut exporter que des fonctions asynchrones.
  const ordre = ["meta", "instagram", "google", "ga4", "labels", "rapport"];
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
