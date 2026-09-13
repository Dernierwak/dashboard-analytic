// ── GITHUB ACTIONS : LANCER LE WORKER, ET LIRE OÙ IL EN EST ──────────────────
//
// LE CLIENT NE DÉCLENCHE PLUS RIEN. Ce module portait quatre boutons ; il n'en
// porte plus aucun. Ce qui se RÉCOLTE ou se RÉDIGE attend le Jour de travail —
// le cron de `.github/workflows/weekly-fetch.yml` tourne tous les matins à
// 07:00 UTC et `_due_today` écarte les comptes dont ce n'est pas le jour
// (`.scratch/refonte/issues/08-la-memoire-du-travail.md` point 7, raison
// corrigée par `.scratch/refonte/issues/13-entre-deux-jours-de-travail.md`).
//
// IL RESTE DONC EXACTEMENT DEUX APPELANTS, et aucun n'est un bouton :
//  · la RÉCOLTE D'AMORÇAGE, quand une source vient d'être branchée
//    (`app/comptes/actions.ts`) — « quand on branche une source, les données
//    sont prises directement, et ensuite mises à jour le jour que nous voulons
//    avoir pour notre report » (David, 13 §5). Sans infrastructure neuve : le
//    dispatch est celui-là même que les boutons utilisaient ;
//  · le SUIVI (`checkFetchStatus`, `app/actions.ts`), qui ne lance rien et
//    regarde seulement si un run tourne. 08 tue le déclencheur, pas
//    l'afficheur : une première récolte Instagram prend seize minutes et
//    RÉUSSIT — retirer l'afficheur laisserait un client devant un écran muet
//    pendant un quart d'heure.
//
// POURQUOI CE MODULE N'A PAS DE DIRECTIVE `"use server"`. Il vivait dans
// `app/actions.ts`, qui en porte une : un tel fichier ne peut exporter QUE des
// fonctions asynchrones, donc ni `NOM_JETON` ni `messageGitHub` n'auraient pu
// en sortir, et `app/comptes/actions.ts` aurait dû réécrire le dispatch une
// deuxième fois. Un module sans directive se compile des deux côtés et reste la
// seule implémentation.
//
// ── UN CODE HTTP N'EST PAS UN MESSAGE ───────────────────────────────────────
//
// Les appels tapent la même API avec le même jeton, et ratent tous pour les
// mêmes raisons. Ils répétaient « GitHub a répondu 401 — vérifie le token »,
// une phrase qui ne dit à personne quoi faire : on ne « vérifie » pas un jeton
// révoqué, on en refait un. Et 401, 403 et 404 demandent trois gestes
// différents, dans trois endroits différents. LA TRADUCTION VIT ICI, ET NULLE
// PART AILLEURS.
//
// ON NOMME LA VARIABLE, JAMAIS SA VALEUR. Ces messages partent vers le
// navigateur, finissent dans une capture d'écran ou un ticket de support :
// `GITHUB_TOKEN` est un nom public, ce qu'il contient ne l'est pas. Aucun
// fragment de jeton — pas même les premiers caractères, pas même une longueur —
// ne doit apparaître dans un message, une trace ou un commentaire. Il n'y a pas
// non plus de repli : sans jeton valide, on ne lance rien, on le dit.

const NOM_JETON = "GITHUB_TOKEN";
const NOM_DEPOT = "GITHUB_REPO";
const DEPOT_DEFAUT = "Dernierwak/dashboard-analytic";
const WORKFLOW = "weekly-fetch.yml";

const depotGitHub = () => process.env[NOM_DEPOT] ?? DEPOT_DEFAUT;

/** Le jeton manque : ce n'est pas une panne, c'est une installation inachevée. */
const JETON_ABSENT = `Pas encore configuré : ajoute la variable ${NOM_JETON} sur Vercel (token GitHub avec accès Actions).`;

/** Chaque cause, son geste — et le geste dit OÙ il se fait. */
export function messageGitHub(status: number, repo: string): string {
  switch (status) {
    case 401:
      return `GitHub refuse le jeton (401) : ${NOM_JETON} a expiré ou a été révoqué. Génère-en un nouveau sur GitHub, remplace la valeur de ${NOM_JETON} dans les variables d'environnement Vercel, puis redéploie.`;
    case 403:
      return `Jeton reconnu, mais interdit (403) : ${NOM_JETON} n'a pas le droit de lancer les Actions de ${repo}. Donne-lui la permission « Actions » en écriture sur ce dépôt, puis réessaie.`;
    // GitHub répond aussi 404 pour un dépôt PRIVÉ hors de portée du jeton :
    // il ne confirme pas l'existence de ce qu'on n'a pas le droit de voir. On
    // ne le dit pas à l'écran — trois causes dans un encart de 255 px, plus
    // personne ne lit — mais c'est la troisième piste si les deux premières
    // sont bonnes.
    case 404:
      return `Introuvable (404) : ni le dépôt ${repo}, ni le workflow ${WORKFLOW}. Vérifie ${NOM_DEPOT}, et que .github/workflows/${WORKFLOW} existe bien sur la branche par défaut.`;
    default:
      return `GitHub a répondu ${status} — l'erreur vient de son côté, pas de ta configuration. Réessaie dans quelques minutes.`;
  }
}

/** Lance le workflow avec les entrées données. Le seul chemin vers GitHub. */
export async function lancerWorkflow(
  inputs: Record<string, string | boolean>,
  succes: string
): Promise<{ ok: boolean; message: string }> {
  const token = process.env[NOM_JETON];
  if (!token) return { ok: false, message: JETON_ABSENT };
  const repo = depotGitHub();

  let r: Response;
  try {
    r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs }),
      }
    );
  } catch {
    // Sans ce filet, une coupure réseau remonte en erreur d'action serveur :
    // l'écran affiche un plantage là où il n'y a qu'un réseau qui tousse.
    return {
      ok: false,
      message: "Impossible de joindre GitHub (réseau). Réessaie dans un instant.",
    };
  }
  if (r.status === 204) return { ok: true, message: succes };
  return { ok: false, message: messageGitHub(r.status, repo) };
}

export type EtatRun = {
  state: "pending" | "success" | "failure" | "unknown";
  /** Début du run, en ISO — c'est LUI qui fait foi pour le temps écoulé.
   *  Sans ça, la barre repartait de zéro à chaque changement de page. */
  debut?: string;
  url?: string;
  /** Renseigné UNIQUEMENT pour 401/403/404 — les trois refus qui ne se
   *  répareront pas tout seuls. Un 5xx ou un réseau qui tousse reste
   *  « unknown » sans message : le sondage a le droit de rater un tour, il n'a
   *  pas le droit d'annoncer une panne à chaque hoquet. */
  message?: string;
};

/** L'état du dernier run du workflow — lu, jamais déclenché. */
export async function etatDernierRun(): Promise<EtatRun> {
  const token = process.env[NOM_JETON];
  const repo = depotGitHub();
  if (!token) return { state: "unknown" };
  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (r.status === 401 || r.status === 403 || r.status === 404)
      return { state: "unknown", message: messageGitHub(r.status, repo) };
    if (!r.ok) return { state: "unknown" };
    const run = (await r.json())?.workflow_runs?.[0];
    if (!run) return { state: "unknown" };
    const meta = { debut: run.created_at as string, url: run.html_url as string };
    if (run.status !== "completed") return { state: "pending", ...meta };
    return { state: run.conclusion === "success" ? "success" : "failure", ...meta };
  } catch {
    return { state: "unknown" };
  }
}
