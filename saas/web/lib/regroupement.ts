// LE TOTAL D'UN THÈME SE LIT EN BASE, IL NE SE CALCULE PLUS NULLE PART.
//
// Un Thème ne produit aucune donnée : il change PAR QUOI des chiffres déjà en
// base sont additionnés (`CONTEXT.md`, « Regroupement »). Son total se
// recalcule donc à la lecture, tout de suite, sur tout l'historique — semaines
// passées comprises. La vue `theme_regroupement`
// (`supabase/migrations/theme_regroupement.sql`) est la SEULE implémentation de
// cette arithmétique : Python la lit depuis `fetch_theme_regroupement`
// (`saas/commun/fetch_data.py`), ce fichier la lit pour Pulse. Deux
// implémentations dans deux langages auraient donné deux jeux de seuils qui
// dérivent — le défaut à trois moteurs mesuré par le ticket 11 de la refonte.
//
// CE FICHIER NE CALCULE RIEN, ET C'EST SON UNIQUE RAISON D'ÊTRE. Il lit, il
// indexe, il recopie. La moindre somme écrite ici serait la seconde
// implémentation que la vue existe pour supprimer, et elle dériverait en
// silence — parce qu'un calcul qui marche ne se remarque pas.
//
// CE QU'IL NE TOUCHE PAS. `jugement`, les baselines des actions, les Verdicts
// et les repères de courbe sont des MESURES PRISES : elles jugeaient un geste
// sur le périmètre qui existait ce jour-là, et elles ne rétroagissent jamais
// (`.scratch/refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md`).
// `summary.spend_week`, `best_campaign` et `n_campaigns` restent eux aussi au
// payload : la vue est au grain du THÈME sur tout l'historique, elle ne sait
// rien dire d'une semaine ni d'une campagne nommée.
import type { createClient } from "@/lib/supabase/server";
import type { ReportPayload, ThemeFocus } from "@/lib/report";

/** Une ligne de la vue, telle qu'elle sort — aucun champ recalculé.
 *  Les colonnes portent les noms du SQL, exprès : c'est ce qui rend la
 *  comparaison avec la vue lisible sans traduction mentale. */
export type LigneRegroupement = {
  label: string;
  spend: number;
  ctr: number | null;
  posts: number;
  reach_avg: number | null;
  eng_avg: number | null;
  /** `null` = Google Analytics ne rattache rien à ce compte. JAMAIS 0, qui
   *  affirmerait « ce thème n'a rien rapporté » (`CLAUDE.md` §7). */
  revenue: number | null;
  /** Assez de dépense pour qu'on se prononce (≥ 100 CHF). Le seuil vit dans la
   *  vue, pas ici : un seuil recopié est un seuil qui dérive. */
  juge: boolean;
  /** DÉJÀ FILTRÉ PAR `juge` côté SQL — un appelant ne peut pas afficher un
   *  ROAS calculé sur 12 CHF en croyant lire un chiffre solide. */
  roas: number | null;
};

/**
 * CE QUE LA VUE A RÉPONDU, Y COMPRIS QUAND ELLE N'A PAS RÉPONDU.
 *
 * `lu: false` ne veut pas dire « ce compte n'a aucun thème » — il veut dire
 * « on ne sait pas », et les deux se traitent à l'opposé. La distinction
 * remonte jusqu'à `fusionneRegroupement`, qui ne rafraîchit alors RIEN plutôt
 * que d'effacer des chiffres qu'il ne peut pas remplacer.
 */
export type Regroupement = {
  lu: boolean;
  /** Indexé par label normalisé (`trim().toLowerCase()`), la même clé que
   *  `_nrm` côté worker (`build_report.py`) : deux orthographes d'un même thème
   *  ne doivent pas se rater entre le payload et la vue. */
  lignes: Map<string, LigneRegroupement>;
};

/** « On ne sait pas ». Une FONCTION, pas une constante partagée : un `Map`
 *  module-level vivrait d'une requête à l'autre sur le même serveur, et un
 *  appelant qui y écrirait un jour contaminerait le compte suivant. */
function riensu(): Regroupement {
  return { lu: false, lignes: new Map() };
}

export function cleTheme(label: string | null | undefined): string {
  return String(label ?? "").trim().toLowerCase();
}

function nombre(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nombreOuRien(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * LE TOTAL DE CHAQUE THÈME DE CE COMPTE, LU À CET INSTANT.
 *
 * PAGINÉE, ET ORDONNÉE AVANT DE L'ÊTRE. PostgREST plafonne chaque requête à
 * 1 000 lignes et tronque en silence (`CLAUDE.md` §8) ; sans ordre stable, deux
 * pages successives peuvent répéter ou sauter des lignes. Un compte n'a pas
 * mille thèmes aujourd'hui — la pagination coûte six lignes et évite d'avoir à
 * le revérifier le jour où il en aura.
 *
 * LE FILTRE `user_id` N'EST PAS DÉCORATIF, MÊME AVEC `security_invoker`. La vue
 * lit avec les droits de l'appelant, donc la RLS lui ouvre TOUS les comptes que
 * `a_acces()` lui accorde — et un Membre invité en a souvent plusieurs. Sans ce
 * filtre, Pulse additionnerait les thèmes de deux clients sur la page d'un
 * seul. C'est `getCompteActif().uid` qu'il faut passer, jamais l'identité du
 * lecteur : un invité lit les chiffres du compte qu'il REGARDE.
 *
 * UNE PANNE NE VIDE RIEN. Le client PostgREST ne jette pas, il rend
 * `{data, error}` : une vue absente (migration non jouée) se lirait comme un
 * compte sans aucun thème si on avalait l'erreur. On rend `lu: false`, et
 * l'appelant garde ce que le payload disait.
 */
export async function lisRegroupement(
  supabase: ReturnType<typeof createClient>,
  uid: string
): Promise<Regroupement> {
  const PAGE = 1000;
  const lignes = new Map<string, LigneRegroupement>();
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase
      .from("theme_regroupement")
      .select("label, spend, ctr, posts, reach_avg, eng_avg, revenue, juge, roas")
      .eq("user_id", uid)
      .order("label")
      .range(debut, debut + PAGE - 1);
    if (error) return riensu();
    const page = (data ?? []) as Record<string, unknown>[];
    for (const r of page) {
      const label = String(r.label ?? "");
      if (!label) continue;
      lignes.set(cleTheme(label), {
        label,
        spend: nombre(r.spend),
        ctr: nombreOuRien(r.ctr),
        posts: nombre(r.posts),
        reach_avg: nombreOuRien(r.reach_avg),
        eng_avg: nombreOuRien(r.eng_avg),
        revenue: nombreOuRien(r.revenue),
        juge: Boolean(r.juge),
        roas: nombreOuRien(r.roas),
      });
    }
    if (page.length < PAGE) return { lu: true, lignes };
  }
}

/**
 * LE PAYLOAD FIGÉ, AVEC LE REGROUPEMENT D'AUJOURD'HUI PAR-DESSUS.
 *
 * Trois cas, et ils ne se ressemblent pas :
 *
 *   1. LA VUE A RÉPONDU POUR CE THÈME → ses chiffres remplacent ceux du
 *      payload. C'est tout l'objet du ticket : classer une campagne change le
 *      bilan du thème à la lecture suivante, sans attendre le Jour de travail.
 *
 *   2. LA VUE A RÉPONDU, MAIS PAS POUR CE THÈME → plus rien n'est regroupé
 *      dessous aujourd'hui (ses campagnes ont perdu leur étiquette, ses
 *      publications aussi). Ses chiffres passent à `null`, c'est-à-dire
 *      « inconnu » : réafficher ceux d'avant montrerait un total que la vue ne
 *      confirme plus, et afficher 0 affirmerait qu'il n'a rien dépensé — les
 *      deux sont interdits par `CLAUDE.md` §7.
 *
 *   3. LA VUE N'A PAS RÉPONDU DU TOUT (`lu: false`) → on ne rafraîchit RIEN.
 *      Le payload reste tel qu'il a été publié, et la page dit déjà quand il
 *      l'a été (« publié le X »). Effacer des chiffres parce qu'une migration
 *      manque punirait le lecteur pour un défaut d'exploitation.
 *
 * LE REVENU NE CONNAÎT PAS LE CAS 3. Il vient de la vue ou de nulle part : le
 * `revenuTheme()` qui prenait « le max de deux sources » pouvait afficher un
 * revenu de la fenêtre du rapport (`themes.rows[].rev`) sous un bilan calculé
 * sur tout l'historique — deux périmètres, un seul chiffre, et le plus flatteur
 * des deux. Il est mort avec ce ticket.
 */
export function fusionneRegroupement(
  report: ReportPayload | null,
  regroupement: Regroupement
): ReportPayload | null {
  if (!report) return report;
  if (!regroupement.lu) return report;
  const focus = report.themes_focus;
  if (!focus || focus.length === 0) return report;
  const rafraichis: ThemeFocus[] = focus.map((t) => {
    const ligne = regroupement.lignes.get(cleTheme(t.label));
    return {
      ...t,
      summary: {
        ...t.summary,
        spend: ligne ? ligne.spend : null,
        revenue: ligne ? ligne.revenue : null,
        roas: ligne ? ligne.roas : null,
        ctr: ligne ? ligne.ctr : null,
        posts: ligne ? ligne.posts : null,
        reach_avg: ligne ? ligne.reach_avg : null,
        eng_avg: ligne ? ligne.eng_avg : null,
        juge: ligne ? ligne.juge : null,
      },
    };
  });
  return { ...report, themes_focus: rafraichis };
}
