import { createClient } from "@/lib/supabase/server";

// Couche données des dashboards par canal — mêmes règles que partout :
// fenêtre de N jours PLEINS ancrée sur la dernière date de données (jamais
// aujourd'hui), delta vs la fenêtre précédente de même durée.

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

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

export function periodDays(sp: { d?: string } | undefined): 7 | 14 | 30 {
  const d = Number(sp?.d);
  return d === 14 ? 14 : d === 30 ? 30 : 7;
}

type Window = { since: Date; until: Date; prevSince: Date; prevUntil: Date; label: string };

function makeWindow(lastDataIso: string | null, days: number): Window {
  const yesterday = addDays(new Date(), -1);
  let anchor = yesterday;
  if (lastDataIso) {
    const d = new Date(lastDataIso.slice(0, 10) + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d < yesterday) anchor = d;
  }
  const since = addDays(anchor, -(days - 1));
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(days - 1));
  return {
    since,
    until: anchor,
    prevSince,
    prevUntil,
    label: `${fmtDay(since)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · ${days} jours pleins`,
  };
}

const inWin = (dateStr: string, since: Date, until: Date) => {
  const d = String(dateStr).slice(0, 10);
  return d >= iso(since) && d <= iso(until);
};

export function pct(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

// ── Meta Ads ──────────────────────────────────────────────────────────────────

export type Campaign = {
  key: string;   // meta : campaign_name · google : campaign_id
  name: string;
  label: string | null;
  status: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

export type ChannelDash = {
  email: string;
  periodLabel: string;
  days: number;
  spend: number;
  spendDelta: number | null;
  clicks: number;
  clicksDelta: number | null;
  ctr: number;
  cpc: number;
  impressions: number;
  campaigns: Campaign[];
  labels: string[];
};

export async function getMetaDash(days: number): Promise<ChannelDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("meta_ads_insights")
      .select("date_start, campaign_name, spend, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(6000),
    supabase.from("meta_campaign_config")
      .select("campaign_name, label, effective_status").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);
  const rows = rowsRes.data ?? [];
  const cfg = new Map((cfgRes.data ?? []).map((c) => [c.campaign_name, c]));
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  const w = makeWindow(rows[0]?.date_start ?? null, days);
  const agg = new Map<string, { spend: number; clicks: number; impressions: number }>();
  let spend = 0, clicks = 0, impressions = 0, pSpend = 0, pClicks = 0;
  for (const r of rows) {
    const s = Number(r.spend) || 0, c = Number(r.clicks) || 0, i = Number(r.impressions) || 0;
    if (inWin(r.date_start, w.since, w.until)) {
      spend += s; clicks += c; impressions += i;
      const a = agg.get(r.campaign_name) ?? { spend: 0, clicks: 0, impressions: 0 };
      a.spend += s; a.clicks += c; a.impressions += i;
      agg.set(r.campaign_name, a);
    } else if (inWin(r.date_start, w.prevSince, w.prevUntil)) {
      pSpend += s; pClicks += c;
    }
  }

  const campaigns: Campaign[] = [...agg.entries()]
    .map(([name, a]) => ({
      key: name,
      name,
      label: (cfg.get(name)?.label as string | null) ?? null,
      status: (cfg.get(name)?.effective_status as string | null) ?? null,
      spend: a.spend,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    email: user?.email ?? "",
    periodLabel: w.label,
    days,
    spend,
    spendDelta: pct(spend, pSpend),
    clicks,
    clicksDelta: pct(clicks, pClicks),
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    impressions,
    campaigns,
    labels,
  };
}

export async function getGoogleDash(days: number): Promise<ChannelDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(6000),
    supabase.from("google_campaign_config")
      .select("campaign_id, campaign_name, label, effective_status").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);
  const rows = rowsRes.data ?? [];
  const cfg = new Map((cfgRes.data ?? []).map((c) => [String(c.campaign_id), c]));
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  const w = makeWindow(rows[0]?.date_start ?? null, days);
  const agg = new Map<string, { spend: number; clicks: number; impressions: number }>();
  let spend = 0, clicks = 0, impressions = 0, pSpend = 0, pClicks = 0;
  for (const r of rows) {
    const s = (Number(r.cost_micros) || 0) / 1_000_000;
    const c = Number(r.clicks) || 0, i = Number(r.impressions) || 0;
    const key = String(r.campaign_id);
    if (inWin(r.date_start, w.since, w.until)) {
      spend += s; clicks += c; impressions += i;
      const a = agg.get(key) ?? { spend: 0, clicks: 0, impressions: 0 };
      a.spend += s; a.clicks += c; a.impressions += i;
      agg.set(key, a);
    } else if (inWin(r.date_start, w.prevSince, w.prevUntil)) {
      pSpend += s; pClicks += c;
    }
  }

  const campaigns: Campaign[] = [...agg.entries()]
    .map(([key, a]) => ({
      key,
      name: (cfg.get(key)?.campaign_name as string) || `Campagne ${key}`,
      label: (cfg.get(key)?.label as string | null) ?? null,
      status: (cfg.get(key)?.effective_status as string | null) ?? null,
      spend: a.spend,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    email: user?.email ?? "",
    periodLabel: w.label,
    days,
    spend,
    spendDelta: pct(spend, pSpend),
    clicks,
    clicksDelta: pct(clicks, pClicks),
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    impressions,
    campaigns,
    labels,
  };
}

// ── Instagram organique ───────────────────────────────────────────────────────

export type InstaPost = {
  date: string;      // ISO
  type: string;
  caption: string;
  reach: number;
  likes: number;
  comments: number;
  saved: number;
  eng: number;       // %
};

export type InstaDash = {
  email: string;
  periodLabel: string;
  days: number;
  followers: number;
  followersDelta: number | null;
  avgEng: number;      // engagement moyen historique du compte
  histReach: number;   // portée moyenne historique
  posts: InstaPost[];  // posts de la fenêtre, plus récents d'abord
  postsEng: number | null;   // engagement moyen des posts de la fenêtre
  postsReach: number | null; // portée moyenne des posts de la fenêtre
};

export async function getInstaDash(days: number): Promise<InstaDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("instagram_organic_posts")
      .select("date, type, caption, reach, likes, comments, saved")
      .eq("user_id", uid).order("date", { ascending: false }).limit(400),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: false }).limit(40),
  ]);
  const all = (postsRes.data ?? []).map((p) => {
    const reach = Number(p.reach) || 0;
    const likes = Number(p.likes) || 0;
    const comments = Number(p.comments) || 0;
    const saved = Number(p.saved) || 0;
    return {
      date: String(p.date ?? ""),
      type: String(p.type ?? ""),
      caption: String(p.caption ?? ""),
      reach, likes, comments, saved,
      eng: reach > 0 ? ((likes + comments + saved) / reach) * 100 : 0,
    };
  });
  const follows = followsRes.data ?? [];

  const w = makeWindow(all[0]?.date ?? null, days);
  const posts = all.filter((p) => inWin(p.date, w.since, w.until));

  const followers = follows.length ? Number(follows[0].followers) || 0 : 0;
  let followersDelta: number | null = null;
  if (follows.length > days) followersDelta = followers - (Number(follows[days].followers) || 0);
  else if (follows.length >= 7) followersDelta = followers - (Number(follows[6].followers) || 0);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    email: user?.email ?? "",
    periodLabel: w.label,
    days,
    followers,
    followersDelta,
    avgEng: mean(all.map((p) => p.eng)),
    histReach: mean(all.map((p) => p.reach)),
    posts,
    postsEng: posts.length ? mean(posts.map((p) => p.eng)) : null,
    postsReach: posts.length ? mean(posts.map((p) => p.reach)) : null,
  };
}

// ── Labels (liste + compteurs d'usage) ───────────────────────────────────────

export type LabelRowData = { name: string; meta: number; google: number; instagram: number };

export async function getLabelsData(): Promise<{ email: string; rows: LabelRowData[] }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [labelsRes, metaRes, googleRes, instaRes] = await Promise.all([
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
    supabase.from("meta_campaign_config").select("label").eq("user_id", uid),
    supabase.from("google_campaign_config").select("label").eq("user_id", uid),
    supabase.from("instagram_organic_posts").select("labels").eq("user_id", uid),
  ]);
  const master = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);
  const counts = new Map<string, LabelRowData>();
  const bump = (name: string | null, ch: "meta" | "google" | "instagram") => {
    if (!name) return;
    const row = counts.get(name) ?? { name, meta: 0, google: 0, instagram: 0 };
    row[ch] += 1;
    counts.set(name, row);
  };
  for (const r of metaRes.data ?? []) bump(r.label, "meta");
  for (const r of googleRes.data ?? []) bump(r.label, "google");
  for (const r of instaRes.data ?? [])
    for (const l of (r.labels as string[] | null) ?? []) bump(l, "instagram");

  // Union : liste maîtresse d'abord, puis les labels assignés hors liste (orphelins).
  const rows: LabelRowData[] = master.map(
    (name) => counts.get(name) ?? { name, meta: 0, google: 0, instagram: 0 }
  );
  for (const [name, row] of counts) if (!master.includes(name)) rows.push(row);

  return { email: user?.email ?? "", rows };
}
