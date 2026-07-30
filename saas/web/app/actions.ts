"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getCompteActif, COOKIE_COMPTE } from "@/lib/account";

export type Reaction = "useful" | "not_for_me" | "done";

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
  detail?: { observation?: string; pourquoi?: string; verifier?: string; effort?: string | null } | null;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  if (a.tracked) {
    // Toggle off : on retire de la liste les suivis non rangés de ce conseil.
    await supabase
      .from("suivi_actions")
      .delete()
      .eq("user_id", user.id)
      .eq("reco_key", a.recoKey)
      .in("status", ["running", "done"]);
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
  recoKey?: string
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
      await supabase.from("reco_feedback").upsert(
        { user_id: user.id, reco_key: recoKey, reaction: "done", week_start: mondayISO() },
        { onConflict: "user_id,reco_key,week_start" }
      );
    }
  }
  revalidatePath("/");
  return { ok: true };
}

// Enregistre / bascule la réaction d'un conseil. Re-cliquer la réaction active
// la retire (toggle) ; en choisir une autre la remplace. Même table que le
// Streamlit (reco_feedback) → la boucle de la preuve voit aussi les « Fait »
// posés depuis Pulse.
export async function saveRecoFeedback(recoKey: string, reaction: Reaction, active: boolean) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const week = mondayISO();
  if (active) {
    // Toggle off : on retire la réaction de la semaine courante.
    await supabase
      .from("reco_feedback")
      .delete()
      .eq("user_id", user.id)
      .eq("reco_key", recoKey)
      .eq("week_start", week);
  } else {
    await supabase.from("reco_feedback").upsert(
      {
        user_id: user.id,
        reco_key: recoKey,
        reaction,
        week_start: week,
      },
      { onConflict: "user_id,reco_key,week_start" }
    );
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

// Thème prioritaire (max 3) — « on ne peut pas travailler sur tout » : le
// moteur concentre constats et conseils sur ces thèmes, modifiables à tout
// moment. Stocké dans insight_feedback (clé priority_label:<nom>) : zéro
// migration, permanent, RLS own-rows.
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
    if ((existing.data ?? []).length >= 3) {
      return { ok: false, message: "3 priorités max — retire d'abord un thème." };
    }
    const r = await supabase.from("insight_feedback").upsert(
      { user_id: user.id, insight_key: key, verdict: "agree" },
      { onConflict: "user_id,insight_key" }
    );
    if (r.error) return { ok: false, message: "Rejoue le SQL Supabase (table manquante)." };
  }
  revalidatePath("/labels");
  revalidatePath("/");
  return { ok: true };
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
  return { ok: true };
}

// Commentaire libre sur un conseil (nourrit le persona IA). Upsert sur la
// semaine courante — ne touche pas à la réaction existante.
export async function saveComment(recoKey: string, comment: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  await supabase.from("reco_feedback").upsert(
    {
      user_id: user.id,
      reco_key: recoKey,
      week_start: mondayISO(),
      comment: comment.trim() || null,
    },
    { onConflict: "user_id,reco_key,week_start" }
  );
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

export async function saveOnboarding(answers: {
  objectif: string;
  business_type: string;
  budget_range: string;
  time_budget: string;
  frustration: string;
}) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  await supabase
    .from("profiles")
    .update({
      objectif: answers.objectif || null,
      business_type: answers.business_type || null,
      budget_range: answers.budget_range || null,
      time_budget: answers.time_budget || null,
      frustration: answers.frustration || null,
    })
    .eq("id", user.id);

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

async function _labels(supabase: ReturnType<typeof createClient>, uid: string): Promise<string[]> {
  const r = await supabase.from("profiles").select("labels").eq("id", uid).limit(1);
  return (r.data?.[0]?.labels as string[] | null) ?? [];
}

export async function createLabel(name: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom vide." };
  const current = await _labels(supabase, user.id);
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  await supabase.from("profiles").update({ labels: [...current, clean].sort() }).eq("id", user.id);
  revalidatePath("/labels");
  return { ok: true, message: `« ${clean} » créé.` };
}

// Renomme partout : liste maîtresse + assignations Meta/Google + posts Instagram.
export async function renameLabel(oldName: string, newName: string) {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };
  const clean = newName.trim();
  if (!clean) return { ok: false, message: "Nouveau nom vide." };
  const current = await _labels(supabase, user.id);
  if (current.includes(clean)) return { ok: false, message: `« ${clean} » existe déjà.` };
  await supabase.from("profiles")
    .update({ labels: current.map((l) => (l === oldName ? clean : l)).sort() })
    .eq("id", user.id);
  await supabase.from("meta_campaign_config").update({ label: clean })
    .eq("user_id", user.id).eq("label", oldName);
  await supabase.from("google_campaign_config").update({ label: clean })
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
  const current = await _labels(supabase, user.id);
  await supabase.from("profiles")
    .update({ labels: current.filter((l) => l !== name) }).eq("id", user.id);
  await supabase.from("meta_campaign_config").update({ label: null })
    .eq("user_id", user.id).eq("label", name);
  await supabase.from("google_campaign_config").update({ label: null })
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
  // (repli sans la colonne si la migration n'est pas encore passée)
  if (channel === "meta") {
    const r = await supabase.from("meta_campaign_config").upsert(
      { user_id: user.id, campaign_name: key, label, label_source: "user" },
      { onConflict: "user_id,campaign_name" }
    );
    if (r.error) {
      await supabase.from("meta_campaign_config").upsert(
        { user_id: user.id, campaign_name: key, label },
        { onConflict: "user_id,campaign_name" }
      );
    }
    revalidatePath("/meta");
  } else {
    const r = await supabase.from("google_campaign_config").upsert(
      { user_id: user.id, campaign_id: key, campaign_name: campaignName, label, label_source: "user" },
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
  // label_source='user' : un choix humain n'est jamais réécrit par l'IA.
  // (repli sans la colonne si la migration n'est pas encore passée)
  const r = await supabase
    .from("instagram_organic_posts")
    .update({ labels: label ? [label] : [], label_source: "user" })
    .eq("id", postId)
    .eq("user_id", user.id);
  if (r.error) {
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

// « Récupérer mes données » : déclenche le workflow GitHub Actions pour CET
// utilisateur (fetch + republication du rapport). Fire-and-forget : les
// données arrivent en base ~2-3 minutes plus tard.
export async function triggerFetch(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "Dernierwak/dashboard-analytic";
  if (!token) {
    return {
      ok: false,
      message:
        "Pas encore configuré : ajoute la variable GITHUB_TOKEN sur Vercel (token GitHub avec accès Actions).",
    };
  }

  const r = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/weekly-fetch.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id } }),
    }
  );
  if (r.status === 204) {
    return {
      ok: true,
      message: "Mise à jour lancée — je te préviens ici dès que c'est prêt.",
    };
  }
  return { ok: false, message: `GitHub a répondu ${r.status} — vérifie le token.` };
}

// « ✨ Classer mes contenus » : labellisation IA de tous les posts/campagnes
// sans thème + republication du rapport — via le même workflow GitHub Actions,
// en mode label_only (pas de re-fetch réseau, ~1 min).
export async function triggerClassify(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "Dernierwak/dashboard-analytic";
  if (!token) {
    return {
      ok: false,
      message:
        "Pas encore configuré : ajoute la variable GITHUB_TOKEN sur Vercel (token GitHub avec accès Actions).",
    };
  }

  const r = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/weekly-fetch.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id, label_only: true } }),
    }
  );
  if (r.status === 204) {
    return {
      ok: true,
      message: "Classement lancé — l'IA labellise tes contenus, ~1 minute.",
    };
  }
  return { ok: false, message: `GitHub a répondu ${r.status} — vérifie le token.` };
}

// « ↻ Recharger mes conseils » : republie le rapport depuis les données déjà
// en base (recalcul des conseils, sans re-fetch ni relabel) — ~30 s.
export async function triggerReport(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const user = { id: compte.uid };
  if (!compte.peutEditer)
    return { ok: false, message: "Tu es en lecture seule sur ce compte." };

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "Dernierwak/dashboard-analytic";
  if (!token) {
    return {
      ok: false,
      message:
        "Pas encore configuré : ajoute la variable GITHUB_TOKEN sur Vercel (token GitHub avec accès Actions).",
    };
  }

  const r = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/weekly-fetch.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id, report_only: true } }),
    }
  );
  if (r.status === 204) {
    return { ok: true, message: "Conseils en cours de recalcul — ~30 secondes." };
  }
  return { ok: false, message: `GitHub a répondu ${r.status} — vérifie le token.` };
}

// État du dernier run du workflow (pour le suivi du bouton « Mes données »).
export async function checkFetchStatus(): Promise<{
  state: "pending" | "success" | "failure" | "unknown";
}> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? "Dernierwak/dashboard-analytic";
  if (!token) return { state: "unknown" };
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/weekly-fetch.yml/runs?per_page=1`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (!r.ok) return { state: "unknown" };
    const run = (await r.json())?.workflow_runs?.[0];
    if (!run) return { state: "unknown" };
    if (run.status !== "completed") return { state: "pending" };
    return { state: run.conclusion === "success" ? "success" : "failure" };
  } catch {
    return { state: "unknown" };
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
