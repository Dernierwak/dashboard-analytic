import { createClient } from "@/lib/supabase/server";

// Couche données du rapport hebdo.
// Règles maison (identiques au Streamlit) :
//  - fenêtre = 7 jours PLEINS, ancrés sur la dernière date de données (jamais aujourd'hui)
//  - delta = comparaison avec les 7 jours pleins précédents
//  - |delta| < 0.5 % → « stable »

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export type Kpi = {
  label: string;
  value: string;
  sub: string;
  delta: number | null; // % vs 7 jours précédents, null = pas comparable
  deltaGoodWhenUp: boolean | null; // null = neutre (ex. dépense)
};

export type ChannelSpend = { name: string; icon: string; color: string; spend: number; prev: number };

// Payload publié par le rapport Streamlit (weekly_reports.payload) — même contenu.
export type PayloadReco = {
  key: string;
  platform: "instagram" | "meta" | "google" | "ia";
  title: string;
  observation: string;
  pourquoi: string;
  verifier: string;
  repere?: string;
  angle_mort?: string;
  confidence: "solide" | "creuser" | "piste";
  priority: number;
};

export type ThemeRow = { label: string; spend: number; rev: number };

export type ProofOutcome = {
  key: string;
  title: string;
  week_label: string; // « sem. du 8 jul »
  kpi: string;
  unit: string;
  then: string;
  now: string;
  delta: number | null;
  verdict: "better" | "worse" | "stable";
};

export type ReportPayload = {
  version: number;
  week_label: string;
  since: string;
  until: string;
  verdict: string;
  brief: string | null;
  suivi: { applique: number; utile: number; ecarte: number };
  todo: { key: string; title: string; platform: string; done: boolean }[];
  recos: PayloadReco[];
  themes?: { rows: ThemeRow[]; orphan: number } | null;
  preuve?: {
    outcomes: ProofOutcome[];
    pending: { key: string; title: string }[];
  } | null;
};

export type WeeklyData = {
  email: string;
  weekLabel: string;
  hasData: boolean;
  kpis: Kpi[];
  channels: ChannelSpend[];
  report: ReportPayload | null;
  // Dernière réaction par type de conseil (4 semaines) — live, comme le Streamlit.
  feedback: Record<string, string>;
  // Commentaires de la semaine courante (pré-remplissage) + objectif du compte.
  comments: Record<string, string>;
  objectif: string | null;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function fmtDay(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MOIS_FR[d.getUTCMonth()]}`;
}

export function fmtCHF(n: number): string {
  return n.toLocaleString("fr-CH", { maximumFractionDigits: 0 }).replace(/ /g, " ");
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export async function getWeeklyData(): Promise<WeeklyData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  // On lit ~1 mois : assez pour la fenêtre courante + la précédente.
  const fbCutoff = iso(addDays(new Date(), -28));
  const [metaRes, googleRes, followersRes, reportRes, fbRes, profileRes] = await Promise.all([
    supabase
      .from("meta_ads_insights")
      .select("date_start, spend, clicks, impressions")
      .eq("user_id", uid)
      .order("date_start", { ascending: false })
      .limit(3000),
    supabase
      .from("google_ads_insights")
      .select("date_start, cost_micros, clicks, impressions")
      .eq("user_id", uid)
      .order("date_start", { ascending: false })
      .limit(3000),
    supabase
      .from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid)
      .order("fetched_at", { ascending: false })
      .limit(40),
    supabase
      .from("weekly_reports")
      .select("week_start, payload")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(1),
    supabase
      .from("reco_feedback")
      .select("reco_key, reaction, week_start, comment")
      .eq("user_id", uid)
      .gte("week_start", fbCutoff)
      .order("week_start", { ascending: false }),
    supabase.from("profiles").select("objectif").eq("id", uid).limit(1),
  ]);

  const meta = metaRes.data ?? [];
  const google = googleRes.data ?? [];
  const followers = followersRes.data ?? [];
  // Table absente tant que la migration n'est pas passée → error, on affiche
  // simplement l'invitation à ouvrir le rapport Streamlit une fois.
  const report: ReportPayload | null =
    (reportRes.data?.[0]?.payload as ReportPayload | undefined) ?? null;

  // Dernière réaction par clé (tri desc → première vue = la plus récente),
  // même logique que fetch_reco_feedback côté Python.
  const feedback: Record<string, string> = {};
  for (const row of fbRes.data ?? []) {
    if (row.reco_key && row.reaction && !(row.reco_key in feedback))
      feedback[row.reco_key] = row.reaction;
  }

  // Commentaires de la semaine courante (lundi) — pré-remplissent les cartes.
  const nowLocal = new Date();
  const mondayLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
  mondayLocal.setDate(mondayLocal.getDate() - ((mondayLocal.getDay() + 6) % 7));
  const p2 = (n: number) => String(n).padStart(2, "0");
  const mondayIso = `${mondayLocal.getFullYear()}-${p2(mondayLocal.getMonth() + 1)}-${p2(mondayLocal.getDate())}`;
  const comments: Record<string, string> = {};
  for (const row of fbRes.data ?? []) {
    if (row.reco_key && row.comment && String(row.week_start).slice(0, 10) === mondayIso)
      comments[row.reco_key] = row.comment;
  }

  const objectif: string | null = profileRes.data?.[0]?.objectif ?? null;

  // Ancre = dernière date de données (jour plein), jamais après hier.
  const yesterday = addDays(new Date(), -1);
  let anchor: Date | null = null;
  for (const rows of [meta, google]) {
    for (const r of rows) {
      const d = new Date(String(r.date_start).slice(0, 10) + "T00:00:00Z");
      if (!isNaN(d.getTime()) && (!anchor || d > anchor)) anchor = d;
    }
  }
  if (!anchor || anchor > yesterday) anchor = anchor && anchor <= yesterday ? anchor : yesterday;

  const curSince = addDays(anchor, -6);
  const prevSince = addDays(anchor, -13);
  const prevUntil = addDays(anchor, -7);

  const inWin = (dateStr: string, since: Date, until: Date) => {
    const d = String(dateStr).slice(0, 10);
    return d >= iso(since) && d <= iso(until);
  };

  const sum = (rows: any[], col: string, since: Date, until: Date, factor = 1) =>
    rows.reduce(
      (acc, r) => (inWin(r.date_start, since, until) ? acc + (Number(r[col]) || 0) * factor : acc),
      0
    );

  // Meta
  const mSpend = sum(meta, "spend", curSince, anchor);
  const mSpendPrev = sum(meta, "spend", prevSince, prevUntil);
  const mClicks = sum(meta, "clicks", curSince, anchor);
  const mClicksPrev = sum(meta, "clicks", prevSince, prevUntil);
  const mImpr = sum(meta, "impressions", curSince, anchor);

  // Google (coûts en micros)
  const gSpend = sum(google, "cost_micros", curSince, anchor, 1 / 1_000_000);
  const gSpendPrev = sum(google, "cost_micros", prevSince, prevUntil, 1 / 1_000_000);
  const gClicks = sum(google, "clicks", curSince, anchor);
  const gClicksPrev = sum(google, "clicks", prevSince, prevUntil);
  const gImpr = sum(google, "impressions", curSince, anchor);

  const spend = mSpend + gSpend;
  const spendPrev = mSpendPrev + gSpendPrev;
  const clicks = mClicks + gClicks;
  const clicksPrev = mClicksPrev + gClicksPrev;
  const impr = mImpr + gImpr;
  const ctr = impr > 0 ? (clicks / impr) * 100 : 0;

  // Abonnés : dernier relevé vs relevé le plus proche d'il y a 7 jours.
  let followersNow: number | null = null;
  let followersDelta: number | null = null;
  if (followers.length > 0) {
    followersNow = Number(followers[0].followers) || 0;
    const target = addDays(new Date(String(followers[0].fetched_at)), -7).getTime();
    let best: { diff: number; val: number } | null = null;
    for (const f of followers.slice(1)) {
      const t = new Date(String(f.fetched_at)).getTime();
      const diff = Math.abs(t - target);
      if (!best || diff < best.diff) best = { diff, val: Number(f.followers) || 0 };
    }
    if (best) followersDelta = followersNow - best.val;
  }

  const hasData = meta.length > 0 || google.length > 0 || followers.length > 0;

  const kpis: Kpi[] = [
    {
      label: "Dépensé",
      value: `${fmtCHF(spend)} CHF`,
      sub: "Meta + Google · 7j pleins",
      delta: pctDelta(spend, spendPrev),
      deltaGoodWhenUp: null,
    },
    {
      label: "Clics",
      value: fmtCHF(clicks),
      sub: `CTR ${ctr.toFixed(2)} %`,
      delta: pctDelta(clicks, clicksPrev),
      deltaGoodWhenUp: true,
    },
    {
      label: "Abonnés",
      value:
        followersDelta === null
          ? "—"
          : `${followersDelta >= 0 ? "+" : ""}${fmtCHF(followersDelta)}`,
      sub: followersNow === null ? "pas de relevé" : `${fmtCHF(followersNow)} au total`,
      delta: null,
      deltaGoodWhenUp: true,
    },
  ];

  const channels: ChannelSpend[] = [
    { name: "Meta Ads", icon: "▣", color: "#1a56ff", spend: mSpend, prev: mSpendPrev },
    { name: "Google Ads", icon: "◆", color: "#1a7a4a", spend: gSpend, prev: gSpendPrev },
  ];

  return {
    email: user?.email ?? "",
    weekLabel: `${fmtDay(curSince)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · 7 jours pleins`,
    hasData,
    kpis,
    channels,
    report,
    feedback,
    comments,
    objectif,
  };
}
