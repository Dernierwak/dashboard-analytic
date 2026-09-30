import type { ChangementPlateforme } from "@/lib/report";
import { COULEURS } from "@/lib/couleurs";

// Le lexique des plateformes, en un seul endroit : leur glyphe, leur teinte,
// leur nom, la date courte et la phrase qu'on écrit d'un changement.
//
// Ce fichier portait aussi l'état d'une ACTION décidée par le client — sa
// pastille, son effet, son point d'étape, ses repères de courbe. Ces objets
// sont partis avec le suivi des recommandations ; ce qui reste décrit ce qui
// S'EST PRODUIT sur une plateforme, un fait daté que personne ne juge.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export function dateCourte(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

// D'OÙ VIENT UN CHIFFRE, EN UN SIGNE.
//
// Convention maison, déjà en place dans la frise, la nav et l'anneau : ▣ Meta
// en bleu, ◆ Google en vert, ◎ Instagram en violet. Elle était recopiée dans
// quatre fichiers ; elle se tient ici, avec le reste du lexique.
//
// Deux entrées de plus que les canaux publicitaires, parce que la provenance
// d'un chiffre ne se limite pas à eux : `instagram` (l'organique) et `site`
// (Google Analytics). Ce dernier prend un losange CREUX et non le losange plein
// de Google Ads — même famille, régie différente, et confondre les deux ferait
// couper Google Ads à qui croit lire son trafic.
//
// `surSombre` n'est pas un raffinement : ces teintes sont choisies pour du
// texte sur blanc, et l'encre sur un fond graphite est illisible. Une cellule
// sélectionnée s'inverse — il lui faut la version claire.
export const SOURCE: Record<
  string,
  { glyphe: string; couleur: string; surSombre: string; nom: string }
> = {
  meta: { glyphe: "▣", couleur: COULEURS.encre, surSombre: "#9aa8ff", nom: "Meta" },
  google: { glyphe: "◆", couleur: COULEURS.pos, surSombre: "#5fd09a", nom: "Google" },
  instagram: { glyphe: "◎", couleur: COULEURS.instagram, surSombre: "#bda6ff", nom: "Instagram" },
  site: { glyphe: "◇", couleur: "#5b6472", surSombre: "#c2c8d2", nom: "Google Analytics" },
};

/** Les deux régies publicitaires seules — ce qui peut porter un CHANGEMENT. */
export const CANAL: Record<string, { glyphe: string; couleur: string; nom: string }> = {
  meta: SOURCE.meta,
  google: SOURCE.google,
};

// CE QU'ON ÉCRIT D'UN CHANGEMENT DE PLATEFORME.
//
// Il n'a ni indicateur ni verdict : ce n'est pas une décision qu'on peut
// juger, c'est un FAIT daté. D'où la règle de forme qui l'accompagne — une
// pastille ronde pour ce qu'on a décidé et qui sera jugé, un glyphe pour ce
// qui s'est simplement produit.
export function phraseChangement(c: ChangementPlateforme): string {
  switch (c.type) {
    case "lancee":
      return "lancée";
    case "arretee":
      return "s'est arrêtée";
    case "reprise":
      return "a repris";
    case "planifiee":
      return "est programmée — elle n'a pas encore commencé";
    // Une campagne dont la date de départ est PASSÉE et qui n'a jamais rien
    // dépensé n'est pas « programmée » : elle n'a pas démarré. La nuance n'est
    // pas de langue, c'est la différence entre une annonce et un problème.
    case "jamais_lancee":
      return "devait démarrer, et n'a rien dépensé";
    case "depense":
      return "sa dépense quotidienne a changé";
    default:
      return "a changé";
  }
}
