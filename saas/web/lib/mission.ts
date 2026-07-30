import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// La Mission + la Trajectoire — le fil rouge du rapport.
// Mission = l'objectif du compte, rendu visible : UN chiffre north-star,
// des conseils filtrés dessus. Trajectoire = la courbe de ce chiffre sur
// ~12 semaines, avec des marqueurs là où l'utilisateur a cliqué « Fait »
// → on VOIT le lien entre les actions et la courbe.

export const KEY_LABELS_FR: Record<string, string> = {
  gaspillage: "coût des campagnes",
  scaler: "amplifier une campagne qui marche",
  roas: "retour sur dépense pub (ROAS/CPA)",
  funnel: "où le funnel de vente casse",
  ga4_muet: "données GA4 manquantes",
  connecter_ga4: "connecter Google Analytics",
  format_gagnant: "reproduire un format gagnant",
  silence: "reprendre la cadence de publication",
  page_endormie: "réveiller la portée de la page",
  creneau: "publier au bon créneau",
  ai: "suggestion IA",
};

// Quels conseils servent quelle mission (même logique que OBJECTIFS côté moteur).
export const MISSIONS: Record<
  string,
  { label: string; keys: string[]; platforms: string[] }
> = {
  ventes: {
    label: "Plus de ventes",
    keys: ["gaspillage", "scaler", "roas", "funnel", "connecter_ga4", "ga4_muet"],
    platforms: ["meta", "google", "pub"],
  },
  notoriete: {
    label: "Être plus connu",
    keys: ["silence", "page_endormie", "creneau"],
    platforms: ["instagram"],
  },
  engagement: {
    label: "Une communauté qui réagit",
    keys: ["format_gagnant", "creneau"],
    platforms: ["instagram"],
  },
};

export type TrajPoint = {
  weekStart: string; // lundi ISO
  label: string;     // « 08 jun »
  value: number | null;
  partial: boolean;
};

export type TrajMarker = { weekStart: string; title: string };

export type MissionData = {
  missionKey: string | null;
  missionLabel: string | null;
  metricLabel: string;
  unit: string;
  points: TrajPoint[];
  markers: TrajMarker[];
  hero: { value: string; deltaPct: number | null } | null;
  coach: string | null;
  needsGa4: boolean; // mission ventes sans GA4 → fallback clics
};

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function mondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}
function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getMissionData(objectif: string | null): Promise<MissionData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const WEEKS = 12;
  const thisMonday = mondayOf(new Date());
  const start = new Date(thisMonday);
  start.setDate(start.getDate() - 7 * (WEEKS - 1));
  const startIso = isoLocal(start);

  const [ga4Res, metaRes, googleRes, instaRes, followsRes, decisionsRes] = await Promise.all([
    supabase.from("ga4_insights")
      .select("date, medium, revenue")
      .eq("user_id", uid).gte("date", startIso).limit(8000),
    supabase.from("meta_ads_insights")
      .select("date_start, clicks")
      .eq("user_id", uid).gte("date_start", startIso).limit(8000),
    supabase.from("google_ads_insights")
      .select("date_start, clicks")
      .eq("user_id", uid).gte("date_start", startIso).limit(8000),
    supabase.from("instagram_organic_posts")
      .select("date, reach, likes, comments, saved")
      .eq("user_id", uid).gte("date", startIso).limit(600),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: true }).limit(200),
    supabase.from("reco_feedback")
      .select("reco_key, reaction, week_start")
      .eq("user_id", uid).eq("reaction", "done").gte("week_start", startIso),
  ]);

  // Semaines (lundi → dimanche)
  const weeks: { start: Date; iso: string; label: string }[] = [];
  for (let i = 0; i < WEEKS; i++) {
    const s = new Date(start);
    s.setDate(s.getDate() + i * 7);
    weeks.push({ start: s, iso: isoLocal(s), label: `${String(s.getDate()).padStart(2, "0")} ${MOIS[s.getMonth()]}` });
  }
  const weekIndexOf = (dateStr: string): number => {
    const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
    if (isNaN(d.getTime())) return -1;
    const m = mondayOf(d);
    const idx = Math.round((m.getTime() - start.getTime()) / (7 * 86400_000));
    return idx >= 0 && idx < WEEKS ? idx : -1;
  };

  // Agrégats hebdo par source
  const paidRev = Array(WEEKS).fill(0);
  let hasGa4 = false;
  for (const r of ga4Res.data ?? []) {
    const i = weekIndexOf(String(r.date));
    if (i < 0) continue;
    hasGa4 = true;
    const paid = ["cpc", "ppc", "paid"].some((k) => String(r.medium ?? "").toLowerCase().includes(k));
    if (paid) paidRev[i] += Number(r.revenue) || 0;
  }
  const clicks = Array(WEEKS).fill(0);
  for (const r of metaRes.data ?? []) {
    const i = weekIndexOf(String(r.date_start));
    if (i >= 0) clicks[i] += Number(r.clicks) || 0;
  }
  for (const r of googleRes.data ?? []) {
    const i = weekIndexOf(String(r.date_start));
    if (i >= 0) clicks[i] += Number(r.clicks) || 0;
  }
  const engAcc: { sum: number; n: number }[] = Array.from({ length: WEEKS }, () => ({ sum: 0, n: 0 }));
  for (const p of instaRes.data ?? []) {
    const i = weekIndexOf(String(p.date));
    if (i < 0) continue;
    const reach = Number(p.reach) || 0;
    if (reach <= 0) continue;
    engAcc[i].sum += ((Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.saved) || 0)) / reach * 100;
    engAcc[i].n += 1;
  }
  // Abonnés : dernier relevé ≤ fin de semaine
  const followerAt: (number | null)[] = Array(WEEKS).fill(null);
  for (const f of followsRes.data ?? []) {
    const i = weekIndexOf(String(f.fetched_at));
    if (i >= 0) followerAt[i] = Number(f.followers) || 0; // asc → le dernier gagne
  }
  // combler : une semaine sans relevé hérite de la précédente
  for (let i = 1; i < WEEKS; i++) if (followerAt[i] === null) followerAt[i] = followerAt[i - 1];

  // Choix de la métrique north-star
  let metricLabel: string;
  let unit = "";
  let series: (number | null)[];
  let needsGa4 = false;
  const fmt = (v: number) => v.toLocaleString("fr-CH", { maximumFractionDigits: v < 100 ? 1 : 0 }).replace(/,/g, ".");

  if (objectif === "ventes") {
    if (hasGa4) {
      metricLabel = "Revenu attribué à la pub";
      unit = "CHF";
      series = paidRev.map((v, i) => (v > 0 || i >= 0 ? v : null));
    } else {
      metricLabel = "Clics publicitaires";
      series = clicks.map((v) => v);
      needsGa4 = true;
    }
  } else if (objectif === "engagement") {
    metricLabel = "Engagement moyen des posts";
    unit = "%";
    series = engAcc.map((a) => (a.n > 0 ? a.sum / a.n : null));
  } else if (objectif === "notoriete") {
    metricLabel = "Abonnés Instagram";
    series = followerAt;
  } else {
    metricLabel = "Abonnés Instagram";
    series = followerAt;
  }

  const points: TrajPoint[] = weeks.map((w, i) => ({
    weekStart: w.iso,
    label: w.label,
    value: series[i],
    partial: i === WEEKS - 1,
  }));

  // Marqueurs « Fait »
  const markers: TrajMarker[] = [];
  for (const dRow of decisionsRes.data ?? []) {
    const iso = String(dRow.week_start).slice(0, 10);
    if (weekIndexOf(iso) < 0) continue;
    markers.push({ weekStart: isoLocal(mondayOf(new Date(iso + "T12:00:00"))), title: KEY_LABELS_FR[dRow.reco_key] ?? dRow.reco_key });
  }

  // Hero : dernière semaine PLEINE vs précédente
  const fullVals = points.slice(0, -1).map((p) => p.value);
  let hero: MissionData["hero"] = null;
  const lastIdx = fullVals.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).pop();
  if (lastIdx !== undefined && lastIdx >= 0) {
    const cur = fullVals[lastIdx]!;
    let prev: number | null = null;
    for (let i = lastIdx - 1; i >= 0; i--) if (fullVals[i] !== null) { prev = fullVals[i]; break; }
    hero = {
      value: `${fmt(cur)}${unit ? ` ${unit}` : ""}`,
      deltaPct: prev && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null,
    };
  }

  // Voix du coach — déterministe et honnête
  let coach: string | null = null;
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length >= 3) {
    const last3 = vals.slice(-3);
    const rising = last3[2] > last3[1] && last3[1] > last3[0];
    const falling = last3[2] < last3[1] && last3[1] < last3[0];
    const best = Math.max(...vals);
    const isBest = vals[vals.length - 1] >= best;
    if (markers.length > 0) {
      const firstMarkerIdx = points.findIndex((p) => p.weekStart === markers[0].weekStart);
      const before = firstMarkerIdx > 0 ? points[firstMarkerIdx - 1]?.value ?? points[firstMarkerIdx]?.value : points[0]?.value;
      const nowV = vals[vals.length - 1];
      if (before !== null && before !== undefined && before !== 0) {
        const d = ((nowV - before) / Math.abs(before)) * 100;
        if (d >= 5)
          coach = `Depuis ta première action appliquée : ${fmt(before)} → ${fmt(nowV)}${unit ? ` ${unit}` : ""} (+${d.toFixed(0)} %). Tes décisions paient — on continue.`;
        else if (d <= -5)
          coach = `Depuis ta première action, la courbe n'a pas encore réagi (${d.toFixed(0)} %). Pas de panique : certains effets prennent 2-3 semaines — et si ça persiste, on pivote.`;
      }
    }
    if (!coach && rising) coach = "3 semaines de progression d'affilée — ce que tu fais en ce moment fonctionne, garde le cap.";
    if (!coach && isBest && vals.length >= 4) coach = "Meilleure semaine de ta trajectoire — regarde ce qui a changé cette semaine et note-le.";
    if (!coach && falling) coach = "3 semaines de baisse — le rapport ci-dessous te dit où regarder en premier.";
  }

  return {
    missionKey: objectif,
    missionLabel: objectif ? MISSIONS[objectif]?.label ?? null : null,
    metricLabel,
    unit,
    points,
    markers,
    hero,
    coach,
    needsGa4,
  };
}
