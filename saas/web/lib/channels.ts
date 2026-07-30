import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Couche données des dashboards par canal — mêmes règles que le Streamlit :
// fenêtre de N jours PLEINS ancrée sur la dernière date de données (jamais
// aujourd'hui), delta vs la fenêtre précédente ; « Tout » = tout l'historique.
// Filtres statut / campagne / thème appliqués AVANT les agrégats (KPIs, graphe
// et tables suivent le filtre, comme dans l'app actuelle).

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

export type Days = 7 | 14 | 30 | 90 | 0; // 0 = tout l'historique

export type DashParams = {
  d?: string;
  m?: string;       // métrique du graphe
  status?: string;  // filtre statut
  camp?: string;    // filtre campagne (key)
  label?: string;   // filtre thème
  from?: string;    // période custom : YYYY-MM-DD
  to?: string;
  s?: string;       // tri des tables (Instagram)
};

export function periodDays(sp: DashParams | undefined): Days {
  if (sp?.d === "0") return 0;
  const d = Number(sp?.d);
  return d === 14 ? 14 : d === 30 ? 30 : d === 90 ? 90 : 7;
}

type Window = { since: Date; until: Date; prevSince: Date; prevUntil: Date; label: string };

function makeWindow(lastDataIso: string | null, firstDataIso: string | null, days: Days): Window {
  const yesterday = addDays(new Date(), -1);
  let anchor = yesterday;
  if (lastDataIso) {
    const d = new Date(lastDataIso.slice(0, 10) + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d < yesterday) anchor = d;
  }
  if (days === 0) {
    let first = addDays(anchor, -365);
    if (firstDataIso) {
      const f = new Date(firstDataIso.slice(0, 10) + "T00:00:00Z");
      if (!isNaN(f.getTime())) first = f;
    }
    // pas de période précédente comparable → deltas null
    return {
      since: first,
      until: anchor,
      prevSince: addDays(first, -1),
      prevUntil: addDays(first, -2),
      label: `Tout l'historique · ${fmtDay(first)} ${first.getUTCFullYear()} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()}`,
    };
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

// Période custom « du … au … » : fenêtre libre, comparée à la fenêtre de même
// durée juste avant (même règle de delta que les presets).
export function customWindow(sp: DashParams | undefined): Window | null {
  const f = sp?.from ?? "";
  const t = sp?.to ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const since = new Date(f + "T00:00:00Z");
  const until = new Date(t + "T00:00:00Z");
  if (isNaN(since.getTime()) || isNaN(until.getTime()) || since > until) return null;
  const len = Math.round((until.getTime() - since.getTime()) / 86400_000) + 1;
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(len - 1));
  return {
    since,
    until,
    prevSince,
    prevUntil,
    label: `du ${fmtDay(since)} ${since.getUTCFullYear()} au ${fmtDay(until)} ${until.getUTCFullYear()} · ${len} jours`,
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
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

export type AdsetRow = AdRow & { ads: AdRow[] };

export type Campaign = {
  key: string;   // meta : campaign_name · google : campaign_id
  name: string;
  label: string | null;
  labelSource: string | null; // 'user' | 'ai' — pastille IA sur les thèmes proposés
  status: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  adsets: AdsetRow[]; // Meta : adsets → ads · Google : groupes d'annonces → annonces
};

export type DayPoint = {
  date: string;
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
};

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
  days: Days;
  metric: string;
  filters: { status: string; camp: string; label: string };
  statusOptions: string[];
  campOptions: { key: string; name: string }[];
  activeCampaigns: number;
  spend: number;
  spendDelta: number | null;
  clicks: number;
  clicksDelta: number | null;
  impressions: number;
  imprDelta: number | null;
  reach: number;      // 0 si non suivi (Google)
  reachDelta: number | null;
  ctr: number;
  ctrDelta: number | null;
  cpc: number;
  cpcDelta: number | null;
  cpm: number;
  cpmDelta: number | null;
  daily: DayPoint[];
  campaigns: Campaign[];
  byLabel: LabelAgg[];
  labels: string[];
};

type RawAd = {
  date: string;
  campaign: string; // clé de campagne
  adset: string;
  ad: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

type Cfg = Map<string, { name: string; label: string | null; labelSource: string | null; status: string | null }>;

function buildDash(
  rows: RawAd[],
  drillRows: RawAd[],
  days: Days,
  sp: DashParams | undefined,
  cfg: Cfg,
  labels: string[],
  email: string
): ChannelDash {
  const lastIso = rows[0]?.date ?? null;
  const firstIso = rows.length ? rows[rows.length - 1].date : null;
  const w = customWindow(sp) ?? makeWindow(lastIso, firstIso, days);

  // Options de filtre (avant filtrage — on liste tout ce qui existe)
  const statusSet = new Set<string>();
  const campSet = new Map<string, string>();
  for (const r of rows) {
    const c = cfg.get(r.campaign);
    if (c?.status) statusSet.add(c.status);
    campSet.set(r.campaign, c?.name || r.campaign);
  }

  const fStatus = sp?.status ?? "";
  const fCamp = sp?.camp ?? "";
  const fLabel = sp?.label ?? "";
  const keep = (campKey: string): boolean => {
    const c = cfg.get(campKey);
    if (fStatus && (c?.status ?? "") !== fStatus) return false;
    if (fCamp && campKey !== fCamp) return false;
    if (fLabel && (c?.label ?? "") !== fLabel) return false;
    return true;
  };

  let spend = 0, clicks = 0, impressions = 0, reach = 0;
  let pSpend = 0, pClicks = 0, pImpr = 0, pReach = 0;
  const byDay = new Map<string, { spend: number; clicks: number; impressions: number }>();
  const byCamp = new Map<string, { spend: number; clicks: number; impressions: number; reach: number }>();

  for (const r of rows) {
    if (!keep(r.campaign)) continue;
    if (inWin(r.date, w.since, w.until)) {
      spend += r.spend; clicks += r.clicks; impressions += r.impressions; reach += r.reach;
      const dk = r.date.slice(0, 10);
      const dd = byDay.get(dk) ?? { spend: 0, clicks: 0, impressions: 0 };
      dd.spend += r.spend; dd.clicks += r.clicks; dd.impressions += r.impressions;
      byDay.set(dk, dd);
      const c = byCamp.get(r.campaign) ?? { spend: 0, clicks: 0, impressions: 0, reach: 0 };
      c.spend += r.spend; c.clicks += r.clicks; c.impressions += r.impressions; c.reach += r.reach;
      byCamp.set(r.campaign, c);
    } else if (inWin(r.date, w.prevSince, w.prevUntil)) {
      pSpend += r.spend; pClicks += r.clicks; pImpr += r.impressions; pReach += r.reach;
    }
  }

  // Drill-down : campagne → adset/groupe → annonce (sur la fenêtre, filtré)
  const drill = new Map<string, Map<string, Map<string, { spend: number; clicks: number; impressions: number }>>>();
  for (const r of drillRows) {
    if (!keep(r.campaign) || !inWin(r.date, w.since, w.until)) continue;
    const setName = r.adset || "—";
    const adName = r.ad || "—";
    const sets = drill.get(r.campaign) ?? new Map();
    const ads = sets.get(setName) ?? new Map();
    const a = ads.get(adName) ?? { spend: 0, clicks: 0, impressions: 0 };
    a.spend += r.spend; a.clicks += r.clicks; a.impressions += r.impressions;
    ads.set(adName, a);
    sets.set(setName, ads);
    drill.set(r.campaign, sets);
  }
  const finish = (x: { spend: number; clicks: number; impressions: number }) => ({
    ctr: x.impressions > 0 ? (x.clicks / x.impressions) * 100 : 0,
    cpc: x.clicks > 0 ? x.spend / x.clicks : 0,
  });

  // Série journalière complète (jours vides inclus) — bornée à 120 pts pour « Tout »
  const daily: DayPoint[] = [];
  let dStart = w.since;
  const maxPts = 120;
  const span = Math.round((w.until.getTime() - w.since.getTime()) / 86400_000) + 1;
  if (span > maxPts) dStart = addDays(w.until, -(maxPts - 1));
  for (let d = new Date(dStart); d <= w.until; d = addDays(d, 1)) {
    const k = iso(d);
    const v = byDay.get(k) ?? { spend: 0, clicks: 0, impressions: 0 };
    daily.push({ date: k, label: fmtDay(d), spend: v.spend, clicks: v.clicks, impressions: v.impressions });
  }

  const campaigns: Campaign[] = [...byCamp.entries()]
    .map(([key, c]) => {
      const conf = cfg.get(key);
      const adsets: AdsetRow[] = [...(drill.get(key) ?? new Map()).entries()]
        .map(([setName, adsMap]) => {
          const ads: AdRow[] = [...(adsMap as Map<string, { spend: number; clicks: number; impressions: number }>).entries()]
            .map(([adName, a]) => ({ name: adName, ...a, ...finish(a) }))
            .sort((a, b) => b.spend - a.spend);
          const tot = ads.reduce(
            (acc, a) => ({ spend: acc.spend + a.spend, clicks: acc.clicks + a.clicks, impressions: acc.impressions + a.impressions }),
            { spend: 0, clicks: 0, impressions: 0 }
          );
          return { name: setName, ...tot, ...finish(tot), ads };
        })
        .sort((a, b) => b.spend - a.spend);
      return {
        key,
        name: conf?.name || key,
        label: conf?.label ?? null,
        labelSource: conf?.labelSource ?? null,
        status: conf?.status ?? null,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        reach: c.reach,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
        adsets,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const lblAgg = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const c of campaigns) {
    if (!c.label) continue;
    const a = lblAgg.get(c.label) ?? { spend: 0, clicks: 0, impressions: 0 };
    a.spend += c.spend; a.clicks += c.clicks; a.impressions += c.impressions;
    lblAgg.set(c.label, a);
  }
  const byLabel: LabelAgg[] = [...lblAgg.entries()]
    .map(([label, a]) => ({ label, ...a, ...finish(a) }))
    .sort((a, b) => b.spend - a.spend);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0;
  const pCpc = pClicks > 0 ? pSpend / pClicks : 0;
  const pCpm = pImpr > 0 ? (pSpend / pImpr) * 1000 : 0;

  const METRICS = ["spend", "clicks", "impressions", "ctr", "cpc"];
  const metric = METRICS.includes(sp?.m ?? "") ? (sp!.m as string) : "spend";

  return {
    email,
    periodLabel: w.label,
    days,
    metric,
    filters: { status: fStatus, camp: fCamp, label: fLabel },
    statusOptions: [...statusSet].sort(),
    campOptions: [...campSet.entries()].map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    activeCampaigns: campaigns.length,
    spend,
    spendDelta: pct(spend, pSpend),
    clicks,
    clicksDelta: pct(clicks, pClicks),
    impressions,
    imprDelta: pct(impressions, pImpr),
    reach,
    reachDelta: pct(reach, pReach),
    ctr,
    ctrDelta: pct(ctr, pCtr),
    cpc,
    cpcDelta: pct(cpc, pCpc),
    cpm,
    cpmDelta: pct(cpm, pCpm),
    daily,
    campaigns,
    byLabel,
    labels,
  };
}

export async function getMetaDash(sp: DashParams | undefined): Promise<ChannelDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("meta_ads_insights")
      .select("date_start, campaign_name, adset_name, ad_name, spend, clicks, impressions, reach")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("meta_campaign_config")
      .select("*").eq("user_id", uid),
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
  const cfg: Cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_name),
      {
        name: String(c.campaign_name),
        label: (c.label as string | null) ?? null,
        labelSource: (c.label_source as string | null) ?? null,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  // Meta : les lignes sont déjà au niveau annonce → mêmes lignes pour le drill.
  return buildDash(rows, rows, days, sp, cfg, labels, compte.email);
}

export async function getGoogleDash(sp: DashParams | undefined): Promise<ChannelDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [rowsRes, adsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    supabase.from("google_ads_ad_insights")
      .select("date_start, campaign_id, ad_group_name, ad_name, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("google_campaign_config")
      .select("*").eq("user_id", uid),
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
  // Drill google : groupes d'annonces → annonces (table dédiée)
  const drillRows: RawAd[] = (adsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_id),
    adset: String(r.ad_group_name ?? ""),
    ad: String(r.ad_name ?? ""),
    spend: (Number(r.cost_micros) || 0) / 1_000_000,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    reach: 0,
  }));
  const cfg: Cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_id),
      {
        name: (c.campaign_name as string) || `Campagne ${c.campaign_id}`,
        label: (c.label as string | null) ?? null,
        labelSource: (c.label_source as string | null) ?? null,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  return buildDash(rows, drillRows, days, sp, cfg, labels, compte.email);
}

// ── Instagram organique ───────────────────────────────────────────────────────

export type InstaPost = {
  id: string;        // uuid de la ligne (édition du thème)
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
  labels: string[];
  labelSource: string | null; // 'user' | 'ai' — pastille IA sur les thèmes proposés
};

// avgReach = moyenne de la MÉTRIQUE CHOISIE (pas forcément la portée).
export type FormatStat = { type: string; count: number; avgReach: number; avgEng: number };
export type FollowerPoint = { date: string; followers: number };
export type SlotCell = { count: number; avgReach: number };
export type PostLabelAgg = { label: string; count: number; avgReach: number; avgEng: number };

export const INSTA_DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
export const INSTA_SLOTS = ["0-7h", "7-10h", "10-13h", "13-16h", "16-19h", "19-24h"];

export type InstaDash = {
  email: string;
  periodLabel: string;
  days: Days;
  labels: string[]; // liste maîtresse (assignation de thème par post)
  heatmapScope: "periode" | "historique"; // fallback si fenêtre trop vide
  followers: number;
  followersDelta: number | null;
  growth30: number | null;
  avgEng: number;
  histReach: number;
  avgLikes: number;
  avgComments: number;
  avgSaved: number;
  avgViews: number;
  followersSeries: FollowerPoint[];
  formats: FormatStat[];
  heatmap: SlotCell[][];   // [jour 0-6][créneau 0-5] — tout l'historique
  bestSlot: { day: number; slot: number; avgReach: number; count: number } | null;
  topPosts: InstaPost[];   // top 3 de la fenêtre (fallback : historique)
  topMetric: string;       // métrique qui pilote formats, heatmap, top 3 et thèmes
  byLabel: PostLabelAgg[];
  posts: InstaPost[];
  allPosts: InstaPost[];
  postsEng: number | null;
  postsReach: number | null;
};

const FORMAT_LABEL: Record<string, string> = {
  VIDEO: "Reel",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrousel",
  IMAGE: "Image",
};

export async function getInstaDash(sp: DashParams | undefined): Promise<InstaDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [postsRes, followsRes, labelsRes] = await Promise.all([
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("instagram_organic_posts")
      .select("*")
      .eq("user_id", uid).order("date", { ascending: false }).limit(600),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: false }).limit(90),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);
  const masterLabels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);
  const all: InstaPost[] = (postsRes.data ?? []).map((p) => {
    const reach = Number(p.reach) || 0;
    const likes = Number(p.likes) || 0;
    const comments = Number(p.comments) || 0;
    const saved = Number(p.saved) || 0;
    return {
      id: String(p.id ?? ""),
      date: String(p.date ?? ""),
      type: FORMAT_LABEL[String(p.type ?? "")] ?? String(p.type ?? ""),
      caption: String(p.caption ?? ""),
      mediaUrl: String(p.media_url ?? ""),
      reach,
      views: Number(p.views) || 0,
      likes, comments, saved,
      eng: reach > 0 ? ((likes + comments + saved) / reach) * 100 : 0,
      labels: ((p.labels as string[] | null) ?? []),
      labelSource: ((p as Record<string, unknown>).label_source as string | null) ?? null,
    };
  });
  const follows = followsRes.data ?? [];

  const w = customWindow(sp) ?? makeWindow(all[0]?.date ?? null, all.length ? all[all.length - 1].date : null, days);
  const posts = all.filter((p) => inWin(p.date, w.since, w.until));

  const followers = follows.length ? Number(follows[0].followers) || 0 : 0;
  let followersDelta: number | null = null;
  const dRef = days === 0 ? follows.length - 1 : days;
  if (follows.length > dRef && dRef > 0) followersDelta = followers - (Number(follows[dRef].followers) || 0);
  else if (follows.length >= 7) followersDelta = followers - (Number(follows[6].followers) || 0);

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

  // La métrique choisie en haut de page pilote TOUTE la page : formats,
  // heatmap, top 3 et performance par thème. Filtrer sur les vues et voir
  // ensuite des classements par portée, c'est répondre à côté de la question.
  const _METRICS = ["reach", "views", "likes", "comments", "saved", "eng"] as const;
  const topMetric = (_METRICS as readonly string[]).includes(String(sp?.m ?? ""))
    ? String(sp!.m)
    : "reach";
  const _mval = (p: InstaPost): number =>
    topMetric === "views" ? p.views
    : topMetric === "likes" ? p.likes
    : topMetric === "comments" ? p.comments
    : topMetric === "saved" ? p.saved
    : topMetric === "eng" ? p.eng
    : p.reach;

  const fmtMap = new Map<string, { count: number; reach: number; eng: number }>();
  for (const p of all) {
    const f = fmtMap.get(p.type) ?? { count: 0, reach: 0, eng: 0 };
    f.count += 1; f.reach += _mval(p); f.eng += p.eng;
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

  // « Quand publier ? » + Top 3 : suivent la PÉRIODE filtrée. Fenêtre trop
  // vide (< 2 posts) → fallback sur l'historique, signalé au rendu.
  const heatPool = posts.length >= 2 ? posts : all;
  const heatmapScope: "periode" | "historique" = posts.length >= 2 ? "periode" : "historique";
  const slotOf = (h: number) => (h < 7 ? 0 : h < 10 ? 1 : h < 13 ? 2 : h < 16 ? 3 : h < 19 ? 4 : 5);
  const acc: { count: number; reach: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 6 }, () => ({ count: 0, reach: 0 }))
  );
  for (const p of heatPool) {
    const d = new Date(p.date);
    if (isNaN(d.getTime())) continue;
    const day = (d.getDay() + 6) % 7; // lundi = 0
    const slot = slotOf(d.getHours());
    acc[day][slot].count += 1;
    acc[day][slot].reach += _mval(p);
  }
  const heatmap: SlotCell[][] = acc.map((row) =>
    row.map((c) => ({ count: c.count, avgReach: c.count ? c.reach / c.count : 0 }))
  );
  let bestSlot: InstaDash["bestSlot"] = null;
  for (let day = 0; day < 7; day++)
    for (let slot = 0; slot < 6; slot++) {
      const c = heatmap[day][slot];
      if (c.count >= 2 && (!bestSlot || c.avgReach > bestSlot.avgReach))
        bestSlot = { day, slot, avgReach: c.avgReach, count: c.count };
    }

  // Top 3 posts de la période filtrée (fallback historique, même signal).
  const topPosts = [...heatPool].sort((a, b) => _mval(b) - _mval(a)).slice(0, 3);

  // Performance par label (posts labellisés, tout l'historique)
  const lblMap = new Map<string, { count: number; reach: number; eng: number }>();
  for (const p of all)
    for (const l of p.labels) {
      const x = lblMap.get(l) ?? { count: 0, reach: 0, eng: 0 };
      x.count += 1; x.reach += _mval(p); x.eng += p.eng;
      lblMap.set(l, x);
    }
  const byLabel: PostLabelAgg[] = [...lblMap.entries()]
    .map(([label, x]) => ({
      label,
      count: x.count,
      avgReach: x.count ? x.reach / x.count : 0,
      avgEng: x.count ? x.eng / x.count : 0,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    email: compte.email,
    periodLabel: w.label,
    days,
    labels: masterLabels,
    heatmapScope,
    followers,
    followersDelta,
    growth30,
    avgEng: mean(all.map((p) => p.eng)),
    histReach: mean(all.map((p) => p.reach)),
    avgLikes: mean(all.map((p) => p.likes)),
    avgComments: mean(all.map((p) => p.comments)),
    avgSaved: mean(all.map((p) => p.saved)),
    avgViews: mean(all.map((p) => p.views)),
    followersSeries,
    formats,
    heatmap,
    bestSlot,
    topPosts,
    topMetric,
    byLabel,
    posts,
    allPosts: all,
    postsEng: posts.length ? mean(posts.map((p) => p.eng)) : null,
    postsReach: posts.length ? mean(posts.map((p) => p.reach)) : null,
  };
}

// ── Labels (liste + compteurs d'usage) ───────────────────────────────────────

export type LabelRowData = { name: string; meta: number; google: number; instagram: number };

export async function getLabelsData(): Promise<{
  email: string;
  rows: LabelRowData[];
  priorities: string[]; // ≤ 3 thèmes prioritaires (insight_feedback priority_label:*)
}> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [labelsRes, metaRes, googleRes, instaRes, prioRes] = await Promise.all([
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
    supabase.from("meta_campaign_config").select("label").eq("user_id", uid),
    supabase.from("google_campaign_config").select("label").eq("user_id", uid),
    supabase.from("instagram_organic_posts").select("labels").eq("user_id", uid),
    supabase.from("insight_feedback").select("insight_key")
      .eq("user_id", uid).like("insight_key", "priority_label:%"),
  ]);
  const priorities = (prioRes.data ?? [])
    .map((r) => String(r.insight_key).split(":").slice(1).join(":"))
    .filter(Boolean)
    .slice(0, 3);
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

  const rows: LabelRowData[] = master.map(
    (name) => counts.get(name) ?? { name, meta: 0, google: 0, instagram: 0 }
  );
  for (const [name, row] of counts) if (!master.includes(name)) rows.push(row);

  return { email: compte.email, rows, priorities };
}
