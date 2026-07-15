import { createClient } from "@/lib/supabase/server";

// Couche données de la page Coûts : dépense du mois en cours par canal,
// budget mensuel avec CARRY-FORWARD (même règle que budget_for_month côté
// Python : si le mois n'a pas de ligne, on reporte le dernier budget ≤ mois).

const MOIS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export type ChannelCout = {
  key: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  budget: number;
};

export type CoutsData = {
  email: string;
  monthLabel: string;
  elapsed: number; // fraction du mois écoulée (repère), 0..1
  channels: ChannelCout[];
  totalSpent: number;
  totalBudget: number;
};

export async function getCoutsData(): Promise<CoutsData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const elapsed = Math.min(1, now.getDate() / daysInMonth);

  const [metaRes, googleRes, budgetsRes] = await Promise.all([
    supabase
      .from("meta_ads_insights")
      .select("spend")
      .eq("user_id", uid)
      .gte("date_start", monthStart),
    supabase
      .from("google_ads_insights")
      .select("cost_micros")
      .eq("user_id", uid)
      .gte("date_start", monthStart),
    supabase.from("channel_budgets").select("channel, month, amount").eq("user_id", uid),
  ]);

  const metaSpent = (metaRes.data ?? []).reduce((a, r) => a + (Number(r.spend) || 0), 0);
  const googleSpent =
    (googleRes.data ?? []).reduce((a, r) => a + (Number(r.cost_micros) || 0), 0) / 1_000_000;

  const budgets = budgetsRes.data ?? [];
  const budgetFor = (channel: string): number => {
    let best: [string, number] | null = null;
    for (const b of budgets) {
      if (b.channel !== channel) continue;
      const mo = String(b.month).slice(0, 10);
      if (mo <= monthStart && (!best || mo > best[0])) best = [mo, Number(b.amount) || 0];
    }
    return best ? best[1] : 0;
  };

  const channels: ChannelCout[] = [
    { key: "meta", name: "Meta Ads", icon: "▣", color: "#1a56ff", spent: metaSpent, budget: budgetFor("meta") },
    { key: "google", name: "Google Ads", icon: "◆", color: "#1a7a4a", spent: googleSpent, budget: budgetFor("google") },
  ];

  return {
    email: user?.email ?? "",
    monthLabel: `${MOIS_FULL[m]} ${y}`,
    elapsed,
    channels,
    totalSpent: channels.reduce((a, c) => a + c.spent, 0),
    totalBudget: channels.reduce((a, c) => a + c.budget, 0),
  };
}
