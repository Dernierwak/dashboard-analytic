import Link from "next/link";
import { ObjectifSelect } from "@/components/objectif-select";

// L'OBJECTIF, POSÉ DEVANT LE THÈME QU'IL COMMANDE.
//
// Il flottait en haut de page, sous le résumé de la semaine, à 600 px des
// cartes qu'il pondère. On lisait donc « Plus de ventes » comme un réglage de
// compte parmi d'autres, alors que c'est lui qui décide de l'indicateur suivi
// par CHAQUE carte de thème et de l'ordre de ses conseils. Il se pose
// maintenant juste au-dessus de la première carte : la cause avant l'effet.
//
// IL PREND SON THÈME EN PROPS, IL NE LIT AUCUN ÉTAT GLOBAL.
//
// CHAQUE THÈME PRIORITAIRE PEUT DÉSORMAIS AVOIR SON PROPRE OBJECTIF
// (`theme_objectifs`, réglable sur /labels) — `profiles.objectif` n'est plus
// qu'un DÉFAUT hérité en silence. Deux valeurs DIFFÉRENTES en découlent, et
// elles ne peuvent PLUS partager une seule prop `objectif` (erreur de la passe
// précédente, corrigée) :
//   · `objectifCompte` — `profiles.objectif` tel quel. C'est la SEULE valeur
//     que `<ObjectifSelect>` doit lire et écrire : le sélecteur sous « L'objectif
//     du compte » appelle `saveObjectif` → `profiles.objectif`, donc lui montrer
//     l'objectif effectif d'un thème (potentiellement différent) afficherait une
//     valeur qui n'est pas celle que le `onChange` va écrire.
//   · `objectifEffectif` — le mot du résumé (rang 3) : le sien si le thème
//     affiché a un réglage propre, sinon celui du compte. C'est LUI qui pilote
//     réellement la courbe et les conseils (voir le worker, `_obj_theme`).
//
// `commun` compare les objectifs EFFECTIFS de tous les thèmes affichés — il
// reste vrai même quand la convergence vient d'un choix propre, PAS seulement
// de l'héritage. Le pied ne peut donc pas se contenter de `commun` pour dire
// « tant qu'aucun n'a le sien » : il vérifie `nbPropre` séparément (2e défaut
// de la passe précédente, corrigé).

const OBJ_MOT: Record<string, string> = {
  ventes: "Plus de ventes",
  notoriete: "Être plus connu",
  engagement: "Une communauté qui réagit",
};

export function ObjectifTheme({
  theme,
  objectifCompte,
  objectifEffectif,
  objectifPropre,
  commun,
  nbPropre,
  priorities,
  nbThemes,
}: {
  /** Le thème que ce widget coiffe. `null` = aucun thème classé encore. */
  theme: { label: string; is_priority: boolean } | null;
  /** `profiles.objectif` — la valeur que lit et écrit `<ObjectifSelect>`. */
  objectifCompte: string | null;
  /** L'objectif EFFECTIF du thème affiché (rang 3) — le sien s'il en a un, sinon celui du compte. */
  objectifEffectif: string | null;
  /** Ce thème a-t-il un réglage propre (vs hérité du compte) ? */
  objectifPropre: boolean;
  /** Tous les thèmes affichés partagent-ils exactement le même objectif effectif ? */
  commun: boolean;
  /** Combien, parmi les thèmes affichés, ont leur propre objectif. */
  nbPropre: number;
  priorities: string[];
  /** Combien de thèmes ce module regarde en tout — 1, 6, ou zéro. */
  nbThemes: number;
}) {
  const mot = commun ? OBJ_MOT[objectifEffectif ?? ""] ?? "à définir" : "plusieurs objectifs";
  const plusieurs = nbThemes > 1;

  return (
    <details className="group rounded-xl border border-line bg-white shadow-card mb-3">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qu&apos;on cherche
        </span>
        <span className="text-[14px] font-semibold text-brand">{mot}</span>
        {theme && (
          <span className="text-[12.5px] text-muted">
            {!plusieurs ? (
              <>
                · pour{" "}
                <span className="font-semibold text-ink">
                  {theme.is_priority && <span className="text-warn">★ </span>}
                  {theme.label}
                </span>
                {objectifPropre && <span className="text-faint"> (objectif propre)</span>}
              </>
            ) : commun ? (
              <>
                · commun à <span className="font-semibold text-ink">tes {nbThemes} thèmes</span>
              </>
            ) : (
              <>
                ·{" "}
                <span className="font-semibold text-ink">
                  {nbPropre} sur {nbThemes}
                </span>{" "}
                {nbPropre > 1 ? "ont leur" : "a son"} propre objectif
              </>
            )}
          </span>
        )}
        <span className="ml-auto text-[11px] text-faint group-open:hidden">modifier ▾</span>
        <span className="ml-auto text-[11px] text-faint hidden group-open:inline">replier ▴</span>
      </summary>

      {/* Rang 8 — le pilotage, et il n'y a que ça dans ce module : il ne montre
          aucun chiffre, il en commande. */}
      <div className="px-4 pb-4 pt-1 border-t border-line grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
            L&apos;objectif du compte
          </div>
          {/* TOUJOURS `objectifCompte` — jamais `objectifEffectif`. Ce
              sélecteur écrit `profiles.objectif` (`saveObjectif`) : lui faire
              afficher l'objectif propre d'un thème montrerait une valeur que
              son propre `onChange` n'écrirait pas. */}
          <ObjectifSelect current={objectifCompte} />
          <p className="text-[11px] text-faint mt-2 leading-relaxed">
            Le DÉFAUT hérité par tout thème sans réglage propre. Pris en compte à la
            prochaine publication du rapport.
          </p>
        </div>
        <div>
          {/* « 3/3 » disait un plafond qui n'existe plus. Trois reste un
              nombre du produit, mais ce n'est plus le nombre de thèmes qu'on a
              le droit d'étoiler : c'est le nombre que l'IA rédige. On compte
              donc les étoiles, sans dénominateur.

              ET ON NE LES NUMÉROTE PAS ICI. Le rang vient de l'ordre où les
              étoiles ont été posées ; `priorities` arrive dans cette page par
              `Object.keys(insightFeedback)`, dont l'ordre n'est pas garanti.
              Afficher « ★1 ★2 ★3 » à partir d'une liste non triée serait un
              rang inventé — la page ◫ Thèmes, elle, lit l'ordre daté et peut
              le montrer. */}
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
            On se concentre sur{" "}
            {priorities.length > 0 && `(${priorities.length} thème${priorities.length > 1 ? "s" : ""})`}
          </div>
          {priorities.length > 0 ? (
            <div className="flex flex-wrap gap-2 items-center">
              {priorities.map((p) => (
                <span
                  key={p}
                  className="text-[13px] font-semibold text-warn bg-warn/[0.08] border border-warn/25 rounded-full px-3 py-1.5"
                >
                  ★ {p}
                </span>
              ))}
              <Link
                href="/labels"
                className="text-[12px] font-semibold text-brand hover:underline ml-1"
              >
                Changer →
              </Link>
              {priorities.length > 3 && (
                <p className="text-[11px] text-faint leading-relaxed w-full mt-1">
                  Tous ont leur carte et leurs conseils calculés ; l&apos;IA en rédige
                  3 — les 3 étoiles posées en premier, visibles sur ◫ Thèmes.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted leading-relaxed">
              Aucune priorité — le rapport prend tes 3 plus gros thèmes.{" "}
              <Link href="/labels" className="text-brand font-semibold hover:underline">
                Choisis les tiens →
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Rang 9 — le pied, un seul. Ce que ce réglage sait faire, et où —
          y compris quand un seul thème est affiché et porte déjà le sien :
          sans cette branche, le seul texte visible à l'écran (« objectif
          propre ») ne dirait jamais où ce réglage se change. */}
      {plusieurs ? (
        <p className="text-[11px] text-faint px-4 pb-3.5 leading-relaxed">
          {nbPropre === 0 ? (
            <>
              Objectif par défaut, partagé par tes {nbThemes} thèmes tant qu&apos;aucun n&apos;a
              le sien. Un thème qui vise la notoriété et un autre les ventes ne se pilotent
              pas au même indicateur — chacun peut avoir le sien sur{" "}
              <Link href="/labels" className="font-semibold text-brand hover:underline">
                ◫ Thèmes →
              </Link>
              .
            </>
          ) : commun ? (
            <>
              Tes {nbThemes} thèmes suivent pour l&apos;instant tous le même objectif, mais{" "}
              {nbPropre} {nbPropre > 1 ? "l'ont choisi" : "l'a choisi"} spécifiquement plutôt
              que de l&apos;hériter du compte — détail thème par thème sur{" "}
              <Link href="/labels" className="font-semibold text-brand hover:underline">
                ◫ Thèmes →
              </Link>
              .
            </>
          ) : nbPropre < nbThemes ? (
            <>
              {nbPropre} de tes {nbThemes} thèmes {nbPropre > 1 ? "suivent" : "suit"} déjà{" "}
              {nbPropre > 1 ? "leur" : "son"} propre objectif ; les autres restent sur celui du
              compte. Détail thème par thème sur{" "}
              <Link href="/labels" className="font-semibold text-brand hover:underline">
                ◫ Thèmes →
              </Link>
              .
            </>
          ) : (
            // `nbPropre === nbThemes` ET `!commun` : CHAQUE thème a le sien, avec
            // des valeurs différentes — il n'y a donc aucun « autre » qui hérite
            // encore du compte. La branche précédente le dirait à tort : c'est
            // l'aboutissement normal de la fonctionnalité (un objectif propre par
            // thème étoilé), pas un cas limite.
            <>
              Tes {nbThemes} thèmes suivent chacun leur propre objectif — plus aucun
              n&apos;hérite de celui du compte. Détail thème par thème sur{" "}
              <Link href="/labels" className="font-semibold text-brand hover:underline">
                ◫ Thèmes →
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        objectifPropre && (
          <p className="text-[11px] text-faint px-4 pb-3.5 leading-relaxed">
            Objectif propre à ce thème, distinct de celui du compte si besoin — réglable sur{" "}
            <Link href="/labels" className="font-semibold text-brand hover:underline">
              ◫ Thèmes →
            </Link>
            .
          </p>
        )
      )}
    </details>
  );
}
