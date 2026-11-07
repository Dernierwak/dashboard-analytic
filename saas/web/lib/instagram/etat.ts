// Sans directive, comme `lecture.ts` (`CLAUDE.md` §8) ; harnais du ticket 15.
import { jourLong } from "./annee";

// ── LES ÉTATS DE LA PAGE ─────────────────────────────────────────────────────
//
// Spec, § La page — Les états de la page : compte neuf (un seul encart), jeton
// mort (grand encart en tête, page grisée), compte gratuit (AUCUN état à part :
// même page, mêmes règles, le minimum de 6 par format fait le tri).
//
// D'OÙ VIENT « JETON MORT ». Pas de `connected_accounts` : un Membre invité ne
// le lit pas (RLS fermée exprès, `CLAUDE.md` §7), et la page doit être la même
// pour lui (spec, user story 5). Deux sources partagées existaient :
// `weekly_reports.payload.sources.instagram.etat` — figée au dernier rapport,
// donc jusqu'à une semaine de retard dans les deux sens — et `fetch_progress`,
// réécrite à chaque passage, le léger quotidien compris (liste 15.1, lisible
// par l'invité). On lit la seconde : le jour où le jeton meurt, la page le dit
// le lendemain matin, pas au Jour de travail suivant.

/** La ligne `fetch_progress` du canal `instagram` (une par canal : clé
 *  `(user_id, canal)`, réécrite à chaque passage). */
export type LigneProgres = { etat: string; mot_de_fin: string | null };

export type EtatPage =
  | { etat: "normale" }
  /** `motDuWorker` : le dernier passage a SAUTÉ Instagram pour une autre
   *  raison (pas de compte Business lié, pas de connexion Meta) — l'encart le
   *  rapporte tel quel, plutôt que de promettre un passage qui ne lira rien. */
  | { etat: "neuf"; motDuWorker: string | null }
  /** `figeAu` : le jour (`AAAA-MM-JJ`) du relevé le plus récent ; `null` si
   *  aucun post n'a de relevé daté (section 23 pas jouée) — pas de date. */
  | { etat: "jeton_mort"; figeAu: string | null };

// Le mot que le plan écrit quand le jeton Meta est mort :
// `orchestration/execution_plan.py:_a_reconnecter("meta", …)` →
// « jeton Meta à reconnecter — <raison> → Comptes → Connexions », en état
// `saute`. Un même jeton sert Meta Ads et Instagram : mort, il saute les deux.
const MOT_JETON_MORT = "jeton Meta à reconnecter";

function jetonMort(p: LigneProgres | null): boolean {
  return p?.etat === "saute" && (p.mot_de_fin ?? "").startsWith(MOT_JETON_MORT);
}

function figeAuDe(posts: { releveA: string | null }[]): string | null {
  let max: string | null = null;
  for (const { releveA } of posts) {
    if (releveA && Number.isFinite(Date.parse(releveA)) && (max === null || Date.parse(releveA) > Date.parse(max))) max = releveA;
  }
  return max ? new Date(max).toISOString().slice(0, 10) : null;
}

export function etatDeLaPage(e: { posts: { releveA: string | null }[]; progres: LigneProgres | null }): EtatPage {
  if (jetonMort(e.progres)) return { etat: "jeton_mort", figeAu: figeAuDe(e.posts) };
  // Neuf = rien en base ET aucun passage fini : un passage fini qui n'a rien
  // trouvé n'est pas un compte qui attend le worker, c'est un compte sans post.
  if (e.posts.length === 0 && e.progres?.etat !== "fini") {
    return { etat: "neuf", motDuWorker: e.progres?.etat === "saute" ? e.progres.mot_de_fin : null };
  }
  return { etat: "normale" };
}

export function texteFigeAu(figeAu: string | null): string {
  return figeAu ? `Tes chiffres Instagram sont figés au ${jourLong(figeAu, true)}` : "Tes chiffres Instagram ne se mettent plus à jour";
}
