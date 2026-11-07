// La couleur de chaque format, partagée par le nuage, la liste des 5
// meilleurs (ticket 11) et le Panneau. Ici, sans directive, pour que serveur
// et client lisent la même valeur (`CLAUDE.md` §8). Les teintes sont celles
// du prototype retenu par David (version D) et viennent toutes du nuancier
// maison (`lib/palette.ts`) : violet Instagram pour le Reel, puis bleu, ambre
// et turquoise — quatre teintes non voisines de la roue.
import { SERIES, type Teinte } from "../palette";
import type { Format } from "./lecture";

const par = (nom: string): Teinte => SERIES.find((t) => t.nom === nom) as Teinte;

export const COULEUR_FORMAT: Record<Format, Teinte> = {
  reel: par("violet"),
  carrousel: par("bleu"),
  image: par("ambre"),
  video_fil: par("turquoise"),
};
