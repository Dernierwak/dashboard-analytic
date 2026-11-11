# 17: Les mots-clés et les termes de recherche dans l'API Google Ads

Type: research
Status: open
Blocked by: —
Assignee: —

## Question

L'Analyse Search (ticket 18) montrera les **mots-clés** et les **termes de
recherche** d'un compte, tous ou filtrés par campagne, peut-être en nuage de
points coloré par campagne ([Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md),
réponse). **Qu'est-ce que l'API Google Ads v26 rend pour eux, et à quelles
conditions ?**

- **Mots-clés** (`keyword_view`, `ad_group_criterion`) : les métriques
  (impressions, clics, coût, conversions, valeur, CTR, CPC), le type de
  correspondance, le statut, le niveau de qualité et ses trois composantes,
  la part d'impressions et la part perdue (budget, classement) — lesquelles
  existent par jour, lesquelles seulement sur une période ?
- **Termes de recherche** (`search_term_view`) : métriques, lien au mot-clé
  qui les a déclenchés, seuil de confidentialité (termes masqués à faible
  volume : quelle part du coût échappe au détail ?), PMax
  (`campaign_search_term_view`, ticket 01) et ses limites.
- **Ce qu'il faut pour les spécialités de l'Analyse (18)** : le texte exact
  du terme et du mot-clé déclencheur, le type de correspondance du mot-clé et
  celui avec lequel le terme a été apparié (`segments.search_term_match_type`
  ou équivalent v26), le statut du terme (ajouté, exclu, aucun), et les
  **mots-clés à exclure** déjà posés (au niveau campagne, groupe, listes
  partagées) — pour que Pulse ne montre pas comme « à voir » un mot déjà
  exclu. Le découpage des termes en mots est fait par Pulse : seulement
  vérifier que le texte est rendu tel quel (casse, accents, langue).
- **Limites** qui rejettent ou tronquent : fenêtre maximale, volume de lignes,
  lignes à 0 omises avec `segments.date` (piège du ticket 10).
- **Ce que l'interface Google Ads montre** pour ces deux écrans (colonnes par
  défaut, « Autres termes » pour ce qui est masqué), pour que Pulse retrouve
  les mêmes nombres (principe du ticket 05).

Déjà su : 8 400 lignes mot-clé × jour et 8 700 termes sur 90 jours pour le
compte principal (ticket 10) ; les mots-clés ne sont pas récoltés aujourd'hui
(`BACKLOG.md`, 2026-09-08).

## Rendu attendu

Une page de constats sourcés (developers.google.com et l'aide Google Ads),
avec un tableau « champ × disponible par jour / par période / jamais ».
Findings sur la branche jetable `research/google-mots-cles`, fichier
`.scratch/google-ads/research/mots-cles.md`, poussée sans PR ; pointeur de
contexte ici.
