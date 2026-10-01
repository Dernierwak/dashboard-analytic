# Trois harnais testent ce qui est parti

Type: task
Status: open
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — rangé ici le 2026-10-01 : c'est une réparation, pas une décision.

## Question

Trouvé en chemin par « Le thème et le label quittent l'écran et le code ».

Le faux lecteur partagé (`.scratch/construction/harnais/16-le-seam-du-payload/lecteur_fige.py`)
ne grée plus de thème : `Campagne` n'a plus de champ `theme`, `compte()` ne
prend plus `etoiles`. Le harnais 16 a été adapté et passe (71/71, 23/23). Les
trois autres qui importent ce faux lecteur tombent dès la construction de leur
jeu, sur `Campagne(..., theme=...)` :

- `18-revenu-google/test_part_muette.py` — mesure la part muette du ROAS **par
  thème**. L'objet mesuré n'existe plus : à supprimer, ou à ramener au compte
  si la part muette doit survivre ailleurs (voir ADR 0010 : plus de jointure
  GA4 pour Meta).
- `20-canal-muet/test_canal_muet.py` et `47-escalade-canal-muet/test_escalade.py`
  — testent le **canal muet**, qui reste une fonction vivante du produit. Mais
  ils l'observent à travers les cartes de thème (`themes_focus`), les étoiles et
  des règles de conseil (`theme_hors_budget`, `theme_deux_regies`) parties dès
  le 2026-09-21. Ils étaient donc probablement déjà rouges avant ce ticket —
  non vérifié.

Rien à décider sur le fond : réécrire 20 et 47 pour qu'ils observent le canal
muet là où il vit encore (`canaux_muets`, le verdict, la frise), décider du sort
du 18, et rejouer. Sans ça, le seul filet du canal muet ne tient plus.
