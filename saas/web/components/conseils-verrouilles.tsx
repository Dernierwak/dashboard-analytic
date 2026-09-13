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
// DEUX ÉTATS, PARCE QUE CE QUI MANQUE N'EST PAS LA MÊME CHOSE :
//   · `hors-priorites`   — d'autres thèmes sont désignés, pas celui-ci. Il faut
//                          en échanger une, parce que trois est le maximum.
//   · `aucune-priorite`  — le compte n'a aucune étoile. Cette carte-ci ne
//                          RÉCLAME alors rien : elle nomme l'état et renvoie au
//                          module « À faire », qui porte le geste.
//
// La règle qu'ils servent tous les deux est la phrase du produit : **Pulse
// n'arbitre pas entre les thèmes, le client désigne ses priorités et Pulse
// conseille dedans** (`CLAUDE.md` §1, ADR 0003).
//
// ── POURQUOI LE CAS « AUCUNE ÉTOILE » NE DEMANDE PLUS RIEN ICI ───────────────
//
// `CONTEXT.md` (entrée « Priorité ») place ce cas sur le **module À faire** :
// « c'est lui qui le dit, jamais le module verrouillé d'un thème, qui ne parle
// que de données manquantes ». Le module existe depuis le ticket
// `.scratch/construction/issues/11-module-a-faire-et-date-libre.md` : la demande
// d'étoiler — la phrase en gras, le lien vers ◫ Thèmes, ce qu'une étoile
// débloque — a donc déménagé chez lui, et elle n'est plus écrite ici.
//
// Mais la carte ne se tait pas pour autant : sans une étoile sur tout le compte,
// TOUTES les cartes ont leur colonne de conseils vide, et un vide non expliqué
// se lit comme une panne. Elle nomme donc l'état en une ligne et désigne où le
// geste se pose — un seul endroit demande, tous les autres expliquent. Répéter
// la demande sur cinq cartes en ferait le décor qu'on évite partout ailleurs.

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
                Aucun thème n&apos;est prioritaire pour l&apos;instant.
              </span>{" "}
              Pulse ne conseille que dans les thèmes que tu désignes — le module{" "}
              <a href="#a-faire" className="text-brand font-semibold hover:underline">
                À faire
              </a>
              , en haut du rapport, dit comment en désigner un. En attendant, tu gardes le
              point de vue de la semaine — tes chiffres, ta courbe et ce qui a bougé sur tes
              plateformes.
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
