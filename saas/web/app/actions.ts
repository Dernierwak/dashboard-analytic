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
