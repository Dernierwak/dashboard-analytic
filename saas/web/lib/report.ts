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
  platform: "instagram" | "meta" | "google" | "pub" | "ia";
  title: string;
  observation: string;
  pourquoi: string;
  verifier: string;
  repere?: string;
  angle_mort?: string;
  confidence: "solide" | "creuser" | "piste";
  priority: number;
  source?: "rule" | "ai";
  // Suivi « ▶ Je le teste » : indicateur-cible + sa valeur du moment (photo).
  metric?: string | null;
  metric_label?: string | null;
  direction?: string | null;
  baseline?: number | null;
};

export type TrackedAction = {
  id: string;
  title: string;
  theme: string | null;
  metric_label: string | null;
  decided_at: string;
  check_at: string;
  due?: boolean;
  then?: number;
  now?: number;
  delta?: number | null;
  verdict?: "better" | "worse" | "stable";
};

export type ThemeRow = { label: string; spend: number; rev: number };

// Constat de la vision globale (« Ce qui fonctionne pour toi ») — clé stable,
// verdict du client persistant (insight_feedback).
export type VisionConstat = {
  key: string;
  kind: string; // theme_best | theme_worst | format_best | slot_best | campagne_locomotive | angle_mort
  title: string;
  detail: string;
  status: "new" | "agree" | "reject";
};

export type VisionBlock = {
  generated_at: string;
  period_label: string; // « depuis le 1 jan »
  priorities?: string[]; // ≤ 3 thèmes prioritaires choisis page Thèmes
  constats: VisionConstat[];
};

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

export type MatriceCoverage = {
  posts_labeled: number;
  posts_total: number;
  campaigns_labeled: number;
  campaigns_total: number;
  ga4: boolean;
};

// Carte « par thème » du rapport v2 — le cœur : un label, ses chiffres, ses
// campagnes (éditables) et ≤3 conseils cross-canal.
export type ThemeCampaign = {
  name: string;
  channel: "meta" | "google";
  key: string; // campaign_name (Meta) | campaign_id (Google) — clé d'édition
  label: string | null;
  label_source: string | null;
  spend: number;
  revenue: number | null;
  ctr: number;
  cpc: number;
};

export type ThemeSummary = {
  spend: number | null;
  revenue: number | null;
  roas: number | null;
  ctr: number | null;
  posts: number | null;
  reach_avg: number | null;
  eng_avg: number | null;
  spend_week: number;
  best_campaign: string | null;
  n_campaigns: number;
};

export type ThemeSeries = {
  metric_label: string;
  points: { label: string; value: number }[];
  markers: number[]; // index de semaine où une action a été lancée
};

export type ThemeFocus = {
  label: string;
  is_priority: boolean;
  summary: ThemeSummary;
  series?: ThemeSeries | null;
  campaigns: ThemeCampaign[];
  recos: PayloadReco[];
};

export type ReportPayload = {
  version: number;
  // v2 (worker) — absents des payloads v1 : tout est optionnel.
  vision?: VisionBlock | null;
  matrice?: { coverage?: MatriceCoverage } | null;
  themes_focus?: ThemeFocus[] | null;
  reglages?: PayloadReco[] | null;
  tracking?: { running: TrackedAction[]; verified: TrackedAction[] } | null;
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
  // Verdicts sur les constats de la vision globale — live (le payload peut dater).
  insightFeedback: Record<string, string>;
  // Commentaires de la semaine courante (pré-remplissage) + objectif du compte.
  comments: Record<string, string>;
  objectif: string | null;
  onboarded: boolean;
  // Liste maîtresse des thèmes (étape « priorités » du parcours de démarrage).
  labels: string[];
  // Clés des conseils actuellement suivis (« ▶ Je le teste » → en cours).
  trackedKeys: string[];
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
  const [metaRes, googleRes, followersRes, reportRes, fbRes, profileRes, ga4Res, postsRes, insightRes, trackRes] =
    await Promise.all([
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
    supabase.from("profiles").select("objectif, business_type, labels").eq("id", uid).limit(1),
    // Pour la Vue d'ensemble selon la mission (ventes → revenu, noto/eng → posts)
    supabase
      .from("ga4_insights")
      .select("date, medium, revenue")
      .eq("user_id", uid)
      .gte("date", iso(addDays(new Date(), -35)))
      .limit(6000),
    supabase
      .from("instagram_organic_posts")
      .select("date, reach, likes, comments, saved")
      .eq("user_id", uid)
      .gte("date", iso(addDays(new Date(), -35)))
      .limit(300),
    // Verdicts ✓/✗ sur les constats de la vision (table absente avant la
    // migration → error, on dégrade en {}).
    supabase
      .from("insight_feedback")
      .select("insight_key, verdict")
      .eq("user_id", uid),
    // Conseils en cours de suivi (« ▶ Je le teste ») — état live du bouton.
    supabase
      .from("suivi_actions")
      .select("reco_key")
      .eq("user_id", uid)
      .eq("status", "running"),
  ]);

  const meta = metaRes.data ?? [];
  const google = googleRes.data ?? [];
  const followers = followersRes.data ?? [];
  // Table absente tant que la migration n'est pas passée → error, on affiche
  // simplement l'invitation à ouvrir le rapport Streamlit une fois.
  const report: ReportPayload | null =
    (reportRes.data?.[0]?.payload as ReportPayload | undefined) ?? null;

  const insightFeedback: Record<string, string> = {};
  for (const row of insightRes.data ?? []) {
    if (row.insight_key && row.verdict) insightFeedback[row.insight_key] = row.verdict;
  }

  const trackedKeys: string[] = (trackRes.data ?? [])
    .map((r) => String(r.reco_key))
    .filter(Boolean);

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

  // Si la colonne business_type n'existe pas encore (migration §7 pas passée),
  // la requête combinée échoue → on retombe sur objectif seul, onboarding masqué.
  let profRow: {
    objectif?: string | null;
    business_type?: string | null;
    labels?: string[] | null;
  } | null = profileRes.data?.[0] ?? null;
  let migrated = !profileRes.error;
  if (profileRes.error) {
    const retry = await supabase.from("profiles").select("objectif, labels").eq("id", uid).limit(1);
    profRow = retry.data?.[0] ?? null;
  }
  const objectif: string | null = profRow?.objectif ?? null;
  const labels: string[] = profRow?.labels ?? [];
  // Onboarded si déjà répondu — ou si la migration n'est pas passée (pas de formulaire cassé)
  const onboarded: boolean =
    !migrated || Boolean(objectif) || Boolean(profRow?.business_type);

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

  // ── Vue d'ensemble SELON LA MISSION — les 3 chiffres qui servent l'objectif ─
  const winDates = `${fmtDay(curSince)} → ${fmtDay(anchor)}`;

  // Revenu payant GA4 (fenêtre courante + précédente)
  const ga4Rows = ga4Res.data ?? [];
  const isPaid = (m: unknown) =>
    ["cpc", "ppc", "paid"].some((k) => String(m ?? "").toLowerCase().includes(k));
  let rev = 0, revPrev = 0;
  for (const r of ga4Rows) {
    if (!isPaid(r.medium)) continue;
    if (inWin(String(r.date), curSince, anchor)) rev += Number(r.revenue) || 0;
    else if (inWin(String(r.date), prevSince, prevUntil)) revPrev += Number(r.revenue) || 0;
  }
  const hasGa4 = ga4Rows.length > 0;

  // Posts Instagram (fenêtre courante + précédente)
  const postRows = (postsRes.data ?? []).map((p) => ({
    date: String(p.date ?? ""),
    reach: Number(p.reach) || 0,
    inter: (Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saved) || 0),
  }));
  const pWin = postRows.filter((p) => inWin(p.date, curSince, anchor));
  const pPrev = postRows.filter((p) => inWin(p.date, prevSince, prevUntil));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const reachAvg = mean(pWin.map((p) => p.reach));
  const reachAvgPrev = mean(pPrev.map((p) => p.reach));
  const engAvg = mean(pWin.map((p) => (p.reach > 0 ? (p.inter / p.reach) * 100 : 0)));
  const engAvgPrev = mean(pPrev.map((p) => (p.reach > 0 ? (p.inter / p.reach) * 100 : 0)));
  const interTot = pWin.reduce((a, p) => a + p.inter, 0);
  const interTotPrev = pPrev.reduce((a, p) => a + p.inter, 0);

  const kpiSpend: Kpi = {
    label: "Dépensé",
    value: `${fmtCHF(spend)} CHF`,
    sub: `Meta + Google · ${winDates}`,
    delta: pctDelta(spend, spendPrev),
    deltaGoodWhenUp: null,
  };
  const kpiClicks: Kpi = {
    label: "Clics",
    value: fmtCHF(clicks),
    sub: `CTR ${ctr.toFixed(2)} %`,
    delta: pctDelta(clicks, clicksPrev),
    deltaGoodWhenUp: true,
  };
  const kpiFollowers: Kpi = {
    label: "Abonnés",
    value:
      followersDelta === null
        ? "—"
        : `${followersDelta >= 0 ? "+" : ""}${fmtCHF(followersDelta)}`,
    sub: followersNow === null ? "pas de relevé" : `${fmtCHF(followersNow)} au total`,
    delta: null,
    deltaGoodWhenUp: true,
  };

  let kpis: Kpi[];
  if (objectif === "ventes" && hasGa4) {
    const roas = spend > 0 ? rev / spend : 0;
    kpis = [
      kpiSpend,
      {
        label: "Revenu attribué",
        value: `${fmtCHF(rev)} CHF`,
        sub: spend > 0 ? `ROAS ${roas.toFixed(1)} · GA4 payant` : "GA4 · trafic payant",
        delta: pctDelta(rev, revPrev),
        deltaGoodWhenUp: true,
      },
      kpiClicks,
    ];
  } else if (objectif === "notoriete") {
    kpis = [
      kpiFollowers,
      {
        label: "Portée moyenne / post",
        value: pWin.length ? fmtCHF(reachAvg) : "—",
        sub: `${pWin.length} post${pWin.length > 1 ? "s" : ""} · ${winDates}`,
        delta: pWin.length && pPrev.length ? pctDelta(reachAvg, reachAvgPrev) : null,
        deltaGoodWhenUp: true,
      },
      {
        label: "Posts publiés",
        value: String(pWin.length),
        sub: pPrev.length ? `${pPrev.length} la période précédente` : "sur la période",
        delta: null,
        deltaGoodWhenUp: true,
      },
    ];
  } else if (objectif === "engagement") {
    kpis = [
      {
        label: "Engagement moyen",
        value: pWin.length ? `${engAvg.toFixed(1)} %` : "—",
        sub: `${pWin.length} post${pWin.length > 1 ? "s" : ""} · ${winDates}`,
        delta: pWin.length && pPrev.length ? pctDelta(engAvg, engAvgPrev) : null,
        deltaGoodWhenUp: true,
      },
      {
        label: "Interactions",
        value: fmtCHF(interTot),
        sub: "j'aime + comm. + enreg.",
        delta: pctDelta(interTot, interTotPrev),
        deltaGoodWhenUp: true,
      },
      kpiFollowers,
    ];
  } else {
    kpis = [kpiSpend, kpiClicks, kpiFollowers];
  }

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
    insightFeedback,
    comments,
    objectif,
    onboarded,
    labels,
    trackedKeys,
  };
}
