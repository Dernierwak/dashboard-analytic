import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// LE BUDGET PLANIFIÉ — ce qui a été POSÉ dans les campagnes, par opposition à
// ce qui a été DÉPENSÉ.
//
// Deux natures de nombre qu'on n'a jamais eues côte à côte :
//   · dépensé  → `meta_ads_insights` / `google_ads_insights`, du réel constaté ;
//   · planifié → le budget réglé sur la campagne elle-même, une PROMESSE.
//
// Meta pose soit un `daily_budget`, soit un `lifetime_budget` sur la campagne
// (ou sur ses ad sets quand la campagne est en budget CBO désactivé). Google
// pose un `campaign_budget.amount_micros` journalier, parfois un
// `total_amount_micros` pour toute la durée. D'où la règle de conversion, la
// même des deux côtés :
//
//   budget planifié sur [du, au] =
//     · budget TOTAL  → la part de la campagne qui tombe dans la fenêtre,
//       au prorata des jours ;
//     · budget JOURNALIER → journalier × nombre de jours de la campagne
//       compris dans la fenêtre.
//
// AUCUN HISTORIQUE N'EST RECONSTITUABLE. Ni Meta ni Google ne donnent le budget
// tel qu'il était il y a trois mois : on ne connaît que sa valeur au moment du
// relevé. La table est donc une suite de PHOTOS hebdomadaires, et tout ce qui
// précède le premier relevé est inconnu — ce que `vide` et `releveLe` disent à
// l'écran plutôt que d'afficher un zéro qui ressemble à « rien de prévu ».

export type BudgetPlanifie = {
  /** Budget posé sur la période, par canal. */
  parCanal: Record<"meta" | "google", number>;
  /** Budget posé sur la période, par thème (clé = label). */
  parTheme: Record<string, number>;
  /** Ce qui n'est rattaché à aucun thème. */
  horsTheme: number;
  total: number;
  /** Aucun relevé en base : le worker n'a pas encore tourné depuis la bascule. */
  vide: boolean;
  /** Date du relevé utilisé (le plus récent qui couvre la fenêtre). */
  releveLe: string | null;
};

export const BUDGET_PLANIFIE_VIDE: BudgetPlanifie = {
  parCanal: { meta: 0, google: 0 },
  parTheme: {},
  horsTheme: 0,
  total: 0,
  vide: true,
  releveLe: null,
};

// Dates en heure LOCALE — même raison que dans `lib/couts.ts` :
// `new Date("2026-08-12")` est lu en UTC et recule d'un jour à l'ouest de
// Greenwich, ce qui décalerait le prorata d'une journée entière.
function dParse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Nombre de jours du segment [from, to], bornes COMPRISES. */
function dJours(from: string, to: string): number {
  return Math.round((dParse(to).getTime() - dParse(from).getTime()) / 86_400_000) + 1;
}

// PostgREST plafonne chaque requête à 1000 lignes. Un compte d'agence à 400
// campagnes × deux canaux dépasse ce plafond en trois relevés — et la troncature
// est SILENCIEUSE : le budget planifié se mettrait à baisser sans raison.
//
// L'erreur est LEVÉE, pas ignorée : le client PostgREST ne jette jamais, il
// renvoie `{data, error}`. Un `try/catch` posé autour ne rattraperait donc
// rien, et une table absente passerait pour une table vide.
async function fetchAllRows<T>(
  build: () => {
    range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
  }
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < page) return out;
  }
}

const CANAUX = ["meta", "google"] as const;
type Canal = (typeof CANAUX)[number];

type LigneBudget = {
  channel: string | null;
  campaign_id: string | number | null;
  campaign_name: string | null;
  daily_budget: number | string | null;
  total_budget: number | string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
};

// Une campagne SUPPRIMÉE reste dans la réponse de Google (`FROM campaign` sans
// filtre les renvoie toutes) et garde son budget d'origine. La compter serait
// promettre de l'argent sur une campagne qui n'existe plus.
const MORTES = new Set(["REMOVED", "DELETED", "ARCHIVED"]);

/** Ce qu'une campagne pèse sur la fenêtre, en CHF. 0 si elle n'y est pas. */
function montantSurFenetre(l: LigneBudget, from: string, to: string): number {
  const debutDeclare = l.start_date ? String(l.start_date).slice(0, 10) : null;
  const finDeclaree = l.end_date ? String(l.end_date).slice(0, 10) : null;

  // Une campagne sans date de début est réputée courir depuis le début de la
  // fenêtre, et une campagne sans date de fin jusqu'à sa borne droite —
  // « sans fin déclarée » ne veut pas dire « jamais diffusée ».
  const debut = debutDeclare ?? from;
  const fin = finDeclaree ?? to;
  if (fin < from || debut > to) return 0;

  const dedansDebut = debut > from ? debut : from;
  const dedansFin = fin < to ? fin : to;
  const jours = dJours(dedansDebut, dedansFin);
  if (jours <= 0) return 0;

  const total = l.total_budget === null ? null : Number(l.total_budget);
  if (total !== null && Number.isFinite(total) && total > 0) {
    // UN BUDGET TOTAL SANS SES DEUX DATES N'EST PAS PRORATISABLE. Les bornes
    // par défaut ci-dessus sont celles de la FENÊTRE : les appliquer ici
    // donnerait `duree === jours`, donc l'enveloppe entière — une campagne de
    // 12 000 CHF s'afficherait en entier sur une semaine, exactement ce que le
    // prorata existe pour éviter. En pratique les deux plateformes imposent
    // les dates avec un budget total ; si l'une manque, on préfère ne rien
    // compter plutôt qu'inventer une durée.
    if (!debutDeclare || !finDeclaree) return 0;
    const duree = Math.max(1, dJours(debutDeclare, finDeclaree));
    return (total * jours) / duree;
  }

  const jour = l.daily_budget === null ? null : Number(l.daily_budget);
  if (jour !== null && Number.isFinite(jour) && jour > 0) return jour * jours;
  return 0;
}

/**
 * Le budget planifié sur une fenêtre, ventilé par canal et par thème.
 *
 * Lit `platform_budgets` (relevés hebdomadaires) et les deux tables de config
 * de campagnes pour rattacher chaque campagne à son thème. Renvoie
 * `BUDGET_PLANIFIE_VIDE` tant qu'aucun relevé n'existe — jamais une exception :
 * la page Coûts doit s'afficher entièrement même sans un seul relevé.
 */
export async function getBudgetPlanifie(
  from: string,
  to: string
): Promise<BudgetPlanifie> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  // LE RELEVÉ EST CHOISI PAR CANAL, et c'est tout sauf un détail. Un relevé
  // unique pour les deux ferait OSCILLER le budget planifié : le jour où le
  // jeton Google expire, seul Meta est photographié, et la date du jour ne
  // contient que Meta — la page annoncerait un budget effondré, puis doublé la
  // semaine suivante, sans que rien n'ait bougé chez le client.
  const releves: Partial<Record<Canal, string>> = {};
  try {
    const res = await Promise.all(
      CANAUX.map((c) =>
        supabase
          .from("platform_budgets")
          .select("captured_on")
          .eq("user_id", uid)
          .eq("channel", c)
          .lte("captured_on", to)
          .order("captured_on", { ascending: false })
          .limit(1)
      )
    );
    res.forEach(({ data, error }, i) => {
      if (error) throw error;
      const d = (data?.[0]?.captured_on as string | undefined)?.slice(0, 10);
      if (d) releves[CANAUX[i]] = d;
    });
  } catch {
    return BUDGET_PLANIFIE_VIDE; // table absente (migration pas passée)
  }

  const retenus = CANAUX.filter((c) => releves[c]);
  if (retenus.length === 0) return BUDGET_PLANIFIE_VIDE;

  // La date affichée est la PLUS ANCIENNE des deux : c'est à partir d'elle que
  // l'ensemble du chiffre est vrai. Un canal peut manquer — un budget partiel
  // vaut mieux que rien, à condition d'être daté honnêtement.
  const releveLe = retenus.map((c) => releves[c]!).sort()[0];

  let lignes: LigneBudget[] = [];
  let metaCfg: { campaign_name: string | null; label: string | null }[] = [];
  let googCfg: { campaign_id: string | number | null; label: string | null }[] = [];
  try {
    const [parCanalLignes, m, g] = await Promise.all([
      Promise.all(
        retenus.map((c) =>
          fetchAllRows<LigneBudget>(() =>
            supabase
              .from("platform_budgets")
              .select(
                "channel, campaign_id, campaign_name, daily_budget, total_budget, start_date, end_date, status"
              )
              .eq("user_id", uid)
              .eq("channel", c)
              .eq("captured_on", releves[c]!)
          )
        )
      ),
      supabase.from("meta_campaign_config").select("campaign_name, label").eq("user_id", uid),
      supabase.from("google_campaign_config").select("campaign_id, label").eq("user_id", uid),
    ]);
    if (m.error) throw m.error;
    if (g.error) throw g.error;
    lignes = parCanalLignes.flat();
    metaCfg = m.data ?? [];
    googCfg = g.data ?? [];
  } catch {
    return BUDGET_PLANIFIE_VIDE;
  }
  if (lignes.length === 0) return BUDGET_PLANIFIE_VIDE;

  // Meta se rattache par NOM de campagne, Google par IDENTIFIANT — c'est la clé
  // que chaque table de config utilise, et les mélanger perdrait tous les thèmes.
  const metaLbl = new Map(metaCfg.map((c) => [String(c.campaign_name), c.label]));
  const googLbl = new Map(googCfg.map((c) => [String(c.campaign_id), c.label]));

  const parCanal: Record<Canal, number> = { meta: 0, google: 0 };
  const parTheme: Record<string, number> = {};
  let horsTheme = 0;
  let total = 0;

  for (const l of lignes) {
    const canal = l.channel === "google" ? "google" : l.channel === "meta" ? "meta" : null;
    if (!canal) continue;
    if (l.status && MORTES.has(String(l.status).toUpperCase())) continue;

    const chf = montantSurFenetre(l, from, to);
    if (chf <= 0) continue;

    parCanal[canal] += chf;
    total += chf;

    const theme =
      canal === "meta"
        ? metaLbl.get(String(l.campaign_name)) ?? null
        : googLbl.get(String(l.campaign_id)) ?? null;
    if (theme) parTheme[theme] = (parTheme[theme] ?? 0) + chf;
    else horsTheme += chf;
  }

  return { parCanal, parTheme, horsTheme, total, vide: false, releveLe };
}
