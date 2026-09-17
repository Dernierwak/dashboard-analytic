import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { JOUR_DEFAUT } from "@/lib/jour-de-travail";
import { fusionneRegroupement, lisRegroupement } from "@/lib/regroupement";

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

// Payload publié en headless par saas/traitement/build_report.py (weekly_reports.payload).
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
  // Temps à prévoir pour l'appliquer (« 10 min », « 30 min », « 1 h », « 2 h+ »).
  effort?: string | null;
  // LA PREUVE : le délai auquel on saura (voir `ROLES`, `build_report.py`).
  //   generale  — un geste, constatable demain à l'œil dans la plateforme.
  //   hypothese — une hypothèse, dont le verdict tombe à 14 jours.
  // Portée par TOUTES les règles depuis le ticket 06 de la construction
  // (`_GESTE_REGLE`) — avant, seule une piste IA se le déclarait, et les
  // pistes sont coupées depuis le ticket 08.
  role?: "generale" | "hypothese" | null;
  // LE GESTE : couper, augmenter, tester, créer, corriger (voir `NATURES`).
  // Même portée que `role`. Un conseil sans geste n'existe pas — c'est un
  // constat, et il n'est jamais servi (`_est_conseil`, `build_report.py`).
  nature?: "couper" | "augmenter" | "tester" | "créer" | "corriger" | null;
  // LE LEVIER : sur quoi le conseil demande d'agir — argent, contenu, tempo,
  // audience, ou `socle` pour un prérequis de mesure. Il sert à ne pas servir
  // trois conseils qui disent la même chose, et il repart avec le clic
  // « ▶ Je le teste » pour nourrir la mémoire du thème.
  levier?: string | null;
  // L'objet NOMMÉ que le conseil vise — une campagne, une annonce, un
  // groupe d'annonces. `null` quand le conseil porte sur le thème entier.
  // C'est la moitié de l'empreinte qui l'empêche de revenir à l'identique
  // (`saas/recos_ia/composition.py`).
  cible?: string | null;
};

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
  // Semaines où une action a été appliquée, tous thèmes confondus. Absent des
  // payloads publiés avant — la courbe s'affiche alors sans repères.
  markers?: number[];
  marqueurs?: RepereAction[];
};

// Un conseil de la sélection « les 3 du moment » — il porte son thème avec lui.
export type TopReco = PayloadReco & { theme: string | null; is_priority?: boolean };

// Une action décidée depuis un conseil. Cinq états :
//   running  = à faire (elle vit en haut du rapport) — un clic client
//   done     = faite le done_at, on observe 14 jours à partir de ce jour — un clic client
//   auto     = STATUT HÉRITÉ, plus jamais écrit ni relu (ticket 06 de la
//              construction). C'était l'Hypothèse d'un thème posée par le
//              WORKER à la publication, sans aucun clic, qui recevait un
//              verdict à l'échéance que le client l'ait faite ou non — un
//              mouvement de chiffres attribué à un geste que personne n'a
//              confirmé (`CLAUDE.md` §7). `build_report.py` ne lit plus ces
//              lignes : elles restent en base, elles n'arrivent plus ici. Les
//              branches qui les gèrent encore (ci-dessous et dans les
//              composants) sont donc inertes, pas actives.
//   archived = verdict vu, rangée dans l'historique
//   dropped  = abandonnée — elle quitte la liste mais reste dans l'historique
/** LES TROIS VERDICTS, ÉCRITS UNE SEULE FOIS DE CE CÔTÉ-CI.
 *  L'union du type et la validation de ce qui arrive de la base disaient la
 *  même liste deux fois ; elle en dérive maintenant. Un quatrième verdict
 *  ajouté au `CHECK` de `suivi_actions_verdict.sql` ne peut donc plus être
 *  accepté à la lecture sans que le type le connaisse aussi.
 *
 *  PAS EXPORTÉE, délibérément : `etat-action.tsx` tient le lexique affiché de
 *  ces trois mots, il est chargé par des composants CLIENT, et il n'importe de
 *  ce module que des TYPES. Y prendre une VALEUR entraînerait `next/headers`
 *  dans leur bundle (piège `CLAUDE.md` §8, déjà commenté là-bas). */
const VERDICTS = ["better", "worse", "stable"] as const;
type Verdict = (typeof VERDICTS)[number];

export type TrackedAction = {
  id: string;
  reco_key?: string;
  /** `note` = écrite à la main, elle ne sera jamais jugée. Absent avant la
   *  migration `suivi_actions_notes.sql` — tout est alors une `action`. */
  kind?: "action" | "note";
  title: string;
  theme: string | null;
  metric_label: string | null;
  decided_at: string;
  check_at: string;
  done_at?: string | null;
  status?: "running" | "done" | "auto" | "archived" | "dropped";
  /**
   * MARQUEUR D'ORIGINE DURABLE — distinct de `status` (rejet du checker,
   * 3e passe). `status` porte le cycle de vie ET, pour `"auto"`, l'origine —
   * mais deux gestes client parfaitement normaux (« ✓ Vu — je range »,
   * « × j'abandonne ») écrasent `status="auto"` sans que le client ait
   * jamais rien décidé lui-même. `origin` vient de `detail.origin` (posé une
   * fois par le worker, jamais réécrit par `resolveAction` — voir
   * `build_report.py`) : il reste `"auto"` même après un archivage ou un
   * abandon. Un `done_at` posé (uniquement via `resolveAction(id,"done")`,
   * donc un clic « ✓ Je l'ai fait ») fait quand même de la ligne une vraie
   * décision client, quelle que soit son origine — voir `estDecisionClient`.
   */
  origin?: "auto";
  due?: boolean;
  then?: number;
  now?: number;
  delta?: number | null;
  verdict?: Verdict;
  // Photo du conseil au moment de la décision — pour s'en souvenir plus tard.
  detail?: {
    observation?: string;
    pourquoi?: string;
    verifier?: string;
    effort?: string | null;
    /** Copie brute de l'origine — `origin` (ci-dessus) est la forme lue par
     *  le reste du produit ; ce champ n'existe que parce que `detail` est
     *  l'endroit où le worker l'écrit (jsonb déjà en place, sans migration). */
    origin?: "auto";
  } | null;
  /**
   * LE POINT D'ÉTAPE À SEPT JOURS — à mi-parcours, pas un verdict.
   * Écrit par le worker seulement si l'action est faite depuis 7 jours pleins
   * ET que le mouvement dépasse 10 % : sous ce seuil, sept jours de données ne
   * distinguent pas un effet d'un lundi calme.
   */
  etape?: { jours: number; delta: number; sens: "bon" | "mauvais" } | null;
};

/**
 * VRAIE DÉCISION CLIENT, PEU IMPORTE LE `status` ACTUEL.
 *
 * Utilisée partout où compter/étiqueter une ligne de suivi comme « ce que TU
 * as fait » ne doit PAS inclure une hypothèse auto-suivie que le client n'a
 * fait que ranger ou abandonner (rejet du checker, 3e passe) : `origin` seul
 * ne suffit pas, parce qu'une hypothèse auto que le client confirme via
 * « ✓ Je l'ai fait » (`done_at` posé) DEVIENT une vraie décision — c'est
 * justement le seul geste qui écrit `done_at`, et lui seul.
 */
export function estDecisionClient(a: TrackedAction): boolean {
  return a.origin !== "auto" || Boolean(a.done_at);
}

/**
 * UNE VEILLE N'EST PAS UN CONSEIL — c'est un constat qu'on surveille, et il ne
 * demande aucun geste. D'où deux conséquences qui vivent ailleurs : la carte ne
 * lui donne ni « ▶ Je le teste » ni état de suivi (`reco-card.tsx`), et le
 * module « À faire » ne l'inscrit pas (`lib/a-faire.ts`) — une liste qui se
 * vide ne peut pas porter une ligne qu'aucun geste ne retire.
 */
export function estVeille(key: string): boolean {
  return key.startsWith("veille_");
}

/** La ventilation de la DÉPENSE DE LA FENÊTRE DU RAPPORT par thème — l'anneau
 *  de la section 1, avec sa part « autres » (`orphan`). Ce n'est PAS le
 *  regroupement de la carte de thème : celui-là couvre tout l'historique et se
 *  lit dans la vue (`lib/regroupement.ts`). Deux périmètres, deux objets — les
 *  confondre est exactement ce que `revenuTheme()` faisait. */
export type ThemeRow = { label: string; spend: number; rev: number };

// `revenuTheme()` A ÉTÉ SUPPRIMÉ AVEC LE TICKET 22 DE LA CONSTRUCTION.
//
// Il prenait « le plus grand des deux » entre `themes_focus[].summary.revenue`
// et `themes.rows[].rev`. Les deux ne mesurent pas la même chose : le premier
// couvre tout l'historique, le second la seule fenêtre du rapport. Prendre le
// max, c'était afficher le plus flatteur des deux sous un bilan calculé sur la
// période de l'autre — un revenu que rien ne confirme (`CLAUDE.md` §7).
//
// LE REVENU D'UN THÈME A MAINTENANT UNE SEULE SOURCE : la vue
// `theme_regroupement`, lue à chaque affichage (`lib/regroupement.ts`). Sans
// réponse d'elle, `summary.revenue` vaut `null` et la carte écrit que le revenu
// n'est pas connu. Pas de zéro, pas d'estimation, pas de seconde source.

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
 *
 * `revenu === null` N'EST PAS `0`. Depuis le ticket 22, le revenu vient de la
 * vue `theme_regroupement` et vaut `null` quand elle n'en rattache aucun — donc
 * « on ne sait pas », pas « il n'y en a pas ». La note est alors CONSERVÉE :
 * elle n'est démentie que par un revenu réellement constaté, et taire un
 * avertissement sur une ignorance reviendrait à affirmer le contraire de ce
 * qu'on sait.
 */
export function noteSerie(
  serie: ThemeSeries | null | undefined,
  revenu: number | null
): string | null {
  const note = serie?.note;
  if (!note) return null;
  if (revenu !== null && revenu > 0 && /roas/i.test(note)) return null;
  return note;
}

// Constat de la vision globale (« Ce qui fonctionne pour toi ») — clé stable,
// verdict du client persistant (insight_feedback).
//
// C'EST LA SEULE RÉPONSE À « QU'EST-CE QUI MARCHE CHEZ TOI » DEPUIS LE
// 2026-09-12. Elle se calculait trois fois : ici (`saas/recos_ia/insights.py`),
// dans deux règles du moteur, et une troisième fois EN TYPESCRIPT sur
// `/instagram` — trois jeux de seuils qui pouvaient se contredire le même
// lundi. Les deux autres sont mortes ; cette page ne recalcule plus rien, elle
// lit (`.scratch/construction/issues/09-trois-moteurs-un-seul.md`).
export type VisionConstat = {
  key: string;
  // theme_best | theme_worst | format_best | slot_best | campagne_locomotive
  // | cout_conversion | angle_mort
  kind: string;
  title: string;
  detail: string;
  /** La page de plateforme où ce constat CONCLUT (rang 4 du gabarit) :
   *  « instagram », « meta », « google », « pub » (les deux régies), ou absent
   *  quand il parle d'un THÈME — un thème traverse les régies et l'organique,
   *  c'est même ce qu'aucune régie ne sait dire. */
  platform?: string | null;
  /** Ce que le chiffre NE compte pas. Un seul genre le porte aujourd'hui
   *  (`cout_conversion`) : son coût par conversion est une borne haute, jamais
   *  une mesure complète, et l'afficher sans cette phrase le ferait lire comme
   *  une mesure (`CLAUDE.md` §7). */
  angle_mort?: string | null;
  status: "new" | "agree" | "reject";
};

export type VisionBlock = {
  generated_at: string;
  period_label: string; // « depuis le 1 jan »
  // Thèmes étoilés page Thèmes, dans l'ORDRE D'ÉTOILAGE — plus de plafond
  // depuis le 14 août 2026. Les trois premiers seuls reçoivent des conseils.
  priorities?: string[];
  constats: VisionConstat[];
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
  /** `null` quand un canal payant était muet cette semaine : la dépense
   *  hebdo du thème traverse alors un trou de récolte et ne se publie pas
   *  amputée (ticket 20). `theme-card.tsx` teste `> 0`, que `null` ne
   *  passe pas — la ligne disparaît, elle n'affiche pas 0 CHF. */
  spend_week: number | null;
  best_campaign: string | null;
  /**
   * Le nombre EXACT de campagnes du thème — pas la longueur de
   * `ThemeFocus.campaigns`, qui est un extrait plafonné.
   *
   * IL PORTE SUR TOUT L'HISTORIQUE, pas sur la semaine : il se compte dans
   * `matrix.campaigns`, que `build_matrix` agrège sur toute la profondeur des
   * données (`saas/recos_ia/insights.py`). Une campagne arrêtée l'an dernier y
   * est donc comptée. C'est cohérent avec le lien de la porte, qui emporte
   * `matrice.period` — la même profondeur, de la première donnée au dernier
   * jour plein.
   */
  n_campaigns: number;
  /**
   * LE MÊME COMPTE, RÉGIE PAR RÉGIE (ticket 34).
   *
   * `ThemeFocus.campaigns` s'arrête aux huit plus grosses dépenses du thème :
   * en compter les canaux se trompe sur le nombre ET sur la PRÉSENCE — douze
   * campagnes Meta grasses évincent les deux campagnes Google du thème, et la
   * porte vers `/google` ne s'ouvre plus du tout. Ce compte-ci porte sur la
   * liste entière, côté worker.
   *
   * Une régie où le thème ne tourne pas n'a **pas de clé**, elle ne vaut pas 0.
   * `undefined`/`null` = payload publié avant ce ticket : on ne sait pas, et
   * `lib/campagnes-theme.ts` retombe alors sur l'extrait — le comportement
   * d'avant, jamais une invention rétroactive.
   */
  n_campaigns_canal?: Partial<Record<"meta" | "google", number>> | null;
  /**
   * ASSEZ DE DÉPENSE POUR QU'ON SE PRONONCE — le drapeau de la vue
   * `theme_regroupement`, posé par `fusionneRegroupement` (ticket 22).
   *
   * IL VOYAGE, IL NE SE RECALCULE PAS. Le seuil (100 CHF) vit dans le SQL et
   * nulle part ailleurs : le réécrire ici en donnerait deux, et deux seuils
   * finissent toujours par diverger. C'est lui qui dit POURQUOI un thème n'a
   * pas de ROAS — trop peu dépensé, et non « revenu inconnu », deux phrases
   * qu'un lecteur ne doit pas confondre.
   *
   * `null`/absent = on ne sait pas : la vue n'a pas pu être lue, ou ce payload
   * est antérieur au ticket. Jamais traité comme un « non ».
   */
  juge?: boolean | null;
};

/**
 * Un repère d'action sur une courbe. `markers` ne portait que l'index de la
 * semaine — de quoi tracer un pointillé, pas de quoi écrire ce qu'on a fait.
 * `titre` est vide quand plusieurs actions tombent la même semaine : elles
 * partagent un seul repère, et `n` dit combien elles sont.
 * Absent des payloads publiés avant août 2026.
 */
export type RepereAction = { i: number; date: string; titre: string; n: number };

export type ThemeSeries = {
  metric_label: string;
  // Pourquoi ce n'est pas l'indicateur de ton objectif qu'on suit ici.
  note?: string | null;
  points: { label: string; value: number }[];
  markers: number[]; // index de semaine où une action a été lancée
  marqueurs?: RepereAction[];
};

export type ThemeFocus = {
  label: string;
  is_priority: boolean;
  /**
   * CE THÈME REÇOIT-IL DES CONSEILS ?
   *
   * Le filtre dur : Pulse conseille sur les trois thèmes que le client a
   * désignés, et seulement sur eux (`_THEMES_CONSEILLES`, `build_report.py` —
   * `CLAUDE.md` §1, ADR 0003). Un thème `conseille: false` garde sa carte, ses
   * chiffres, sa courbe et sa veille ; à la place de ses conseils, la carte
   * affiche un module VERROUILLÉ qui dit ce qui le déverrouille.
   *
   * ABSENT VAUT « OUI ». Les payloads publiés avant ce filtre ne le portent
   * pas, et leurs cartes avaient bien des conseils : traiter l'absence comme un
   * « non » verrouillerait rétroactivement des dizaines d'anciens rapports.
   */
  conseille?: boolean;
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
  recos: PayloadReco[];
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
};

export type ReportPayload = {
  version: number;
  /** Toujours présent depuis le ticket 20, vide quand la récolte a tout lu.
   *  Absent des payloads d'avant : `undefined` ne veut donc PAS dire « aucun
   *  trou », il veut dire « ce rapport ne sait pas répondre ». */
  canaux_muets?: CanalMuet[] | null;
  changements?: ChangementPlateforme[] | null;
  // v2 (worker) — absents des payloads v1 : tout est optionnel.
  vision?: VisionBlock | null;
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
  // Phrase de passage : relie le constat de la semaine aux conseils qui suivent.
  themes_intro?: string | null;
  // Savoir-faire de fond par thématique — durable, pas lié à la semaine.
  themes_tips?: { theme: string; tips: { titre: string; texte: string }[] }[] | null;
  /**
   * HISTORIQUE — plus jamais écrit, encore lu.
   *
   * C'était « Si tu ne fais que trois choses », une sélection cross-thème en
   * tête des conseils. Elle avait un sens quand douze conseils sortaient ; il y
   * en a cinq au maximum depuis le plafond de semaine, sur trois thèmes au
   * maximum. David a déplacé l'objet plutôt que de le supprimer : « cette
   * notification peut vivre sur l'app, elle ne doit pas être rattachée à la
   * page hebdomadaire » — c'est le module de commandes
   * (`.scratch/refonte/issues/12-module-de-commandes.md`).
   *
   * Le champ reste lu pour une seule chose : retrouver la photo d'un conseil
   * (`recoDetail`) dans un payload déjà publié.
   */
  top_recos?: TopReco[] | null;
  reglages?: PayloadReco[] | null;
  tracking?: { running: TrackedAction[]; verified: TrackedAction[] } | null;
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
  brief: string | null;
  suivi: { applique: number; utile: number; ecarte: number };
  todo: { key: string; title: string; platform: string; done: boolean }[];
  recos: PayloadReco[];
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

/** LE GESTE QUI N'A JAMAIS SERVI — ce que le module « À faire » vide peut
 *  encore faire découvrir (`lib/a-faire.ts`, `nudge`). Lu une fois en base,
 *  jamais dans le temps : un conseil d'usage éteint par le premier usage du
 *  geste ne peut pas devenir un décor, un conseil d'usage qui revient chaque
 *  semaine, si. */
export type Decouvertes = {
  /** Vrai dès qu'une Note a été écrite, une seule fois, un jour. */
  note: boolean;
  /** Vrai dès qu'un budget a été posé (`channel_budgets`). */
  budget: boolean;
};

export type WeeklyData = {
  email: string;
  weekLabel: string;
  hasData: boolean;
  kpis: Kpi[];
  channels: ChannelSpend[];
  report: ReportPayload | null;
  /** `weekly_reports.updated_at` — la date de PUBLICATION de ce payload, la
   *  deuxième des trois dates en tête du rapport. `null` tant qu'aucun rapport
   *  n'existe (ou si la colonne n'a pas pu être lue) : on n'écrit alors aucune
   *  date plutôt qu'une date approchée (`CLAUDE.md` §7). */
  publieLe: string | null;
  /** Le Jour de travail du compte regardé (`profiles.fetch_schedule`), en
   *  anglais comme en base. C'est de lui que sort la troisième date. */
  jourDeTravail: string;
  // Dernière réaction par type de conseil (4 semaines) — live, comme le Streamlit.
  // Deux formats de clé cohabitent (TASK-025, voir `feedbackKey`) : la clé
  // COMPOSITE `${reco_key}::${theme}` (précise, une clé-règle générique porte
  // une ligne par thème) et la clé PLATE `reco_key` seul (repli). Lire avec
  // `feedback[feedbackKey(key, theme)] ?? feedback[key] ?? null`.
  feedback: Record<string, string>;
  // Verdicts sur les constats de la vision globale — live (le payload peut dater).
  insightFeedback: Record<string, string>;
  // Commentaires de la semaine courante (pré-remplissage) + objectif du compte.
  // Même double clé que `feedback` ci-dessus.
  comments: Record<string, string>;
  objectif: string | null;
  onboarded: boolean;
  // Liste maîtresse des thèmes (étape « priorités » du parcours de démarrage).
  labels: string[];
  // Clés des conseils actuellement suivis (« ▶ Je le teste » → en cours).
  trackedKeys: string[];
  // L'action produite par un conseil, par clé de conseil — la carte a besoin
  // de l'objet, pas seulement de savoir qu'il existe.
  suivis: Record<string, TrackedAction>;
  // Actions en cours / faites — lues en direct (le bloc du haut s'affiche au clic).
  actions: TrackedAction[];
  // Actions rangées (verdict vu) — l'historique de la section Suivi.
  actionsArchived: TrackedAction[];
  decouvertes: Decouvertes;
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

// LA CLÉ DE LOOKUP « current »/« comment » D'UNE CARTE (TASK-025) — `reco_key`
// seul ne suffit plus : une clé-règle générique (ex. « gaspillage ») porte
// maintenant une ligne PAR THÈME (`reco_feedback_uq2`, migration
// `reco_feedback_contexte.sql`). `""` est le sentinel « pas de thème »
// (réglages compte entier), le même que côté écriture (`actions.ts`).
export function feedbackKey(recoKey: string, theme: string | null): string {
  return `${recoKey}::${theme ?? ""}`;
}

// Lit `reco_feedback` avec repli si la colonne `theme` n'existe pas encore
// (migration `reco_feedback_contexte.sql` pas jouée) — sans repli, AJOUTER
// `theme` à la sélection ferait échouer TOUTE la requête (donc perdre
// `reaction`/`comment` aussi, pas seulement le thème) tant que la migration
// n'est pas passée.
//
// `migrationOk` REMONTE la distinction jusqu'à l'appelant (rejet du checker,
// 3e passe) — sans ça, la clé plate `reco_key` (repli légitime SEULEMENT
// quand la migration est absente) était aussi peuplée quand elle était
// juste ABSENTE POUR CE THÈME PRÉCIS (migration active, mais rien cliqué sur
// CE thème) : un refus sur le thème A s'affichait alors comme actif sur le
// thème B, et le désactiver ne supprimait aucune ligne (aucune n'existe pour
// B) — plus « transféré » comme au 1er rejet, mais « impossible à poser sur
// un 2e thème ». `migrationOk` permet à l'appelant de ne peupler la clé
// plate QUE quand la migration est réellement absente.
async function fetchRecoFeedbackRows(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  cutoff: string
) {
  const withTheme = await supabase
    .from("reco_feedback")
    .select("reco_key, reaction, week_start, comment, theme")
    .eq("user_id", uid)
    .gte("week_start", cutoff)
    .order("week_start", { ascending: false });
  if (!withTheme.error) return { ...withTheme, migrationOk: true as const };
  const sansTheme = await supabase
    .from("reco_feedback")
    .select("reco_key, reaction, week_start, comment")
    .eq("user_id", uid)
    .gte("week_start", cutoff)
    .order("week_start", { ascending: false });
  return { ...sansTheme, migrationOk: false as const };
}

// LE VERDICT SE LIT SUR LA LIGNE, PAS DANS LE PAYLOAD.
//
// Depuis le ticket 17 de la construction, `suivi_actions.verdict` est écrit UNE
// fois, le jour de la chute, et ne se réécrit plus (`ecrire_verdict` filtre
// `verdict IS NULL` côté base) : la colonne est la vérité, le payload n'en est
// qu'une copie. Or `tracking.verified` est bâti sur `suivi_en_cours()`, qui ne
// lit que `status IN ('running','done')` — une action RANGÉE n'y est plus. Lue
// depuis le payload, elle perdait donc son verdict au premier rangement, et
// l'écran écrivait « rangée » là où le bilan du carnet, lui, comptait ce même
// verdict en direct (`lib/carnet.ts`) : deux chiffres qui se contredisent sur
// la même page.
//
// Le payload ne sert plus qu'au triplet `then/now/delta`, qui n'existe QUE la
// semaine de la chute et qu'aucune colonne ne garde.
//
// ON NE RECOPIE PAS UNE VALEUR QU'ON NE SAIT PAS LIRE. Un `verdict` hors des
// trois que le worker écrit ne serait pas une nuance : `etat()` le rabattrait
// silencieusement sur « stable » (`VERDICT[a.verdict] ?? VERDICT.stable`,
// `etat-action.tsx`), donc afficherait un jugement que personne n'a rendu
// (`CLAUDE.md` §7). La colonne porte bien un `CHECK` en base
// (`000_run_me_all.sql` §23) ; ceci est la garde de l'autre bout du fil, là où
// la ligne arrive non typée.
//
// ET AUCUN REPLI SUR LE PAYLOAD, c'est le cœur du correctif. Un verdict que le
// payload porte alors que la colonne est vide, c'est une écriture qui n'a pas
// pris — un refus RLS ne lève rien et touche zéro ligne (`CLAUDE.md` §8) : la
// ligne repassera par la branche de mesure et son verdict sera RECALCULÉ contre
// le KPI du jour au rapport suivant. Le servir remettrait à l'écran le verdict
// qui dérive que le ticket 17 vient de retirer du worker. La ligne reste alors
// « à juger » : un verdict retardé, pas un verdict faux.
function verdictDeLaLigne(valeur: unknown): Verdict | undefined {
  return VERDICTS.includes(valeur as Verdict) ? (valeur as Verdict) : undefined;
}

export async function getWeeklyData(): Promise<WeeklyData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  // On lit ~1 mois : assez pour la fenêtre courante + la précédente.
  const fbCutoff = iso(addDays(new Date(), -28));
  const [metaRes, googleRes, followersRes, reportRes, fbRes, profileRes, ga4Res, postsRes, insightRes, trackRes, noteRes, budgetRes, regroupement] =
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
    fetchRecoFeedbackRows(supabase, uid, fbCutoff),
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
    // Actions décidées (« ▶ Je le teste ») — lues en entier et en direct : le
    // bloc « ce que tu dois faire » s'affiche au clic, sans attendre le worker.
    supabase
      .from("suivi_actions")
      .select("*")
      .eq("user_id", uid)
      .order("decided_at", { ascending: false })
      .limit(60),
    // A-T-IL DÉJÀ ÉCRIT UNE NOTE, UN JOUR ? La lecture des actions juste
    // au-dessus est bornée à 60 lignes et ne peut donc pas répondre : « jamais »
    // ne se déduit pas d'une fenêtre. Une ligne suffit, on ne lit que son id.
    supabase.from("suivi_actions").select("id").eq("user_id", uid).eq("kind", "note").limit(1),
    // A-T-IL DÉJÀ POSÉ UN BUDGET ? Même question, même forme.
    supabase.from("channel_budgets").select("id").eq("user_id", uid).limit(1),
    // LE REGROUPEMENT PAR THÈME, RECALCULÉ EN BASE À CHAQUE AFFICHAGE.
    //
    // C'est la moitié web du ticket 04 : la vue `theme_regroupement` est la
    // seule implémentation de l'arithmétique des thèmes, et Pulse la lit
    // désormais au lieu de relire le total figé dans le payload. Classer une
    // campagne change le bilan de son thème à la lecture suivante — c'est ce
    // qui rend enfin vrai le `revalidatePath("/")` de `setCampaignLabel`, qui
    // était jusqu'ici un no-op documenté comme s'il marchait.
    //
    // DANS LE `Promise.all`, PAS APRÈS. Elle est lue sur la page la plus
    // consultée du produit : la mettre au bout de la file ajouterait son
    // aller-retour à tous les autres, et elle ne dépend d'aucun d'eux.
    lisRegroupement(supabase, uid),
  ]);

  const meta = metaRes.data ?? [];
  const google = googleRes.data ?? [];
  const followers = followersRes.data ?? [];
  // null si la table est absente (migration pas encore passée) ou si le
  // worker n'a pas encore publié pour ce compte — l'écran gère les deux
  // sans distinction, en état vide.
  //
  // CE QUI SE REGROUPE EST RECALCULÉ PAR-DESSUS ; LE RESTE ATTEND LE JOUR DE
  // TRAVAIL. `fusionneRegroupement` ne touche qu'aux totaux de thème
  // (`summary`) et ne recalcule RIEN lui-même — le détail des trois cas, et de
  // ce qui reste intouchable (`jugement`, baselines, Verdicts, repères), est
  // dans `lib/regroupement.ts`.
  const report: ReportPayload | null = fusionneRegroupement(
    (reportRes.data?.[0]?.payload as ReportPayload | undefined) ?? null,
    regroupement
  );
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

  // Les chiffres du verdict (avant → après) sont calculés par le worker : on
  // les rapatrie par id sur les lignes lues en direct. Le VERDICT, lui, se lit
  // sur la ligne (`verdictDeLaLigne`) — voir le commentaire de ce helper.
  const todayIso = iso(new Date());
  const measured = new Map<string, TrackedAction>();
  for (const v of report?.tracking?.verified ?? []) measured.set(String(v.id), v);
  // Le point d'étape vit sur les actions ENCORE en cours : il n'est pas dans
  // `verified`, qui ne contient que ce dont le verdict est tombé.
  const etapes = new Map<string, TrackedAction["etape"]>();
  for (const v of report?.tracking?.running ?? [])
    if (v.etape) etapes.set(String(v.id), v.etape);

  // Les actions prises AVANT que la photo du conseil existe n'ont pas de
  // detail : on le retrouve dans le rapport courant tant que le conseil y est
  // encore (même clé). Mieux qu'un titre orphelin.
  const recoDetail = new Map<string, TrackedAction["detail"]>();
  const collecte = (x?: PayloadReco | null) => {
    if (x?.key && !recoDetail.has(x.key))
      recoDetail.set(x.key, {
        observation: x.observation,
        pourquoi: x.pourquoi,
        verifier: x.verifier,
        effort: x.effort ?? null,
      });
  };
  for (const tf of report?.themes_focus ?? []) for (const x of tf.recos) collecte(x);
  for (const x of report?.reglages ?? []) collecte(x);
  for (const x of report?.top_recos ?? []) collecte(x);
  for (const x of report?.recos ?? []) collecte(x);

  const allActions: TrackedAction[] = (trackRes.data ?? []).map((r: any) => {
    const status = String(r.status ?? "running") as TrackedAction["status"];
    const check = String(r.check_at ?? "").slice(0, 10);
    const m = measured.get(String(r.id));
    return {
      id: String(r.id),
      reco_key: String(r.reco_key ?? ""),
      kind: r.kind === "note" ? "note" : "action",
      title: String(r.title ?? ""),
      theme: (r.theme as string | null) ?? null,
      metric_label: (r.metric_label as string | null) ?? null,
      decided_at: String(r.decided_at ?? "").slice(0, 10),
      check_at: check,
      done_at: r.done_at ? String(r.done_at).slice(0, 10) : null,
      status,
      // Lu UNIQUEMENT depuis la ligne elle-même — jamais depuis le repli
      // `recoDetail` (la photo d'un conseil du rapport courant, qui ne sait
      // pas qui a créé la ligne de suivi). Absent avant que le worker n'ait
      // commencé à l'écrire (migration §11 déjà en place, mais rapports
      // publiés avant cette tâche) : ces lignes-là n'ont simplement pas
      // d'origine connue, traitées comme manuelles par défaut — c'était déjà
      // leur seul comportement possible.
      origin: r.detail && typeof r.detail === "object" && r.detail.origin === "auto"
        ? "auto"
        : undefined,
      // `"auto"` (l'hypothèse auto-suivie) reçoit son verdict à l'échéance
      // exactement comme `"done"` — sans jamais dépendre d'un clic client.
      due: (status === "done" || status === "auto") && check !== "" && check <= todayIso,
      detail:
        (r.detail as TrackedAction["detail"]) ??
        recoDetail.get(String(r.reco_key ?? "")) ??
        null,
      etape: etapes.get(String(r.id)) ?? null,
      then: m?.then,
      now: m?.now,
      delta: m?.delta ?? null,
      verdict: verdictDeLaLigne(r.verdict),
    };
  });
  const vivantes = (st?: string) => st !== "archived" && st !== "dropped";
  const actions = allActions.filter((a) => vivantes(a.status));
  const actionsArchived = allActions.filter((a) => !vivantes(a.status));
  // L'ACTION QU'UN CONSEIL A PRODUITE, indexée par sa clé.
  //
  // La carte du conseil ne recevait qu'un booléen « déjà pris ». Il lui faut
  // désormais l'objet : son `id` (pour la résoudre), son état, son échéance. Bâti
  // sur les VIVANTES seulement — une action rangée ne re-verrouille pas son
  // conseil, il peut être repris. `trackRes` est trié `decided_at` décroissant,
  // donc la première vue est la plus récente.
  const suivis: Record<string, TrackedAction> = {};
  for (const a of actions)
    if (a.kind !== "note" && a.reco_key && !(a.reco_key in suivis)) suivis[a.reco_key] = a;
  // Un conseil reste « en test » tant que son action n'est pas rangée.
  const trackedKeys: string[] = Object.keys(suivis);

  // Dernière réaction par clé (tri desc → première vue = la plus récente),
  // même logique que fetch_reco_feedback côté Python. Clé COMPOSITE
  // (`feedbackKey`, précise — une clé-règle générique comme « gaspillage »
  // porte une ligne par thème) TOUJOURS peuplée. La clé PLATE (`reco_key`
  // seul, ancien comportement compte-entier) n'est peuplée QUE si
  // `!fbRes.migrationOk` (rejet du checker, 3e passe) : sinon, dès que la
  // migration est active, l'ABSENCE de ligne pour CE thème précis (rien
  // cliqué ici) se voyait recouverte par la clé plate d'un AUTRE thème —
  // un refus sur A s'affichait comme actif sur B, et le désactiver sur B ne
  // supprimait aucune ligne (aucune n'existe pour B). La clé plate ne doit
  // servir de repli QUE quand la migration est réellement absente.
  const feedback: Record<string, string> = {};
  for (const row of fbRes.data ?? []) {
    if (!row.reco_key || !row.reaction) continue;
    const composite = feedbackKey(row.reco_key, (row as { theme?: string | null }).theme ?? null);
    if (!(composite in feedback)) feedback[composite] = row.reaction;
    if (!fbRes.migrationOk && !(row.reco_key in feedback)) feedback[row.reco_key] = row.reaction;
  }

  // Commentaires de la semaine courante (lundi) — pré-remplissent les cartes.
  // Même règle de clé (composite toujours, plate seulement si `!migrationOk`)
  // que `feedback` ci-dessus.
  const nowLocal = new Date();
  const mondayLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
  mondayLocal.setDate(mondayLocal.getDate() - ((mondayLocal.getDay() + 6) % 7));
  const p2 = (n: number) => String(n).padStart(2, "0");
  const mondayIso = `${mondayLocal.getFullYear()}-${p2(mondayLocal.getMonth() + 1)}-${p2(mondayLocal.getDate())}`;
  const comments: Record<string, string> = {};
  for (const row of fbRes.data ?? []) {
    if (!row.reco_key || !row.comment || String(row.week_start).slice(0, 10) !== mondayIso) continue;
    const composite = feedbackKey(row.reco_key, (row as { theme?: string | null }).theme ?? null);
    if (!(composite in comments)) comments[composite] = row.comment;
    if (!fbRes.migrationOk && !(row.reco_key in comments)) comments[row.reco_key] = row.comment;
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
    email: compte.email,
    weekLabel: `${fmtDay(curSince)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · 7 jours pleins`,
    hasData,
    kpis,
    channels,
    report,
    publieLe,
    jourDeTravail,
    feedback,
    insightFeedback,
    comments,
    objectif,
    onboarded,
    labels,
    trackedKeys,
    suivis,
    actions,
    actionsArchived,
    // UNE ERREUR VAUT « DÉJÀ FAIT », jamais « jamais fait » : si la colonne
    // `kind` ou la table manquent (migration pas passée), on ne pousse pas vers
    // un geste dont on ne sait pas s'il est possible. Un conseil d'usage de trop
    // se paie plus cher qu'un conseil d'usage manquant — il devient un décor.
    decouvertes: {
      note: Boolean(noteRes.error) || (noteRes.data ?? []).length > 0,
      budget: Boolean(budgetRes.error) || (budgetRes.data ?? []).length > 0,
    },
  };
}
