"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { triggerFetch, checkFetchStatus } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ↻ Mes données » — déclenche la récolte et la suit.
//
// LA VÉRITÉ EST SUR GITHUB, PAS DANS CE COMPOSANT. C'est le changement de
// fond. Avant, tout l'état vivait ici : lancer depuis la page Connexions puis
// aller voir son rapport démontait le composant, tuait le sondage, et la
// récolte devenait invisible alors qu'elle tournait toujours. Deux exemplaires
// cohabitent d'ailleurs — un dans la barre latérale, un sur /comptes — et
// chacun ignorait l'autre.
//
// Désormais chaque exemplaire demande au montage l'état du dernier run et
// reconstruit tout à partir de sa date de départ. Changer de page, recharger,
// ouvrir un second onglet : la barre reprend là où elle en est.
//
// ET IL N'Y A PLUS DE COUPERET. L'ancienne version abandonnait à 15 minutes
// avec « vérifie l'onglet Actions » — sur un premier chargement de 200 posts
// Instagram, la récolte prend 16 minutes et RÉUSSIT. On annonçait donc un échec
// une minute avant la victoire. Une récolte longue est signalée comme longue,
// jamais comme cassée.
//
// ── LE PANNEAU S'OUVRAIT HORS DE L'ÉCRAN (mesuré, pas supposé) ──────────────
//
// Il était figé à `w-64` (256 px) et ancré `right-0 top-full`, ce qui va très
// bien sur la page Connexions et dans l'en-tête du téléphone. Dans la colonne
// de gauche, non : la colonne offre 215 px de large, donc 41 px de trop, et
// comme elle commence à x = 0 le panneau démarrait à x = −29. Ces 29 px ne sont
// pas « à faire défiler » : `scrollWidth` valait `clientWidth`, le navigateur
// ne donne aucun moyen d'aller les chercher. « Classement des contenus par
// l'IA » s'affichait « ssement des contenus par l'IA ».
// Deuxième coupe, verticale, que personne n'avait vue : le bloc du bas est
// collé au bas d'une colonne `h-screen`, et un panneau qui s'ouvre VERS LE BAS
// finissait 34 px sous la fenêtre (834 px de bas dans 800 px de haut). La
// colonne étant `sticky`, faire défiler la page ne les ramenait pas non plus.
//
// D'où deux ancrages, et pas une largeur unique :
//  · `colonne` — dans la barre latérale et son tiroir : le panneau prend la
//    LARGEUR DE LA COLONNE (`w-full`), donc il ne peut plus déborder quelle que
//    soit la largeur de la barre, et il s'ouvre VERS LE HAUT, seul côté où il y
//    a de la place ;
//  · `droite` — en-tête du téléphone et page Connexions : `w-64`, vers le bas,
//    comme avant, parce que là il y a de la place des deux côtés.
//
// ── ET LE BOUTON NE CHANGE PLUS DE TAILLE ───────────────────────────────────
//
// Mesuré au pixel, dans sa police : « ↻ Mes données » 108,3 px · « … » 33,2 px ·
// « ◌ récolte 4 % » 95,2 px · « ◌ récolte 92 % » 101,4 px · « ✓ Données prêtes
// — recharger » 189,2 px. Aucun n'était tronqué — mais cliquer faisait fondre
// le bouton de 108 à 33 px, puis regonfler à 95, puis à 101 quand le pourcentage
// passait à deux chiffres. Dans la colonne il tient maintenant toute la largeur
// (comme « Se déconnecter » juste dessous), ailleurs il a un plancher de
// 112 px : le libellé change, la boîte ne bouge pas.
// Le pourcentage a quitté le bouton pour se poser au bout de la barre de
// progression, qui est exactement ce qu'il décrit. Le bouton se contente de
// « ◌ récolte » (73,3 px) : plus court, et surtout sans chiffre qui change de
// longueur en cours de route.

// Les étapes réelles du worker, dans l'ordre. Les secondes sont indicatives :
// la première récolte d'un compte est cent fois plus longue que les suivantes,
// parce que c'est elle qui rapatrie tout l'historique Instagram.
const ETAPES: { at: number; label: string }[] = [
  { at: 0, label: "Lancement de la récolte" },
  { at: 20, label: "Publicités Meta" },
  { at: 60, label: "Posts Instagram" },
  { at: 420, label: "Google Ads" },
  { at: 480, label: "Google Analytics" },
  { at: 540, label: "Classement des contenus par l'IA" },
  { at: 600, label: "Rédaction de ton rapport" },
];
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

function etapeDe(sec: number): string {
  let cur = ETAPES[0].label;
  for (const e of ETAPES) if (sec >= e.at) cur = e.label;
  return cur;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

// La barre n'estime pas une durée — elle n'en connaît aucune qui vaille pour
// les deux cas (2 min en routine, 16 min au premier chargement). Elle approche
// 92 % sans jamais l'atteindre : elle avance vite au début, lentement ensuite,
// et ne promet jamais une fin qu'elle ne sait pas dater.
function avancement(sec: number): number {
  return Math.round(92 * (1 - Math.exp(-sec / 260)));
}

/** Où le panneau a de la place. Voir la note « LE PANNEAU S'OUVRAIT HORS DE
 *  L'ÉCRAN » en tête de fichier — ce n'est pas un goût, c'est une mesure. */
export type Ancrage = "droite" | "colonne";

export function FetchButton({ ancrage = "droite" }: { ancrage?: Ancrage } = {}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lien, setLien] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Le moment où CE navigateur a demandé la récolte. Il sert à ne pas prendre
  // le run précédent pour le nôtre pendant les secondes où GitHub n'a pas
  // encore enregistré le nouveau.
  const demandeA = useRef<number | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
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

  const lire = useCallback(
    async (premier: boolean) => {
      const res = await checkFetchStatus();
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
      if (res.debut) setLien(res.url ?? null);
      const neuf = res.debut ? Date.parse(res.debut) : null;
      // Un run terminé mais ANTÉRIEUR à notre demande est l'ancien : GitHub ne
      // publie le nouveau qu'après quelques secondes. On patiente.
      const aNous =
        demandeA.current === null || (neuf !== null && neuf >= demandeA.current - 60_000);

      if (res.state === "pending") {
        setDebut(neuf);
        setPhase("running");
        return;
      }
      if (!aNous) {
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        stopAll();
        // Au tout premier coup d'œil sans demande de notre part, un run réussi
        // est simplement le dernier en date : rien à annoncer.
        setPhase(premier && demandeA.current === null ? "idle" : "ready");
      } else if (res.state === "failure") {
        stopAll();
        setPhase("failed");
        setMessage("La récolte a échoué — regarde le détail du run sur GitHub.");
      }
    },
    [stopAll]
  );

  // Au montage : si une récolte tourne déjà, on la reprend en cours de route.
  // C'est ce qui rend la barre indépendante de la page où on se trouve.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const res = await checkFetchStatus();
      if (!vivant || res.state !== "pending") return;
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
    pollRef.current = setInterval(() => void lire(false), 12_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [phase, lire]);

  const launch = () =>
    startTransition(async () => {
      demandeA.current = Date.now();
      const res = await triggerFetch();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.message);
        return;
      }
      setDebut(Date.now());
      setMessage(null);
      setPhase("running");
    });

  const colonne = ancrage === "colonne";
  // Une seule boîte pour toutes les phases : `w-full` dans la colonne (comme
  // « Se déconnecter » juste dessous), un plancher de 112 px ailleurs — le plus
  // large des libellés au repos fait 108,3 px.
  const boite = `text-[11px] font-semibold rounded-full px-3 py-1 inline-flex items-center justify-center ${
    colonne ? "w-full" : "min-w-[112px]"
  }`;
  // Le panneau. Dans la colonne il n'est PAS flottant : il prend la largeur
  // disponible et se range DANS le flux, juste au-dessus du bouton. Trois
  // raisons, et la troisième est la bonne :
  //  · en flux, il ne peut par construction ni dépasser à gauche ni passer sous
  //    la fenêtre — les deux coupes mesurées disparaissent d'elles-mêmes ;
  //  · flottant vers le haut, il RECOUVRAIT le sélecteur de compte pendant
  //    toute la récolte, c'est-à-dire deux à seize minutes sur toutes les pages ;
  //  · il est placé AVANT le bouton dans le DOM, et le bloc est collé en bas par
  //    `mt-auto` : sa hauteur est donc absorbée par le vide au-dessus. Le
  //    bouton, l'e-mail et « Se déconnecter » ne bougent pas d'un pixel ; seul
  //    le sélecteur remonte, dans de l'espace qui ne servait à rien.
  // Ailleurs (en-tête du téléphone, page Connexions) il reste flottant à 256 px
  // vers le bas, parce que là il y a la place et que rien ne doit être poussé.
  const panneau = colonne
    ? "w-full"
    : "absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] z-20";

  if (phase === "ready") {
    return (
      <button
        onClick={() => window.location.reload()}
        className={`${boite} text-white bg-pos border border-transparent hover:opacity-90 transition-opacity animate-pulse`}
      >
        ✓ Données prêtes — recharger
      </button>
    );
  }

  const pourcent = avancement(elapsed);
  const longue = elapsed > LONGUE;

  const suivi = phase === "running" && (
    <div className={`${panneau} rounded-lg border border-line bg-white shadow-card px-3 py-2.5`}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[11.5px] font-semibold text-ink leading-snug">
          {etapeDe(elapsed)}
        </span>
        <span className="font-mono text-[10.5px] text-faint shrink-0">{mmss(elapsed)}</span>
      </div>
      {/* Le pourcentage a quitté le bouton pour venir ici, au bout de la barre
          qu'il chiffre. Il ne fait plus bouger personne : la barre est
          `flex-1`, c'est elle qui absorbe la différence entre 4 % et 92 %. */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 min-w-0 rounded-full bg-black/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(4, pourcent)}%` }}
          />
        </div>
        <span className="font-mono text-[10.5px] text-faint shrink-0">{pourcent} %</span>
      </div>
      <p className="text-[10.5px] text-faint mt-1.5 leading-relaxed">
        {longue ? (
          <>
            Plus de dix minutes : c&apos;est long, ce n&apos;est pas cassé. La
            récolte va au bout. Les longues sont celles qui ont beaucoup à
            rapatrier — un premier chargement, ou un compte laissé de côté un
            moment.
          </>
        ) : (
          <>
            Compte 2 à 15 minutes selon ce qu&apos;il reste à rapatrier. Tu peux changer
            de page ou fermer l&apos;onglet — la barre te retrouvera.
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

  const alerte = message && (
    <div
      className={`${panneau} text-[11.5px] leading-relaxed rounded-lg border px-3 py-2 shadow-card bg-white ${
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

  return (
    <div className={colonne ? "flex flex-col gap-2" : "relative inline-block"}>
      {/* En colonne, les panneaux passent AVANT le bouton — voir la note sur
          `panneau` : c'est ce qui empêche le bouton de sauter. */}
      {colonne && suivi}
      {colonne && alerte}
      <button
        disabled={pending || phase === "running"}
        onClick={launch}
        className={`${boite} border transition-colors disabled:opacity-70 ${
          phase === "running"
            ? "text-warn border-warn/30 bg-warn/[0.06]"
            : "text-brand border-brand/30 hover:bg-brand/[0.06]"
        }`}
      >
        {pending ? "◌ lancement" : phase === "running" ? "◌ récolte" : "↻ Mes données"}
      </button>
      {!colonne && suivi}
      {!colonne && alerte}
    </div>
  );
}
