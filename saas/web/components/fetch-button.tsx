"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { triggerFetch, checkFetchStatus, checkFetchProgress } from "@/app/actions";
import type { CanalRecolte } from "@/app/actions";

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
// Le pourcentage a quitté le bouton, puis il a quitté le produit — il ne
// mesurait rien (voir la note suivante). Le bouton se contente de « ◌ récolte »
// (73,3 px) : plus court, et surtout sans chiffre qui change de longueur en
// cours de route.

// ── CE QUI A ÉTÉ RETIRÉ, ET POURQUOI ────────────────────────────────────────
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

/** Où le panneau a de la place. Voir la note « LE PANNEAU S'OUVRAIT HORS DE
 *  L'ÉCRAN » en tête de fichier — ce n'est pas un goût, c'est une mesure. */
export type Ancrage = "droite" | "colonne";

export function FetchButton({ ancrage = "droite" }: { ancrage?: Ancrage } = {}) {
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
      // Les deux sources partent ENSEMBLE : GitHub dit si ça tourne, la table
      // dit où ça en est. Une seule ne suffit à rien — c'est le croisement des
      // deux qui permet de dire « interrompu » sans inventer de délai.
      const [res, prog] = await Promise.all([
        checkFetchStatus(),
        checkFetchProgress(),
      ]);
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
      const [res, prog] = await Promise.all([
        checkFetchStatus(),
        checkFetchProgress(),
      ]);
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
  // le clic et la première ligne du worker, la table porte encore le passage
  // d'avant. L'afficher ferait passer « 5 / 5 terminées » d'hier pour
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
  // quand il a quelque chose que le bouton ne dit pas : quelle plateforme a
  // échoué. Un run GitHub peut se conclure « réussi » avec Google Ads par
  // terre, puisque chaque canal est attrapé dans son fil.
  const aDire = echecs.length > 0 || interrompus.length > 0;
  const montrer = phase === "running" || (runFini && aDire);

  const suivi = montrer && (
    <div className={`${panneau} rounded-lg border border-line bg-white shadow-card px-3 py-2.5`}>
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
            : "Récolte lancée. Le worker n'a pas encore donné signe de vie — GitHub réserve une machine et installe Python avant la première ligne."}
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
            plateformes. Ce qui était déjà écrit est gardé ; relance pour le
            reste.
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

  if (phase === "ready") {
    return (
      <div className={colonne ? "flex flex-col gap-2" : "relative inline-block"}>
        {colonne && suivi}
        <button
          onClick={() => window.location.reload()}
          className={`${boite} text-white bg-pos border border-transparent hover:opacity-90 transition-opacity animate-pulse`}
        >
          ✓ Données prêtes — recharger
        </button>
        {!colonne && suivi}
      </div>
    );
  }

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
