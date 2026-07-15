import { createClient } from "@/lib/supabase/server";

// Couche données des dashboards par canal — mêmes règles que partout :
// fenêtre de N jours PLEINS ancrée sur la dernière date de données (jamais
// aujourd'hui), delta vs la fenêtre précédente de même durée.
// Même base que les onglets Streamlit : 7 KPIs, série journalière, campagnes
// avec drill-down par annonce (Meta), vue Par label, page Instagram complète.

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

// ── Publicité (Meta / Google) ────────────────────────────────────────────────

export type AdRow = {
  name: string;
  adset: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

export type Campaign = {
  key: string;   // meta : campaign_name · google : campaign_id
  name: string;
  label: string | null;
  status: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  ads: AdRow[]; // Meta : drill-down par annonce · Google : vide
};

export type DayPoint = { date: string; label: string; spend: number; clicks: number };

export type LabelAgg = {
  label: string;
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
  impressions: number;
  imprDelta: number | null;
  reach: number;      // 0 si non suivi (Google)
  ctr: number;
  cpc: number;
  cpm: number;
  daily: DayPoint[];  // série journalière de la fenêtre (asc)
  campaigns: Campaign[];
  byLabel: LabelAgg[];
  labels: string[];
};

type RawAd = {
  date: string;
  campaign: string;
  adset: string;
  ad: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

// Cœur commun Meta/Google : fenêtres, agrégats, série, par-campagne, par-label.
function buildDash(
  rows: RawAd[],
  days: number,
  cfg: Map<string, { name?: string; label: string | null; status: string | null }>,
  keyOf: (r: RawAd) => string,
  labels: string[],
  email: string,
  withAds: boolean
): Omit<ChannelDash, "email" | "labels"> & { email: string; labels: string[] } {
  const w = makeWindow(rows[0]?.date ?? null, days);

  let spend = 0, clicks = 0, impressions = 0, reach = 0;
  let pSpend = 0, pClicks = 0, pImpr = 0;
  const byDay = new Map<string, { spend: number; clicks: number }>();
  const byCamp = new Map<string, { spend: number; clicks: number; impressions: number; reach: number; ads: Map<string, AdRow> }>();

  for (const r of rows) {
    if (inWin(r.date, w.since, w.until)) {
      spend += r.spend; clicks += r.clicks; impressions += r.impressions; reach += r.reach;
      const dk = r.date.slice(0, 10);
      const dd = byDay.get(dk) ?? { spend: 0, clicks: 0 };
      dd.spend += r.spend; dd.clicks += r.clicks;
      byDay.set(dk, dd);

      const ck = keyOf(r);
      const c = byCamp.get(ck) ?? { spend: 0, clicks: 0, impressions: 0, reach: 0, ads: new Map() };
      c.spend += r.spend; c.clicks += r.clicks; c.impressions += r.impressions; c.reach += r.reach;
      if (withAds && r.ad) {
        const a = c.ads.get(r.ad) ?? { name: r.ad, adset: r.adset, spend: 0, clicks: 0, impressions: 0, ctr: 0, cpc: 0 };
        a.spend += r.spend; a.clicks += r.clicks; a.impressions += r.impressions;
        c.ads.set(r.ad, a);
      }
      byCamp.set(ck, c);
    } else if (inWin(r.date, w.prevSince, w.prevUntil)) {
      pSpend += r.spend; pClicks += r.clicks; pImpr += r.impressions;
    }
  }

  // Série journalière complète (jours sans dépense inclus → barres à zéro)
  const daily: DayPoint[] = [];
  for (let d = new Date(w.since); d <= w.until; d = addDays(d, 1)) {
    const k = iso(d);
    const v = byDay.get(k) ?? { spend: 0, clicks: 0 };
    daily.push({ date: k, label: fmtDay(d), spend: v.spend, clicks: v.clicks });
  }

  const campaigns: Campaign[] = [...byCamp.entries()]
    .map(([key, c]) => {
      const conf = cfg.get(key);
      const ads = [...c.ads.values()]
        .map((a) => ({
          ...a,
          ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
          cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
        }))
        .sort((a, b) => b.spend - a.spend);
      return {
        key,
        name: conf?.name || key,
        label: conf?.label ?? null,
        status: conf?.status ?? null,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        reach: c.reach,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
        ads,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // Vue Par label — agrégation des campagnes labellisées
  const lblAgg = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const c of campaigns) {
    if (!c.label) continue;
    const a = lblAgg.get(c.label) ?? { spend: 0, clicks: 0, impressions: 0 };
    a.spend += c.spend; a.clicks += c.clicks; a.impressions += c.impressions;
    lblAgg.set(c.label, a);
  }
  const byLabel: LabelAgg[] = [...lblAgg.entries()]
    .map(([label, a]) => ({
      label,
      spend: a.spend,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    email,
    periodLabel: w.label,
    days,
    spend,
    spendDelta: pct(spend, pSpend),
    clicks,
    clicksDelta: pct(clicks, pClicks),
    impressions,
    imprDelta: pct(impressions, pImpr),
    reach,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    daily,
    campaigns,
    byLabel,
    labels,
  };
}

export async function getMetaDash(days: number): Promise<ChannelDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("meta_ads_insights")
      .select("date_start, campaign_name, adset_name, ad_name, spend, clicks, impressions, reach")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(9000),
    supabase.from("meta_campaign_config")
      .select("campaign_name, label, effective_status").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);

  const rows: RawAd[] = (rowsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_name ?? ""),
    adset: String(r.adset_name ?? ""),
    ad: String(r.ad_name ?? ""),
    spend: Number(r.spend) || 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0,
  }));
  const cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_name),
      { name: String(c.campaign_name), label: (c.label as string | null) ?? null, status: (c.effective_status as string | null) ?? null },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  return buildDash(rows, days, cfg, (r) => r.campaign, labels, user?.email ?? "", true);
}

export async function getGoogleDash(days: number): Promise<ChannelDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(9000),
    supabase.from("google_campaign_config")
      .select("campaign_id, campaign_name, label, effective_status").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);

  const rows: RawAd[] = (rowsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_id),
    adset: "",
    ad: "",
    spend: (Number(r.cost_micros) || 0) / 1_000_000,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    reach: 0,
  }));
  const cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_id),
      {
        name: (c.campaign_name as string) || `Campagne ${c.campaign_id}`,
        label: (c.label as string | null) ?? null,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  return buildDash(rows, days, cfg, (r) => r.campaign, labels, user?.email ?? "", false);
}

// ── Instagram organique ───────────────────────────────────────────────────────

export type InstaPost = {
  date: string;      // ISO
  type: string;
  caption: string;
  mediaUrl: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  eng: number;       // %
};

export type FormatStat = { type: string; count: number; avgReach: number; avgEng: number };

export type FollowerPoint = { date: string; followers: number };

export type InstaDash = {
  email: string;
  periodLabel: string;
  days: number;
  followers: number;
  followersDelta: number | null;  // sur la période
  growth30: number | null;        // sur ~30 jours
  avgEng: number;      // engagement moyen historique du compte
  histReach: number;   // portée moyenne historique
  followersSeries: FollowerPoint[]; // asc, ~30 derniers relevés
  formats: FormatStat[];            // stats par format (tout l'historique)
  posts: InstaPost[];  // posts de la fenêtre, plus récents d'abord
  allPosts: InstaPost[]; // tout l'historique (vue globale)
  postsEng: number | null;
  postsReach: number | null;
};

const FORMAT_LABEL: Record<string, string> = {
  VIDEO: "Reel",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrousel",
  IMAGE: "Image",
};

export async function getInstaDash(days: number): Promise<InstaDash> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [postsRes, followsRes] = await Promise.all([
    supabase.from("instagram_organic_posts")
      .select("date, type, caption, media_url, reach, views, likes, comments, saved")
      .eq("user_id", uid).order("date", { ascending: false }).limit(500),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: false }).limit(60),
  ]);
  const all: InstaPost[] = (postsRes.data ?? []).map((p) => {
    const reach = Number(p.reach) || 0;
    const likes = Number(p.likes) || 0;
    const comments = Number(p.comments) || 0;
    const saved = Number(p.saved) || 0;
    return {
      date: String(p.date ?? ""),
      type: FORMAT_LABEL[String(p.type ?? "")] ?? String(p.type ?? ""),
      caption: String(p.caption ?? ""),
      mediaUrl: String(p.media_url ?? ""),
      reach,
      views: Number(p.views) || 0,
      likes, comments, saved,
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

  // Croissance ~30 jours : relevé le plus proche d'il y a 30 jours
  let growth30: number | null = null;
  if (follows.length >= 2) {
    const target = new Date(String(follows[0].fetched_at)).getTime() - 30 * 86400_000;
    let best: { diff: number; val: number } | null = null;
    for (const f of follows.slice(1)) {
      const diff = Math.abs(new Date(String(f.fetched_at)).getTime() - target);
      if (!best || diff < best.diff) best = { diff, val: Number(f.followers) || 0 };
    }
    if (best) growth30 = followers - best.val;
  }

  const followersSeries: FollowerPoint[] = follows
    .slice(0, 30)
    .map((f) => ({ date: String(f.fetched_at).slice(0, 10), followers: Number(f.followers) || 0 }))
    .reverse();

  // Stats par format sur tout l'historique (comme l'onglet Streamlit)
  const fmtMap = new Map<string, { count: number; reach: number; eng: number }>();
  for (const p of all) {
    const f = fmtMap.get(p.type) ?? { count: 0, reach: 0, eng: 0 };
    f.count += 1; f.reach += p.reach; f.eng += p.eng;
    fmtMap.set(p.type, f);
  }
  const formats: FormatStat[] = [...fmtMap.entries()]
    .map(([type, f]) => ({
      type,
      count: f.count,
      avgReach: f.count ? f.reach / f.count : 0,
      avgEng: f.count ? f.eng / f.count : 0,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    email: user?.email ?? "",
    periodLabel: w.label,
    days,
    followers,
    followersDelta,
    growth30,
    avgEng: mean(all.map((p) => p.eng)),
    histReach: mean(all.map((p) => p.reach)),
    followersSeries,
    formats,
    posts,
    allPosts: all,
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
