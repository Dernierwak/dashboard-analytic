import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Couche données de la page Coûts.
//
// L'HORIZON QUI SE PILOTE EST L'ANNÉE. Le mois en était l'unité jusqu'ici, et
// ça se défendait tant qu'on parlait de rythme ; ça ne tient plus dès qu'on
// parle d'enveloppe. Une enveloppe se fixe une fois — un budget de saison, un
// salon, un exercice — et la seule question qui vaille est « à ce rythme, est-ce
// que je tiens l'année ? ». Le mois devient donc une LECTURE de l'année, pas une
// saisie de plus.
//
// Conséquence directe, et c'est ce qui supprime la moitié des champs : le
// mensuel se DÉDUIT de l'annuel (÷ 12). Fixer une seule fois 72 000 CHF suffit à
// faire vivre le mois, le jour, les alertes et toutes les barres de la page.
//
// LE MOIS N'A PLUS DE RÈGLE DE PRÉSÉANCE, ET C'EST VOLONTAIRE. Il en avait
// trois — mensuel global saisi, somme des mensuels par plateforme, annuel ÷ 12 —
// et l'éditeur qui permettait de poser les deux premières a été supprimé avec le
// dépliant « Réglages du budget ». Les laisser vivre aurait produit le pire des
// cas : un compte qui avait tapé 4 000 CHF pour un mois de 2025 aurait continué
// de voir ce montant primer sur son enveloppe d'année, SANS AUCUN MOYEN DE LE
// CHANGER. Un montant qui gouverne une page et qu'aucun écran ne peut plus
// atteindre est pire qu'un montant faux. Il ne reste donc qu'une source, et
// `sourceBudgetMois` continue de l'écrire à l'endroit où le nombre s'affiche.
//
// L'ANNÉE SUIT LA MÊME RÈGLE DEPUIS QUE LES ENVELOPPES PAR PLATEFORME ONT QUITTÉ
// L'ÉCRAN. Elle avait trois branches — montant saisi, somme des deux plateformes,
// somme des douze mensuels — dont une seule a encore un champ de saisie. Les deux
// autres produisaient exactement le défaut fondateur de cette page : un client
// qui avait réglé 2 000 Meta et 1 000 Google lisait « enveloppe : 3 000 CHF »
// qu'il n'avait jamais tapée. Tant que les deux éditeurs par plateforme
// existaient, il pouvait au moins la corriger ; ils ont disparu, donc la branche
// aussi. IL N'Y A PLUS DE PRÉSÉANCE : `budgetAnnuel` vaut ce qui a été tapé, ou
// zéro.
//
// Rien n'est détruit en base pour autant, et ce qui existait doit être DIT :
// `budgetAnnuelHerite` porte ce que l'ancienne règle aurait calculé, uniquement
// pour que l'écran puisse écrire « ces montants ne fabriquent plus d'enveloppe ».
// Il ne gouverne plus rien — un nombre qu'on abandonne se raconte, il ne
// s'efface pas en silence.

const MOIS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_ABR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

// Dates en heure LOCALE. `new Date("2026-08-12")` est interprété en UTC et
// recule d'un jour à l'ouest de Greenwich : une dépense du 1er août tomberait
// en juillet, et le mois entier serait faux d'un jour.
function dParse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function dIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dAjout(s: string, n: number): string {
  const d = dParse(s);
  d.setDate(d.getDate() + n);
  return dIso(d);
}
function dJours(from: string, to: string): number {
  return Math.round((dParse(to).getTime() - dParse(from).getTime()) / 86_400_000) + 1;
}
function dLundi(s: string): string {
  const d = dParse(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dIso(d);
}
function dCourt(s: string): string {
  const d = dParse(s);
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS_ABR[d.getMonth()]}`;
}

// CE QU'UNE PLATEFORME A DÉPENSÉ, ET RIEN D'AUTRE.
//
// Elle portait aussi son budget annuel (`budgetAn`, `budgetAnSaisi`) : une
// ENVELOPPE par régie, éditable dans le module de l'année. Les deux éditeurs
// sont partis — l'enveloppe est unique — et les deux champs avec eux. Garder le
// nombre sans le champ, c'était afficher une promesse que plus personne ne
// pouvait modifier.
export type ChannelCout = {
  key: string;
  name: string;
  icon: string;
  color: string;
  spent: number;      // ce mois-ci
  spentYear: number;  // depuis janvier
};

export type CoutDay = { date: string; label: string; meta: number; google: number };

/** Un point de la courbe filtrée — un jour, ou une semaine sur les longues périodes. */
export type PointSerie = { cle: string; label: string; meta: number; google: number };

/** Ce qui a été dépensé par plateforme — la même forme partout sur cette page. */
export type ParCanal = { meta: number; google: number };

// Budget par thème : réutilise channel_budgets avec channel = "label:<nom>"
// pour le mensuel et "an:label:<nom>" pour l'annuel (même carry-forward que
// les canaux, zéro migration).
//
// AUCUNE ESTIMATION D'ENVELOPPE. `budgetYear` retombait sur la somme des douze
// budgets mensuels du thème quand rien n'était saisi. Effet à l'écran : un thème
// dont le champ ENVELOPPE affichait 0 se voyait quand même reprocher « 61 % de
// l'enveloppe », pendant que douze autres thèmes n'avaient ni barre ni
// pourcentage — la page semblait juger certains thèmes et pas d'autres, sur un
// dénominateur que personne n'avait tapé. Une enveloppe est maintenant SAISIE ou
// absente ; sans elle, un thème affiche sa dépense et se tait.
export type ThemeSpend = {
  label: string;
  spendYear: number;    // dépense cumulée depuis janvier
  budgetYear: number;   // enveloppe d'année SAISIE (0 = aucune, et rien ne la remplace)
  /** Ce que l'ancienne estimation aurait produit — affiché pour dire qu'il ne
   *  compte plus, jamais pour fabriquer un dénominateur. */
  budgetYearHerite: number;
  spendPeriode: number; // dépense sur la période filtrée — ce que montre l'anneau
  /** Sur QUELLE plateforme l'argent de ce thème est parti, depuis janvier.
   *  Un thème qui pèse 4 000 CHF ne se pilote pas pareil selon qu'il est à
   *  100 % sur Google ou partagé — et rien ne le disait. */
  parCanalAn: ParCanal;
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

/** Ce que l'utilisateur a demandé de voir — période et thèmes. */
export type FiltreCouts = {
  /** Preset : "30" | "90" | "mois" | "an" (défaut). Ignoré si from+to. */
  p?: string;
  from?: string;
  to?: string;
  /** Thèmes retenus ; vide = tous. */
  labels?: string[];
};

export type PeriodeCouts = {
  from: string;
  to: string;
  jours: number;
  preset: string;          // "30" | "90" | "mois" | "an" | "custom"
  titre: string;           // « depuis janvier », « 30 derniers jours », « du 3 mar au 8 avr »
  pas: "jour" | "semaine";
};

export type CoutsData = {
  email: string;
  // Liste maîtresse des thèmes (profiles.labels) — elle fixe la couleur de
  // chacun, la même ici que dans le rapport.
  labels: string[];
  annee: number;
  monthLabel: string;
  elapsed: number;    // fraction du MOIS écoulée (repère), 0..1
  elapsedAn: number;  // fraction de l'ANNÉE écoulée, en jours et non en mois
  channels: ChannelCout[];

  // ── L'année : ce qui se pilote ────────────────────────────────────────────
  spentYear: number;
  /** L'enveloppe unique, telle qu'elle a été TAPÉE. Aucune règle de préséance,
   *  aucune estimation : 0 tant que rien n'est saisi. */
  budgetAnnuel: number;
  /** Ce que les anciens réglages (par plateforme, par mois) auraient donné.
   *  Sert uniquement à écrire qu'ils ne comptent plus. */
  budgetAnnuelHerite: number;

  // ── Le mois : une lecture de l'année, et rien d'autre ─────────────────────
  totalSpent: number;
  totalBudget: number;       // toujours l'annuel ÷ 12
  sourceBudgetMois: "annuel" | "aucun";

  joursMois: number;
  budgetJour: number;    // budget mensuel ÷ jours du mois
  moyenneJour: number;   // dépense de l'ANNÉE ÷ jours écoulés — le rythme réel
  repereJour: number;    // ce qu'il faudrait tenir par jour pour finir l'année dedans
  alertes: AlerteJour[]; // jours au-dessus du double du budget quotidien
  daily: CoutDay[];      // le mois en cours, jour par jour (non filtré)
  parMois: number[];     // dépense de chaque mois de l'année — la forme de la tuile

  // ── Ce que le filtre commande ─────────────────────────────────────────────
  periode: PeriodeCouts;
  labelsChoisis: string[];
  serie: PointSerie[];       // la courbe, au pas de la période
  /** Le dernier point est une semaine incomplète — il faut le dire. */
  dernierePartielle: boolean;
  totalPeriode: number;
  /** La même dépense de période, ventilée par plateforme — le second anneau. */
  parCanalPeriode: ParCanal;
  filtreActif: boolean;      // au moins un thème sélectionné

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

/** Résout le filtre demandé en une période bornée, avec son pas d'affichage. */
function resoudrePeriode(f: FiltreCouts, aujourdhui: string, yearStart: string, monthStart: string): PeriodeCouts {
  const valide = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
  let from: string;
  let to = aujourdhui;
  let preset: string;
  let titre: string;

  if (valide(f.from) && valide(f.to) && f.from! <= f.to!) {
    from = f.from!;
    to = f.to!;
    preset = "custom";
    titre = `du ${dCourt(from)} au ${dCourt(to)}`;
  } else if (f.p === "30") {
    from = dAjout(aujourdhui, -29);
    preset = "30";
    titre = "30 derniers jours";
  } else if (f.p === "90") {
    from = dAjout(aujourdhui, -89);
    preset = "90";
    titre = "90 derniers jours";
  } else if (f.p === "mois") {
    from = monthStart;
    preset = "mois";
    titre = "ce mois-ci";
  } else {
    from = yearStart;
    preset = "an";
    titre = "depuis janvier";
  }

  const jours = Math.max(1, dJours(from, to));
  // Au-delà de dix semaines, un point par jour donne un peigne illisible — et
  // `LineChart` cesse de toute façon de dessiner ses points au-delà de 60
  // colonnes. On agrège alors par semaine : la FORME reste, le bruit part.
  return { from, to, jours, preset, titre, pas: jours > 70 ? "semaine" : "jour" };
}

export async function getCoutsData(filtre: FiltreCouts = {}): Promise<CoutsData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const aujourdhui = dIso(now);
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const yearStart = `${y}-01-01`;
  const anneeIso = yearStart;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const elapsed = Math.min(1, now.getDate() / daysInMonth);

  const periode = resoudrePeriode(filtre, aujourdhui, yearStart, monthStart);
  const labelsChoisis = (filtre.labels ?? []).filter(Boolean);
  const filtreActif = labelsChoisis.length > 0;
  const retenu = new Set(labelsChoisis);

  // Une période personnalisée peut commencer avant le 1er janvier : on remonte
  // la fenêtre de récolte jusqu'à elle, sinon la courbe démarre dans le vide.
  const depuis = periode.from < yearStart ? periode.from : yearStart;

  type MetaRow = { date_start: string; campaign_name: string | null; spend: number | null };
  type GoogRow = { date_start: string; campaign_id: string | number; cost_micros: number | null };
  const [metaRows, googleRaw, budgetsRes, labelsRes, metaCfgRes, googCfgRes] = await Promise.all([
    fetchAllRows<MetaRow>(() =>
      supabase
        .from("meta_ads_insights")
        .select("date_start, campaign_name, spend")
        .eq("user_id", uid)
        .gte("date_start", depuis)
        .order("date_start", { ascending: false })
    ),
    fetchAllRows<GoogRow>(() =>
      supabase
        .from("google_ads_insights")
        .select("date_start, campaign_id, cost_micros")
        .eq("user_id", uid)
        .gte("date_start", depuis)
        .order("date_start", { ascending: false })
    ),
    supabase.from("channel_budgets").select("channel, month, amount").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
    supabase.from("meta_campaign_config").select("campaign_name, label").eq("user_id", uid),
    supabase.from("google_campaign_config").select("campaign_id, label").eq("user_id", uid),
  ]);

  const metaLbl = new Map((metaCfgRes.data ?? []).map((c) => [String(c.campaign_name), c.label as string | null]));
  const googLbl = new Map((googCfgRes.data ?? []).map((c) => [String(c.campaign_id), c.label as string | null]));

  // Toutes les lignes ramenées à la même forme : une date, un canal, un montant,
  // un thème. Les six agrégats qui suivent lisent cette liste une seule fois.
  type Ligne = { date: string; canal: "meta" | "google"; chf: number; theme: string | null };
  const lignes: Ligne[] = [];
  for (const r of metaRows) {
    lignes.push({
      date: String(r.date_start).slice(0, 10),
      canal: "meta",
      chf: Number(r.spend) || 0,
      theme: metaLbl.get(String(r.campaign_name)) ?? null,
    });
  }
  for (const r of googleRaw) {
    lignes.push({
      date: String(r.date_start).slice(0, 10),
      canal: "google",
      chf: (Number(r.cost_micros) || 0) / 1_000_000,
      theme: googLbl.get(String(r.campaign_id)) ?? null,
    });
  }

  const parJourMois = new Map<string, { meta: number; google: number }>();
  const parJourPeriode = new Map<string, { meta: number; google: number }>();
  const themeAn = new Map<string, number>();
  const themeCanalAn = new Map<string, ParCanal>();
  const themePeriode = new Map<string, number>();
  const parMoisCanal = new Map<string, { meta: number; google: number }>();
  let metaSpent = 0, googleSpent = 0;        // mois en cours
  let metaYear = 0, googleYear = 0;          // depuis janvier
  let totalPeriode = 0;
  const parCanalPeriode: ParCanal = { meta: 0, google: 0 };

  for (const l of lignes) {
    const dansMois = l.date >= monthStart && l.date <= aujourdhui;
    const dansAnnee = l.date >= yearStart;
    const dansPeriode = l.date >= periode.from && l.date <= periode.to;

    if (dansAnnee) {
      if (l.canal === "meta") metaYear += l.chf;
      else googleYear += l.chf;
      const mo = l.date.slice(0, 7);
      const v = parMoisCanal.get(mo) ?? { meta: 0, google: 0 };
      v[l.canal] += l.chf;
      parMoisCanal.set(mo, v);
      if (l.theme) {
        themeAn.set(l.theme, (themeAn.get(l.theme) ?? 0) + l.chf);
        const c = themeCanalAn.get(l.theme) ?? { meta: 0, google: 0 };
        c[l.canal] += l.chf;
        themeCanalAn.set(l.theme, c);
      }
    }
    if (dansMois) {
      if (l.canal === "meta") metaSpent += l.chf;
      else googleSpent += l.chf;
      const v = parJourMois.get(l.date) ?? { meta: 0, google: 0 };
      v[l.canal] += l.chf;
      parJourMois.set(l.date, v);
    }
    // La période, elle, obéit au filtre par thèmes. Une ligne sans thème sort
    // dès qu'un filtre est posé : la garder ferait mentir le total de l'anneau.
    if (dansPeriode && (!filtreActif || (l.theme && retenu.has(l.theme)))) {
      const cle = periode.pas === "semaine" ? dLundi(l.date) : l.date;
      const v = parJourPeriode.get(cle) ?? { meta: 0, google: 0 };
      v[l.canal] += l.chf;
      parJourPeriode.set(cle, v);
      totalPeriode += l.chf;
      parCanalPeriode[l.canal] += l.chf;
      if (l.theme) themePeriode.set(l.theme, (themePeriode.get(l.theme) ?? 0) + l.chf);
    }
  }

  // ── La courbe : un point par pas, y compris les pas à zéro ────────────────
  // Sauter les jours vides ferait mentir la forme : trois jours sans dépense
  // deviendraient un simple segment plus long, jamais un creux.
  const serie: PointSerie[] = [];
  const premier = periode.pas === "semaine" ? dLundi(periode.from) : periode.from;
  for (let cur = premier; cur <= periode.to; cur = dAjout(cur, periode.pas === "semaine" ? 7 : 1)) {
    const v = parJourPeriode.get(cur) ?? { meta: 0, google: 0 };
    // Le premier seau d'une série hebdomadaire commence au lundi de la semaine
    // qui CONTIENT le début de période — souvent avant lui. « Depuis janvier »
    // afficherait alors « 29 déc » comme premier point, pour une semaine dont
    // on n'a que quatre jours. On l'écrit à sa vraie date de départ.
    const debut = cur < periode.from ? periode.from : cur;
    serie.push({ cle: cur, label: dCourt(debut), meta: v.meta, google: v.google });
  }
  // La dernière semaine est en cours : elle est mécaniquement plus basse, et
  // sans avertissement elle se lit comme un effondrement de la dépense.
  const dernierePartielle =
    periode.pas === "semaine" &&
    serie.length > 1 &&
    dAjout(serie[serie.length - 1].cle, 6) > periode.to;

  const daily: CoutDay[] = [];
  for (let day = 1; day <= now.getDate(); day++) {
    const dk = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const v = parJourMois.get(dk) ?? { meta: 0, google: 0 };
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
  const sommeDouze = (channel: string): number => {
    let t = 0;
    for (let mm = 0; mm < 12; mm++) t += budgetFor(channel, `${y}-${String(mm + 1).padStart(2, "0")}-01`);
    return t;
  };

  // Thèmes budgétés sans dépense : on les montre quand même (c'est justement
  // quand un thème ne consomme pas son enveloppe qu'on veut le voir).
  for (const b of budgets) {
    const ch = String(b.channel ?? "");
    if ((Number(b.amount) || 0) <= 0) continue;
    const name = ch.startsWith("an:label:")
      ? ch.slice(9)
      : ch.startsWith("label:")
        ? ch.slice(6)
        : null;
    if (name && !themeAn.has(name)) themeAn.set(name, 0);
  }

  const byTheme: ThemeSpend[] = [...themeAn.entries()]
    .map(([label, spendYear]) => {
      const saisi = budgetFor(`an:label:${label}`, anneeIso);
      const mensuels = sommeDouze(`label:${label}`);
      return {
        label,
        spendYear,
        // `saisi`, jamais `saisi || mensuels` : douze mensuels ne font pas une
        // enveloppe d'année, ils font une moyenne qu'on présenterait comme une
        // décision.
        budgetYear: saisi,
        budgetYearHerite: saisi > 0 ? 0 : mensuels,
        spendPeriode: themePeriode.get(label) ?? 0,
        parCanalAn: themeCanalAn.get(label) ?? { meta: 0, google: 0 },
      };
    })
    .sort((a, b) => b.spendYear - a.spendYear);

  // La forme de l'année, mois par mois — la sparkline de la tuile « Budget
  // annuel ». La table « détail mois par mois » a disparu avec le dépliant des
  // réglages : c'était douze lignes de saisie pour un nombre qu'on tape une
  // fois, et elle n'était rendue nulle part ailleurs.
  const parMois: number[] = [];
  for (let i = 0; i <= m; i++) {
    const spent = parMoisCanal.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? { meta: 0, google: 0 };
    parMois.push(spent.meta + spent.google);
  }

  // ── L'ANNÉE, d'abord : c'est elle qui commande tout le reste ─────────────
  // UNE SEULE SOURCE, celle qui a un champ à l'écran.
  const budgetAnnuel = budgetFor("an:global", anneeIso);
  const anPlateformesSaisi = budgetFor("an:meta", anneeIso) + budgetFor("an:google", anneeIso);
  const anMensuels = sommeDouze("global") > 0 ? sommeDouze("global") : sommeDouze("meta") + sommeDouze("google");
  // Ce que l'ancienne préséance aurait servi. Il ne pilote plus rien — il donne
  // seulement à l'écran de quoi expliquer une enveloppe qui a « disparu ».
  const budgetAnnuelHerite = anPlateformesSaisi > 0 ? anPlateformesSaisi : anMensuels;

  // ── Le mois : UNE seule règle, l'année ÷ 12 ──────────────────────────────
  // Les mensuels déjà en base (`global`, `meta`, `google` sur un mois) ne sont
  // plus lus nulle part : ils ne pilotent ni le mois ni l'année. Ils restent
  // écrits en base et l'écran dit qu'ils ne comptent plus — c'est la seule
  // manière honnête d'abandonner un réglage dont on a supprimé le champ.
  const totalBudget = budgetAnnuel > 0 ? budgetAnnuel / 12 : 0;
  const sourceBudgetMois: CoutsData["sourceBudgetMois"] =
    budgetAnnuel > 0 ? "annuel" : "aucun";

  const channels: ChannelCout[] = [
    {
      key: "meta", name: "Meta Ads", icon: "▣", color: "#1a56ff",
      spent: metaSpent, spentYear: metaYear,
    },
    {
      key: "google", name: "Google Ads", icon: "◆", color: "#1a7a4a",
      spent: googleSpent, spentYear: googleYear,
    },
  ];

  const totalSpent = metaSpent + googleSpent;
  const spentYear = metaYear + googleYear;

  // La part de l'année écoulée se compte en JOURS, pas en mois entiers : le
  // 2 août, compter août comme passé annoncerait 67 % d'année au lieu de 58, et
  // ferait croire qu'on est très en dessous alors qu'on est dans les clous.
  const joursAnnee = dJours(yearStart, `${y}-12-31`);
  const joursEcoulesAn = dJours(yearStart, aujourdhui);
  const elapsedAn = Math.min(1, joursEcoulesAn / joursAnnee);

  const joursMois = daysInMonth;
  const budgetJour = totalBudget > 0 ? totalBudget / joursMois : 0;
  const moyenneJour = spentYear / Math.max(1, joursEcoulesAn);
  // Ce qu'il reste à dépenser, étalé sur les jours qui restent : le vrai repère
  // du rythme. Une moyenne comparée au budget/365 punit un début d'année calme
  // et absout une fin d'année emballée.
  const joursRestants = Math.max(1, joursAnnee - joursEcoulesAn);
  const repereJour = budgetAnnuel > 0 ? Math.max(0, budgetAnnuel - spentYear) / joursRestants : 0;

  const alertes: AlerteJour[] =
    budgetJour > 0
      ? daily
          .map((d) => ({
            date: d.date,
            label: d.label,
            montant: d.meta + d.google,
            ratio: (d.meta + d.google) / budgetJour,
          }))
          // SEUIL À 2×, et ce n'est pas un réglage de confort. Google Ads
          // s'autorise lui-même jusqu'à DEUX FOIS le budget quotidien un jour
          // donné et ne garantit que le total du mois ; Meta dépasse
          // couramment de 25 %, parfois de 75 %, et lisse sur la semaine.
          // À `ratio > 1`, cette alerte mesurait donc le pilotage des
          // plateformes, pas un dérapage — elle criait au loup par
          // construction, tous les mois, sans qu'il y ait rien à corriger.
          .filter((a) => a.ratio > 2)
          .sort((a, b) => b.montant - a.montant)
      : [];

  return {
    email: compte.email,
    labels: (labelsRes.data?.[0]?.labels as string[] | null) ?? [],
    annee: y,
    monthLabel: `${MOIS_FULL[m]} ${y}`,
    elapsed,
    elapsedAn,
    channels,
    spentYear,
    budgetAnnuel,
    budgetAnnuelHerite,
    totalSpent,
    totalBudget,
    sourceBudgetMois,
    joursMois,
    budgetJour,
    moyenneJour,
    repereJour,
    alertes,
    daily,
    parMois,
    periode,
    labelsChoisis,
    serie,
    dernierePartielle,
    totalPeriode,
    parCanalPeriode,
    filtreActif,
    byTheme,
  };
}
