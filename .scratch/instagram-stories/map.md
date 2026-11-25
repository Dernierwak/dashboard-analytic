# Carte — Les stories Instagram

Label : `wayfinder:map`

## Destination

Une **spec des stories**, prête à remettre à la construction : comment Pulse
attrape une story pendant ses 24 h de vie, reçoit ses chiffres définitifs de
Meta, les garde, et les montre **dans la page `/instagram`**, comme un format
parmi les autres — pas dans une page à part.

## Notes

- **Ce que David veut, dans ses mots (2026-11-25)** : « Instagram envoie les
  stories quand elles sont finies. Il faut qu'elles soient directement
  envoyées sur la Supabase […] et qu'on puisse les afficher. » Une catégorie
  stories **à l'intérieur** de la page Instagram, « on ne sépare pas stories et
  puis le reste ». Les métriques qui n'existent que pour la story (le clic,
  la navigation) vont dans une catégorie comme **Trafic**.
- **Faits déjà établis**, à ne pas refaire :
  - une story n'est lisible que **24 h** ; ses chiffres aussi (« Story media
    metrics are only available for 24 hours ») — recherche du 2026-11-01,
    `git show origin/research/api-post:.scratch/instagram/research/api-post.md` ;
  - métriques d'une STORY selon la doc : `reach`, `views`, `shares`,
    `reposts`, `total_interactions`, `follows`, `profile_visits`,
    `profile_activity`, et **seulement pour elle** `link_clicks`,
    `navigation` (ventilation `story_navigation_action_type`), `replies` ;
  - **`replies` vaut 0 pour les stories créées en Europe** : jamais affiché
    (§7) — à écrire dans `docs/mesures-impossibles.md` ;
  - **sous 5 spectateurs**, l'API rend l'erreur `10`, le webhook `-1` : « – »,
    jamais 0 ;
  - le webhook `story_insights` (Facebook Login, le nôtre) n'envoie selon la
    doc que `reach`, `taps_forward`, `taps_back`, `exits`, `replies`,
    `impressions` — **ni image, ni `link_clicks`, ni `views`, ni `follows`** ;
  - nos scopes suffisent pour les insights des posts et du compte, sans
    `pages_read_engagement` (essai réel du 2026-11-06,
    `.scratch/instagram/issues/17-l-essai-reel-des-metriques.md`) — **non
    essayé sur une story** ;
  - la ventilation du compte par `media_product_type` compte déjà `STORY`
    dans `reach` et `total_interactions`, **dédoublonnée au sein du
    produit** (essai réel, point 8) : piste pour la portée d'une journée de
    stories, que la somme des portées ne donne pas ;
  - le cron actuel tourne **une fois par jour à 07:00 UTC**
    (`.github/workflows/weekly-fetch.yml`) : il ne voit pas une story publiée
    à 07:30 avant qu'elle ait disparu ;
  - le middleware ne laisse passer sans session que `app/login/controle-*/` :
    une route de webhook demande une exception explicite.
- **Ce qui est perdu l'est pour de bon** : rien de ce qui a été publié avant
  la mise en route ne se rattrape. Chaque jour de retard est un jour
  d'historique en moins.
- **§7 partout** : aucun chiffre fabriqué, une absence n'est pas un zéro, des
  portées ne s'additionnent pas, le jour en cours est exclu.
- **Pulse ne conseille rien** (`CLAUDE.md` §1).
- **Grilling : trois questions au plus par série** (David, 2026-10-31).
- Le vocabulaire de la page vit dans `.scratch/instagram/spec.md` §
  Vocabulaire (format, place, objectif) ; la story le reprend.

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by / Assignee`. Le frontier = `Status: open`, rien d'ouvert dans
`Blocked by`, pas d'`Assignee`.

| Ticket | Type | Bloqué par |
|---|---|---|
| [Le webhook et l'API des stories, à jour](issues/01-le-webhook-et-l-api-des-stories.md) | research | — |
| [L'essai réel d'une story](issues/02-l-essai-reel-d-une-story.md) | task (HITL) | — |
| [La journée de stories](issues/03-la-journee-de-stories.md) | grilling | 02 |
| [Trafic et navigation](issues/04-trafic-et-navigation.md) | grilling | 02 |
| [La place de la story dans la page](issues/05-la-place-de-la-story-dans-la-page.md) | grilling | 03, 04 |
| [La récolte horaire et la réception du webhook](issues/06-la-recolte-et-la-reception.md) | task | 01, 02 |
| [La spec des stories](issues/07-la-spec-des-stories.md) | task | 03, 04, 05, 06 |

## Decisions so far

- **Intégrées à `/instagram`, pas de page à part** (David, 2026-11-25) : la
  story est un format de plus, à côté de Reel, Carrousel, Image et Vidéo du
  fil. Un format sans une métrique reçoit une phrase, jamais un zéro — la
  règle existante de la spec.
- **Regroupées par jour** (David, 2026-11-25) : l'unité lue est la **journée
  de stories**, pas la story seule — un compte en publie 5 à 10 d'affilée, une
  par une elles noieraient le Tableau et bruiteraient la place.
- **Le circuit, en trois temps** (proposé le 2026-11-25, accepté par David) :
  1. **chaque heure**, un job léger liste `/{ig-user-id}/stories` ; pour une
     **nouvelle** story, il garde l'identifiant, le type, la date, le lien et
     **copie l'image** dans un bucket Supabase Storage privé (`media_url`
     expire) ;
  2. **une seule lecture des chiffres, quand la story a entre 22 h et 23 h**,
     pour ceux que le webhook n'envoie pas (`link_clicks`, `views`, `follows`,
     `profile_visits`, `shares`) — sans elle, Trafic serait vide ;
  3. **à l'expiration**, le webhook `story_insights` envoie la portée et la
     navigation définitives, reliées à la story **par son identifiant** ; une
     story que le job horaire n'a pas vue garde quand même sa ligne.
  Viser l'heure exacte de fin a été écarté : à 24 h les chiffres ont disparu,
  et le cron GitHub ne vise pas une heure précise.
- **Le webhook se reçoit sur une route Vercel** (recommandation acceptée le
  2026-11-25), pas sur GitHub — GitHub Actions ne reste pas à l'écoute.
- **Sécurité, cinq obligations** (2026-11-25), aucune n'est critique si elles
  sont tenues : signature `X-Hub-Signature-256` vérifiée sur le corps brut
  avec le secret de l'app (rejet sinon) ; `hub.verify_token` dans les
  variables Vercel ; un message pour un compte absent de
  `connected_accounts` est ignoré ; écriture idempotente sur l'identifiant de
  la story (Meta renvoie) ; images dans un bucket privé, aux mêmes règles
  d'accès que les chiffres.
- **`replies` n'est jamais affiché** (0 en Europe, doc Meta).
- **Le webhook, d'après la doc à jour** (2026-11-25,
  [ticket 01](issues/01-le-webhook-et-l-api-des-stories.md)) : contenu inchangé
  dans la référence (`impressions`, `reach`, taps, `exits`, `replies`), alors que
  l'API a retiré `impressions` et les taps — le vrai contenu se lit à la première
  livraison, champ absent ≠ 0. Il faut l'app **Live**, la **revue Meta**
  (Advanced Access), un abonnement **par Page** avec un jeton de Page, et deux
  scopes qui nous manquent : **`pages_manage_metadata`** et
  **`pages_read_engagement`**. Meta retente pendant **36 h**, puis abandonne.
- **L'essai réel** ([ticket 02](issues/02-l-essai-reel-d-une-story.md),
  2026-11-25) : `/stories` et les 12 métriques répondent avec nos scopes ;
  navigation ventilée exacte ; images téléchargeables sans jeton ; la portée
  `STORY` du compte se lit jour par jour et la récolte quotidienne la lit déjà.
- **Pas de webhook** (Claude sur délégation de David, 2026-11-25,
  [ticket 06](issues/06-la-recolte-et-la-reception.md)) : tout se lit pendant
  la vie de la story ; le webhook coûterait deux scopes, l'app Live et la revue
  Meta pour la seule dernière heure. Le circuit devient **relevé horaire +
  relecture à chaque passage dès 20 h de vie**. Les puces « webhook » plus haut
  restent comme historique.
- **La journée** ([03](issues/03-la-journee-de-stories.md)) : jour de
  publication ; sommes des comptes ; portée = `reach_story` du compte ; aucun
  ratio entre ces deux bases ; sorties pour 100 vues.
- **Trafic** ([04](issues/04-trafic-et-navigation.md)) : un Objectif, clics
  sur le lien ; navigation dans le Panneau.
- **La page** ([05](issues/05-la-place-de-la-story-dans-la-page.md)) : rangée
  Story, une ligne par journée, Panneau aux vignettes.
- **La spec** : [`spec.md`](spec.md), construction sous [`tickets/`](tickets/README.md).

## Not yet specified

- **Une story avec lien rend-elle des clics, et une sans lien 0 ou rien ?**
  Les 4 stories de l'essai rendaient 0, sans qu'on sache si l'une portait un
  lien. L'écran le dit en attendant ; à relancer
  `.scratch/instagram-stories/essai/essai_story.sh` un jour de story à lien.
- **Combien de temps une vignette reste téléchargeable** : `--retelecharger`
  pas encore relancé ; sans effet sur le circuit (copie au premier passage).
- **Le webhook** reste possible plus tard si la dernière heure manque : il
  faudra alors l'app Live, la revue Meta et deux scopes (décision de David).

## Out of scope

- **L'onglet Organique de l'hebdo** : déjà un chantier à part au
  `BACKLOG.md` ; il reprendra les stories quand il se refera.
- **Les stories publiées avant la mise en route** : irrécupérables.
- **Les stories Facebook** et tout autre réseau.
- **Les thèmes / labels** (retirés le 2026-09-30).
