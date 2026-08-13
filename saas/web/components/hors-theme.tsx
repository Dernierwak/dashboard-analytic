import type { ChangementPlateforme, TrackedAction } from "@/lib/report";
import type { ChangementApi } from "@/lib/changements-api";
import { RailActions } from "@/components/rail-actions";
import { NoteAjout } from "@/components/note-ajout";

// LE FILET — ce qu'aucune carte de thème ne prend.
//
// Il était une bande pleine largeur en bas de page ; il est maintenant une
// colonne à gauche de « Ta boussole », et le déplacement change ce qu'il doit
// dire. Contre la courbe du compte, il n'est plus un repêchage : c'est le
// registre de ce qui a bougé pendant que la courbe bougeait.
//
// D'où son rang 3 — il n'en avait aucun, il ouvrait sur un titre puis une
// liste. Le chiffre compte ce qui S'EST PASSÉ, pas ce qui attend : les
// campagnes « programmée — aucune dépense encore » sont un état, pas un
// événement, elles ne valent qu'en nombre et se replient sous le rail.
//
// IL VIVAIT DANS `app/page.tsx`, ET C'EST CE QUI A COÛTÉ LE PLUS CHER.
// Un module écrit à l'intérieur d'une page n'est vérifiable qu'en production :
// la page est derrière `middleware.ts`, elle lit un vrai compte Supabase, et on
// ne peut donc ni lui donner vingt-cinq lignes ni lui en donner zéro pour voir
// ce que ça fait. Les deux défauts corrigés ici — une liste sans fin et une
// carte qui ne tenait pas la hauteur de sa rangée — sont exactement ceux qu'un
// écran de contrôle aurait montrés le premier jour. Même raison, même remède
// que pour `components/couts-modules.tsx`.
//
// LA LISTE DÉFILE, LE MODULE NON. `.defile` (voir `app/globals.css`) est posé
// sur le SEUL rail : l'en-tête — le surtitre, le chiffre, la phrase qui le
// nomme — reste au-dessus, fixe. Un module dont l'en-tête part au défilement
// perd ce qui nomme son nombre : on lit « 14 » sans savoir 14 de quoi. Le pied
// (« ✎ Noter quelque chose », la provenance des lignes) reste sous la liste
// pour la même raison — un geste qu'il faut aller chercher en défilant n'existe
// pas. Le fond derrière le rail est celui de la carte, du blanc : `.defile` se
// peint en blanc par défaut, aucune variante à écrire.
//
// LA HAUTEUR VIENT DE LA RANGÉE, PAS DU CONTENU — et c'est `rangee` qui le dit.
//
// Le module partage sa ligne avec « Ta boussole », qui est haute (un grand
// chiffre, une courbe de 210 px, un sélecteur de neuf indicateurs). Tant que la
// grille était en `items-start`, les deux cartes finissaient où elles voulaient
// et un vide s'ouvrait sous la plus courte. La carte s'étire donc sur la
// hauteur de la rangée, et c'est la zone défilante qui absorbe ce qui reste
// (`flex-1 min-h-0`) : une `max-h` en dur laisserait soit un trou sous la liste
// quand la boussole est haute, soit un débordement quand elle est courte.
//
// `min-h-0` n'est pas décoratif : un enfant flex vaut `min-height: auto`, il
// refuse de descendre sous la hauteur de son contenu, et sans lui la carte
// s'allonge au lieu de faire défiler.
//
// Reste le piège qui casse d'habitude, et il est en amont de tout ça : une
// carte qui contient vingt-cinq lignes DIT à sa rangée qu'elle a besoin de
// vingt-cinq lignes. `flex-basis: 0` n'y change rien — la hauteur intrinsèque
// d'une colonne flex reste celle de son contenu, la ligne de grille grandit
// avec, et c'est le filet qui fixe la hauteur au lieu de la subir. La carte
// sort donc du flux de sa cellule (`lg:absolute lg:inset-0`, la cellule portant
// `lg:relative`) : elle ne pèse plus rien dans le calcul de la rangée, la
// boussole reste seule à la mesurer, et `inset-0` lui rend exactement cette
// hauteur-là.
//
// EN DESSOUS DE `lg`, IL N'Y A PLUS DE RANGÉE — donc plus de hauteur à égaler.
// Les deux cartes s'empilent, la boussole passe en premier, et le filet reprend
// une hauteur naturelle : positionnement normal, et un plafond de 420 px sur la
// liste pour qu'une année de faits ne fasse pas défiler la page pendant dix
// secondes. Même chose quand il est SEUL sur sa rangée (pas de boussole dans ce
// rapport) : personne ne lui donne de hauteur, il ne peut que prendre la
// sienne, bornée à 58 vh pour rester un module et non une page.
export function HorsTheme({
  actions,
  changements,
  changementsApi,
  survenus,
  programmees,
  rangee = false,
}: {
  actions: TrackedAction[];
  changements: ChangementPlateforme[];
  changementsApi: ChangementApi[];
  survenus: number;
  programmees: number;
  /** true quand le module partage sa rangée avec un voisin qui en fixe la
   *  hauteur — « Ta boussole ». La cellule qui l'accueille porte alors
   *  `lg:relative`, sans quoi la carte se caserait sur la page entière. */
  rangee?: boolean;
}) {
  return (
    <section
      id="actions-hors-theme"
      className={`flex flex-col bg-white border border-line rounded-2xl shadow-card px-4 py-4 scroll-mt-4 ${
        rangee ? "lg:absolute lg:inset-0" : ""
      }`}
    >
      {/* Rangs 1 à 3 — le surtitre, le chiffre, ce que le chiffre compte. Ils
          ne défilent pas : `shrink-0` les protège du jour où la liste réclame
          plus de place que la rangée n'en donne. */}
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
          Hors de tes thèmes
        </div>

        {survenus > 0 ? (
          <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
            <span className="font-mono text-[26px] leading-none font-medium text-ink">
              {survenus}
            </span>
            <span className="text-[11.5px] text-muted leading-snug">
              {survenus > 1 ? "faits et actions" : "fait ou action"} qu&apos;aucun thème ne
              prend
            </span>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted leading-relaxed mb-2.5">
            Rien hors de tes thèmes
            {programmees > 0 ? " — à part ce qui attend de démarrer." : "."}
          </p>
        )}
      </div>

      {/* LA SEULE ZONE QUI DÉFILE. `maxH` de `RailActions` est un emplacement de
          classes, pas une valeur : c'est par lui qu'on remplace le plafond en
          dur par « prends ce qui reste » sans écrire un second mécanisme de
          défilement à côté de `.defile`. */}
      <RailActions
        actions={actions}
        changements={changements}
        changementsApi={changementsApi}
        themeCourant={null}
        maxH={`flex-1 min-h-0 max-h-[420px] ${rangee ? "lg:max-h-none" : "lg:max-h-[58vh]"}`}
      />

      <div className="shrink-0">
        <NoteAjout theme={null} />

        {/* Rang 9 — le pied, un seul : pourquoi ces lignes sont là. */}
        <p className="text-[10.5px] text-faint/80 mt-2 leading-relaxed">
          Prises depuis les réglages de base, posées sur un thème sorti de tes priorités,
          ou faites sur une campagne que tu n&apos;as pas encore étiquetée.
        </p>
      </div>
    </section>
  );
}
