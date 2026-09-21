import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { JOUR_DEFAUT } from "@/lib/jour-de-travail";
import { fetchCanauxMuets, type CanalMuetLive } from "@/lib/canaux-muets";

// Couche données du rapport hebdo.
// Règle maison : fenêtre = 7 jours PLEINS, ancrés sur la dernière date de
// données, jamais aujourd'hui (`CLAUDE.md` §7 : le jour du fetch est
// incomplet). Elle ne sert plus qu'à dater `weekLabel` — les mesures et leurs
// écarts sont calculés par le worker et lus dans `report` (ticket 51).

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];


// « Ta boussole » — l'indicateur qui compte, choisi selon l'objectif du compte,
// avec sa trajectoire sur 10 semaines et les zones qui le rendent lisible.
export type KpiOption = {
  key: string;
  titre: string;
  unite: string;
  direction: "up" | "down";
  valeur: number;
  precedent: number | null;
  repere: string | null;
  points: (number | null)[];
  bandes: { max: number | null; label: string; tone: "neg" | "warn" | "pos" }[];
};

// « Ce qui tournait » — les campagnes en barres et les publications en points,
// sur une même échelle de 4 semaines. `couverture` dit jusqu'où chaque source
// est réellement à jour : sans elle, une barre qui s'arrête au dernier jour
// récolté se lirait « campagne terminée ».
export type Frise = {
  debut: string;
  fin: string;
  semaine_debut: string;
  couverture?: { meta: string | null; google: string | null; instagram: string | null } | null;
  campagnes: {
    nom: string;
    canal: string;
    theme: string | null;
    /** Premier et dernier jour où la campagne a RÉELLEMENT dépensé. */
    debut: string;
    fin: string;
    jours: number;
    continu: boolean;
    depense: number;
    // ── Ce qui est DÉCLARÉ dans la plateforme, pas observé ────────────────
    // Absent tant que le worker ne va pas chercher les dates de campagne chez
    // Meta (`start_time`/`stop_time`) et Google Ads (`campaign.start_date`/
    // `campaign.end_date`). Elles ne se déduisent pas de la dépense : une
    // campagne programmée jusqu'en décembre et une campagne arrêtée hier ont
    // exactement la même trace. Tant que ces champs sont absents, la frise
    // n'affiche aucun segment prévisionnel — elle ne devine pas.
    /** Fin programmée. `null` = explicitement sans date de fin. */
    fin_prevue?: string | null;
    /** true quand la campagne est créée mais n'a encore rien dépensé. */
    planifiee?: boolean;
  }[];
  /**
   * `plateforme` est absente des payloads publiés avant août 2026 — l'affichage
   * retombe alors sur « instagram », qui était la seule source.
   */
  posts: { date: string; theme: string | null; type: string; plateforme?: string }[];
};

export type KpiFocus = {
  labels: string[];
  defaut: string;
  options: KpiOption[];
};





export type ThemeRow = { label: string; spend: number; rev: number };

/**
 * LE REVENU RÉELLEMENT CONSTATÉ SUR UN THÈME, quelle que soit la source qui le
 * porte.
 *
 * Deux endroits du payload le connaissent, et ils ne sont pas remplis par le
 * même chemin : `themes.rows[].rev` (la ventilation GA4 du compte) et
 * `themes_focus[].summary.revenue` (le bilan de la carte). Un rapport peut
 * porter l'un sans l'autre selon la version du worker qui l'a publié — on prend
 * donc le plus grand des deux plutôt que d'en élire un et de rater le cas où
 * c'est l'autre qui sait.
 */
export function revenuTheme(theme: ThemeFocus, rows?: ThemeRow[] | null): number {
  const bilan = theme.summary?.revenue ?? 0;
  const ligne = (rows ?? []).find((r) => r.label === theme.label)?.rev ?? 0;
  return Math.max(bilan > 0 ? bilan : 0, ligne > 0 ? ligne : 0);
}

/**
 * LA NOTE DE LA SÉRIE, MAIS SEULEMENT QUAND ELLE EST VRAIE.
 *
 * Défaut vu sur le rapport de David : la carte « Audio Tour » affichait
 * « 4 521 CHF dépensé · 820 CHF revenu · 0,2 ROAS » et, deux lignes plus bas,
 * « Le ROAS de ce thème n'est pas mesurable ». Les deux ne peuvent pas être
 * vrais en même temps.
 *
 * La cause est dans le worker (`_theme_series`, `saas/traitement/build_report.py`) :
 * quand l'objectif est « ventes », aucune branche n'essaie de construire une
 * série de ROAS — on tombe directement sur `has_spend`, la courbe passe en
 * « Dépense (CHF) » et la note est écrite sans qu'on ait regardé si le thème a
 * du revenu. Le rapport ne se régénérant qu'à la demande, la correction du
 * worker ne suffirait pas : les payloads déjà publiés porteraient la note
 * fausse pendant des semaines. Pulse la filtre donc à l'affichage.
 *
 * Le juge est le revenu du thème, pas la présence d'un ROAS : un thème avec du
 * revenu et sans ROAS calculé n'est pas un thème « non mesurable », c'est un
 * thème dont on n'a pas fait la division.
 *
 * Le test sur « ROAS » n'est pas une précaution de style : c'est le seul motif
 * de note que le worker écrit aujourd'hui, mais il en écrira d'autres — « on
 * suit la portée faute d'engagement », par exemple — et celles-là ne sont pas
 * démenties par un revenu.
 */
export function noteSerie(
  serie: ThemeSeries | null | undefined,
  revenu: number
): string | null {
  const note = serie?.note;
  if (!note) return null;
  if (revenu > 0 && /roas/i.test(note)) return null;
  return note;
}



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
  /** `null` quand un canal payant était muet cette semaine : la dépense
   *  hebdo du thème traverse alors un trou de récolte et ne se publie pas
   *  amputée (ticket 20). `theme-card.tsx` teste `> 0`, que `null` ne
   *  passe pas — la ligne disparaît, elle n'affiche pas 0 CHF. */
  spend_week: number | null;
  best_campaign: string | null;
  n_campaigns: number;
};


export type ThemeSeries = {
  metric_label: string;
  // Pourquoi ce n'est pas l'indicateur de ton objectif qu'on suit ici.
  note?: string | null;
  points: { label: string; value: number }[];
};

export type ThemeFocus = {
  label: string;
  is_priority: boolean;
  /**
   * L'objectif EFFECTIF de ce thème — celui qui pilote réellement sa courbe
   * (`series.metric_label`) et l'ordre de ses conseils, PAS forcément celui du
   * compte. Absent des payloads publiés avant cette fonctionnalité : le front
   * retombe alors sur l'objectif du compte, exactement le comportement d'avant.
   */
  objectif?: string | null;
  /**
   * `true` seulement si CE thème a un réglage propre (`theme_objectifs`) ET
   * qu'il est toujours étoilé — un thème qui perd son étoile retombe sur
   * l'objectif du compte sans que sa ligne soit effacée (voir le worker).
   * Absent ou `false` = hérité du compte.
   */
  objectif_propre?: boolean;
  /**
   * Le jugement assemblé du thème — où il en est sur son indicateur (GA4 pour
   * ventes/engagement, portée pour notoriété, faute d'équivalent GA4 —
   * décision de David : la notoriété n'est pas une conversion), en vrai % de
   * variation MESURÉ vs la semaine précédente (aucune cible chiffrée
   * n'existe pour un objectif de thème). `mode: "cible"` = le thème se
   * dégrade au-delà du seuil, les recos ont été réordonnées pour mettre en
   * avant le levier le plus impactant. `null` si la métrique n'était pas
   * mesurable cette semaine (pas de baseline) — jamais un chiffre inventé.
   * Absent des payloads publiés avant cette fonctionnalité.
   */
  jugement?: {
    objectif: string;
    metric: string;
    metric_label: string;
    variation_pct: number;
    mode: "tout" | "cible";
    explication: string;
    levier_impactant: string | null;
  } | null;
  summary: ThemeSummary;
  series?: ThemeSeries | null;
  campaigns: ThemeCampaign[];
};

/**
 * CE QUI A BOUGÉ SUR TES PLATEFORMES, sans passer par Pulse.
 *
 * Déduit de la dépense quotidienne, jamais d'un champ d'API : aucune
 * plateforme ne nous dit « le budget a changé le 2 août ». On écrit donc ce
 * qu'on observe — « la dépense est passée de 30 à 75 CHF par jour » — pas ce
 * qu'on suppose. Absent des payloads publiés avant août 2026.
 */
export type ChangementPlateforme = {
  date: string;
  canal: string;
  campagne: string;
  theme: string | null;
  /**
   * `planifiee` = son début est À VENIR. `jamais_lancee` = son début est passé
   * et elle n'a jamais rien dépensé — deux faits opposés que le worker écrivait
   * tous les deux « est programmée » jusqu'au 12 août 2026.
   */
  type: "lancee" | "arretee" | "reprise" | "planifiee" | "jamais_lancee" | "depense";
  detail?: string | null;
};

/** UN CANAL QUI AURAIT DÛ ÉCRIRE ET N'A RIEN ÉCRIT (ticket 20 de la
 *  construction). Ce n'est ni « pas connecté » ni « zéro dépensé » : c'est une
 *  récolte qui a échoué — jeton expiré, 500, limite de débit, schéma en retard.
 *  Les trois se ressemblent dans les chiffres et se traitent à l'opposé, d'où
 *  ce champ : le worker est le seul à savoir laquelle des trois s'est produite.
 *
 *  Tant qu'un canal est là-dedans avec `chiffres_tus`, les mesures qui
 *  traversent son trou valent `null` dans ce payload — jamais 0. Un écran qui
 *  afficherait 0 à la place dirait « tu n'as rien dépensé » (`CLAUDE.md` §7). */
export type CanalMuet = {
  canal: string;
  /** Le nom porté devant le client — « Meta Ads », jamais « meta ». */
  nom: string;
  /** Le mot de la fin du worker. Nomme la variable en cause, jamais sa valeur. */
  mot: string;
  /** Dernier jour que ce canal a réellement écrit. `null` = jamais rien écrit. */
  depuis: string | null;
  /** `true` quand ce canal fait taire des chiffres de CETTE semaine. Un canal
   *  tombé après avoir tout écrit est signalé sans rien taire — ne pas alarmer
   *  dessus, ça userait l'alarme. */
  chiffres_tus: boolean;
  /** Depuis combien de rapports publiés d'affilée ce canal est muet, celui-ci
   *  compris — donc 1 la première semaine (ticket 47). Compté sur les rapports
   *  PUBLIÉS, pas sur le calendrier : une semaine sans rapport ne dit pas que le
   *  canal est revenu, elle est sautée. Absent des payloads d'avant le
   *  ticket 47 : `undefined` se lit alors « première semaine », faute de mieux.
   *
   *  NE JAMAIS L'AFFICHER TEL QUEL. C'est un seuil interne ; ce que le client
   *  lit, c'est la date de `depuis`, qui est mesurée. */
  semaines_muettes?: number;
};

export type ReportPayload = {
  version: number;
  /** Toujours présent depuis le ticket 20, vide quand la récolte a tout lu.
   *  Absent des payloads d'avant : `undefined` ne veut donc PAS dire « aucun
   *  trou », il veut dire « ce rapport ne sait pas répondre ». */
  canaux_muets?: CanalMuet[] | null;
  changements?: ChangementPlateforme[] | null;
  // v2 (worker) — absents des payloads v1 : tout est optionnel.
  /** `period` EST LA FENÊTRE DU BILAN DE CHAQUE CARTE DE THÈME : les chiffres
   *  de `ThemeFocus.summary` sortent tous de cette matrice
   *  (`matrix_themes_by`, `build_report.py`), et `vision.period_label`
   *  — « depuis le 1 jan » — n'est que son `since` mis en français. Le champ
   *  était calculé et publié depuis toujours (`insights.py`) mais n'était pas
   *  déclaré ici ; il l'est parce que la porte vers la plateforme emporte
   *  cette fenêtre-là, et aucune autre. Absent des payloads v1 : sans lui la
   *  porte ne s'ouvre pas, plutôt que de s'ouvrir sur une autre période. */
  matrice?: {
    coverage?: MatriceCoverage;
    period?: { since: string; until: string; days: number } | null;
  } | null;
  themes_focus?: ThemeFocus[] | null;
  // Lecture simple des métriques clés de la semaine (section « Où on en est »).
  metrics_read?: {
    trafic: number | null;
    vues: number | null;
    clics: number | null;
    ctr: number | null;
  } | null;
  // L'indicateur qui compte pour cet objectif, avec sa pente et ses zones.
  kpi_focus?: KpiFocus | null;
  frise?: Frise | null;
  // Les quatre tuiles sur 10 semaines — une pente vaut mieux qu'un chiffre nu.
  metrics_series?: {
    labels: string[];
    trafic: (number | null)[];
    vues: (number | null)[];
    clics: (number | null)[];
    ctr: (number | null)[];
  } | null;
  // Les mêmes sur la fenêtre précédente — le repère qui rend le chiffre lisible.
  metrics_prev?: {
    trafic: number | null;
    vues: number | null;
    clics: number | null;
    ctr: number | null;
  } | null;
  week_label: string;
  /** La ligne sous laquelle le worker a écrit ce payload — le lundi de la
   *  FENÊTRE MESURÉE, pas celui du jour de fabrication (`build_report.py`).
   *  Publié depuis le ticket 13 de la construction, absent des payloads
   *  d'avant. Déclaré ici pour que la clé d'écriture soit lisible côté web ;
   *  aucun écran ne s'en sert — le rapport se date par les trois dates. */
  week_start?: string | null;
  since: string;
  until: string;
  verdict: string;
  // Les ingrédients du verdict, pour l'afficher en grand plutôt qu'en phrase.
  // Absents des payloads publiés avant → repli sur la phrase seule.
  verdict_pct?: number | null;
  verdict_metric?: string | null;
  verdict_tone?: "pos" | "neg" | "stable" | null;
  themes?: { rows: ThemeRow[]; orphan: number } | null;
  // `preuve` A ÉTÉ RETIRÉ LE 2026-09-13, avec le moteur qui l'écrivait.
  //
  // C'était le bilan des actions AU NIVEAU DU COMPTE, remesuré par un second
  // moteur du worker pendant que le rail rendait son verdict sur le THÈME de
  // l'action : deux mesures, deux périmètres, deux verdicts possibles sur la
  // même décision. Aucun composant ne l'a jamais lu. Le bilan compte-entier est
  // désormais un COMPTAGE des verdicts déjà persistés (`lib/carnet.ts`), donc
  // il ne peut plus contredire le rail. Les payloads déjà publiés portent
  // encore le champ ; rien ne le lit, il s'éteint de lui-même.
};


export type WeeklyData = {
  email: string;
  weekLabel: string;
  hasData: boolean;
  /** IL N'Y A NI TUILES KPI NI DÉPENSE PAR CANAL ICI, et ce n'est pas un oubli
   *  (`.scratch/construction/issues/51-les-tuiles-kpi-du-rapport-ne-sont-lues-par-personne.md`).
   *  Le rapport est organisé PAR THÈME — les trois dates, le verdict, la
   *  boussole, l'anneau, la frise, puis les cartes — où une rangée de totaux
   *  tous canaux confondus n'a pas de place. La dépense par plateforme, elle,
   *  est vivante sur `/couts`.
   *
   *  Leur calcul avait survécu à leur retrait, donc plus rien ne le
   *  vérifiait. Les rebrancher demande de reprendre la décision d'ordre
   *  ci-dessus, pas de décommenter. */
  /** LE TROU DE RÉCOLTE LU EN DIRECT, pas celui du payload.
   *
   *  Il ne double PAS `report.canaux_muets`, qui reste la source du bandeau du
   *  rapport : celui-là est la photo du jour où le worker a écrit, celui-ci est
   *  l'état de maintenant. Un seul écran a besoin du second — l'ÉTAT VIDE. Un
   *  compte qui vient de brancher Meta et dont la première récolte a échoué n'a
   *  ni ligne ni payload : sans cette liste, on lui dirait « branche une
   *  source » alors qu'il vient de le faire, et rien ne nommerait la panne. */
  canauxMuets: CanalMuetLive[];
  report: ReportPayload | null;
  /** `weekly_reports.updated_at` — la date de PUBLICATION de ce payload, la
   *  deuxième des trois dates en tête du rapport. `null` tant qu'aucun rapport
   *  n'existe (ou si la colonne n'a pas pu être lue) : on n'écrit alors aucune
   *  date plutôt qu'une date approchée (`CLAUDE.md` §7). */
  publieLe: string | null;
  /** Le Jour de travail du compte regardé (`profiles.fetch_schedule`), en
   *  anglais comme en base. C'est de lui que sort la troisième date. */
  jourDeTravail: string;
  /** Les thèmes que le client a étoilés — stockés dans `insight_feedback` sous
   *  la clé `priority_label:<nom>`, lus en direct parce que le payload peut
   *  dater d'un étoilage plus ancien. */
  insightFeedback: Record<string, string>;
  objectif: string | null;
  onboarded: boolean;
  // Liste maîtresse des thèmes (étape « priorités » du parcours de démarrage).
  labels: string[];
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


export async function getWeeklyData(): Promise<WeeklyData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  //
  // LES DEUX RÉGIES NE SE LISENT PLUS QU'À UNE LIGNE CHACUNE
  // (`.scratch/construction/issues/51-les-tuiles-kpi-du-rapport-ne-sont-lues-par-personne.md`), et
  // c'est tout ce dont ce module a besoin depuis que les tuiles KPI ont quitté
  // l'écran : l'ANCRE veut la dernière date écrite — le tri la met en tête —
  // et `hasData` veut seulement savoir s'il existe une ligne. Plus une seule
  // somme ici, donc plus une seule raison de rapatrier la fenêtre entière.
  //
  // Le `limit(3000)` d'avant était en outre une fiction — PostgREST plafonne à
  // 1 000 lignes et tronque EN SILENCE (`CLAUDE.md` §8) : les sommes que ce
  // ticket supprime se calculaient sur un mois tronqué sans le dire.
  const [metaRes, googleRes, followersRes, reportRes, profileRes, insightRes, canauxMuets] =
    await Promise.all([
    supabase
      .from("meta_ads_insights")
      .select("date_start")
      .eq("user_id", uid)
      .order("date_start", { ascending: false })
      .limit(1),
    supabase
      .from("google_ads_insights")
      .select("date_start")
      .eq("user_id", uid)
      .order("date_start", { ascending: false })
      .limit(1),
    // Une seule ligne suffit ici aussi, et N'IMPORTE LAQUELLE : `followers`
    // ne sert plus qu'à dire « ce compte a déjà reçu quelque chose » dans
    // `hasData`. D'où l'absence de tri — contrairement aux deux régies
    // ci-dessus, où le tri désigne l'ancre.
    supabase
      .from("followers_history")
      .select("fetched_at")
      .eq("user_id", uid)
      .limit(1),
    // `updated_at` EXISTE DEPUIS TOUJOURS ET N'ÉTAIT JAMAIS LU. C'est la
    // deuxième des trois dates en tête du rapport — « publié le X » — et la
    // seule qui dise QUAND le worker a écrit ce payload. Sans elle, un lecteur
    // qui a classé des campagnes un mardi ne peut pas savoir que le texte
    // qu'il lit est plus vieux que les chiffres regroupés à côté
    // (`.scratch/refonte/issues/13-entre-deux-jours-de-travail.md` §4).
    supabase
      .from("weekly_reports")
      .select("week_start, payload, updated_at")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(1),
    // `fetch_schedule` ENTRE DANS CETTE LECTURE, et c'est sans risque ici : la
    // colonne est celle que `_due_today` lit pour décider qui est récolté
    // (`saas/collecte/automatisation/fetch_all.py`). Une base qui ne l'aurait
    // pas ne publierait aucun rapport — il n'y aurait donc rien à dater. Le
    // repli ci-dessous (`retry`) ne la redemande pas : dans ce cas on retombe
    // sur le défaut du worker lui-même, lundi, et pas sur une invention.
    supabase
      .from("profiles")
      .select("objectif, business_type, labels, fetch_schedule")
      .eq("id", uid)
      .limit(1),
    // Verdicts ✓/✗ sur les constats de la vision (table absente avant la
    // migration → error, on dégrade en {}).
    supabase
      .from("insight_feedback")
      .select("insight_key, verdict")
      .eq("user_id", uid),
    // QUELLE RÉCOLTE A ÉCHOUÉ AU DERNIER PASSAGE (ticket 48). Dans le même
    // lot que le reste : la lecture ne coûte rien de plus en temps.
    //
    // ELLE N'A PLUS QU'UN SEUL RÔLE ICI — empêcher un canal périmé d'ancrer la
    // fenêtre (ADR 0005). Elle faisait aussi taire les chiffres recalculés à
    // côté du payload ; ces chiffres sont partis avec les tuiles KPI, ce
    // rôle-là n'a plus d'objet.
    //
    // ELLE RESSORT DE `WeeklyData`, pour l'ÉTAT VIDE seulement (voir
    // `canauxMuets` dans le type). Ce que lit le client d'un rapport garni,
    // c'est `report.canaux_muets` — la photo du worker, servie par
    // `CanalMuetAlerte` : deux listes côte à côte sur un même écran finiraient
    // par se contredire.
    fetchCanauxMuets(supabase, uid),
  ]);

  const meta = metaRes.data ?? [];
  const google = googleRes.data ?? [];
  const followers = followersRes.data ?? [];
  // null si la table est absente (migration pas encore passée) ou si le
  // worker n'a pas encore publié pour ce compte — l'écran gère les deux
  // sans distinction, en état vide.
  const report: ReportPayload | null =
    (reportRes.data?.[0]?.payload as ReportPayload | undefined) ?? null;
  // QUAND CE PAYLOAD A ÉTÉ ÉCRIT — la ligne, pas le payload : le worker n'y
  // met aucune date de publication, et `updated_at` est la seule qui existe.
  // Elle bouge à chaque republication, ce qui est exactement ce qu'on veut
  // dire : « voilà la version que tu lis ».
  const publieLe: string | null =
    (reportRes.data?.[0]?.updated_at as string | undefined) ?? null;

  const insightFeedback: Record<string, string> = {};
  for (const row of insightRes.data ?? []) {
    if (row.insight_key && row.verdict) insightFeedback[row.insight_key] = row.verdict;
  }

  // Si la colonne business_type n'existe pas encore (migration §7 pas passée),
  // la requête combinée échoue → on retombe sur objectif seul, onboarding masqué.
  let profRow: {
    objectif?: string | null;
    business_type?: string | null;
    labels?: string[] | null;
    fetch_schedule?: string | null;
  } | null = profileRes.data?.[0] ?? null;
  let migrated = !profileRes.error;
  if (profileRes.error) {
    const retry = await supabase.from("profiles").select("objectif, labels").eq("id", uid).limit(1);
    profRow = retry.data?.[0] ?? null;
  }
  const objectif: string | null = profRow?.objectif ?? null;
  const labels: string[] = profRow?.labels ?? [];
  // LE JOUR DE TRAVAIL DU COMPTE REGARDÉ, jamais celui de la personne qui
  // regarde : un Membre invité lit les dates du compte dont il voit les
  // chiffres, et c'est `user_id` que le worker compare (`_due_today`). D'où
  // `uid` et non `compte.moi`.
  const jourDeTravail: string = profRow?.fetch_schedule || JOUR_DEFAUT;
  // Onboarded si déjà répondu — ou si la migration n'est pas passée (pas de formulaire cassé)
  const onboarded: boolean =
    !migrated || Boolean(objectif) || Boolean(profRow?.business_type);

  // Ancre = dernière date de données (jour plein), jamais après hier.
  //
  // UN CANAL MUET N'ANCRE PAS LA FENÊTRE (ADR 0005). Sa dernière date est
  // périmée par définition — c'est le jour où il a cessé d'écrire. S'ancrer
  // dessus reculerait la fenêtre entière et ferait relire au client la semaine
  // PRÉCÉDENTE sous les dates d'aujourd'hui : il ne verrait pas un écran troué,
  // il verrait l'ancien, et la panne deviendrait invisible pour tout le monde.
  // C'est la sortie la plus discrète du problème, et c'est un compte qui ne
  // fait que de la pub qui l'emprunte, faute d'une autre source pour ancrer.
  const yesterday = addDays(new Date(), -1);
  const muetsAncre = new Set(canauxMuets.map((c) => c.canal));
  let anchor: Date | null = null;
  for (const [canal, rows] of [["meta", meta], ["google", google]] as const) {
    if (muetsAncre.has(canal)) continue;
    for (const r of rows) {
      const d = new Date(String(r.date_start).slice(0, 10) + "T00:00:00Z");
      if (!isNaN(d.getTime()) && (!anchor || d > anchor)) anchor = d;
    }
  }
  if (!anchor || anchor > yesterday) anchor = anchor && anchor <= yesterday ? anchor : yesterday;

  const curSince = addDays(anchor, -6);

  // `hasData` RESTE UNE QUESTION DE LIGNES, et ce n'est pas le même verrou que
  // le `has_data` du worker.
  //
  // Celui du worker décide s'il PUBLIE un rapport, et l'ADR 0005 lui interdit
  // de se taire sur un canal muet — sinon la panne devient invisible. Celui-ci
  // décide entre l'écran de bienvenue et le corps du rapport : sans une seule
  // ligne ni un seul payload, ce corps n'a rien à rendre, et le forcer donne
  // une page de modules vides sans rien pour l'expliquer.
  //
  // Un compte au jeton mort garde ses lignes des semaines passées, donc
  // `hasData` vaut vrai pour lui de toute façon. Le seul cas qui tombe ici est
  // celui qui n'a JAMAIS rien reçu — et c'est l'écran de bienvenue qui doit le
  // prendre en charge, en disant que la récolte a échoué (`canauxMuets`
  // ci-dessous, lu par `app/page.tsx`).
  const hasData = meta.length > 0 || google.length > 0 || followers.length > 0;

  return {
    email: compte.email,
    weekLabel: `${fmtDay(curSince)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · 7 jours pleins`,
    hasData,
    report,
    publieLe,
    jourDeTravail,
    insightFeedback,
    objectif,
    onboarded,
    labels,
    canauxMuets,
  };
}
