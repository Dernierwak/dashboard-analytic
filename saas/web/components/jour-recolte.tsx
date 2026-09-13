"use client";

import { useState } from "react";
import { ChoixJour } from "@/components/choix-jour";
import { JOURS, delai, enFrancais, prochainPassage } from "@/lib/jour-de-travail";

// LE JOUR DE LA RÉCOLTE — `profiles.fetch_schedule`, lu par le worker
// (`saas/collecte/automatisation/fetch_all.py`, `_due_today`) qui compare au jour courant en
// anglais et retombe sur lundi quand rien n'est réglé.
//
// Le module suit la grammaire (docs/03-grammaire-des-modules.md) :
//
//   rang 1  titre de lecture — c'est un module qu'on LIT, pas une tuile qu'on
//           scanne : il porte une décision et deux phrases d'honnêteté ;
//   rang 2  PAS DE SORTIE, et c'est une conséquence, pas un oubli. Un lien
//           « récolter maintenant ↓ » descendait vers « ↻ Mes données » : le
//           bouton est sorti de l'app avec les trois autres
//           (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`)
//           et un lien qui mène à un bloc sans bouton promet un geste qui
//           n'existe plus. Régler « vendredi » un mardi se lit maintenant pour
//           ce que c'est : le prochain passage est vendredi ;
//   rang 3  LE chiffre. Il n'est pas un nombre ici, et c'est voulu : « Monday »
//           ne se lit pas, « lundi 17 août » se comprend. Le mono, qui sert à
//           aligner des chiffres entre eux, n'alignerait rien — le reste de la
//           règle tient : premier élément, le plus gros, aucune forme avant lui ;
//   rang 5  le délai, immédiatement sous le chiffre, avec son mot ;
//   rang 8  le pilotage, EN BAS — les sept jours (`components/choix-jour.tsx`,
//           partagé avec la clôture du fil de démarrage). C'est la seule forme
//           du module : une semaine dessinée en sept unités qu'on peut cliquer.
//           En faire aussi un rang 6 décoratif au-dessus donnerait deux fois le
//           même objet ;
//   rang 9  un seul pied, et il dit la limite réelle : la récolte tourne à
//           heure fixe, le jour choisi n'est pas une heure garantie.

// LES SEPT JOURS, LE CALCUL DU PROCHAIN PASSAGE ET L'ÉCRITURE EN FRANÇAIS ONT
// DÉMÉNAGÉ dans `lib/jour-de-travail.ts`, un module SANS directive. Les trois
// dates en tête du rapport (`components/trois-dates.tsx`) ont besoin du même
// calcul et sont rendues par le serveur : une constante exportée depuis un
// module `"use client"` y arriverait sous forme de proxy, sans que rien ne lève
// (`CLAUDE.md` §8). Ce module-ci reste client — il porte l'état des sept
// boutons — et lit les mêmes valeurs que le serveur.

export function JourRecolte({
  jour,
  maintenantIso,
}: {
  /** Valeur en base (`Monday`, …). Défaut lundi, comme le worker. */
  jour: string;
  /** L'heure du serveur, figée au rendu : le calcul est donc le même des deux
   *  côtés de l'hydratation. */
  maintenantIso: string;
}) {
  const [choisi, setChoisi] = useState(JOURS.some((j) => j.en === jour) ? jour : "Monday");

  const maintenant = new Date(maintenantIso);
  // La date de tête suit le clic sans attendre le serveur : c'est la réponse au
  // geste. `ChoixJour` la remet à sa valeur d'avant si l'écriture échoue.
  const { date, delta } = prochainPassage(choisi, maintenant);

  return (
    <section className="bg-white border border-line rounded-xl shadow-card p-5 mb-5">
      {/* rang 1 — seul : il n'y a pas de sortie, voir la grammaire en tête. */}
      <div className="mb-4">
        <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
          <span className="inline-block h-[18px] w-[3px] rounded-full bg-brand shrink-0" aria-hidden />
          Le jour de ta récolte.
        </h2>
      </div>

      {/* rang 3 — le jour servi, écrit pour être lu */}
      <div className="text-[30px] sm:text-[34px] leading-none font-semibold tracking-tight text-ink">
        {enFrancais(date)}
      </div>

      {/* rang 5 — le délai, immédiatement sous lui */}
      <p className="text-[12.5px] text-muted mt-2.5">
        prochaine récolte · <span className="font-semibold text-ink">{delai(delta)}</span>
      </p>

      {/* rang 8 — le pilotage, en bas */}
      <div className="mt-5 pt-4 border-t border-line">
        <ChoixJour valeur={choisi} onValeur={setChoisi} />
      </div>

      {/* rang 9 — un seul pied, et il dit la limite */}
      <p className="text-[11px] text-faint mt-4 leading-relaxed">
        La récolte est lancée une fois par jour à heure fixe (07:00 UTC) et ne traite que
        les comptes dont c&apos;est le jour : tu choisis le jour où tu es servi, pas la
        minute. C&apos;est aussi le seul moment où tes conseils sont réécrits — une
        source que tu viens de brancher, elle, est récoltée tout de suite.
      </p>
    </section>
  );
}
