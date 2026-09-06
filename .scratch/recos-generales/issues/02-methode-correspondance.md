Type: grilling
Status: resolved
Blocked by: 01

## Question

Quelle méthode le classificateur du Graphe A utilise pour juger qu'une piste
candidate "correspond" à une catégorie déjà connue de `reco_engine` ? Trois
options posées dans l'artifact "La fabrique des recos" :

1. Mots-clés (comme `_levier()` aujourd'hui) — gratuit mais grossier.
2. Embedding + similarité cosinus — robuste, coûte un appel par piste.
3. Second appel IA classificateur — le plus flexible, le plus cher.

Cette décision **bloque toute la Phase 2** du plan de construction partagé
(le module `saas/recos_ia/reco_classifier.py`, `classify()`, `_match_category()`,
`_pattern_signature()`) — c'est la première chose à trancher avant d'écrire
du code sur le classificateur.

À trancher avec David : le budget (coût par appel IA vs gratuit), le niveau de
faux positifs/négatifs acceptable, et si le choix diffère entre le Graphe A
(compte) et le futur classificateur du Graphe B (même famille documentée,
mais "chantier séparé").

## Answer

Fait vérifié en cours de route : le classificateur construit puis retiré
(commits `c4a630a` / `b10b9fd`) n'utilisait aucune des trois options posées —
une **quatrième méthode**, plus simple que toutes : Gemini **auto-déclare sa
catégorie dans le même appel** qui rédige l'idée (pas un second appel IA),
puis le code fait une **comparaison exacte de chaîne** contre la liste fermée
des clés `reco_engine` (`CLASSIFIER_CATEGORIES_IA`) — toute valeur hors liste
rejette la piste sans repli. Gratuit (aucun appel IA supplémentaire), précis
(pas de mots-clés approximatifs, pas de seuil de similarité à calibrer).
Le message du commit de retrait (`b10b9fd`) ne signale **aucun problème
technique** avec cette méthode — le retrait est motivé uniquement par la
décision produit "on fait pas de recos générale", sans lien avec la qualité
du matching.

Décision de David : **on reprend cette méthode telle quelle** — auto-
déclaration dans le même appel + comparaison exacte — plutôt que
mots-clés/embedding/second appel IA.

Sur la dernière sous-question ("le choix diffère-t-il du Graphe B ?") : sans
objet — le Graphe B (carte sœur `.scratch/recos-labels/`) n'a pas de
classificateur du tout, il génère directement 1 hypothèse par thème sans
notion de correspondance à une catégorie existante.

