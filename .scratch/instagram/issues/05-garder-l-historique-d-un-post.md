# 05: Garder l'historique des chiffres d'un post

Type: grilling
Status: resolved
Blocked by: 03
Assignee: Claude

## Question

Aujourd'hui la récolte **écrase** les chiffres d'un post à chaque passage
(upsert `(user_id, post_id)`) : on ne sait pas ce qu'un post valait à J+2. Pour
comparer **à âge égal**, faut-il garder un relevé daté des chiffres de chaque
post — et alors **pendant combien de jours après publication**, à **quelle
fréquence** (chaque Jour de travail ? chaque jour ?), pour **quels posts**
(les 10 d'un compte gratuit ? les 200 d'un payant ?), et à quel coût en appels
Graph par passage du worker ?

Dépend de [Quand les chiffres d'un post se figent](03-quand-les-chiffres-d-un-post-se-figent.md) :
si l'API rend déjà la série jour par jour, ce ticket se réduit ; si elle ne
rend que le cumul, il devient le cœur de la récolte. Un relevé ne commence
qu'au jour où on le construit : les posts déjà publiés n'auront jamais leur
J+2 — dire ce que la page montre pour eux.

> **Éclairé par [la recherche 03](03-quand-les-chiffres-d-un-post-se-figent.md)
> (2026-11-01)** : l'API ne rend qu'un cumul `lifetime` ; **le relevé daté est
> la seule voie vers l'âge égal**, et la seule source possible d'un seuil de
> maturité au-delà de 48 h. Les insights d'un média restent lisibles 2 ans.

## Answer

Grilling avec David, 2026-11-02/03. Oui : on garde un relevé daté — c'est la
seule voie vers l'âge égal (recherche 03).

- **Relevé** : la lecture datée du cumul d'un post. Il s'ajoute, il n'écrase
  jamais. Le chiffre affiché d'un post est son dernier relevé. **Âge** :
  heures écoulées entre la publication et le relevé ; « J+n » = au moins
  n × 24 h ; on stocke l'âge **réel** (un passage manqué donne un J+8, jamais
  un faux J+7).
- **Fréquence** : un **passage quotidien léger**, Instagram seulement, relève
  **tous** les posts de J+0 à J+7 — sans plafond : la fenêtre et la limite des
  posts en base (200 payant / 10 gratuit) le bornent déjà. Le cron tourne déjà
  chaque jour ; c'est un nouveau mode du worker, qui n'écrit que des relevés
  et ne touche pas au rapport. Ensuite, la relecture du Jour de travail
  (jusqu'à J+30, plafond 40) ajoute elle aussi un relevé.
  Raison : relevé au seul Jour de travail, un post du dimanche est lu à J+1,
  un du mardi à J+6 — l'âge égal est impossible. David : un post bouge
  surtout à 24–48 h, rarement après une semaine ; d'où la fenêtre de 7 jours,
  que les relevés vérifieront (seuil observé du ticket 07).
- **Coût** (lu dans `fetchers/post_metrics.py`) : 2 appels Graph par relevé
  (insights + `follows`), 1 pour un Reel ; ni fiche, ni image, ni inventaire —
  les posts jeunes se lisent en base. Ordres : ~2 appels/jour (1 post/sem.),
  ~16 (1/jour), ~112 (8/jour). Quota sans rapport (4800 × affichages / 24 h).
  **Durée par appel non mesurée** : elle se mesure à l'essai.
- **Quels posts** : tous les posts publiés à partir de la mise en service,
  gratuits compris. Rien de reconstitué : un post plus ancien n'a pas de J+2,
  et ce que la page en montre se tranche dans [L'âge d'un post](07-l-age-d-un-post.md).
- **Affichage** : la page montre le dernier relevé **et sa date**, avec une
  phrase qui explique l'écart avec le rapport hebdo, lui figé au jour de sa
  publication (texte exact : maquette de la page).
- **Absence** : une métrique non rendue est écrite absente, jamais 0 (§7) —
  le défaut actuel de `follows` doit être corrigé avant le premier relevé.
- **Stockage** : une table de relevés à part, à côté de
  `instagram_organic_posts` ; sa forme se décide dans
  [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md).
- **Heure par heure** : écarté pour l'instant. L'API ne rend aucune courbe ;
  il faudrait 24 passages par jour, et le cron GitHub ne garantit pas l'heure.
  Idée gardée par David (« on se la note et on voit comment faire ») —
  `BACKLOG.md` est absent de l'arbre depuis `1b05a92`, elle vit donc ici et
  sur la carte.
- **Posts boostés** : remarque de David pendant ce grilling (« ça fait une
  grosse différence ») → nouveau ticket [Les posts boostés](19-les-posts-boostes.md).
