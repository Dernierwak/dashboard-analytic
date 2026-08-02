import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Couche données de la page Coûts : dépense du mois en cours par canal,
// budget mensuel avec CARRY-FORWARD (même règle que budget_for_month côté
// Python), série journalière empilée, table des budgets de l'année,
// dépense du mois par thème.

const MOIS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_ABR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export type ChannelCout = {
  key: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  budget: number;
};

export type CoutDay = { date: string; label: string; meta: number; google: number };

export type MonthRow = {
  monthIso: string;   // YYYY-MM-01
  name: string;       // « jul 2026 »
  isCurrent: boolean;
  isFuture: boolean;
  metaBudget: number;
  metaSpent: number;
  googleBudget: number;
  googleSpent: number;
};

// Budget par thème : réutilise channel_budgets avec channel = "label:<nom>"
// pour le mensuel et "an:label:<nom>" pour l'annuel (même carry-forward que
// les canaux, zéro migration).
export type ThemeSpend = {
  label: string;
  spend: number;        // dépense du mois en cours
  budget: number;       // budget mensuel du thème
  spendYear: number;    // dépense cumulée depuis janvier
  budgetYear: number;   // budget annuel EFFECTIF (saisi, sinon somme des 12 mois)
  budgetYearSaisi: number; // ce qui a été saisi explicitement (0 = rien)
};

// Un jour dont la dépense dépasse le budget quotidien. C'est le garde-fou que
// le budget mensuel seul ne donne pas : à la fin du mois il est trop tard, et
// une seule journée emballée peut manger une semaine d'enveloppe.
export type AlerteJour = {
  date: string;
  label: string;
  montant: number;
  ratio: number; // 1.8 = 80 % au-dessus du budget du jour
};

export type CoutsData = {
  email: string;
  monthLabel: string;
  elapsed: number; // fraction du mois écoulée (repère), 0..1
  channels: ChannelCout[];
  totalSpent: number;
  totalBudget: number;      // budget MENSUEL effectif, tous canaux
  budgetGlobalSaisi: number; // saisi en tant que budget unique (0 = hérité des canaux)
  spentYear: number;
  budgetAnnuel: number;      // budget ANNUEL effectif
  budgetAnnuelSaisi: number; // saisi explicitement (0 = somme des 12 mois)
  joursMois: number;
  budgetJour: number;    // budget mensuel ÷ jours du mois
  moyenneJour: number;   // dépense réelle ÷ jours écoulés
  alertes: AlerteJour[]; // jours au-dessus du budget quotidien, du pire au moindre
  daily: CoutDay[];
  months: MonthRow[];
  byTheme: ThemeSpend[];
};

// PostgREST plafonne chaque requête à 1000 lignes : on pagine, sinon la
// dépense du mois est fausse (Google a >1000 lignes/an → juillet tronqué).
async function fetchAllRows<T>(
  build: () => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null }> }
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data } = await build().range(from, from + page - 1);
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < page) return out;
  }
}

export async function getCoutsData(): Promise<CoutsData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const yearStart = `${y}-01-01`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const elapsed = Math.min(1, now.getDate() / daysInMonth);

  type MetaRow = { date_start: string; campaign_name: string | null; spend: number | null };
  type GoogRow = { date_start: string; campaign_id: string | number; cost_micros: number | null };
  const [metaRows, googleRaw, budgetsRes, metaCfgRes, googCfgRes] = await Promise.all([
    fetchAllRows<MetaRow>(() =>
      supabase
        .from("meta_ads_insights")
        .select("date_start, campaign_name, spend")
        .eq("user_id", uid)
        .gte("date_start", yearStart)
        .order("date_start", { ascending: false })
    ),
    fetchAllRows<GoogRow>(() =>
      supabase
        .from("google_ads_insights")
        .select("date_start, campaign_id, cost_micros")
        .eq("user_id", uid)
        .gte("date_start", yearStart)
        .order("date_start", { ascending: false })
    ),
    supabase.from("channel_budgets").select("channel, month, amount").eq("user_id", uid),
    supabase.from("meta_campaign_config").select("campaign_name, label").eq("user_id", uid),
    supabase.from("google_campaign_config").select("campaign_id, label").eq("user_id", uid),
  ]);

  const googleRows = googleRaw.map((r) => ({
    date_start: r.date_start,
    campaign_id: String(r.campaign_id),
    chf: (Number(r.cost_micros) || 0) / 1_000_000,
  }));

  // ── Mois en cours : totaux + série journalière + par thème ────────────────
  const metaLbl = new Map((metaCfgRes.data ?? []).map((c) => [String(c.campaign_name), c.label as string | null]));
  const googLbl = new Map((googCfgRes.data ?? []).map((c) => [String(c.campaign_id), c.label as string | null]));

  let metaSpent = 0;
  let googleSpent = 0;
  const dayMap = new Map<string, { meta: number; google: number }>();
  const themeMap = new Map<string, number>();
  const themeYear = new Map<string, number>(); // même découpage, sur toute l'année

  for (const r of metaRows) {
    const dk = String(r.date_start).slice(0, 10);
    if (dk < monthStart) continue;
    const s = Number(r.spend) || 0;
    metaSpent += s;
    const d = dayMap.get(dk) ?? { meta: 0, google: 0 };
    d.meta += s;
    dayMap.set(dk, d);
    const lbl = metaLbl.get(String(r.campaign_name));
    if (lbl) themeMap.set(lbl, (themeMap.get(lbl) ?? 0) + s);
  }
  // Année : mêmes lignes, sans le filtre « ce mois-ci »
  for (const r of metaRows) {
    const lbl = metaLbl.get(String(r.campaign_name));
    if (lbl) themeYear.set(lbl, (themeYear.get(lbl) ?? 0) + (Number(r.spend) || 0));
  }
  for (const r of googleRows) {
    const dk = String(r.date_start).slice(0, 10);
    if (dk < monthStart) continue;
    googleSpent += r.chf;
    const d = dayMap.get(dk) ?? { meta: 0, google: 0 };
    d.google += r.chf;
    dayMap.set(dk, d);
    const lbl = googLbl.get(r.campaign_id);
    if (lbl) themeMap.set(lbl, (themeMap.get(lbl) ?? 0) + r.chf);
  }
  for (const r of googleRows) {
    const lbl = googLbl.get(r.campaign_id);
    if (lbl) themeYear.set(lbl, (themeYear.get(lbl) ?? 0) + r.chf);
  }

  const daily: CoutDay[] = [];
  for (let day = 1; day <= now.getDate(); day++) {
    const dk = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const v = dayMap.get(dk) ?? { meta: 0, google: 0 };
    daily.push({ date: dk, label: `${String(day).padStart(2, "0")} ${MOIS_ABR[m]}`, meta: v.meta, google: v.google });
  }

  // ── Budgets : carry-forward (même règle que budget_for_month) ─────────────
  const budgets = budgetsRes.data ?? [];
  const budgetFor = (channel: string, monthIso: string): number => {
    let best: [string, number] | null = null;
    for (const b of budgets) {
      if (b.channel !== channel) continue;
      const mo = String(b.month).slice(0, 10);
      if (mo <= monthIso && (!best || mo > best[0])) best = [mo, Number(b.amount) || 0];
    }
    return best ? best[1] : 0;
  };

  // Thèmes budgétés sans dépense ce mois : on les montre quand même (suivi).
  // Y compris ceux qui n'ont qu'un budget ANNUEL — sinon poser une enveloppe
  // d'année sur un thème le ferait disparaître de la liste jusqu'à sa première
  // dépense, c'est-à-dire exactement quand on veut le surveiller.
  for (const b of budgets) {
    const ch = String(b.channel ?? "");
    if ((Number(b.amount) || 0) <= 0) continue;
    const name = ch.startsWith("label:")
      ? ch.slice(6)
      : ch.startsWith("an:label:")
        ? ch.slice(9)
        : null;
    if (name && !themeMap.has(name)) themeMap.set(name, 0);
  }
  // Un budget annuel se SAISIT, il ne se devine pas. Beaucoup de campagnes
  // vivent sur une enveloppe posée pour l'année (un salon, une saison) qu'aucune
  // multiplication du mensuel ne reproduit. On stocke donc l'annuel à part, sur
  // le 1er janvier, et on ne retombe sur la somme des 12 mois que faute de mieux.
  const anneeIso = `${y}-01-01`;
  const sommeDouze = (channel: string): number => {
    let t = 0;
    for (let mm = 0; mm < 12; mm++) {
      t += budgetFor(channel, `${y}-${String(mm + 1).padStart(2, "0")}-01`);
    }
    return t;
  };

  const byTheme: ThemeSpend[] = [...themeMap.entries()]
    .map(([label, spend]) => {
      const saisi = budgetFor(`an:label:${label}`, anneeIso);
      return {
        label,
        spend,
        budget: budgetFor(`label:${label}`, monthStart),
        spendYear: themeYear.get(label) ?? 0,
        budgetYear: saisi > 0 ? saisi : sommeDouze(`label:${label}`),
        budgetYearSaisi: saisi,
      };
    })
    .sort((a, b) => b.spendYear - a.spendYear);

  // ── Table des budgets de l'année : dépensé par mois × canal ──────────────
  const spentByMonth = new Map<string, { meta: number; google: number }>();
  for (const r of metaRows) {
    const mo = String(r.date_start).slice(0, 7);
    const v = spentByMonth.get(mo) ?? { meta: 0, google: 0 };
    v.meta += Number(r.spend) || 0;
    spentByMonth.set(mo, v);
  }
  for (const r of googleRows) {
    const mo = String(r.date_start).slice(0, 7);
    const v = spentByMonth.get(mo) ?? { meta: 0, google: 0 };
    v.google += r.chf;
    spentByMonth.set(mo, v);
  }
  const months: MonthRow[] = [];
  for (let i = 0; i < 12; i++) {
    const iso = `${y}-${String(i + 1).padStart(2, "0")}-01`;
    const spent = spentByMonth.get(iso.slice(0, 7)) ?? { meta: 0, google: 0 };
    months.push({
      monthIso: iso,
      name: `${MOIS_ABR[i]} ${y}`,
      isCurrent: i === m,
      isFuture: i > m,
      metaBudget: budgetFor("meta", iso),
      metaSpent: spent.meta,
      googleBudget: budgetFor("google", iso),
      googleSpent: spent.google,
    });
  }

  const channels: ChannelCout[] = [
    { key: "meta", name: "Meta Ads", icon: "▣", color: "#1a56ff", spent: metaSpent, budget: budgetFor("meta", monthStart) },
    { key: "google", name: "Google Ads", icon: "◆", color: "#1a7a4a", spent: googleSpent, budget: budgetFor("google", monthStart) },
  ];

  const totalSpent = channels.reduce((a, c) => a + c.spent, 0);

  // UN SEUL BUDGET, pas un par plateforme. Personne ne raisonne « 2 000 sur
  // Meta et 10 000 sur Google » : on a une enveloppe publicitaire, et on la
  // répartit par thème. Les budgets par plateforme déjà saisis restent
  // honorés — leur somme sert de valeur de départ tant qu'aucun budget unique
  // n'est posé, pour que personne ne perde ce qu'il avait réglé.
  const budgetGlobalSaisi = budgetFor("global", monthStart);
  const totalBudget =
    budgetGlobalSaisi > 0 ? budgetGlobalSaisi : channels.reduce((a, c) => a + c.budget, 0);

  const budgetAnnuelSaisi = budgetFor("an:global", anneeIso);
  const budgetAnnuel =
    budgetAnnuelSaisi > 0
      ? budgetAnnuelSaisi
      : sommeDouze("global") > 0
        ? sommeDouze("global")
        : sommeDouze("meta") + sommeDouze("google");

  const spentYear = months.reduce((a, mo) => a + mo.metaSpent + mo.googleSpent, 0);

  // Le rythme quotidien : le seul niveau où l'on peut encore réagir. Un budget
  // mensuel ne se constate qu'à la fin du mois, quand l'argent est parti.
  const joursMois = daysInMonth;
  const budgetJour = totalBudget > 0 ? totalBudget / joursMois : 0;
  const joursEcoules = Math.max(1, now.getDate());
  const moyenneJour = totalSpent / joursEcoules;
  const alertes: AlerteJour[] =
    budgetJour > 0
      ? daily
          .map((d) => ({
            date: d.date,
            label: d.label,
            montant: d.meta + d.google,
            ratio: (d.meta + d.google) / budgetJour,
          }))
          .filter((a) => a.ratio > 1)
          .sort((a, b) => b.montant - a.montant)
      : [];

  return {
    email: compte.email,
    monthLabel: `${MOIS_FULL[m]} ${y}`,
    elapsed,
    channels,
    totalSpent,
    totalBudget,
    budgetGlobalSaisi,
    spentYear,
    budgetAnnuel,
    budgetAnnuelSaisi,
    joursMois,
    budgetJour,
    moyenneJour,
    alertes,
    daily,
    months,
    byTheme,
  };
}
