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
// IL PREND SON THÈME EN PROPS, IL NE LIT AUCUN ÉTAT GLOBAL — et c'est ce qui
// prépare la suite. Le jour où la section des thèmes défilera horizontalement,
// chaque thème portera son propre objectif : il suffira de rendre un
// `ObjectifTheme` par carte, dans le même conteneur qui glisse, sans toucher à
// ce fichier. Voir le commentaire de `app/page.tsx`, section 2.
//
// Aujourd'hui l'objectif est UNIQUE par compte (`profiles.objectif`). Le module
// l'écrit noir sur blanc dès qu'il y a plus d'un thème, plutôt que de laisser
// croire qu'il ne concerne que la carte du dessous — ce serait un réglage
// présenté pour autre chose que ce qu'il commande.

const OBJ_MOT: Record<string, string> = {
  ventes: "Plus de ventes",
  notoriete: "Être plus connu",
  engagement: "Une communauté qui réagit",
};

export function ObjectifTheme({
  theme,
  objectif,
  priorities,
  nbThemes,
}: {
  /** Le thème que ce widget coiffe. `null` = aucun thème classé encore. */
  theme: { label: string; is_priority: boolean } | null;
  /** L'objectif qui s'applique à CE thème. Un jour : `theme.objectif`. */
  objectif: string | null;
  priorities: string[];
  /** Combien de thèmes se partagent cet objectif — 1, 6, ou zéro. */
  nbThemes: number;
}) {
  const mot = OBJ_MOT[objectif ?? ""] ?? "à définir";
  const partage = nbThemes > 1;

  return (
    <details className="group rounded-xl border border-line bg-white shadow-card mb-3">
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qu&apos;on cherche
        </span>
        <span className="text-[14px] font-semibold text-brand">{mot}</span>
        {theme && (
          <span className="text-[12.5px] text-muted">
            {partage ? "· commun à " : "· pour "}
            {partage ? (
              <span className="font-semibold text-ink">tes {nbThemes} thèmes</span>
            ) : (
              <span className="font-semibold text-ink">
                {theme.is_priority && <span className="text-warn">★ </span>}
                {theme.label}
              </span>
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
          <ObjectifSelect current={objectif} />
          <p className="text-[11px] text-faint mt-2 leading-relaxed">
            Il décide de l&apos;indicateur suivi par chaque carte et de l&apos;ordre des
            conseils. Pris en compte à la prochaine publication du rapport.
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

      {/* Rang 9 — le pied, un seul. Ce que ce réglage ne sait PAS encore faire. */}
      {partage && (
        <p className="text-[11px] text-faint px-4 pb-3.5 leading-relaxed">
          Un seul objectif pour l&apos;instant, partagé par tes {nbThemes} thèmes. Un
          thème qui vise la notoriété et un autre les ventes ne se pilotent pas au
          même indicateur — c&apos;est ici que ça se réglera quand chaque thème aura le
          sien.
        </p>
      )}
    </details>
  );
}
