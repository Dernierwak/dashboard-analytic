# 02: L'essai réel d'une story

Type: task
Status: resolved
Blocked by: —
Assignee: Claude (2026-11-25)

## Question

Ce que la documentation ne tranche pas, **seul un appel réel avec notre
jeton** le tranche — comme l'essai des posts
(`.scratch/instagram/issues/17-l-essai-reel-des-metriques.md`, script
`.scratch/instagram/essai/essai_reel.sh`, à prendre pour modèle). Lancé par
David (le jeton ne passe jamais par la conversation, §7), sur un compte
branché **qui a au moins une story en ligne** au moment de l'essai, et
idéalement une avec un lien.

1. **`/{ig-user-id}/stories`** répond-il avec nos scopes ? Quels champs
   rend-il vraiment ?
2. **Les insights d'une story**, métrique par métrique : `reach`, `views`,
   `shares`, `total_interactions`, `follows`, `profile_visits`,
   `profile_activity` (ventilé par `action_type`), `link_clicks`,
   `navigation` (ventilé par `story_navigation_action_type`), `replies`.
   Pour chacune : valeur, jeu vide, ou erreur (et laquelle).
3. **Une story sans lien** : `link_clicks` rend-il 0, rien, ou une erreur ?
4. **`media_url`** : se télécharge-t-il sans jeton ? Combien de temps
   avant d'expirer (relancer le téléchargement à quelques heures d'écart) ?
5. **La portée du compte ventilée `STORY`** sur une journée passée
   (`period=day`) : rendue, et proche de ce qu'on attend des stories du jour ?
   (piste de [La journée de stories](03-la-journee-de-stories.md))
6. **Une story de moins de 5 spectateurs**, si le compte en a une : l'erreur
   `10` attendue ?

Le script est en lecture seule, imprime un résumé à coller (aucun jeton) et
garde les réponses brutes dans `.essais/` (ignoré par git).

## Le script (2026-11-25)

`.scratch/instagram-stories/essai/essai_story.sh` (wizard, 5 étapes) lance
`essai_story.py`, qui reprend la mécanique d'appel de l'essai des posts
(`essai_reel.Essai`). Lecture seule, environ 70 appels Graph v24.0 : `/stories`,
12 métriques une par une sur 5 stories au plus, téléchargement des images sans
les garder, portée `STORY` du compte sur les 7 derniers jours. Il imprime un
**résumé à coller** et garde le brut dans `.essais/` (ignoré par git).
`--retelecharger` retente les images plus tard (point 4).

Vérifié hors ligne avec une API simulée : pagination, métrique en erreur,
métrique vide, image refusée, `--lister`, `--retelecharger`. L'essai a trouvé
un jeton nu dans un message d'erreur qui passait `sans_jeton` (qui ne masque
que les URL) : la valeur exacte est maintenant retirée de tout ce qui
s'affiche ou s'écrit, revérifié à zéro occurrence. **Pas encore lancé sur un
vrai compte.**

Lancer, depuis la racine du dépôt, un jour où le compte a une story en ligne :
`.scratch/instagram-stories/essai/essai_story.sh`

## Answer

Essai lancé par Claude le 2026-11-25 à 14:45 (délégation de David : « fait le
tout je te fais confiance »), compte `0b83e564-…` (Instagram
`17841400933148249`), Graph v24.0, 4 stories en ligne (âges 1,3 h à 21,9 h).
Brut : `.essais/essai-story-20261125-1445.json` (local, ignoré par git).

1. **`/stories` répond avec nos scopes**, sans `pages_read_engagement`. Champs
   rendus : `id`, `media_type`, `media_product_type`, `timestamp`,
   `permalink` partout ; `media_url` sur **3 sur 4** (la recherche 01 : une
   vidéo avec un son sous droits n'en a pas) ; `thumbnail_url` sur les 3
   vidéos.
2. **Les 12 métriques rendent une valeur sur les 4 stories** : `reach`
   (346, 343, 417, 3 164), `views` (ex. 461), `shares`, `reposts`,
   `total_interactions` (ex. 11), `follows`, `profile_visits`,
   `profile_activity`, `link_clicks`, `navigation` (ex. 373), `replies`.
   **`navigation` ventilée** : `tap_forward` 307, `tap_exit` 47, `tap_back`
   15, `swipe_forward` 4 — somme 373 = la valeur non ventilée.
   **`replies` = 0** partout, comme la doc l'annonce pour l'Europe.
3. **`link_clicks` = 0 sur les 4.** On ne sait pas si l'une portait un lien :
   **0 rendu pour une story sans lien n'est pas exclu.** Reste ouvert (carte,
   Not yet specified) ; l'écran le dira.
4. **Images** : `media_url` et `thumbnail_url` se téléchargent **sans jeton**
   (HTTP 200) — image 829 Ko, vidéos 0,4 à 12 Mo, vignettes 44 à 584 Ko. Le
   paramètre `oe` (déduction, non documenté) annonce une expiration 2 à 5
   jours plus tard. `--retelecharger` pas encore relancé.
5. **La portée `STORY` du compte se lit jour par jour, pour des jours
   passés** : 2 088 à 6 211 du 2026-11-18 au 2026-11-24. **La récolte
   quotidienne la lit déjà** (`releve_compte.py`, `reach_ventile`) et n'en
   garde que la part `AD` : il suffit d'écrire la part `STORY`.
6. Aucune story sous 5 spectateurs : l'erreur `10` n'est pas vue.

Conséquence : **le circuit sans webhook suffit** — tout ce que la page doit
montrer se lit pendant la vie de la story, avec les scopes actuels.
