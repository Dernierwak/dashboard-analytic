"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompteActif, COOKIE_COMPTE } from "@/lib/account";

// « too_hard » : ni un rejet ni un accord — « je vois l'intérêt mais je ne sais
// pas le faire ». C'est le retour le plus utile qu'on puisse recevoir : il dit
// exactement quel savoir-faire manque, et alimente les conseils de fond.
export type Reaction = "useful" | "not_for_me" | "done" | "too_hard";

// Lundi de la semaine courante (même convention que le Streamlit : week_start).
function mondayISO(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (d.getDay() + 6) % 7; // lundi=0 … dimanche=6
  d.setDate(d.getDate() - shift);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// « ▶ Je le teste » : photographie la décision (titre, indicateur-cible + sa
// valeur du moment) et pose l'échéance à +14 j. L'action reste « en cours »
// jusqu'à être faite/vérifiée. Re-cliquer sur un conseil déjà suivi le retire.
export async function startTracking(a: {
  recoKey: string;
  title: string;
  theme: string | null;
  metric: string | null;
  metricLabel: string | null;
  direction: string | null;
  baseline: number | null;
  tracked: boolean;
  // Le conseil disparaîtra du rapport la semaine prochaine : sans cette photo,
  // l'action ne garde qu'un titre et devient incompréhensible en deux jours.
  detail?: {
    observation?: string;
    pourquoi?: string;
    verifier?: string;
    effort?: string | null;
  } | null;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  if (a.tracked) {
    // Toggle off : on retire de la liste les suivis non rangés de ce conseil.
    // `"auto"` (l'hypothèse d'un thème posée par le worker, voir
    // `build_report.py`) est incluse : sans elle, « annuler » sur une carte
    // auto-suivie ne supprimait rien en base, et la carte redevenait « suivie »
    // au rechargement suivant malgré le clic.
    await supabase
      .from("suivi_actions")
      .delete()
      .eq("user_id", user.id)
      .eq("reco_key", a.recoKey)
      .in("status", ["running", "done", "auto"]);
    revalidatePath("/");
    return { ok: true };
  }

  const today = new Date();
  const check = new Date(today);
  check.setDate(check.getDate() + 14);
  const r = await supabase.from("suivi_actions").upsert(
    {
      user_id: user.id,
      reco_key: a.recoKey,
      title: a.title,
      theme: a.theme,
      metric: a.metric,
      metric_label: a.metricLabel,
      direction: a.direction,
      baseline: a.baseline,
      decided_at: isoDate(today),
      check_at: isoDate(check),
      status: "running",
      detail: a.detail ?? null,
    },
    { onConflict: "user_id,reco_key,decided_at" }
  );
  // Repli si la colonne detail n'existe pas encore (migration §11 pas passée).
  if (r.error) {
    const r2 = await supabase.from("suivi_actions").upsert(
      {
        user_id: user.id, reco_key: a.recoKey, title: a.title, theme: a.theme,
        metric: a.metric, metric_label: a.metricLabel, direction: a.direction,
        baseline: a.baseline, decided_at: isoDate(today), check_at: isoDate(check),
        status: "running",
      },
      { onConflict: "user_id,reco_key,decided_at" }
    );
    if (r2.error) return { ok: false, message: "Rejoue le SQL Supabase (table suivi_actions)." };
  }
  revalidatePath("/");
  return { ok: true };
}

// Cycle de vie d'une action, écrit dans Supabase à chaque étape :
//   « ✓ C'est fait »  → status='done' + done_at=aujourd'hui, et l'échéance du
//                       verdict repart de CE jour (+14 j) : on mesure l'effet
//                       à partir du moment où le changement existe vraiment.
//   « ✓ Vu »          → status='archived' : rangée dans l'historique.
//   « retirer »       → status='dropped' : abandonnée, mais CONSERVÉE. Ce que
//                       tu as renoncé à faire fait partie de ton histoire —
//                       l'effacer te priverait de l'info six mois plus tard.
export async function resolveAction(
  id: string,
  action: "done" | "seen" | "drop",
  recoKey?: string,
  // Le thème + le titre de LA PISTE au moment du clic (TASK-025) — persistés
  // dans `reco_feedback` (colonnes `theme`/`title`, migration
  // `reco_feedback_contexte.sql`) pour que le worker sache PLUS TARD sur quel
  // thème et sur QUELLE idée précise ce « fait » portait. Les clés IA
  // (`ai_<theme>_<i>`) sont positionnelles — sans ce texte posé ICI, au clic,
  // rien ne le retrouve la semaine suivante.
  theme?: string | null,
  title?: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  if (action === "drop") {
    const r = await supabase
      .from("suivi_actions")
      .update({ status: "dropped" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (r.error) return { ok: false, message: "Impossible de retirer cette action — réessaie." };
  } else if (action === "seen") {
    const r = await supabase
      .from("suivi_actions")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (r.error) return { ok: false, message: "Impossible de ranger cette action — réessaie." };
  } else {
    const today = new Date();
    const check = new Date(today);
    check.setDate(check.getDate() + 14);
    const r = await supabase
      .from("suivi_actions")
      .update({ status: "done", done_at: isoDate(today), check_at: isoDate(check) })
      .eq("id", id)
      .eq("user_id", user.id);
    // Repli si la colonne done_at n'existe pas encore (migration §10 pas passée).
    if (r.error) {
      const r2 = await supabase
        .from("suivi_actions")
        .update({ status: "done", check_at: isoDate(check) })
        .eq("id", id)
        .eq("user_id", user.id);
      if (r2.error)
        return { ok: false, message: "Enregistrement impossible — rejoue le SQL Supabase (suivi_actions)." };
    }
    // Un seul geste, deux tables : le conseil est aussi marqué « appliqué »
    // côté reco_feedback → l'IA sait ce que tu as réellement mis en place.
    if (recoKey) {
      // `theme` vaut `""` (jamais `null`) : c'est le sentinel « pas de
      // thème » posé dans la clé d'unicité `reco_feedback_uq2` (migration
      // reco_feedback_contexte.sql) — un `not_for_me`/`done` sur le thème A
      // et un autre sur le thème B, la même semaine, doivent produire deux
      // LIGNES distinctes, pas écraser l'une l'autre (rejet du checker, 2e
      // passe : `null` aurait laissé passer plusieurs lignes « réglages »
      // pour la même clé/semaine, `""` est une vraie valeur comparable).
      const fb = await supabase.from("reco_feedback").upsert(
        {
          user_id: user.id,
          reco_key: recoKey,
          reaction: "done",
          week_start: mondayISO(),
          theme: theme ?? "",
          title: title ?? null,
        },
        { onConflict: "user_id,reco_key,week_start,theme" }
      );
      // Repli si les colonnes theme/title (et la contrainte reco_feedback_uq2)
      // n'existent pas encore (migration reco_feedback_contexte.sql pas
      // passée) — même patron que done_at plus haut, sur l'ANCIENNE clé.
      if (fb.error) {
        await supabase.from("reco_feedback").upsert(
          { user_id: user.id, reco_key: recoKey, reaction: "done", week_start: mondayISO() },
          { onConflict: "user_id,reco_key,week_start" }
        );
      }
    }
  }
  revalidatePath("/");
  return { ok: true };
}

// TA PROPRE NOTE dans le fil.
//
// Le fil montre ce que Pulse a conseillé et ce que les plateformes ont fait.
// Il manquait ce que TOI tu as fait et que personne ne peut deviner : « refait
// les visuels », « changé le ciblage à la main », « un concurrent a lancé une
// promo ». Sans ça, dans trois semaines, une courbe qui a bondi reste sans
// explication.
//
// Une note n'est PAS une action : ni indicateur, ni baseline, ni échéance —
// aucun verdict ne peut tomber dessus. `kind = 'note'` porte cette différence,
// et `check_at = decided_at` fait qu'elle n'attend rien.
export async function saveNote(
  texte: string,
  theme: string | null,
  jour?: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const titre = texte.trim().slice(0, 180);
  if (!titre) return { ok: false, message: "Écris quelque chose d'abord." };
  // Le jour est libre — on note souvent le lendemain ce qu'on a fait la veille.
  // Mais jamais dans le futur : une note est un fait, pas un projet.
  const aujourdhui = isoDate(new Date());
  const quand = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) && jour <= aujourdhui
    ? jour
    : aujourdhui;

  const r = await supabase.from("suivi_actions").insert({
    user_id: compte.uid,
    // Unique par construction : deux notes du même jour ne peuvent pas se
    // heurter sur la contrainte (user_id, reco_key, decided_at).
    reco_key: `note:${crypto.randomUUID()}`,
    title: titre,
    theme,
    kind: "note",
    decided_at: quand,
    // Elle n'attend aucun verdict : son échéance est le jour même.
    check_at: quand,
    status: "archived",
  });
  if (r.error) {
    // La colonne `kind` peut ne pas encore exister (migration pas passée).
    if (String(r.error.message || "").includes("kind"))
      return {
        ok: false,
        message: "La migration des notes n'est pas encore passée en base.",
      };
    return { ok: false, message: "Ta note n'a pas pu être enregistrée — réessaie." };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const r = await supabase
    .from("suivi_actions")
    .delete()
    .eq("id", id)
    .eq("user_id", compte.uid)
    .eq("kind", "note");
  if (r.error) return { ok: false, message: "Impossible de retirer cette note — réessaie." };
  revalidatePath("/");
  return { ok: true };
}

// Enregistre / bascule la réaction d'un conseil. Re-cliquer la réaction active
// la retire (toggle) ; en choisir une autre la remplace. Même table que le
// Streamlit (reco_feedback) → la boucle de la preuve voit aussi les « Fait »
// posés depuis Pulse.
export async function saveRecoFeedback(
  recoKey: string,
  reaction: Reaction,
  active: boolean,
  // Le thème + le titre de LA CARTE au moment du clic (TASK-025) — persistés
  // dans `reco_feedback` (colonnes `theme`/`title`, migration
  // `reco_feedback_contexte.sql`). Sert deux besoins : museler `not_for_me`
  // par (reco_key, thème) plutôt que par reco_key seul sur tout le compte, et
  // retrouver le TEXTE d'une piste IA passée (ses clés sont positionnelles,
  // sans ce texte rien ne l'identifie la semaine suivante).
  theme?: string | null,
  title?: string
) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const week = mondayISO();
  if (active) {
    // Toggle off : on retire la réaction de la semaine courante — SUR CE
    // THÈME (rejet du checker, 2e passe) : plusieurs lignes peuvent partager
    // `(reco_key, week_start)` depuis que `theme` est dans la clé
    // d'unicité, une par thème où ce `reco_key` apparaît. Filtrer sans
    // `theme` effacerait le retour de TOUS les thèmes d'un coup au lieu du
    // seul dont la carte a été cliquée.
    const del = await supabase
      .from("reco_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("reco_key", recoKey)
      .eq("week_start", week)
      .eq("theme", theme ?? "");
    // Repli si la colonne theme n'existe pas encore (migration pas passée) —
    // PostgREST refuse de filtrer sur une colonne absente, sans ce repli le
    // toggle échouerait en silence plutôt que de retomber sur l'ancien
    // comportement compte entier.
    if (del.error) {
      await supabase
        .from("reco_feedback")
        .delete()
        .eq("user_id", user.id)
        .eq("reco_key", recoKey)
        .eq("week_start", week);
    }
  } else {
    const r = await supabase.from("reco_feedback").upsert(
      {
        user_id: user.id,
        reco_key: recoKey,
        reaction,
        week_start: week,
        theme: theme ?? "",
        title: title ?? null,
      },
      { onConflict: "user_id,reco_key,week_start,theme" }
    );
    // Repli si les colonnes theme/title (et la contrainte reco_feedback_uq2)
    // n'existent pas encore (migration reco_feedback_contexte.sql pas
    // passée) — sur l'ANCIENNE clé.
    if (r.error) {
      await supabase.from("reco_feedback").upsert(
        { user_id: user.id, reco_key: recoKey, reaction, week_start: week },
        { onConflict: "user_id,reco_key,week_start" }
      );
    }
  }

  revalidatePath("/");
  return { ok: true };
}

// Verdict sur un constat de la vision globale (« ✓ Ça me parle » / « ✗ Pas
// d'accord »). Permanent (pas de notion de semaine) : un constat rejeté reste
// écarté même quand le worker le régénère. Re-cliquer le même verdict le retire.
export async function saveInsightFeedback(
  insightKey: string,
  verdict: "agree" | "reject",
  active: boolean
) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  if (active) {
    await supabase
      .from("insight_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("insight_key", insightKey);
  } else {
    await supabase.from("insight_feedback").upsert(
      { user_id: user.id, insight_key: insightKey, verdict },
      { onConflict: "user_id,insight_key" }
    );
  }
  revalidatePath("/");
  return { ok: true };
}

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
    await supabase
      .from("insight_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("insight_key", key);
  } else {
    const existing = await supabase
      .from("insight_feedback")
      .select("insight_key")
      .eq("user_id", user.id)
      .like("insight_key", "priority_label:%");
    const rang = (existing.data ?? []).length + 1;
    if (rang > 3) {
      message =
        `${rang}ᵉ étoile : ce thème aura sa carte, ses chiffres et ses conseils ` +
        `calculés, mais pas de pistes rédigées par l'IA — elles vont aux ` +
        `3 étoiles posées en premier. Retires-en une pour lui faire de la place.`;
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

// Objectif principal du compte ('ventes' | 'notoriete' | 'engagement' | null).
// Re-pondère les conseils — pris en compte à la prochaine publication du rapport.
export async function saveObjectif(objectif: string | null) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  await supabase
    .from("profiles")
    .update({ objectif: objectif || null })
    .eq("id", user.id);
  revalidatePath("/");
  // Réglable aussi sur /conversions (module « Nos thèmes principaux », à côté
  // des objectifs par thème) depuis que le rapport est passé en lecture seule.
  revalidatePath("/conversions");
  return { ok: true };
}

// Commentaire libre sur un conseil (nourrit le persona IA). Upsert sur la
// semaine courante — ne touche pas à la réaction existante.
//
// `theme` (TASK-025, rejet du checker 2e passe) : DOIT être fourni et
// correspondre EXACTEMENT à celui déjà posé par `saveRecoFeedback`/
// `resolveAction` pour la MÊME carte — la clé d'unicité `reco_feedback_uq2`
// porte maintenant `theme`, un commentaire sans thème irait sur une AUTRE
// ligne (celle du sentinel `""`) que la réaction déjà enregistrée pour cette
// carte, au lieu de rejoindre la même.
export async function saveComment(recoKey: string, comment: string, theme?: string | null) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const r = await supabase.from("reco_feedback").upsert(
    {
      user_id: user.id,
      reco_key: recoKey,
      week_start: mondayISO(),
      comment: comment.trim() || null,
      theme: theme ?? "",
    },
    { onConflict: "user_id,reco_key,week_start,theme" }
  );
  // Repli si la colonne theme (et reco_feedback_uq2) n'existent pas encore
  // (migration reco_feedback_contexte.sql pas passée) — sur l'ANCIENNE clé.
  if (r.error) {
    await supabase.from("reco_feedback").upsert(
      {
        user_id: user.id,
        reco_key: recoKey,
        week_start: mondayISO(),
        comment: comment.trim() || null,
      },
      { onConflict: "user_id,reco_key,week_start" }
    );
  }
  revalidatePath("/");
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
  await supabase.from("channel_budgets").upsert(
    {
      user_id: user.id,
      channel,
      month,
      amount: Number(amount) || 0,
    },
    { onConflict: "user_id,channel,month" }
  );
  revalidatePath("/couts");
  return { ok: true };
}

// Onboarding express : 5 réponses cliquées → profil stocké dans profiles
// + persona seed pour l'IA (si aucun persona n'existe encore).
const ONB_FR: Record<string, Record<string, string>> = {
  business_type: {
    ecommerce: "e-commerce",
    local: "commerce local",
    services: "services / B2B",
    createur: "créateur / média",
  },
  objectif: {
    ventes: "générer plus de ventes/contacts",
    notoriete: "gagner en notoriété et en portée",
    engagement: "construire une communauté qui réagit",
  },
  time_budget: {
    "30min": "30 minutes max par semaine — il veut l'essentiel, pas de détail",
    "1-2h": "1 à 2 heures par semaine",
    "3h+": "3 heures ou plus par semaine — il aime creuser",
  },
  frustration: {
    comprendre: "il a des chiffres mais ne sait pas quoi en FAIRE — donne toujours l'action concrète",
    temps: "le temps lui manque — va droit au but, une priorité à la fois",
    rentabilite: "il dépense sans savoir si ça rapporte — parle rentabilité, CHF et ROAS avant tout",
    stagnation: "il publie mais stagne — montre-lui ce qui change vraiment la donne",
  },
};

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

  // Persona seed : l'IA du brief démarre calibrée dès la semaine 1
  // (écrasé plus tard par le persona appris des commentaires — jamais l'inverse).
  try {
    const existing = await supabase
      .from("profiles").select("user_profile").eq("id", user.id).limit(1);
    if (!existing.data?.[0]?.user_profile) {
      const seed =
        `Profil déclaré à l'inscription : ${ONB_FR.business_type[answers.business_type] ?? answers.business_type}, ` +
        `budget pub ${answers.budget_range} CHF/mois, ${ONB_FR.time_budget[answers.time_budget] ?? answers.time_budget}. ` +
        `Objectif : ${ONB_FR.objectif[answers.objectif] ?? answers.objectif}. ` +
        `Frustration principale : ${ONB_FR.frustration[answers.frustration] ?? answers.frustration}.`;
      await supabase.from("profiles").update({ user_profile: seed }).eq("id", user.id);
    }
  } catch {
    // colonne user_profile absente → pas grave, le persona viendra des commentaires
  }
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
  const { data: current } = await _labels(supabase, user.id);
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  await supabase.from("profiles").update({ labels: [...current, clean].sort() }).eq("id", user.id);
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
// (unique user_id+label), `reco_feedback` (unique user_id+reco_key+week_start+
// theme) et `insight_feedback` (unique user_id+insight_key, où la priorité
// d'un thème est stockée sous la clé `priority_label:<nom>`) peuvent chacun
// avoir DÉJÀ une ligne sous `target` là où `oldName` en a une aussi — un
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
    const r = await supabase.from("suivi_actions").update({ theme: target })
      .eq("user_id", uid).eq("theme", oldName);
    if (r.error) return { ok: false, etape: "actions en cours" };
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
    // `theme` est dans la clé d'unicité de reco_feedback (TASK-025, scoping par
    // thème d'un « pas pour moi »/commentaire) — même traitement de conflit.
    const [oldFeedback, targetFeedback] = await Promise.all([
      supabase.from("reco_feedback").select("id, reco_key, week_start")
        .eq("user_id", uid).eq("theme", oldName),
      supabase.from("reco_feedback").select("reco_key, week_start")
        .eq("user_id", uid).eq("theme", target),
    ]);
    if (oldFeedback.error || targetFeedback.error) return { ok: false, etape: "retours sur les conseils" };
    const targetKeys = new Set(
      (targetFeedback.data ?? []).map((r) => `${r.reco_key}::${r.week_start}`)
    );
    for (const row of oldFeedback.data ?? []) {
      const key = `${row.reco_key}::${row.week_start}`;
      const r = targetKeys.has(key)
        ? await supabase.from("reco_feedback").delete().eq("id", row.id)
        : await supabase.from("reco_feedback").update({ theme: target }).eq("id", row.id);
      if (r.error) return { ok: false, etape: "retours sur les conseils" };
    }
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
  const { data: current } = await _labels(supabase, user.id);
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
      return {
        ok: false,
        message:
          `Fusion interrompue sur « ${fusion.etape} » — ce qui est déjà fusionné ` +
          `n'est pas refait, relance la fusion pour continuer.`,
      };
    }
    revalidatePath("/labels");
    revalidatePath("/");
    return { ok: true, message: `« ${oldName} » fusionné dans « ${clean} ».` };
  }
  await supabase.from("profiles")
    .update({ labels: current.map((l) => (l === oldName ? clean : l)).sort() })
    .eq("id", user.id);
  await supabase.from("meta_campaign_config").update({ label: clean })
    .eq("user_id", user.id).eq("label", oldName);
  await supabase.from("google_campaign_config").update({ label: clean })
    .eq("user_id", user.id).eq("label", oldName);
  // Les actions décidées portent le nom du thème, pas sa clé. Sans cette ligne,
  // renommer un thème rendait toutes ses actions ORPHELINES pour toujours :
  // plus aucune carte ne les prenait, et elles continuaient de compter dans le
  // plafond des trois chantiers.
  await supabase.from("suivi_actions").update({ theme: clean })
    .eq("user_id", user.id).eq("theme", oldName);
  // Même raison que la ligne au-dessus : `theme_ga4_events` porte le NOM du
  // thème. Sans ceci, renommer laisserait les événements choisis accrochés à un
  // thème qui n'existe plus — le thème renommé repartirait sans conversion, et
  // la page n'aurait aucun moyen de montrer ce qui reste en arrière.
  await supabase.from("theme_ga4_events").update({ label: clean })
    .eq("user_id", user.id).eq("label", oldName);
  // Même raison, pour l'objectif propre du thème (`theme_objectifs`).
  await supabase.from("theme_objectifs").update({ label: clean })
    .eq("user_id", user.id).eq("label", oldName);
  const posts = (await supabase.from("instagram_organic_posts").select("id, labels")
    .eq("user_id", user.id).contains("labels", [oldName])).data ?? [];
  for (const p of posts) {
    await supabase.from("instagram_organic_posts")
      .update({ labels: ((p.labels as string[]) ?? []).map((l) => (l === oldName ? clean : l)) })
      .eq("id", p.id);
  }
  revalidatePath("/labels");
  return { ok: true, message: `Renommé en « ${clean} » partout.` };
}

// Supprime partout : liste maîtresse + désassigne Meta/Google + retire des posts.
export async function deleteLabel(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const { data: current } = await _labels(supabase, user.id);
  await supabase.from("profiles")
    .update({ labels: current.filter((l) => l !== name) }).eq("id", user.id);
  await supabase.from("meta_campaign_config").update({ label: null })
    .eq("user_id", user.id).eq("label", name);
  await supabase.from("google_campaign_config").update({ label: null })
    .eq("user_id", user.id).eq("label", name);
  // Le thème disparaît : ses lignes d'événements n'ont plus de sujet. Elles
  // sont supprimées et non orphelinées — la contrainte d'unicité porte sur
  // (user_id, label, event_name), donc un thème recréé plus tard sous le même
  // nom retrouverait sinon des choix qu'il n'a jamais faits.
  await supabase.from("theme_ga4_events").delete()
    .eq("user_id", user.id).eq("label", name);
  // Même raison : un thème recréé plus tard sous le même nom ne doit pas
  // retrouver un objectif qu'il n'a jamais choisi.
  await supabase.from("theme_objectifs").delete()
    .eq("user_id", user.id).eq("label", name);
  const posts = (await supabase.from("instagram_organic_posts").select("id, labels")
    .eq("user_id", user.id).contains("labels", [name])).data ?? [];
  for (const p of posts) {
    await supabase.from("instagram_organic_posts")
      .update({ labels: ((p.labels as string[]) ?? []).filter((l) => l !== name) })
      .eq("id", p.id);
  }
  revalidatePath("/labels");
  return { ok: true, message: `« ${name} » supprimé partout.` };
}

// ── Les catégories de conversions (page /conversions) ───────────────────────
//
// MÊME PATRON QUE createLabel/renameLabel/deleteLabel, sur `conversion_categories`
// au lieu de `profiles.labels` : une catégorie est stockée par son NOM, et le
// renommer/la supprimer doit donc propager dans `ga4_event_categories.category`
// (l'événement, lui, ne bouge jamais).

async function _categories(
  supabase: ReturnType<typeof createClient>,
  uid: string
): Promise<string[]> {
  const r = await supabase.from("conversion_categories").select("name").eq("user_id", uid);
  return (r.data ?? []).map((row) => String(row.name)).sort((a, b) => a.localeCompare(b, "fr"));
}

export async function createConversionCategory(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom vide." };
  const current = await _categories(supabase, user.id);
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
  const current = await _categories(supabase, user.id);
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  const r = await supabase.from("conversion_categories")
    .update({ name: clean }).eq("user_id", user.id).eq("name", oldName);
  if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  await supabase.from("ga4_event_categories").update({ category: clean })
    .eq("user_id", user.id).eq("category", oldName);
  revalidatePath("/conversions");
  return { ok: true, message: `Renommée en « ${clean} » partout.` };
}

export async function deleteConversionCategory(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const r = await supabase.from("conversion_categories")
    .delete().eq("user_id", user.id).eq("name", name);
  if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  // La catégorie disparaît : les événements qui la portaient redeviennent
  // « non catégorisés » — l'absence de ligne EST cet état, comme pour
  // theme_ga4_events quand un thème est supprimé.
  await supabase.from("ga4_event_categories").delete()
    .eq("user_id", user.id).eq("category", name);
  revalidatePath("/conversions");
  return { ok: true, message: `« ${name} » supprimée partout.` };
}

// Pose ou retire la catégorie d'un événement GA4 — un choix qui vient d'un
// clic humain, donc toujours `category_source: 'user'` : c'est ce qui empêche
// la classification IA (`saas/traitement/categorizing.py`) de jamais l'écraser.
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
      await supabase.from("meta_campaign_config").upsert(
        { user_id: user.id, campaign_name: key, label },
        { onConflict: "user_id,campaign_name" }
      );
    }
    revalidatePath("/meta");
  } else {
    const r = await supabase.from("google_campaign_config").upsert(
      { user_id: user.id, campaign_id: key, campaign_name: campaignName, label, label_source: source },
      { onConflict: "user_id,campaign_id" }
    );
    if (r.error) {
      await supabase.from("google_campaign_config").upsert(
        { user_id: user.id, campaign_id: key, campaign_name: campaignName, label },
        { onConflict: "user_id,campaign_id" }
      );
    }
    revalidatePath("/google");
  }
  revalidatePath("/labels");
  revalidatePath("/"); // le rapport regroupe les campagnes par thème
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
    await supabase
      .from("instagram_organic_posts")
      .update({ labels: label ? [label] : [] })
      .eq("id", postId)
      .eq("user_id", user.id);
  }
  revalidatePath("/instagram");
  revalidatePath("/labels");
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

// ── Annuler en bloc ce que l'IA vient d'étiqueter ───────────────────────────
//
// Le bouton « Étiqueter tout via l'IA » applique DIRECTEMENT, sans validation
// préalable — c'est la décision de David, et elle tient à une condition : le
// retour en arrière existe. Une action de masse sans retour en arrière est un
// piège, quelle que soit la qualité du classement.
//
// LE PÉRIMÈTRE EST UNE DATE, PAS UNE SOURCE. « Tout ce qui porte 'ai' » aurait
// emporté les étiquettes posées par l'IA il y a trois semaines et gardées
// depuis. C'est `label_at` (migration labels_origine.sql) qui découpe le
// passage courant — et les lignes antérieures à la migration ont `label_at`
// NULL, donc aucun `>=` ne les attrape jamais.
//
// `depuis` vient du SERVEUR (`triggerClassify`), jamais du navigateur : deux
// horloges d'accord à la minute près, ce n'est pas quelque chose qu'on peut
// supposer d'un poste client.
async function _compterIA(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  depuis: string
): Promise<{ ok: boolean; n: number }> {
  const [m, g, p] = await Promise.all([
    supabase.from("meta_campaign_config").select("campaign_name", { count: "exact", head: true })
      .eq("user_id", uid).eq("label_source", "ai").gte("label_at", depuis),
    supabase.from("google_campaign_config").select("campaign_id", { count: "exact", head: true })
      .eq("user_id", uid).eq("label_source", "ai").gte("label_at", depuis),
    supabase.from("instagram_organic_posts").select("id", { count: "exact", head: true })
      .eq("user_id", uid).eq("label_source", "ai").gte("label_at", depuis),
  ]);
  // Une seule erreur suffit à rendre le compte faux : on préfère dire qu'on ne
  // sait pas plutôt qu'annoncer « 12 » quand il y en a 40.
  if (m.error || g.error || p.error) return { ok: false, n: 0 };
  return { ok: true, n: (m.count ?? 0) + (g.count ?? 0) + (p.count ?? 0) };
}

export async function compterEtiquettesIA(
  depuis: string
): Promise<{ ok: boolean; n: number; message?: string }> {
  if (!depuis) return { ok: true, n: 0 };
  const supabase = createClient();
  const compte = await getCompteActif();
  const r = await _compterIA(supabase, compte.uid, depuis);
  if (!r.ok)
    return { ok: false, n: 0, message: "Rejoue le SQL Supabase (labels_origine.sql)." };
  return { ok: true, n: r.n };
}

export async function annulerEtiquettesIA(
  depuis: string
): Promise<{ ok: boolean; n: number; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, n: 0, message: "Tu es en lecture seule sur ce compte." };
  if (!depuis) return { ok: true, n: 0 };

  const avant = await _compterIA(supabase, compte.uid, depuis);
  if (!avant.ok)
    return { ok: false, n: 0, message: "Rejoue le SQL Supabase (labels_origine.sql)." };
  if (avant.n === 0) return { ok: true, n: 0 };

  // On remet la ligne au VIDE, pas à un état intermédiaire : label absent,
  // source absente. Le trigger `stamp_label_at` efface la date avec la source,
  // donc une seconde annulation ne repassera pas sur ces lignes.
  // `eq('label_source','ai')` est répété sur chaque écriture : c'est le
  // garde-fou write-time qui garantit qu'aucun choix humain n'est touché,
  // même si la ligne a changé entre le comptage et l'écriture.
  const res = await Promise.all([
    supabase.from("meta_campaign_config")
      .update({ label: null, label_source: null })
      .eq("user_id", compte.uid).eq("label_source", "ai").gte("label_at", depuis),
    supabase.from("google_campaign_config")
      .update({ label: null, label_source: null })
      .eq("user_id", compte.uid).eq("label_source", "ai").gte("label_at", depuis),
    supabase.from("instagram_organic_posts")
      .update({ labels: [], label_source: null })
      .eq("user_id", compte.uid).eq("label_source", "ai").gte("label_at", depuis),
  ]);
  if (res.some((r) => r.error))
    return { ok: false, n: 0, message: "Annulation incomplète — recharge la page et réessaie." };

  revalidatePath("/labels");
  revalidatePath("/meta");
  revalidatePath("/google");
  revalidatePath("/instagram");
  revalidatePath("/");
  return { ok: true, n: avant.n };
}

// Même patron que `_compterIA`, sur `ga4_event_categories` : pas de colonne
// `label_at` dédiée ici, `updated_at` (posée par le trigger `set_updated_at`)
// joue le même rôle — la borne du passage qu'on peut annuler.
async function _compterCategoriesIA(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  depuis: string
): Promise<{ ok: boolean; n: number }> {
  const r = await supabase.from("ga4_event_categories")
    .select("event_name", { count: "exact", head: true })
    .eq("user_id", uid).eq("category_source", "ai").gte("updated_at", depuis);
  if (r.error) return { ok: false, n: 0 };
  return { ok: true, n: r.count ?? 0 };
}

export async function compterCategoriesIA(
  depuis: string
): Promise<{ ok: boolean; n: number; message?: string }> {
  if (!depuis) return { ok: true, n: 0 };
  const supabase = createClient();
  const compte = await getCompteActif();
  const r = await _compterCategoriesIA(supabase, compte.uid, depuis);
  if (!r.ok)
    return { ok: false, n: 0, message: "Rejoue le SQL Supabase (conversion_categories.sql)." };
  return { ok: true, n: r.n };
}

export async function annulerCategoriesIA(
  depuis: string
): Promise<{ ok: boolean; n: number; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, n: 0, message: "Tu es en lecture seule sur ce compte." };
  if (!depuis) return { ok: true, n: 0 };

  const avant = await _compterCategoriesIA(supabase, compte.uid, depuis);
  if (!avant.ok)
    return { ok: false, n: 0, message: "Rejoue le SQL Supabase (conversion_categories.sql)." };
  if (avant.n === 0) return { ok: true, n: 0 };

  // La ligne disparaît (pas un état intermédiaire) : l'absence de ligne EST le
  // « non catégorisé », comme partout ailleurs sur cette table.
  const r = await supabase.from("ga4_event_categories")
    .delete().eq("user_id", compte.uid).eq("category_source", "ai").gte("updated_at", depuis);
  if (r.error)
    return { ok: false, n: 0, message: "Annulation incomplète — recharge la page et réessaie." };

  revalidatePath("/conversions");
  return { ok: true, n: avant.n };
}

// ── GITHUB ACTIONS : UN CODE HTTP N'EST PAS UN MESSAGE ──────────────────────
//
// Quatre fonctions tapent la même API avec le même jeton pour lancer ou suivre
// le même workflow, et elles ratent toutes pour les mêmes raisons. Elles
// répétaient donc quatre fois « GitHub a répondu 401 — vérifie le token », une
// phrase qui ne dit à personne quoi faire : on ne « vérifie » pas un jeton
// révoqué, on en refait un. Et 401, 403 et 404 demandent trois gestes
// différents, dans trois endroits différents.
//
// LA TRADUCTION VIT ICI, ET NULLE PART AILLEURS. Ajouter un cinquième appel
// n'ajoute pas un cinquième dialecte.
//
// ON NOMME LA VARIABLE, JAMAIS SA VALEUR. Ces messages partent vers le
// navigateur, finissent dans une capture d'écran ou un ticket de support :
// `GITHUB_TOKEN` est un nom public, ce qu'il contient ne l'est pas. Aucun
// fragment de jeton — pas même les premiers caractères, pas même une longueur —
// ne doit apparaître dans un message, une trace ou un commentaire. Il n'y a pas
// non plus de repli : sans jeton valide, on ne lance rien, on le dit.
const NOM_JETON = "GITHUB_TOKEN";
const NOM_DEPOT = "GITHUB_REPO";
const DEPOT_DEFAUT = "Dernierwak/dashboard-analytic";
const WORKFLOW = "weekly-fetch.yml";

const depotGitHub = () => process.env[NOM_DEPOT] ?? DEPOT_DEFAUT;

/** Le jeton manque : ce n'est pas une panne, c'est une installation inachevée. */
const JETON_ABSENT = `Pas encore configuré : ajoute la variable ${NOM_JETON} sur Vercel (token GitHub avec accès Actions).`;

/** Chaque cause, son geste — et le geste dit OÙ il se fait. */
function messageGitHub(status: number, repo: string): string {
  switch (status) {
    case 401:
      return `GitHub refuse le jeton (401) : ${NOM_JETON} a expiré ou a été révoqué. Génère-en un nouveau sur GitHub, remplace la valeur de ${NOM_JETON} dans les variables d'environnement Vercel, puis redéploie.`;
    case 403:
      return `Jeton reconnu, mais interdit (403) : ${NOM_JETON} n'a pas le droit de lancer les Actions de ${repo}. Donne-lui la permission « Actions » en écriture sur ce dépôt, puis réessaie.`;
    // GitHub répond aussi 404 pour un dépôt PRIVÉ hors de portée du jeton :
    // il ne confirme pas l'existence de ce qu'on n'a pas le droit de voir. On
    // ne le dit pas à l'écran — trois causes dans un encart de 255 px, plus
    // personne ne lit — mais c'est la troisième piste si les deux premières
    // sont bonnes.
    case 404:
      return `Introuvable (404) : ni le dépôt ${repo}, ni le workflow ${WORKFLOW}. Vérifie ${NOM_DEPOT}, et que .github/workflows/${WORKFLOW} existe bien sur la branche par défaut.`;
    default:
      return `GitHub a répondu ${status} — l'erreur vient de son côté, pas de ta configuration. Réessaie dans quelques minutes.`;
  }
}

/** Lance le workflow avec les entrées données. Le seul chemin vers GitHub. */
async function lancerWorkflow(
  inputs: Record<string, string | boolean>,
  succes: string
): Promise<{ ok: boolean; message: string }> {
  const token = process.env[NOM_JETON];
  if (!token) return { ok: false, message: JETON_ABSENT };
  const repo = depotGitHub();

  let r: Response;
  try {
    r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs }),
      }
    );
  } catch {
    // Sans ce filet, une coupure réseau remonte en erreur d'action serveur :
    // l'écran affiche un plantage là où il n'y a qu'un réseau qui tousse.
    return {
      ok: false,
      message: "Impossible de joindre GitHub (réseau). Réessaie dans un instant.",
    };
  }
  if (r.status === 204) return { ok: true, message: succes };
  return { ok: false, message: messageGitHub(r.status, repo) };
}

// « Récupérer mes données » : déclenche le workflow GitHub Actions pour CET
// utilisateur (fetch + republication du rapport). Fire-and-forget : les
// données arrivent en base ~2-3 minutes plus tard.
export async function triggerFetch(): Promise<{ ok: boolean; message: string }> {
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  return lancerWorkflow(
    { user_id: compte.uid },
    "Mise à jour lancée — je te préviens ici dès que c'est prêt."
  );
}

// « ✨ Classer mes contenus » : labellisation IA de tous les posts/campagnes
// sans thème + republication du rapport — via le même workflow GitHub Actions,
// en mode label_only (pas de re-fetch réseau, ~1 min).
//
// C'EST LA SEULE CLASSIFICATION IA DE THÈMES DU PRODUIT, et le bouton
// « Étiqueter tout » de la page Thèmes appelle celle-ci. Elle vit dans
// `saas/traitement/labeling.py`, tourne dans GitHub Actions et respecte déjà la
// règle d'or : elle saute tout ce qui porte `label_source='user'`, donc elle
// ne remplit que le vide. En écrire une seconde CÔTÉ WEB, sur les MÊMES
// contenus (campagnes/posts), aurait donné deux classements divergents.
//
// `triggerCategorize`, plus bas, est un SECOND classifieur — même mécanisme
// (worker Python, GitHub Actions, Gemini, règle d'or `category_source`), mais
// sur un contenu DIFFÉRENT (les événements GA4, pas les campagnes/posts) : ce
// n'est donc pas la duplication que ce paragraphe met en garde contre.
//
// `depuis` EST LE BORNAGE DE L'ANNULATION. Il est pris ici, sur le serveur,
// AVANT que le workflow ne parte : tout ce que la base horodatera après cette
// seconde-là appartient à ce passage. Les trente secondes de marge absorbent
// l'écart d'horloge entre Vercel et Supabase — largement au-delà du réel (les
// deux sont sur NTP), et sans risque d'attraper autre chose : rien d'autre
// n'écrit d'étiquette IA pendant que l'utilisateur clique.
export async function triggerClassify(): Promise<{
  ok: boolean;
  message: string;
  depuis?: string;
}> {
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const depuis = new Date(Date.now() - 30_000).toISOString();

  const res = await lancerWorkflow(
    { user_id: compte.uid, label_only: true },
    "Classement lancé — l'IA labellise tes contenus, ~1 minute."
  );
  // `depuis` ne borne l'annulation que si le classement est effectivement parti.
  return res.ok ? { ...res, depuis } : res;
}

// « ✨ Classer mes conversions » (page /conversions) : catégorise tous les
// événements GA4 du catalogue qui n'ont pas encore de catégorie, via le même
// workflow GitHub Actions, en mode categorize_only. Même mécanisme que
// `triggerClassify` ci-dessus, sur un contenu différent — voir l'en-tête de
// `triggerClassify` pour pourquoi ce n'est pas la duplication qu'il proscrit.
// Ne republie PAS le rapport : une catégorie de conversion n'influence aucun
// conseil ni aucun chiffre du rapport, contrairement à un thème.
export async function triggerCategorize(): Promise<{
  ok: boolean;
  message: string;
  depuis?: string;
}> {
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const depuis = new Date(Date.now() - 30_000).toISOString();

  const res = await lancerWorkflow(
    { user_id: compte.uid, categorize_only: true },
    "Classement lancé — l'IA range tes conversions par catégorie, ~1 minute."
  );
  return res.ok ? { ...res, depuis } : res;
}

// « ↻ Recharger mes conseils » : republie le rapport depuis les données déjà
// en base (recalcul des conseils, sans re-fetch ni relabel) — ~30 s.
export async function triggerReport(): Promise<{ ok: boolean; message: string }> {
  const compte = await getCompteActif();
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  return lancerWorkflow(
    { user_id: compte.uid, report_only: true },
    "Conseils en cours de recalcul — ~30 secondes."
  );
}

// État du dernier run du workflow (pour le suivi du bouton « Mes données »).
export async function checkFetchStatus(): Promise<{
  state: "pending" | "success" | "failure" | "unknown";
  /** Début du run, en ISO — c'est LUI qui fait foi pour le temps écoulé.
   *  Sans ça, la barre repartait de zéro à chaque changement de page. */
  debut?: string;
  url?: string;
  /** Renseigné UNIQUEMENT pour 401/403/404 — les trois refus qui ne se
   *  répareront pas tout seuls. Un 5xx ou un réseau qui tousse reste
   *  « unknown » sans message : le sondage a le droit de rater un tour, il n'a
   *  pas le droit d'annoncer une panne à chaque hoquet. */
  message?: string;
}> {
  const token = process.env[NOM_JETON];
  const repo = depotGitHub();
  if (!token) return { state: "unknown" };
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (r.status === 401 || r.status === 403 || r.status === 404)
      return { state: "unknown", message: messageGitHub(r.status, repo) };
    if (!r.ok) return { state: "unknown" };
    const run = (await r.json())?.workflow_runs?.[0];
    if (!run) return { state: "unknown" };
    const meta = { debut: run.created_at as string, url: run.html_url as string };
    if (run.status !== "completed") return { state: "pending", ...meta };
    return { state: run.conclusion === "success" ? "success" : "failure", ...meta };
  } catch {
    return { state: "unknown" };
  }
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
    .eq("owner_id", compte.moi);
  if (r.error) return { ok: false, message: "Changement impossible — réessaie." };
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
    .eq("owner_id", compte.moi);
  if (r.error) return { ok: false, message: "Révocation impossible — réessaie." };
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
