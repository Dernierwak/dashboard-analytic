# 20: L'Analyse Search en maquette

Type: prototype
Status: open
Blocked by: 18
Assignee: —

## Question

**À quoi ressemble l'Analyse Search, et se lit-elle ?** La structure est
tranchée ([L'Analyse Search](18-l-analyse-search.md), réponse) : onglets de
type, nuage Performance piloté par le Sélecteur de vue, niveau (campagnes ›
groupes d'annonces › annonces › éléments), onglet Étendue, listes mots-clés
puis termes, catégories de termes, choix des actions de conversion.

À éprouver avec David :
- la **règle des couleurs** au-delà de 8 campagnes (le compte A en a 21
  actives) ;
- la **phrase de lecture** de chaque nuage, sans juger ;
- la descente de niveau : où se place le contrôle, comment on remonte ;
- la place du menu des actions de conversion.

La leçon des tickets 08 et 15 : montrer **la seule section**, dans la page, en
partant de la grammaire Meta. Chiffres fictifs, plausibles, jamais présentés
comme ceux du client.

## Comments

- 2026-11-11 — Contraintes posées par
  [L'essai réel de l'Analyse Search](19-l-essai-reel-de-l-analyse-search.md),
  à respecter dans la maquette :
  - au niveau **éléments**, chaque point se lit seul : leurs chiffres ne
    s'additionnent pas (≈ 5 fois les clics réels), donc ni total, ni part ;
  - les **catégories** n'ont pas de coût ; un même sujet y est découpé par
    langue ; la catégorie fourre-tout (≈ 16 % des clics) ne liste aucun terme ;
  - la liste des **termes** n'est jamais le tout : 44 à 61 % des clics Search
    viennent de termes masqués, et la part masquée s'affiche ;
  - **niveau de qualité** « — » pour les mots-clés sans note (58 % des
    mots-clés actifs chez A) et pour tout mot-clé inactif ;
  - le **menu des actions** part des objectifs de chaque campagne : une
    action « non principale » peut porter l'essentiel des conversions.
