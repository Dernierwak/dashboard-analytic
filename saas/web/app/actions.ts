"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// Enregistre / bascule la réaction d'un conseil. Re-cliquer la réaction active
// la retire (toggle) ; en choisir une autre la remplace. Même table que le
// Streamlit (reco_feedback) → la boucle de la preuve voit aussi les « Fait »
// posés depuis Pulse.
export async function saveRecoFeedback(recoKey: string, reaction: Reaction, active: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

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

// Objectif principal du compte ('ventes' | 'notoriete' | 'engagement' | null).
// Re-pondère les conseils — pris en compte à la prochaine publication du rapport.
export async function saveObjectif(objectif: string | null) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
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

// Budget mensuel d'un canal — mois en cours (carry-forward pour les suivants).
export async function saveBudget(channel: string, amount: number) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const now = new Date();
  const monthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  await supabase.from("channel_budgets").upsert(
    {
      user_id: user.id,
      channel,
      month: monthIso,
      amount: Number(amount) || 0,
    },
    { onConflict: "user_id,channel,month" }
  );
  revalidatePath("/couts");
  return { ok: true };
}

// ── Labels unifiés (liste maîtresse profiles.labels + assignations par canal) ─

async function _labels(supabase: ReturnType<typeof createClient>, uid: string): Promise<string[]> {
  const r = await supabase.from("profiles").select("labels").eq("id", uid).limit(1);
  return (r.data?.[0]?.labels as string[] | null) ?? [];
}

export async function createLabel(name: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Non connecté." };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Non connecté." };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Non connecté." };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (channel === "meta") {
    await supabase.from("meta_campaign_config").upsert(
      { user_id: user.id, campaign_name: key, label },
      { onConflict: "user_id,campaign_name" }
    );
    revalidatePath("/meta");
  } else {
    await supabase.from("google_campaign_config").upsert(
      { user_id: user.id, campaign_id: key, campaign_name: campaignName, label },
      { onConflict: "user_id,campaign_id" }
    );
    revalidatePath("/google");
  }
  revalidatePath("/labels");
  return { ok: true };
}

// « Récupérer mes données » : déclenche le workflow GitHub Actions pour CET
// utilisateur (fetch + republication du rapport). Fire-and-forget : les
// données arrivent en base ~2-3 minutes plus tard.
export async function triggerFetch(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Non connecté." };

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
      message: "Mise à jour lancée — tes données arrivent dans 2-3 minutes, recharge ensuite.",
    };
  }
  return { ok: false, message: `GitHub a répondu ${r.status} — vérifie le token.` };
}
