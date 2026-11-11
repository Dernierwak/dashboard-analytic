# 17: Les mots-clés et les termes de recherche dans l'API Google Ads

Type: research
Status: resolved
Blocked by: —
Assignee: Claude (agent de recherche, 2026-11-11)

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

## Answer

Constats sourcés (référence v26, guides developers.google.com, aide Google
Ads ; lus le 2026-11-11, aucun appel réel) : branche `research/google-mots-cles`
(`5ae6ebd`), fichier `.scratch/google-ads/research/mots-cles.md` sur cette
branche.

- **Le nuage des mots-clés est faisable** : `keyword_view` rend par jour
  impressions, clics, coût, conversions, valeur, CTR, CPC ; la campagne est
  un attribut, on peut colorer par campagne.
- **`keyword_view` omet un mot-clé sans impression et un mot-clé exclu** (guide
  « Criteria metrics ») : pour les voir, lire aussi `ad_group_criterion` — ils
  s'affichent sans chiffres, jamais avec des zéros.
- **Part d'impressions du mot-clé** : part, part perdue (classement), haut de
  page, correspondance exacte, part de clics, par jour. La **part perdue
  (budget)** serait refusée avec `keyword_view` dans le FROM — lu par l'agent
  dans les marqueurs de compatibilité, **non confirmé** par mon contrôle (le
  filtre de la page est interactif) : à trancher par un essai réel. Les
  valeurs 0,0999 et 0,9001 sont des plafonds, pas des mesures.
- **Niveau de qualité** : `ad_group_criterion.quality_info.*` (note et trois
  composantes, état actuel, parfois vide) ou `metrics.historical_*` (par jour,
  sans appareil, réseau, correspondance ni conversion). Rien sur les termes.
- **Termes** (`search_term_view`) : un terme par groupe d'annonces, avec le
  mot-clé déclencheur (texte, type, critère) et `segments.search_term_match_type`
  (`EXACT` / `NEAR_EXACT`, `PHRASE` / `NEAR_PHRASE` — valeurs lues par
  l'agent, pas par mon contrôle). Pas de part d'impressions ni de qualité.
- **« Déclenché tout seul »** se calcule de deux façons qui divergent : texte
  du terme identique au mot-clé, ou appariement `EXACT` (une variante proche
  est `NEAR_EXACT`). À choisir au 18.
- **Statut du terme** : `ADDED`, `EXCLUDED`, `ADDED_EXCLUDED`, `NONE` —
  « currently », l'état actuel et non celui du jour de la ligne (**vérifié** sur
  la page de référence). Il dit si un terme est déjà exclu ; s'il couvre les
  listes partagées et la liste du compte : non trouvé.
- **Seuil de confidentialité** : les clics des termes masqués comptent dans la
  campagne, pas dans le rapport des termes ; aucun seuil publié. La part
  masquée ne se lit pas, elle se **calcule** (total campagne − somme des
  termes, même fenêtre).
- **Exclusions déjà posées**, quatre niveaux : groupe et campagne (critère
  `negative`), listes partagées (`shared_set` `NEGATIVE_KEYWORDS`), compte
  (`ACCOUNT_LEVEL_NEGATIVE_KEYWORDS`). Une exclusion couvre casse et fautes,
  pas les variantes proches — à savoir pour le mot récurrent découpé par Pulse.
- **PMax** : `campaign_search_term_view`, par campagne, sans mot-clé
  déclencheur, depuis mars 2023 ; il contient aussi Search — l'additionner à
  `search_term_view` compterait deux fois (_déduction_ de l'agent).
- **Limites** : lignes à 0 omises par jour ; 37 mois par jour, au-delà la
  requête est rejetée ; pages de 10 000 lignes, aucune troncature documentée ;
  aucune fenêtre propre aux termes ou mots-clés.
- **Non trouvé** : casse et accents du terme tels que tapés ; la ligne
  « Other search terms » de l'interface ; la liste d'exclusion d'un compte
  manager lue depuis le compte client.

Ce qui reste incertain se vérifie par un essai réel avant la spec (même
démarche que le ticket 10) — noté dans la carte.
