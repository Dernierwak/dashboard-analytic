import type { ChangementPlateforme } from "@/lib/report";

// La date courte et la phrase qu'on écrit d'un changement. Le glyphe, la
// teinte et le nom de chaque plateforme vivent dans `lib/plateformes.ts`.
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
