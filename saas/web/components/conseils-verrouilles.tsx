import Link from "next/link";

// ── LE MODULE VERROUILLÉ DES CONSEILS ────────────────────────────────────────
//
// Il occupe EXACTEMENT la place où les conseils du thème auraient été, et il
// est visible — jamais caché, jamais vide. C'est le patron posé par
// `.scratch/refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md`, décision
// a, dans les mots de David : « si la personne n'ajoute rien, on a des modules
// qui sont visibles mais limite flous, on lui demande d'ajouter des labels pour
// pouvoir les débloquer » et « on a des modules qui ont l'air super et qui nous
// motivent à ajouter les labels car — ha voilà, je débloque quelque chose de
// super ». Le classement devient désirable À L'ENDROIT OÙ LE BÉNÉFICE SE VOIT,
// au lieu d'être réclamé sur une page de réglages.
//
// POURQUOI IL EXISTE PLUTÔT QU'UN VIDE. Une carte plus courte que sa voisine,
// sans un mot, se lit de deux façons et les deux sont fausses : « Pulse est
// cassé sur ce thème », ou « ce thème n'a aucun problème ». Un vide non
// expliqué est une règle connue de ce projet.
//
// ET CE N'EST PAS UNE ALERTE. Pas de rouge, pas d'orange : rien n'a échoué, un
// choix n'a pas encore été fait. Le cadenas et la trame disent « verrouillé » ;
// la phrase dit ce qui déverrouille, et elle est la seule chose en gras.
//
// DEUX ÉTATS, PARCE QUE LA PHRASE QUI DÉBLOQUE N'EST PAS LA MÊME :
//   · `aucune-priorite`  — le compte n'a aucune étoile. Il faut en poser une.
//   · `hors-priorites`   — d'autres thèmes sont désignés, pas celui-ci. Il faut
//                          en échanger une, parce que trois est le maximum.
//
// La règle qu'ils servent tous les deux est la phrase du produit : **Pulse
// n'arbitre pas entre les thèmes, le client désigne ses priorités et Pulse
// conseille dedans** (`CLAUDE.md` §1, ADR 0003).
//
// ── UN ÉCART ASSUMÉ AVEC `CONTEXT.md`, À REFERMER PAR LE TICKET 11 ───────────
//
// L'entrée « Priorité (étoile) » de `CONTEXT.md` place le cas
// `aucune-priorite` sur le **module À faire** — « c'est lui qui le dit, jamais
// le module verrouillé d'un thème, qui ne parle que de données manquantes ».
// Le module À faire n'existe pas encore : c'est le ticket
// `.scratch/construction/issues/11-module-a-faire-et-date-libre.md`. En
// attendant, cette phrase vit dans le seul endroit où les conseils existent —
// la colonne de gauche d'une carte de thème. Quand 11 construira À faire, le
// cas `aucune-priorite` déménage chez lui et ne laisse ici que
// `hors-priorites`. C'est un fait remonté, pas une décision reprise.

const LIEN = (
  <Link href="/labels" className="text-brand font-semibold hover:underline">
    ◫ Thèmes
  </Link>
);

export function ConseilsVerrouilles({
  etat,
}: {
  etat: "aucune-priorite" | "hors-priorites";
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-black/[0.02] px-4 py-5 max-w-[68ch]">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-[15px] text-faint leading-none mt-px">
          ⌧
        </span>
        <div className="min-w-0">
          {etat === "aucune-priorite" ? (
            <p className="text-[12.5px] text-muted leading-relaxed">
              <span className="font-semibold text-ink">
                Désigne un thème prioritaire pour recevoir des conseils.
              </span>{" "}
              Étoile jusqu&apos;à trois thèmes sur {LIEN} : Pulse travaille dedans, et
              seulement dedans. En attendant, tu gardes le point de vue de la semaine —
              tes chiffres, ta courbe et ce qui a bougé sur tes plateformes.
            </p>
          ) : (
            <p className="text-[12.5px] text-muted leading-relaxed">
              <span className="font-semibold text-ink">
                Ce thème n&apos;est pas dans tes priorités.
              </span>{" "}
              Pulse conseille sur les trois thèmes que tu désignes, pas plus — sinon la
              semaine se remplit de choses à faire que personne ne fait. Pour travailler
              celui-ci, échange une étoile sur {LIEN}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
