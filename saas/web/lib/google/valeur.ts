// ── LA RÈGLE « SANS VALEUR » : LA VALEUR DE CONVERSION SE MONTRE-T-ELLE ? ────
//
// Spec `.scratch/google-ads/spec.md`, § « Les conversions et leur valeur » ;
// décision de David du 2026-11-10 (carte, issue 13). Harnais :
// `.scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/`.
//
// Google rend une valeur de conversion même quand le compte n'en déclare
// aucune : une action dont la valeur est imposée à 1 rend « 1 × le nombre de
// conversions » (chez A, 8 actions principales sur 13). Afficher ce total en
// francs ferait lire un comptage comme un chiffre d'affaires (`CLAUDE.md` §7).
//
// Pulse ne RECOMPOSE jamais la valeur : il décide seulement s'il montre celle
// de Google (`metrics.conversions_value`), et ce qu'il en dit.
//
// Module pur, sans directive ni import, comme `lecture.ts` qui l'appelle.

export type ActionConversion = {
  id: string;
  nom: string;
  /** `value_settings.always_use_default_value` ; `null` = non lu. */
  toujoursDefaut: boolean | null;
  /** `value_settings.default_value` ; `null` = non lu. */
  valeurDefaut: number | null;
};

/** Une ligne de `google_ads_conversions_by_action`. */
export type ConversionsParAction = {
  date: string;
  campagneId: string;
  actionId: string;
  conversions: number | null;
};

/** Ce que la page lit pour tenir la règle. Absente = rien n'a été lu. */
export type Repartition = { actions: ActionConversion[]; parAction: ConversionsParAction[] };

export const RAISON_SANS_VALEUR = "aucune valeur de conversion déclarée dans Google Ads";
export const RAISON_NON_LUE = "Pulse n'a pas encore lu les réglages de valeur des actions qui ont converti";

const AVERTISSEMENT_COMPTAGE =
  "Une partie des conversions vient d'actions sans valeur déclarée (valeur imposée à 0 ou 1 dans Google Ads) : dans ce total, cette partie n'est qu'un comptage, pas un montant.";
const AVERTISSEMENT_NON_LU =
  "Pulse n'a pas lu les réglages de valeur d'une partie des conversions : cette partie peut n'être qu'un comptage.";

/** Décision de David (issue 13, point 1) : une valeur imposée de 0 ou 1 par
 *  conversion ne mesure rien. Une valeur imposée à un autre montant est une
 *  valeur fixe choisie par l'annonceur — une vraie valeur. Un réglage non lu
 *  n'est rangé nulle part ici : `verdictValeur` le traite à part. */
export function sansValeur(a: ActionConversion): boolean {
  return a.toujoursDefaut === true && (a.valeurDefaut === 0 || a.valeurDefaut === 1);
}

function reglagesLus(a: ActionConversion | undefined): a is ActionConversion {
  return !!a && a.toujoursDefaut !== null && (a.toujoursDefaut === false || a.valeurDefaut !== null);
}

export type Verdict = { affichee: true; avertissement: string | null } | { affichee: false; raison: string };

/** `google_ads_insights.conversions` est `numeric(12, 2)` : chaque ligne y est
 *  arrondie d'au plus 0,005, la répartition par action ne l'est pas. Un écart
 *  sous ce cumul n'est pas un reste. */
const ARRONDI_PAR_LIGNE = 0.005;
const EPSILON = 1e-9;

/**
 * La valeur de Google se montre-t-elle sur cette sélection (période × campagne) ?
 *
 * `conversions` et `lignesConverties` viennent de `google_ads_insights` sur la
 * sélection ; `parAction`, de la répartition DÉJÀ filtrée sur la même
 * sélection. La part de `conversions` que la répartition n'explique pas
 * (répartition pas encore récoltée, ligne sans action lisible) compte comme
 * une action aux réglages non lus : on ne conclut pas sur ce qu'on n'a pas vu.
 */
export function verdictValeur(
  selection: { conversions: number; lignesConverties: number; parAction: ConversionsParAction[] },
  actions: ActionConversion[]
): Verdict {
  if (selection.conversions === 0) return { affichee: true, avertissement: null };
  const parId = new Map(actions.map((a) => [a.id, a]));
  let comptage = false;
  let vraie = false;
  let nonLue = false;
  let reparti = 0;
  for (const l of selection.parAction) {
    const n = l.conversions ?? 0;
    if (n === 0) continue;
    reparti += n;
    const a = parId.get(l.actionId);
    if (!reglagesLus(a)) nonLue = true;
    else if (sansValeur(a)) comptage = true;
    else vraie = true;
  }
  if (selection.conversions - reparti > selection.lignesConverties * ARRONDI_PAR_LIGNE + EPSILON) nonLue = true;

  if (!vraie) return { affichee: false, raison: nonLue ? RAISON_NON_LUE : RAISON_SANS_VALEUR };
  const avertissements = [comptage && AVERTISSEMENT_COMPTAGE, nonLue && AVERTISSEMENT_NON_LU].filter(Boolean);
  return { affichee: true, avertissement: avertissements.length ? `Total déclaré par Google. ${avertissements.join(" ")}` : null };
}
