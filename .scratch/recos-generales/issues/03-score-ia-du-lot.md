Type: grilling
Status: resolved
Blocked by: 01

## Question

L'artifact "La fabrique des recos" note : "un LLM qui note son propre travail
est un signal faible seul ; il vaut surtout comme alerte (\"ce lot répète 3×
le même levier\") plutôt que comme note affichée. À calibrer contre le
jugement humain avant de lui faire confiance."

À trancher : est-ce qu'on construit ce score IA du lot, sous quelle forme
exactement (une alerte interne visible seulement en admin ? un signal qui
déclenche une relecture humaine ? rien pour l'instant tant qu'il n'y a pas de
volume à calibrer) — et quel protocole de calibrage contre le jugement
humain avant de lui faire confiance (ex. comparer N lots notés par l'IA et
par l'agent `recos` sur les mêmes critères — Décision / Répétition /
Vérifiabilité / Honnêteté).

## Answer

Décisions de David :
1. **On attend** — pas de volume réel tant que le classificateur du Graphe A
   (ticket 02) n'est pas reconstruit ; construire un calibrage sur du vide
   n'a pas de sens. Ce ticket décrit l'intention, pas un chantier immédiat.
2. **Jamais visible côté client, confirmé** — signal interne uniquement
   (logs/admin), jamais un chiffre de qualité affiché au client, et
   seulement après calibrage.
3. **Protocole de calibrage accepté** : prendre N lots réels une fois le
   volume disponible, les faire noter par l'IA et par l'agent `recos` (même
   grille Décision/Répétition/Vérifiabilité/Honnêteté), ne faire confiance
   au score IA que s'il est d'accord avec l'agent `recos` sur un pourcentage
   minimum de lots, sur plusieurs semaines de suite. N et le seuil exact
   restent un détail à fixer au moment de calibrer, une fois qu'on voit le
   volume réel disponible — pas une décision à figer maintenant sur du vide.

