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
// `weekly_reports.payload.sources.instagram.etat` — figée au dernier rapport —
// et `fetch_progress` (liste 15.1, lisible par l'invité). On lit la seconde
// pour la CAUSE : son mot de fin dit « jeton Meta à reconnecter ». Elle n'est
// écrite que par le passage COMPLET du Jour de travail : le léger quotidien
// n'y touche pas, exprès (`account_sync.leger` — une ligne de plus ferait
// oublier l'échec Meta au rapport). Le constat arrive donc au Jour de travail.
//
// LA RECONNEXION, ELLE, SE VOIT TOUS LES JOURS : le léger écrit un relevé de
// post (`releve_a`) et la ligne du compte (`instagram_compte_jours.maj_a`)
// chaque matin, et ne le peut qu'avec un jeton vivant. L'un ou l'autre PLUS
// RÉCENT que la ligne `fetch_progress` dit que le jeton revit : l'encart se
// tait, sans attendre le Jour de travail suivant (revue de code).

/** La ligne `fetch_progress` du canal `instagram` (une par canal : clé
 *  `(user_id, canal)`, réécrite à chaque passage complet). `maj_a` absent ou
 *  illisible : rien ne permet de dire qu'une reconnexion l'a suivie. */
export type LigneProgres = { etat: string; mot_de_fin: string | null; maj_a?: string | null };

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

function plusRecent(instant: string | null | undefined, que: number): boolean {
  return !!instant && Number.isFinite(Date.parse(instant)) && Date.parse(instant) > que;
}

/** Un relevé de post ou une ligne du compte écrits APRÈS le constat du jeton
 *  mort : le léger a lu, le jeton revit. */
function reconnecte(e: EntreeEtat): boolean {
  const constat = Date.parse(e.progres?.maj_a ?? "");
  if (!Number.isFinite(constat)) return false;
  return plusRecent(e.compteMajA, constat) || e.posts.some((p) => plusRecent(p.releveA, constat));
}

/** `compteMajA` : le `maj_a` le plus récent d'`instagram_compte_jours`. */
type EntreeEtat = { posts: { releveA: string | null }[]; progres: LigneProgres | null; compteMajA?: string | null };

export function etatDeLaPage(e: EntreeEtat): EtatPage {
  if (jetonMort(e.progres) && !reconnecte(e)) return { etat: "jeton_mort", figeAu: figeAuDe(e.posts) };
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
