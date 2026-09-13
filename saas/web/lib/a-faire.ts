import {
  feedbackKey,
  estVeille,
  type Decouvertes,
  type PayloadReco,
  type ReportPayload,
  type TrackedAction,
} from "@/lib/report";
import type { Prise } from "@/app/actions";

// ── CE QUI ATTEND UNE DÉCISION DE TOI ────────────────────────────────────────
//
// LA RÈGLE, EN UNE PHRASE : **le module « À faire » liste ce qui attend une
// décision de toi ; le rail montre le temps qui passe.** C'est la seule
// frontière énonçable qui empêche les deux de se contredire — et il en fallait
// une, parce que trois objets montrent déjà les mêmes actions (les cartes de
// conseil, `rail-actions.tsx`, et la pastille de la navigation). Décidée par
// `.scratch/refonte/issues/20-a-faire-cette-semaine.md`.
//
// Concrètement : une seule liste, trois natures. Les Verdicts tombés qu'il faut
// regarder, les choses que tu t'es écrites toi-même, et les conseils de la
// semaine que tu n'as pas encore tranchés. « En cours », « en observation » et
// l'historique restent au rail : ils n'attendent rien de toi.
//
// LE COMPTAGE EST ICI, ET NULLE PART AILLEURS. Le module l'affiche, la pastille
// de la navigation l'affichera : deux objets pour un même chiffre ne doivent
// pas pouvoir se contredire — c'est le patron de `getCouverture`, entre la page
// Thèmes et le rapport. Les « deux compteurs » de la pastille ne sont pas deux
// listes, ce sont deux comptages de celle-ci.
//
// CE FICHIER NE DESSINE RIEN et ne lit pas la base : il reçoit ce que la page a
// déjà lu et il TRIE. Le rendu est dans `components/a-faire.tsx`, les gestes
// dans `components/a-faire-lignes.tsx`.

/** Un conseil de la semaine que personne n'a encore tranché. */
export type ConseilAFaire = {
  key: string;
  titre: string;
  /** `null` sur un réglage de base : il ne porte aucun thème. */
  theme: string | null;
  /** Le temps à prévoir, tel que le worker l'a posé (« 10 min », « 1 h »…). */
  effort: string | null;
  /** Vrai quand le conseil vit dans « Réglages de base » et non sur une carte
   *  de thème — c'est ce qui décide vers où le titre renvoie. */
  reglage: boolean;
  /** La photo à écrire si tu le marques fait sans l'avoir pris d'abord. */
  prise: Prise;
};

export type AFaire = {
  /** Les Verdicts tombés — en premier, toujours. */
  verdicts: TrackedAction[];
  /** Ce que tu t'es écrit toi-même et qui n'est pas encore coché. */
  notes: TrackedAction[];
  /** Les conseils de la semaine non décidés. */
  conseils: ConseilAFaire[];
};

/**
 * UNE NOTE ÉCRITE AVANT LE FAIT, PAS ENCORE COCHÉE.
 *
 * `kind = "note"` née `running` — le seul objet qui vit dans ce module et nulle
 * part ailleurs tant qu'il n'est pas coché : le rail montre le temps qui passe,
 * or une ligne qu'on n'a pas encore faite ne raconte rien et ne marque pas la
 * courbe (`CONTEXT.md`, entrée Note). D'où le même filtre dans
 * `rail-actions.tsx` et dans le filet « hors thème » (`app/page.tsx`).
 *
 * Le mot « tâche » n'est employé nulle part : `CONTEXT.md` l'écarte deux fois.
 */
export function estNoteOuverte(a: TrackedAction): boolean {
  return a.kind === "note" && a.status === "running";
}

/** LES TROIS SORTIES D'UN CONSEIL. « Utile » n'en est pas une : c'est une
 *  pondération, pas une décision — le conseil reste à trancher, donc il reste
 *  dans la liste. */
const DECIDE = new Set(["done", "not_for_me", "too_hard"]);

/** La photo du conseil, telle que la ligne de suivi la gardera. */
function photographier(r: PayloadReco, theme: string | null): Prise {
  return {
    recoKey: r.key,
    title: r.title,
    theme,
    metric: r.metric ?? null,
    metricLabel: r.metric_label ?? null,
    direction: r.direction ?? null,
    baseline: r.baseline ?? null,
    detail: {
      observation: r.observation,
      pourquoi: r.pourquoi,
      verifier: r.verifier,
      effort: r.effort ?? null,
      // Le levier part avec le clic : `suivi_actions` n'a pas de colonne pour
      // lui et la mémoire d'un thème en a besoin. Le déduire de l'indicateur
      // serait un chiffre fabriqué (`CLAUDE.md` §7).
      levier: r.levier ?? null,
    },
  };
}

export function composerAFaire(
  report: ReportPayload | null,
  actions: TrackedAction[],
  suivis: Record<string, TrackedAction>,
  feedback: Record<string, string>
): AFaire {
  // LES VERDICTS S'EMPILENT TOUJOURS, et c'est l'inverse exact des conseils :
  // un conseil non décidé ne coûte rien à jeter (il redescend en priorité et
  // revient plus simple), un verdict effacé effacerait ce que TU as fait. Rien
  // n'archive un `due` tout seul — seul un clic « ✓ Vu » le range
  // (`resolveAction`). Le plus ancien d'abord : c'est celui qu'on fait attendre
  // depuis le plus longtemps.
  const verdicts = actions
    .filter((a) => a.kind !== "note" && (a.status === "done" || a.status === "auto") && a.due)
    .sort((a, b) => (a.check_at < b.check_at ? -1 : 1));

  // Les lignes que le client s'écrit lui-même : une Note née `running`
  // (`saveNoteOuverte`). Elle n'a ni indicateur ni verdict — elle se coche, et
  // c'est en la cochant qu'elle se date.
  const notes = actions
    .filter(estNoteOuverte)
    .sort((a, b) => (a.decided_at < b.decided_at ? -1 : 1));

  const conseils: ConseilAFaire[] = [];
  const ajouter = (r: PayloadReco, theme: string | null, reglage: boolean) => {
    // UNE VEILLE N'EST PAS UN CONSEIL : elle ne demande aucun geste, elle
    // surveille. La carte ne lui donne déjà ni « ▶ Je le teste » ni état de
    // suivi ; l'inscrire ici ferait du module une liste qu'on ne peut pas
    // vider.
    if (estVeille(r.key)) return;
    // Déjà pris (« ▶ Je le teste ») : la ligne vit au rail, où le temps passe.
    if (suivis[r.key]) return;
    const retour = feedback[feedbackKey(r.key, theme)] ?? feedback[r.key] ?? null;
    if (retour && DECIDE.has(retour)) return;
    conseils.push({
      key: r.key,
      titre: r.title,
      theme,
      effort: r.effort ?? null,
      reglage,
      prise: photographier(r, theme),
    });
  };
  for (const t of report?.themes_focus ?? []) for (const r of t.recos) ajouter(r, t.label, false);
  // Les réglages de base attendent une décision comme les autres — les laisser
  // dehors ferait de leur bloc le seul endroit où un conseil peut se cacher de
  // la liste.
  for (const r of report?.reglages ?? []) ajouter(r, null, true);

  return { verdicts, notes, conseils };
}

export type Nudge = { texte: string; lien: { href: string; mot: string } | null };

/** LE CONSEIL D'USAGE DU MODULE VIDE — un seul à la fois, le premier geste
 *  jamais utilisé gagne. Éteint POUR TOUJOURS par le premier usage du geste,
 *  jamais par le temps : un conseil d'usage qui revient chaque semaine devient
 *  un décor en trois semaines (réserve écrite de la refonte 20).
 *
 *  LIMITE CONNUE, non corrigée : `Decouvertes` lit une ligne VIVANTE. Supprimer
 *  sa dernière note, ou son dernier budget, rallume donc le conseil d'usage.
 *  Le corriger demanderait de mémoriser « déjà découvert » quelque part —
 *  c'est-à-dire l'objet neuf que ce ticket s'est interdit. */
export function nudge(d: Decouvertes): Nudge | null {
  if (!d.note)
    return {
      texte:
        "Tu n'as encore rien écrit toi-même. Ce que Pulse ne voit pas — un visuel refait, " +
        "un prix changé, une promo chez le concurrent — se note ici et se retrouve sur la courbe.",
      lien: null,
    };
  if (!d.budget)
    return {
      texte:
        "Tu n'as encore posé aucun budget. Sans lui, Pulse ne peut pas te dire que tu vas le dépasser.",
      lien: { href: "/couts", mot: "▤ Coûts" },
    };
  return null;
}

/**
 * LES DEUX COMPTEURS, calculés ICI et nulle part ailleurs.
 *
 * Ce ne sont pas deux listes : ce sont deux comptages de LA liste. Le module les
 * affiche, la pastille de la navigation les affichera (refonte 12) — et deux
 * objets qui portent le même chiffre ne doivent pas pouvoir se contredire,
 * exactement comme `getCouverture` entre la page Thèmes et le rapport.
 *
 * La partition suit la règle du ticket : **les conseils ne s'empilent jamais,
 * les verdicts s'empilent toujours.** D'un côté le résultat de ton travail, de
 * l'autre ce qui attend ta décision — qu'il vienne de Pulse ou de toi.
 */
export function compteursAFaire(a: AFaire): { verdicts: number; decisions: number } {
  return {
    verdicts: a.verdicts.length,
    decisions: a.notes.length + a.conseils.length,
  };
}

/** L'ÉTAT DU MODULE, décidé UNE fois : la page en a besoin pour numéroter ses
 *  sections, le module pour se dessiner. Deux calculs séparés finiraient par
 *  diverger — c'est exactement ce que ce module existe pour éviter. */
export type EtatAFaire = {
  /** LE MODULE DISPARAÎT QUAND IL EST VIDE **ET** QU'IL N'A PLUS RIEN À FAIRE
   *  DÉCOUVRIR. « Vide parce que tu as tout décidé » et « vide parce que rien ne
   *  peut y entrer » ne sont pas le même écran. */
  visible: boolean;
  /** Aucune étoile : aucun conseil ne peut entrer, jamais. Le module ne
   *  disparaît donc pas, il dit pourquoi il est vide et donne le geste. C'est
   *  LUI qui le dit, pas le module verrouillé d'une carte de thème : celui-là
   *  parle de ce qui manque EN BASE, celui-ci de ce qui manque À TA DÉCISION
   *  (`CONTEXT.md`, entrée Priorité). */
  bloque: boolean;
  /** Le conseil d'usage, un seul à la fois, et seulement dans le module vide —
   *  jamais à côté de la liste. */
  nudge: Nudge | null;
};

export function etatAFaire(
  a: AFaire,
  aucunePriorite: boolean,
  d: Decouvertes
): EtatAFaire {
  const plein = a.verdicts.length + a.notes.length + a.conseils.length > 0;
  // UN SEUL À LA FOIS, et l'état bloqué compte comme celui-là : sans étoile, le
  // module pousse DÉJÀ vers un geste précis. Y ajouter un conseil d'usage ferait
  // dire deux choses au même endroit au même moment — la réserve écrite de la
  // refonte 20, mot pour mot.
  const conseilDUsage = plein || aucunePriorite ? null : nudge(d);
  return {
    visible: plein || aucunePriorite || conseilDUsage !== null,
    bloque: aucunePriorite,
    nudge: conseilDUsage,
  };
}
