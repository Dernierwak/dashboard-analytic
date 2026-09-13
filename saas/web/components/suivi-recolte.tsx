"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkFetchStatus, checkFetchProgress } from "@/app/actions";
import type { CanalRecolte } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// LE SUIVI DE LA RÉCOLTE — il regarde, il ne lance rien.
//
// ── CE COMPOSANT S'APPELAIT `FetchButton`, ET LE BOUTON EST PARTI ────────────
//
// « ↻ Mes données » était l'un des quatre déclencheurs que le client avait en
// main ; les quatre sont sortis de l'app
// (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`, qui
// exécute le point 7 de `refonte/08`). Ce qui se RÉCOLTE attend le Jour de
// travail, et rien d'autre ne déclenche une récolte : le cron de 07:00 UTC, ou
// le branchement d'une source neuve (`app/comptes/actions.ts`).
//
// MAIS 08 TUE LE DÉCLENCHEUR, PAS L'AFFICHEUR, et c'est le piège que ce module
// existe pour éviter. Une première récolte Instagram prend SEIZE MINUTES et
// RÉUSSIT. Sans ce panneau, le client qui vient de brancher sa Page reste
// devant un écran vide pendant un quart d'heure, sans savoir si quelque chose
// tourne. Tout ce qui suit — la vérité serveur, la reprise au montage, les
// canaux un par un — est conservé intact.
//
// ── LA VÉRITÉ EST SUR GITHUB ET DANS `fetch_progress`, PAS ICI ──────────────
//
// Chaque exemplaire demande au montage l'état du dernier run et reconstruit
// tout à partir de sa date de départ. Changer de page, recharger, ouvrir un
// second onglet : le panneau reprend là où il en est. Il n'y a plus de
// couperet non plus — une récolte longue est signalée comme longue, jamais
// comme cassée.
//
// ── LE PANNEAU NE FLOTTE PLUS, ET C'EST LE BOUTON QUI L'IMPOSAIT ────────────
//
// Il était ancré `absolute right-0 top-full` : il pendait SOUS le bouton, qui
// donnait sa taille et sa position à la boîte `relative`. Sans bouton, cette
// boîte mesure zéro et le panneau se serait accroché à un point sans hauteur.
// Le flottement n'était donc pas un choix de forme, c'était une conséquence du
// déclencheur — il part avec lui.
//
// Restent deux places, et elles n'ont pas la même largeur :
//  · `flux` — la barre latérale, son tiroir, et la page Connexions : le panneau
//    prend la LARGEUR DE SON CONTENEUR (`w-full`) et se range dans le flux. En
//    flux, il ne peut par construction ni dépasser à gauche ni passer sous la
//    fenêtre : les deux coupes mesurées de l'ancienne version — 29 px hors de
//    l'écran à gauche, 34 px sous la fenêtre, qu'aucun défilement ne
//    rattrapait — ne peuvent plus se produire ;
//  · `compact` — l'en-tête du téléphone, 52 px de haut : il n'y a la place que
//    pour DIRE qu'une récolte tourne. Le détail, lui, est à un tap, dans le
//    tiroir, qui rend exactement le même module en `flux`. Y poser le panneau
//    entier recouvrirait le contenu pendant les seize minutes d'une première
//    récolte Instagram.

// ── CE QUI A ÉTÉ RETIRÉ AVANT LE BOUTON, ET POURQUOI ────────────────────────
//
// Ici vivaient une liste `ETAPES` — sept étiquettes horodatées à la main
// (« Google Ads » à 420 s) — et une fonction `avancement(sec)` qui rendait
// `92 * (1 - exp(-sec / 260))`. Ni l'une ni l'autre n'a jamais rien mesuré :
// c'était une courbe sur le TEMPS ÉCOULÉ, affichée comme un avancement. Le
// pourcentage au bout de la barre ne décrivait pas la récolte, il décrivait le
// chronomètre.
//
// Deux raisons de les retirer plutôt que de les multiplier par quatre :
//  · la récolte tourne maintenant EN PARALLÈLE. Les étapes ordonnées sont donc
//    fausses par construction — Google Ads ne vient plus après Instagram, il
//    tourne en même temps. Quatre barres sur ce principe auraient fait quatre
//    chiffres fabriqués au lieu d'un ;
//  · le worker sait où il en est. Il l'écrit désormais dans `fetch_progress`,
//    canal par canal, et `checkFetchProgress()` le lit. Il n'y a plus besoin de
//    deviner.
//
// CE QU'ON N'AFFICHE TOUJOURS PAS, ET C'EST VOULU : un pourcentage à
// l'intérieur d'un canal. Le nombre d'appels API d'une récolte Meta n'est connu
// de personne avant de l'avoir faite ; « 47 % » serait à nouveau un chiffre
// inventé. Une étape franchie (« budgets », « insights ») est une position
// réelle dans une séquence écrite dans le code — on affiche celle-là. Le seul
// canal qui chiffre est Instagram, parce que la liste des posts à relire est
// arrêtée AVANT d'entrer dans la boucle : « posts 12/37 » est un compte, pas
// une estimation.
//
// Le seul nombre du module est donc celui qu'on sait compter : combien de
// canaux ont fini, sur combien étaient prévus.

// Au-delà, on prévient que c'est long — pas que c'est cassé.
//
// ── ET ON NE DIT PLUS « C'EST NORMAL LA PREMIÈRE FOIS » ─────────────────────
//
// Le message affiché passé ce seuil affirmait « c'est normal la première fois :
// la récolte rapatrie tout ton historique ». Il l'affirmait à TOUT LE MONDE,
// sans jamais vérifier que c'en était une — ce composant ne sait rien du
// contenu du compte, il ne connaît que l'état du dernier run GitHub. Un
// utilisateur qui récolte depuis des mois lisait donc « la première fois » à
// chaque récolte longue, et la seule chose qu'il pouvait en conclure, c'est
// qu'on lui racontait n'importe quoi.
//
// Savoir si c'en est vraiment une demanderait de compter les lignes déjà en
// base, donc un aller-retour serveur que ce composant n'a pas. Entre inventer
// une cause et n'en affirmer aucune, on n'en affirme aucune : le message dit ce
// qu'il sait (dix minutes, ce n'est pas un échec) et nomme les deux causes
// possibles sans choisir à la place de l'utilisateur.
const LONGUE = 10 * 60;

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

// LA SEULE BARRE DE POURCENTAGE DU MODULE, ET ELLE NE MESURE PAS UNE ESTIMATION.
// La note « CE QU'ON N'AFFICHE TOUJOURS PAS » plus haut explique pourquoi un
// pourcentage est absent partout ailleurs : le nombre d'appels d'un canal
// n'est jamais connu d'avance. Instagram est l'unique exception, écrite dans
// `fetch_headless` (collecte/meta/fetch_instagram.py) : la liste des posts à
// relire est arrêtée AVANT la boucle, donc `note("posts 12/37")` est un
// compte réel. La barre lit ce même texte, elle n'invente rien de plus.
const POSTS_RE = /^posts (\d+)\/(\d+)$/;
function progresInstagram(etape: string | null): number | null {
  if (!etape) return null;
  const m = POSTS_RE.exec(etape);
  if (!m) return null;
  const total = Number(m[2]);
  if (!total) return null;
  return Math.min(100, Math.round((Number(m[1]) / total) * 100));
}

// Le nom lisible d'un canal. La clé est celle que le worker écrit (`CANAUX`
// dans saas/collecte/automatisation/suivi.py) ; un canal inconnu s'affiche tel quel plutôt que
// de disparaître.
const NOM_CANAL: Record<string, string> = {
  meta: "Publicités Meta",
  instagram: "Posts Instagram",
  google: "Google Ads",
  ga4: "Google Analytics",
  labels: "Classement par l'IA",
  rapport: "Ton rapport",
};

// Le glyphe et la couleur d'un état. « interrompu » n'est pas un état écrit en
// base — c'est une DÉDUCTION : le run GitHub est terminé alors que la ligne
// n'a jamais atteint sa fin. Voir `etatLu` plus bas.
const ETAT: Record<string, { signe: string; couleur: string }> = {
  attente: { signe: "·", couleur: "text-faint" },
  en_cours: { signe: "◌", couleur: "text-warn" },
  fini: { signe: "✓", couleur: "text-pos" },
  echec: { signe: "✗", couleur: "text-neg" },
  saute: { signe: "–", couleur: "text-faint" },
  interrompu: { signe: "!", couleur: "text-neg" },
};

/** Où le module a de la place. Voir la note « LE PANNEAU NE FLOTTE PLUS » en
 *  tête de fichier — ce n'est pas un goût, c'est une mesure. */
export type Place = "flux" | "compact";

export function SuiviRecolte({ place = "flux" }: { place?: Place } = {}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lien, setLien] = useState<string | null>(null);
  // Ce que le worker dit de lui-même. Vide tant qu'il n'a pas encore démarré —
  // GitHub met une minute à réserver une machine, installer Python et les
  // dépendances avant que la première ligne ne s'écrive. Ce vide-là est un fait,
  // on l'affiche comme tel plutôt que de le combler avec une courbe.
  const [canauxLus, setCanaux] = useState<CanalRecolte[]>([]);
  const [runIdSuivi, setRunIdSuivi] = useState<string | null>(null);
  const [suiviIndispo, setSuiviIndispo] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const veilleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (veilleRef.current) clearInterval(veilleRef.current);
    pollRef.current = null;
    tickRef.current = null;
    veilleRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // Le chronomètre part de la date du run, pas du montage du composant.
  useEffect(() => {
    if (phase !== "running" || debut === null) return;
    const maj = () => setElapsed(Math.max(0, Math.round((Date.now() - debut) / 1000)));
    maj();
    tickRef.current = setInterval(maj, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase, debut]);

  // Un tour de sondage. Les deux sources partent ENSEMBLE : GitHub dit si ça
  // tourne, la table dit où ça en est. Une seule ne suffit à rien — c'est le
  // croisement des deux qui permet de dire « interrompu » sans inventer de
  // délai.
  //
  // LA QUESTION « EST-CE NOTRE RUN ? » A DISPARU AVEC LE BOUTON. Elle existait
  // parce que GitHub met quelques secondes à publier un run qu'on vient de
  // demander, et qu'un run terminé plus VIEUX que le clic était l'ancien. Plus
  // personne ne clique : le dernier run est le seul dont on ait à parler.
  const lire = useCallback(async () => {
    const [res, prog] = await Promise.all([checkFetchStatus(), checkFetchProgress()]);
    setCanaux(prog.canaux);
    setRunIdSuivi(prog.runId);
    setSuiviIndispo(prog.indisponible);
    // 401/403/404 : le sondage ne pourra plus JAMAIS répondre — inutile de
    // faire tourner un rond pendant un quart d'heure devant un jeton mort.
    // On s'arrête et on dit lequel des trois c'est. Les autres ratés
    // (réseau, 5xx) n'arrivent pas jusqu'ici sans message : on retente.
    if (res.message) {
      stopAll();
      setPhase("error");
      setMessage(res.message);
      return;
    }
    if (res.debut) {
      setLien(res.url ?? null);
      setDebut(Date.parse(res.debut));
    }
    if (res.state === "pending") {
      setPhase("running");
      return;
    }
    if (res.state === "success") {
      stopAll();
      setPhase("ready");
    } else if (res.state === "failure") {
      stopAll();
      setPhase("failed");
      setMessage("La récolte a échoué — regarde le détail du run sur GitHub.");
    }
  }, [stopAll]);

  // Au montage : si une récolte tourne déjà, on la reprend en cours de route.
  // C'est ce qui rend le panneau indépendant de la page où on se trouve — et,
  // depuis que le client ne lance plus rien, c'est le SEUL moyen de voir une
  // récolte qu'on n'a pas demandée : celle du Jour de travail, ou celle qui
  // part quand on branche une source.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const [res, prog] = await Promise.all([checkFetchStatus(), checkFetchProgress()]);
      if (!vivant) return;
      // Le détail est repris même si le run est fini : c'est lui qui dit
      // QUELLE plateforme a échoué quand le run, lui, s'annonce réussi.
      setCanaux(prog.canaux);
      setRunIdSuivi(prog.runId);
      setSuiviIndispo(prog.indisponible);
      if (res.state !== "pending") return;
      setDebut(res.debut ? Date.parse(res.debut) : Date.now());
      setLien(res.url ?? null);
      setPhase("running");
    })();
    return () => {
      vivant = false;
    };
  }, []);

  // Le sondage vit tant qu'une récolte tourne, quelle qu'en soit l'origine.
  useEffect(() => {
    if (phase !== "running" || pollRef.current) return;
    pollRef.current = setInterval(() => void lire(), 12_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [phase, lire]);

  // ── LA VEILLE, ET POURQUOI ELLE N'EXISTAIT PAS AVANT ────────────────────────
  //
  // Tant que la récolte partait d'un clic, le clic lui-même faisait passer
  // l'écran en « ◌ récolte » : il n'y avait rien à guetter. Maintenant les deux
  // départs sont ailleurs — le cron du Jour de travail, et le branchement d'une
  // source, qui lance sa récolte depuis le serveur. Sans veille, quelqu'un qui
  // vient de brancher sa Page Facebook resterait devant un écran muet jusqu'à
  // ce qu'il pense à recharger : GitHub met quelques secondes à publier un run,
  // donc la lecture du montage tombe encore sur l'ANCIEN, terminé.
  //
  // Une minute, et `checkFetchStatus` SEUL. C'est un appel GitHub par minute et
  // par onglet ouvert — le détail par canal (`fetch_progress`, côté Supabase)
  // n'est lu qu'une fois la récolte repérée, par le sondage rapide ci-dessus.
  // Un départ se voit donc dans la minute, ce qui est le bon ordre de grandeur
  // pour un travail qui dure entre deux et seize minutes.
  useEffect(() => {
    if (phase !== "idle" || veilleRef.current) return;
    const guetter = async () => {
      // Un onglet en arrière-plan n'a personne devant lui : il reprendra la
      // veille quand on y reviendra. La barre latérale est rendue DEUX FOIS
      // (la colonne et le tiroir du téléphone) et la page Connexions en pose
      // une troisième — sans cette garde, un onglet oublié interrogerait
      // GitHub trois fois par minute pour personne.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const res = await checkFetchStatus();
      if (res.state !== "pending") return;
      setDebut(res.debut ? Date.parse(res.debut) : Date.now());
      setLien(res.url ?? null);
      setPhase("running"); // le sondage rapide prend le relais
    };
    veilleRef.current = setInterval(() => void guetter(), 60_000);
    return () => {
      if (veilleRef.current) clearInterval(veilleRef.current);
      veilleRef.current = null;
    };
  }, [phase]);

  const compact = place === "compact";

  const longue = elapsed > LONGUE;
  // LE RUN EST-IL FINI ? C'est GitHub qui le dit, et personne d'autre. C'est la
  // clé du cas « le worker meurt en cours de route » : une ligne restée « en
  // cours » alors que le run est terminé n'est pas une récolte qui traîne,
  // c'est une récolte interrompue. Aucun délai d'expiration à inventer, aucune
  // ligne qui vieillit — un fait croisé avec un autre fait.
  const runFini = phase === "ready" || phase === "failed";
  const etatLu = (c: CanalRecolte) =>
    runFini && (c.etat === "en_cours" || c.etat === "attente") ? "interrompu" : c.etat;

  // ── LES LIGNES DU PASSAGE PRÉCÉDENT NE COMPTENT PAS ────────────────────────
  // GitHub met une minute à réserver une machine et à installer Python : entre
  // le départ du run et la première ligne du worker, la table porte encore le
  // passage d'avant. L'afficher ferait passer « 5 / 5 terminées » d'hier pour
  // l'avancement d'aujourd'hui — exactement le genre de chiffre qu'on vient de
  // retirer. `run_id` est l'horodatage de départ du worker, `debut` celui du run
  // GitHub : le worker démarre forcément APRÈS son run, donc des lignes plus
  // vieilles que `debut` sont périmées. Le sens de l'erreur est le bon : au pire
  // on masque une seconde des lignes fraîches, et l'écran dit « pas encore de
  // nouvelles » — ce qui reste vrai.
  const aJour =
    debut === null || runIdSuivi === null || Date.parse(runIdSuivi) >= debut;
  const canaux = aJour ? canauxLus : [];

  // Les canaux qui devaient tourner. Un canal « sauté » n'est pas en retard :
  // il n'était pas au programme, il ne compte donc pas au dénominateur.
  const prevus = canaux.filter((c) => c.etat !== "saute");
  const acheves = prevus.filter((c) =>
    ["fini", "echec", "interrompu"].includes(etatLu(c))
  );
  const echecs = prevus.filter((c) => etatLu(c) === "echec");
  const interrompus = prevus.filter((c) => etatLu(c) === "interrompu");

  // Le panneau vit tant que la récolte tourne — et il SURVIT à la fin du run
  // quand il a quelque chose que le reste de l'écran ne dit pas : quelle
  // plateforme a échoué. Un run GitHub peut se conclure « réussi » avec Google
  // Ads par terre, puisque chaque canal est attrapé dans son fil.
  const aDire = echecs.length > 0 || interrompus.length > 0;
  const montrer = phase === "running" || (runFini && aDire);

  // EN COMPACT, LE PANNEAU N'EXISTE PAS. L'en-tête du téléphone fait 52 px :
  // il porte la pastille d'état, rien de plus, et le détail est dans le tiroir.
  const suivi = montrer && !compact && (
    <div className="w-full rounded-lg border border-line bg-white shadow-card px-3 py-2.5">
      {/* rang 1 · l'identité — surtitre, c'est un module qu'on SCANNE.
          rang 2 · le compteur de contexte, à sa droite. Le chronomètre part de
          la date du run GitHub : c'est une durée mesurée, pas un avancement. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-faint">
          Récolte
        </span>
        <span className="font-mono text-[10.5px] text-faint shrink-0">{mmss(elapsed)}</span>
      </div>

      {/* rang 3 · LE CHIFFRE, et c'est le seul du module. Il ne paraît que
          lorsqu'il existe : tant que le worker n'a rien écrit, il n'y a rien à
          compter, et un « 0 / 0 » serait une réponse à une question qu'on ne
          sait pas encore poser. Aucune forme graphique nulle part — ni ici, ni
          plus bas : les canaux SONT les unités, une barre par-dessus les
          redessinerait en moins précis. */}
      {prevus.length > 0 ? (
        <div className="mt-1.5">
          <div className="font-mono text-[22px] leading-none text-ink tabular-nums">
            {acheves.length} <span className="text-faint">/</span> {prevus.length}
          </div>
          <div className="text-[10.5px] text-muted mt-1">
            plateformes terminées, au total
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
          {suiviIndispo
            ? "Le détail par plateforme n'est pas lisible (la table fetch_progress ne répond pas). La récolte, elle, tourne."
            : "Récolte en cours. Le worker n'a pas encore donné signe de vie — GitHub réserve une machine et installe Python avant la première ligne."}
        </p>
      )}

      {/* rang 4 · le verdict, en mots, et seulement quand il y en a un. */}
      {aDire && (
        <span
          className="inline-block mt-2 text-[10px] font-bold rounded-full px-2 py-0.5 text-neg"
          /* Recette maison de la pastille de verdict : `color: X` /
             `background: X + "14"` — X est ici `neg` (#c0392b) du thème. */
          style={{ background: "#c0392b14" }}
        >
          {interrompus.length > 0
            ? `${interrompus.length} interrompue${interrompus.length > 1 ? "s" : ""}`
            : `${echecs.length} en échec`}
        </span>
      )}

      {/* rang 7 · le détail. Une ligne par plateforme : son état, et son mot de
          la fin — celui que le journal du worker écrit déjà, rangé, pas
          réécrit. */}
      {canaux.length > 0 && (
        // DEUX PLAFONDS, ET LE PREMIER FAIT LE TRAVAIL.
        // Chaque mot de fin est borné à deux lignes (`line-clamp-2` plus bas),
        // ce qui borne une ligne de canal à ~41 px : six canaux tiennent donc
        // sous les 248 px, mesurés à 280 px de colonne. Le défilement interne
        // n'est qu'un filet — sans le clamp, il coupait une ligne en deux au
        // milieu d'un mot, ce qui se lit comme un bug d'affichage plutôt que
        // comme une invitation à faire défiler.
        // Un message tronqué n'est pas un message perdu : « voir le détail → »
        // ouvre le journal complet du run.
        <ul className="mt-2 space-y-1.5 max-h-[248px] overflow-y-auto">
          {canaux.map((c) => {
            const e = etatLu(c);
            const style = ETAT[e] ?? ETAT.attente;
            // Ce qu'on dit à droite du nom, dans l'ordre de ce qui est vrai :
            // le mot de la fin s'il existe, sinon l'étape en cours, sinon rien.
            const dit =
              c.motDeFin ?? (e === "en_cours" ? c.etape : null) ?? null;
            // La barre bleue : Instagram seulement, et seulement pendant que
            // l'étape en cours est un compte de posts — voir `progresInstagram`.
            const pct =
              c.canal === "instagram" && e === "en_cours"
                ? progresInstagram(c.etape)
                : null;
            return (
              <li key={c.canal} className="flex gap-1.5 min-w-0">
                <span className={`${style.couleur} text-[11px] leading-[1.35] shrink-0 w-2.5`}>
                  {style.signe}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] leading-[1.35] text-ink">
                    {NOM_CANAL[c.canal] ?? c.canal}
                    {e === "interrompu" && (
                      <span className="text-neg"> — interrompue</span>
                    )}
                  </span>
                  {dit && (
                    <span
                      // PAS de `block` ici, et ce n'est pas un oubli : mesuré
                      // dans le navigateur, `.block` gagne sur le
                      // `display: -webkit-box` que pose `line-clamp-2`, et sans
                      // cette boîte-là `-webkit-line-clamp` ne coupe RIEN. Le
                      // message d'erreur reprenait ses trois lignes en silence,
                      // avec la classe pourtant bien présente.
                      className="text-[10px] leading-[1.35] text-faint break-words line-clamp-2"
                      title={dit}
                    >
                      {dit}
                    </span>
                  )}
                  {pct !== null && (
                    <span
                      className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-brand/15"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className="block h-full rounded-full bg-brand transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* rang 9 · le pied — un seul, et réservé à ce qui rend le module
          honnête. */}
      <p className="text-[10.5px] text-faint mt-2 leading-relaxed border-t border-line pt-1.5">
        {interrompus.length > 0 ? (
          <>
            Interrompue = la récolte s&apos;est arrêtée avant la fin de ces
            plateformes. Ce qui était déjà écrit est gardé ; le reste sera
            repris au prochain passage.
          </>
        ) : longue ? (
          <>
            Plus de dix minutes : c&apos;est long, ce n&apos;est pas cassé. Les
            longues sont celles qui ont beaucoup à rapatrier. Aucune durée
            restante n&apos;est affichée — elle n&apos;est pas connue.
          </>
        ) : (
          <>
            Aucune durée restante : elle n&apos;est pas connue. Tu peux changer
            de page — le suivi te retrouvera.
          </>
        )}
      </p>
      {lien && (
        <a
          href={lien}
          target="_blank"
          rel="noreferrer"
          className="block mt-1.5 text-[10.5px] font-semibold text-brand hover:underline"
        >
          voir le détail →
        </a>
      )}
    </div>
  );

  // LA PASTILLE D'ÉTAT — le module en un mot, pour l'en-tête du téléphone.
  // Elle ne se clique pas : il n'y a rien à déclencher, et le détail est dans
  // le tiroir, à un tap du même écran. Elle DIT qu'une récolte tourne, ce qui
  // est très exactement ce qui manquerait sans elle.
  const pastille = (texte: string, ton: string) => (
    <span
      className={`text-[11px] font-semibold rounded-full px-3 py-1 inline-flex items-center justify-center border ${ton}`}
    >
      {texte}
    </span>
  );

  // LA SEULE CHOSE QUE CE MODULE FAIT FAIRE À QUELQU'UN : recharger la page
  // qu'il a sous les yeux. Ce n'est pas un déclencheur — rien ne part vers
  // GitHub, rien ne se récolte, rien ne se rédige. C'est la fin de la phrase
  // commencée par « ◌ récolte » : les chiffres sont en base, la page affichée
  // date d'avant.
  if (phase === "ready") {
    return (
      <div className={compact ? "inline-block" : "flex flex-col gap-2"}>
        {suivi}
        <button
          onClick={() => window.location.reload()}
          className={`text-[11px] font-semibold rounded-full px-3 py-1 inline-flex items-center justify-center text-white bg-pos border border-transparent hover:opacity-90 transition-opacity animate-pulse ${
            compact ? "" : "w-full"
          }`}
        >
          {compact ? "✓ recharger" : "✓ Données prêtes — recharger"}
        </button>
      </div>
    );
  }

  if (compact) {
    if (phase === "running")
      return pastille("◌ récolte", "text-warn border-warn/30 bg-warn/[0.06]");
    // Un run échoué ou un sondage aveugle : la pastille le dit, la raison est
    // dans le tiroir. Écrire un message GitHub de trois lignes dans un en-tête
    // de 52 px n'aurait aucun lecteur.
    if (phase === "failed" || phase === "error")
      return pastille("✗ récolte", "text-neg border-neg/30 bg-neg/[0.06]");
    return null;
  }

  const alerte = message && (
    <div
      className={`w-full text-[11.5px] leading-relaxed rounded-lg border px-3 py-2 shadow-card bg-white ${
        phase === "failed" || phase === "error" ? "text-neg border-neg/25" : "text-ink border-line"
      }`}
    >
      {message}
      {lien && (
        <a
          href={lien}
          target="_blank"
          rel="noreferrer"
          className="block mt-1 text-[10.5px] font-semibold text-brand hover:underline"
        >
          voir le détail →
        </a>
      )}
      <button
        onClick={() => setMessage(null)}
        className="block mt-1 text-[10.5px] font-semibold text-faint"
      >
        fermer
      </button>
    </div>
  );

  // RIEN À DIRE, RIEN À L'ÉCRAN. C'est l'état le plus fréquent, et c'est la
  // différence de fond avec le bouton qu'il remplace : un bouton occupe sa
  // place en permanence, un afficheur n'apparaît que lorsqu'il a quelque chose
  // à afficher.
  if (!suivi && !alerte) return null;

  return (
    <div className="flex flex-col gap-2">
      {suivi}
      {alerte}
    </div>
  );
}
