// D'OÙ VIENT UN CHIFFRE, EN UN SIGNE — la table des icônes de plateforme.
//
// Convention maison, déjà en place dans la frise, la nav et l'anneau : ▣ Meta
// en bleu, ◆ Google en vert, ◎ Instagram en violet. Elle vivait dans
// `components/etat-action.tsx` ; elle sort ici, dans un module SANS directive,
// parce que les blocs de l'hebdo (`components/hebdo/`) la lisent des deux
// côtés — serveur et client. Une constante exportée d'un module `"use client"`
// se lit côté serveur comme un proxy, sans erreur (`CLAUDE.md` §8).
//
// Deux entrées de plus que les canaux publicitaires, parce que la provenance
// d'un chiffre ne se limite pas à eux : `instagram` (l'organique) et `site`
// (Google Analytics). Ce dernier prend un losange CREUX et non le losange plein
// de Google Ads — même famille, régie différente, et confondre les deux ferait
// couper Google Ads à qui croit lire son trafic.
//
// `surSombre` n'est pas un raffinement : ces teintes sont choisies pour du
// texte sur blanc, et #1a56ff sur un fond encre est illisible. Une cellule
// sélectionnée s'inverse — il lui faut la version claire.
export const SOURCE: Record<
  string,
  { glyphe: string; couleur: string; surSombre: string; nom: string }
> = {
  meta: { glyphe: "▣", couleur: "#1a56ff", surSombre: "#8fadff", nom: "Meta" },
  google: { glyphe: "◆", couleur: "#1a7a4a", surSombre: "#5fd09a", nom: "Google" },
  instagram: { glyphe: "◎", couleur: "#7b4fff", surSombre: "#bda6ff", nom: "Instagram" },
  site: { glyphe: "◇", couleur: "#5b6472", surSombre: "#c2c8d2", nom: "Google Analytics" },
};

/** Les deux régies publicitaires seules — ce qui peut porter un CHANGEMENT. */
export const CANAL: Record<string, { glyphe: string; couleur: string; nom: string }> = {
  meta: SOURCE.meta,
  google: SOURCE.google,
};

// LE FORMAT D'UNE PUBLICATION, en un glyphe et un nom. Il vivait dans
// `components/frise-semaine.tsx` ; il sort ici parce que la frise de l'année et
// le panneau Organique de l'hebdo le lisent aussi (ticket 08).
//
// Les clés sont les `media_type` de Meta, plus `REEL` : le worker ne l'écrit que
// si `media_product_type` vaut `REELS` (`weekly_report/blocs/posts.py`). Sans
// lui, une vidéo reste « Vidéo » — on n'invente pas le Reel.
export const FORMAT: Record<string, { glyphe: string; nom: string }> = {
  IMAGE: { glyphe: "▢", nom: "Image" },
  CAROUSEL_ALBUM: { glyphe: "▤", nom: "Carrousel" },
  VIDEO: { glyphe: "▶", nom: "Vidéo" },
  REEL: { glyphe: "▶", nom: "Reel" },
  REELS: { glyphe: "▶", nom: "Reel" },
  STORY: { glyphe: "◷", nom: "Story" },
};
export const FORMAT_INCONNU = { glyphe: "·", nom: "Autre" };
export const formatDe = (t: string | null | undefined) =>
  FORMAT[(t || "").toUpperCase()] ?? FORMAT_INCONNU;
