import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import {
  aveuglesSur,
  canalTu,
  fenetreTue,
  fetchCanauxMuets,
  type CanalMuetLive,
} from "@/lib/canaux-muets";
import {
  dAjout,
  dCourt,
  dIso,
  dJours,
  dParse,
  MOIS_ABR,
  resoudrePeriode,
  type PeriodeCouts,
} from "@/lib/periode-couts";

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

/** La plus petite de deux dates ISO — deux jours pleins se comparent en texte. */
function minJour(a: string, b: string): string {
  return a < b ? a : b;
}

function dLundi(s: string): string {
  const d = dParse(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dIso(d);
}
// `ChannelCout` A DISPARU, et avec lui le tableau `channels`.
//
// Il ne restait de ce type qu'une dépense par plateforme (`spent` le mois,
// `spentYear` l'année) : son budget annuel — une ENVELOPPE par régie — était
// déjà parti avec les deux éditeurs qui le réglaient, l'enveloppe étant
// désormais unique.
//
// Ce qu'il en restait alimentait deux lignes en bas de `DepenseAnnee`,
// « Meta 29 % / Google 71 % », que l'anneau « Dépensé par plateforme » de la
// section « Où ça part » dessine déjà — en mieux, et en obéissant au filtre de
// période que ces lignes ignoraient. Les lignes parties, plus personne ne lit
// ce tableau : l'anneau se sert de `parCanalPeriode`, qui suit le filtre.
// On ne garde pas un calcul pour le cas où — il se serait remis à diverger de
// l'anneau en silence.
//
// Les quatre sommes qui le remplissaient (`metaSpent`, `googleSpent`,
// `metaYear`, `googleYear`) restent : `totalSpent` et `spentYear` en
// descendent, et toute la page en dépend.

// ── POURQUOI TANT DE `number | null` SUR CETTE PAGE (ticket 48) ─────────────
//
// Cette page ne lit pas le rapport : elle rouvre `meta_ads_insights` et
// `google_ads_insights` elle-même. Elle traverse donc le MÊME trou de récolte
// que le rapport, par un autre chemin, et aucune des protections du ticket 20
// ne s'y appliquait. Une semaine de récolte ratée faisait baisser la dépense de
// l'année — et cette page se sert de la dépense de l'année pour dire « tu es
// dans ton budget ». L'alerte se désarmait donc toute seule, dans le bon sens
// pour le client et dans le mauvais pour la vérité.
//
// La règle appliquée est celle de l'ADR 0005 : chaque mesure se tait si sa
// source est muette SUR SA FENÊTRE. `null` veut dire « on ne sait pas », jamais
// « zéro » — et un budget ne se juge pas sur une dépense qu'on ne connaît pas.
// Les fenêtres qui s'arrêtent AVANT le trou restent des chiffres.

export type CoutDay = { date: string; label: string; meta: number | null; google: number | null };

/** Un point de la courbe filtrée — un jour, ou une semaine sur les longues périodes. */
export type PointSerie = {
  cle: string;
  label: string;
  meta: number | null;
  google: number | null;
};

/** Ce qui a été dépensé par plateforme — la même forme partout sur cette page. */
export type ParCanal = { meta: number | null; google: number | null };

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
  /** `null` quand une régie muette traverse l'année : un cumul amputé se lirait
   *  comme un thème qu'on a arrêté de financer. */
  spendYear: number | null;
  budgetYear: number;   // enveloppe d'année SAISIE (0 = aucune, et rien ne la remplace)
  /** Ce que l'ancienne estimation aurait produit — affiché pour dire qu'il ne
   *  compte plus, jamais pour fabriquer un dénominateur. */
  budgetYearHerite: number;
  spendPeriode: number | null; // dépense sur la période filtrée — ce que montre l'anneau
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
  /** La fenêtre en JOURS GLISSANTS — le vocabulaire du bandeau (`d`) :
   *  7 / 14 / 30 / 90, et 0 pour « depuis le début ». Absent vaut 7, comme
   *  partout ailleurs. Ignoré si from+to. */
  jours?: number;
  /** L'ANCIEN nom de la période de cette page ("30" | "90" | "mois" | "an").
   *  Encore LU pour qu'aucun favori ni lien partagé ne casse, plus jamais
   *  écrit — même extinction que `label` sur les pages canal (12 §5). */
  p?: string;
  from?: string;
  to?: string;
  /** Thèmes retenus ; vide = tous. */
  labels?: string[];
};

export type CoutsData = {
  email: string;
  /** LES RÉGIES DONT LA RÉCOLTE A ÉCHOUÉ AU DERNIER PASSAGE, lues en direct
   *  (`lib/canaux-muets.ts`). C'est ce qui explique chaque `—` de la page : un
   *  tiret sans raison se lit comme un bug de Pulse, pas comme une connexion à
   *  refaire. Vide quand tout va bien, et la page ne dit alors rien. */
  muets: CanalMuetLive[];
  // Liste maîtresse des thèmes (profiles.labels) — elle fixe la couleur de
  // chacun, la même ici que dans le rapport.
  labels: string[];
  annee: number;
  elapsed: number;    // fraction du MOIS écoulée (repère), 0..1
  elapsedAn: number;  // fraction de l'ANNÉE écoulée, en jours et non en mois

  // ── L'année : ce qui se pilote ────────────────────────────────────────────
  /** `null` = une régie muette traverse l'année, donc aucun verdict de budget.
   *  L'alerte SE DÉSARME plutôt que de se prononcer sur une dépense incomplète
   *  (ADR 0005) : une semaine creuse ferait repasser le compte du bon côté et
   *  fabriquerait un « tu es dans ton budget » faux. */
  spentYear: number | null;
  /** L'enveloppe unique, telle qu'elle a été TAPÉE. Aucune règle de préséance,
   *  aucune estimation : 0 tant que rien n'est saisi. */
  budgetAnnuel: number;
  /** Ce que les anciens réglages (par plateforme, par mois) auraient donné.
   *  Sert uniquement à écrire qu'ils ne comptent plus. */
  budgetAnnuelHerite: number;

  // ── Le mois : une lecture de l'année, et rien d'autre ─────────────────────
  totalSpent: number | null;
  totalBudget: number;       // toujours l'annuel ÷ 12
  sourceBudgetMois: "annuel" | "aucun";

  joursMois: number;
  budgetJour: number;    // budget mensuel ÷ jours du mois
  /** `null` quand la dépense de l'année l'est : une moyenne dont on ignore le
   *  numérateur n'est pas une moyenne plus floue, c'est un chiffre inventé. */
  moyenneJour: number | null;
  /** Ce qu'il faudrait tenir par jour pour finir l'année dans l'enveloppe.
   *  `null` dans deux cas : aucune enveloppe fixée (il n'y a rien à tenir), ou
   *  dépense de l'année inconnue (le calculer sur un cumul amputé rendrait une
   *  marge trop généreuse, et c'est un feu vert à dépenser). */
  repereJour: number | null;
  /** Les jours au-dessus du double du budget quotidien. Un jour que le trou
   *  ampute n'y entre PAS : on ne juge pas une journée dont on n'a qu'une
   *  moitié. Ce qui reste est donc constaté — et l'absence d'alerte ne vaut
   *  jamais « tout va bien » quand `muets` n'est pas vide. */
  alertes: AlerteJour[];
  daily: CoutDay[];      // le mois en cours, jour par jour (non filtré)
  parMois: (number | null)[]; // dépense de chaque mois de l'année — la forme de la tuile

  // ── Ce que le filtre commande ─────────────────────────────────────────────
  periode: PeriodeCouts;
  labelsChoisis: string[];
  serie: PointSerie[];       // la courbe, au pas de la période
  /** Le dernier point est une semaine incomplète — il faut le dire. */
  dernierePartielle: boolean;
  totalPeriode: number | null;
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

  // ── L'ANCRE DE LA FENÊTRE : LE DERNIER JOUR PLEIN, JAMAIS AUJOURD'HUI ─────
  //
  // Aligner les MOTS sans aligner l'ancre aurait produit deux fenêtres
  // différentes sous un seul libellé : cette page finissait sur aujourd'hui,
  // les pages canal finissent sur la veille — et reculent jusqu'au dernier jour
  // de donnée quand la récolte a du retard (`makeWindow`, `lib/channels.ts`).
  // La journée en cours est incomplète (`CLAUDE.md` §7) : son point de courbe
  // se lit comme une chute, et sa dépense manque à la répartition.
  //
  // Les deux bornes se DEMANDENT à la base au lieu de se déduire des lignes
  // déjà ramenées, parce que c'est la fenêtre de récolte qui dépend d'elles.
  // Quatre requêtes d'une ligne : la borne est exacte, là où une marge de
  // sécurité aurait été un chiffre inventé.
  const bord = (table: string, ancien: boolean) =>
    supabase
      .from(table)
      .select("date_start")
      .eq("user_id", uid)
      .order("date_start", { ascending: ancien })
      .limit(1);
  const [bornesBrutes, muets] = await Promise.all([
    Promise.all([
      bord("meta_ads_insights", false),
      bord("google_ads_insights", false),
      bord("meta_ads_insights", true),
      bord("google_ads_insights", true),
    ]),
    // QUELLE RÉCOLTE A ÉCHOUÉ AU DERNIER PASSAGE (ticket 48). Lue avant tout le
    // reste parce qu'elle décide de ce que chaque total de cette page a le
    // droit d'affirmer — et c'est cette page qui porte le verdict de budget.
    fetchCanauxMuets(supabase, uid),
  ]);
  const jourOuRien = (res: { data: unknown }) => {
    const d = (res.data as { date_start: string }[] | null)?.[0]?.date_start;
    return d ? String(d).slice(0, 10) : null;
  };
  const connus = (xs: (string | null)[]) => xs.filter((x): x is string => Boolean(x)).sort();
  const derniers = connus([jourOuRien(bornesBrutes[0]), jourOuRien(bornesBrutes[1])]);
  const premiers = connus([jourOuRien(bornesBrutes[2]), jourOuRien(bornesBrutes[3])]);
  const veille = dAjout(aujourdhui, -1);
  const dernierJour = derniers[derniers.length - 1] ?? null;

  const periode = resoudrePeriode(filtre, {
    ancre: dernierJour && dernierJour < veille ? dernierJour : veille,
    premier: premiers[0] ?? null,
    yearStart,
    monthStart,
  });
  // ── CE QUE LE TROU DE RÉCOLTE A LE DROIT DE TAIRE ────────────────────────
  //
  // Une fenêtre est trouée dès qu'elle va AU-DELÀ du dernier jour qu'une régie
  // muette a écrit. Celles qui s'arrêtent avant restent des chiffres — c'est ce
  // qui garde les mois d'avant lisibles pendant que le mois en cours se tait.
  // `fin` est donc toujours le DERNIER jour couvert par la fenêtre, jamais son
  // début.
  const tuSi = (v: number, fin: string) => (fenetreTue(muets, fin) ? null : v);
  const parCanalTu = (
    v: { meta: number; google: number },
    fin: string
  ): ParCanal => ({
    meta: canalTu(muets, "meta", fin) ? null : v.meta,
    google: canalTu(muets, "google", fin) ? null : v.google,
  });

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
  const themeCanalAn = new Map<string, { meta: number; google: number }>();
  const themePeriode = new Map<string, number>();
  const parMoisCanal = new Map<string, { meta: number; google: number }>();
  let metaSpent = 0, googleSpent = 0;        // mois en cours
  let metaYear = 0, googleYear = 0;          // depuis janvier
  let totalPeriode = 0;
  const canalPeriodeBrut = { meta: 0, google: 0 };

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
      canalPeriodeBrut[l.canal] += l.chf;
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
    // LE SEAU SE TAIT DÈS QU'IL DÉBORDE SUR LE TROU, et c'est le défaut le plus
    // visible du ticket 48 : une courbe qui tombe à zéro sur les derniers jours
    // se lit comme un arrêt de campagne, alors que personne n'a rien arrêté.
    // Un point tu ne se dessine pas — le trait s'arrête au dernier jour connu.
    const finSeau = periode.pas === "semaine" ? minJour(dAjout(cur, 6), periode.to) : cur;
    serie.push({ cle: cur, label: dCourt(debut), ...parCanalTu(v, finSeau) });
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
    daily.push({
      date: dk,
      label: `${String(day).padStart(2, "0")} ${MOIS_ABR[m]}`,
      ...parCanalTu(v, dk),
    });
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
        spendYear: tuSi(spendYear, aujourdhui),
        // `saisi`, jamais `saisi || mensuels` : douze mensuels ne font pas une
        // enveloppe d'année, ils font une moyenne qu'on présenterait comme une
        // décision.
        budgetYear: saisi,
        budgetYearHerite: saisi > 0 ? 0 : mensuels,
        spendPeriode: tuSi(themePeriode.get(label) ?? 0, periode.to),
        parCanalAn: parCanalTu(themeCanalAn.get(label) ?? { meta: 0, google: 0 }, aujourdhui),
      };
    })
    // Le tri reste sur la dépense MESURÉE : quand elle se tait, il n'y a plus
    // d'ordre à défendre et l'alphabet vaut mieux qu'un classement arbitraire.
    .sort((a, b) =>
      a.spendYear !== null && b.spendYear !== null
        ? b.spendYear - a.spendYear
        : a.label.localeCompare(b.label)
    );

  // La forme de l'année, mois par mois — la sparkline de la tuile « Budget
  // annuel ». La table « détail mois par mois » a disparu avec le dépliant des
  // réglages : c'était douze lignes de saisie pour un nombre qu'on tape une
  // fois, et elle n'était rendue nulle part ailleurs.
  const parMois: (number | null)[] = [];
  for (let i = 0; i <= m; i++) {
    const spent = parMoisCanal.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? { meta: 0, google: 0 };
    // Le dernier jour que ce mois couvre — le 31 pour un mois révolu,
    // aujourd'hui pour le mois en cours. C'est lui qui dit si le mois
    // traverse le trou : ceux d'avant restent des chiffres.
    const finMois = minJour(dIso(new Date(y, i + 1, 0)), aujourdhui);
    parMois.push(tuSi(spent.meta + spent.google, finMois));
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

  // LE TOTAL AMPUTÉ EST LE MENSONGE LE PLUS CHER DE CETTE PAGE (ticket 48).
  // C'est lui qui fait dire « dans les clous » à un compte dont on n'a pas lu
  // une semaine de dépense. Il n'a pas de moitié valide : dès qu'une des deux
  // régies manque sur la fenêtre, la somme n'est plus une somme.
  const totalSpent = tuSi(metaSpent + googleSpent, aujourdhui);
  const spentYear = tuSi(metaYear + googleYear, aujourdhui);

  // La part de l'année écoulée se compte en JOURS, pas en mois entiers : le
  // 2 août, compter août comme passé annoncerait 67 % d'année au lieu de 58, et
  // ferait croire qu'on est très en dessous alors qu'on est dans les clous.
  const joursAnnee = dJours(yearStart, `${y}-12-31`);
  const joursEcoulesAn = dJours(yearStart, aujourdhui);
  const elapsedAn = Math.min(1, joursEcoulesAn / joursAnnee);

  const joursMois = daysInMonth;
  const budgetJour = totalBudget > 0 ? totalBudget / joursMois : 0;
  const moyenneJour = spentYear === null ? null : spentYear / Math.max(1, joursEcoulesAn);
  // Ce qu'il reste à dépenser, étalé sur les jours qui restent : le vrai repère
  // du rythme. Une moyenne comparée au budget/365 punit un début d'année calme
  // et absout une fin d'année emballée.
  //
  // IL SE TAIT AVEC LA DÉPENSE. Calculé sur un cumul amputé, il rendrait une
  // marge quotidienne TROP GÉNÉREUSE — le sens exact dans lequel il ne faut pas
  // se tromper, puisque c'est un feu vert à dépenser.
  const joursRestants = Math.max(1, joursAnnee - joursEcoulesAn);
  const repereJour =
    spentYear === null || budgetAnnuel <= 0
      ? null
      : Math.max(0, budgetAnnuel - spentYear) / joursRestants;

  // UNE JOURNÉE QU'ON N'A LUE QU'À MOITIÉ NE SE JUGE PAS. Elle ne peut pas
  // produire une fausse alerte — une dépense manquante ne fait que baisser le
  // ratio — mais elle produirait un SILENCE trompeur, listé au milieu de jours
  // réellement mesurés. On l'écarte, et la page dit ailleurs qu'il manque des
  // jours : l'absence d'alerte ne vaut jamais « tout va bien » tant qu'une
  // régie est muette.
  const alertes: AlerteJour[] =
    budgetJour > 0
      ? daily
          .filter((d): d is CoutDay & { meta: number; google: number } =>
            d.meta !== null && d.google !== null
          )
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
    // ON NE SIGNALE QUE CE QUI TAIT VRAIMENT QUELQUE CHOSE. Un canal tombé
    // APRÈS avoir écrit toute la période ne creuse aucun trou sur cette page :
    // l'annoncer quand même userait l'alarme pour rien — c'est la règle de
    // `chiffres_tus` côté rapport, appliquée ici à la fenêtre la plus large de
    // la page, l'année.
    muets: aveuglesSur(muets, aujourdhui),
    labels: (labelsRes.data?.[0]?.labels as string[] | null) ?? [],
    annee: y,
    elapsed,
    elapsedAn,
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
    totalPeriode: tuSi(totalPeriode, periode.to),
    parCanalPeriode: parCanalTu(canalPeriodeBrut, periode.to),
    filtreActif,
    byTheme,
  };
}
