# L'identifiant d'annonce Meta : la migration livrée est un piège armé

Type: task
Status: open

## Question

**Résolu en décision par [25](../../refonte/issues/25-identifiant-annonce-meta.md) ;
il n'en reste que la construction — et un `DROP CONSTRAINT` à faire valider.**

Deux annonces homonymes n'en font qu'une en base : la dépense de la seconde
n'entre jamais. Et la migration écrite pour réparer ça, `meta_ads_ad_id.sql`,
**est un piège armé** : elle annonce un correctif dans `upsert_meta_ads` qui
**n'a jamais existé**. La jouer telle quelle n'aurait pas « laissé le bug en
place » — elle aurait **cassé la récolte Meta**, parce que son `DROP CONSTRAINT`
retire la clé que `on_conflict=…ad_name` désigne.

**Deux gestes sur trois sont déjà faits en code. Le SQL n'est pas joué.**

### Ce qu'il faut faire

- **Ouvrir la migration avant tout autre geste** (§7 : rien de destructeur sans
  regarder d'abord). Elle porte un `DROP CONSTRAINT` : **le signaler à David et
  le faire valider**, explicitement, avant de la jouer.
- Vérifier dans le code que le correctif d'`upsert_meta_ads` que la migration
  suppose est bien là **maintenant** — c'est ce qui décide si elle est encore un
  piège.
- **Le rejeu de l'historique passe par une date forcée, jamais par un `DELETE`**
  (décision de 25). Puisque l'upsert efface désormais les lignes `ad_id IS NULL`
  des dates qu'il réécrit, la table n'est jamais vide et rien ne se perd si la
  récolte s'interrompt — là où un `DELETE` ouvrirait une fenêtre sans donnée.
- **Le drapeau de rejeu ne touche que Meta.** Un `--since` global fabriquerait la
  panne que §8 raconte déjà : Google Ads `change_event` rejette la requête
  entière au-delà de 30 jours.
- **Le code se défend et la run finit ROUGE si la colonne manque.** Une run verte
  sans Meta, c'est une semaine de dépense que le rapport lirait comme une
  **baisse** — donc un faux verdict, et pas un trou visible.
- **Une Annonce est identifiée par `ad_id`, jamais par son nom** (`CONTEXT.md`),
  sans quoi les trois règles Annonce du ticket **07** rejouent le bug dans le
  moteur de conseils.

### Relevé par 25, à ne pas perdre

Le `.env` racine nomme `SUPABASE_SERVICE_ROLE_KEY` quand le worker cherche
`SUPABASE_SERVICE_KEY`, **et son projet Supabase n'existe plus** : la production
ne tourne que parce que le workflow, lui, passe le bon nom. Conséquence directe
pour ce ticket : **aucune vérification en base n'est possible en local**.
Le dire, ne pas le contourner, **ne jamais faire figurer une valeur de secret**
(§7 : un message d'erreur nomme la variable, jamais sa valeur).

### Consigne de repli

Si le `DROP CONSTRAINT` ne peut pas être validé par David dans la session :
livrer la migration **corrigée et non jouée**, avec écrit noir sur blanc ce
qu'elle fait et pourquoi elle attend. Ne pas la jouer sur un « ça devrait aller ».


## Avancement — session du 2026-09-11 (construction)

**La construction est faite et vérifiée. Le SQL n'est pas joué : le
`DROP CONSTRAINT` attend ta validation, et je n'ai pas d'accès à la base.**
Repli appliqué, tel que ce ticket le prévoyait.

### 1 · La migration n'est plus un piège — vérifié, pas supposé

Le premier geste demandé était d'ouvrir la migration avant tout autre geste, et
de vérifier que le correctif d'`upsert_meta_ads` qu'elle suppose existe
**maintenant**. Il existe : `saas/commun/insert_data.py` l. 84-98 porte bien le
DELETE borné (`.eq("user_id")`, `.is_("ad_id", "null")`, `.in_("date_start",
dates)`), la déduplication porte sur `ad_id` (l. 60) et l'upsert sur
`on_conflict="user_id,date_start,ad_id"` (l. 102).

**Le piège est donc désamorcé, mais l'ordre reste contraint** : jouer le SQL sur
l'ancien code, ou déployer ce code sur l'ancienne base, casse la récolte Meta
dans un sens comme dans l'autre. Les deux vont dans la même fenêtre.

### 2 · Le `DROP CONSTRAINT`, signalé comme §7 l'exige

Deux lignes, dans `000_run_me_all.sql` (l. 210-211) comme dans
`meta_ads_ad_id.sql` (l. 78-79) :

```sql
ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq;
ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq2;
```

**Ce qu'elles font** : elles retirent la contrainte d'unicité
`(user_id, date_start, ad_name)` pour la remplacer, deux lignes plus bas, par
`(user_id, date_start, ad_id)`. **Aucune ligne n'est effacée** — un
`DROP CONSTRAINT` ne touche pas les données, seulement la règle. Le second DROP
rend le fichier rejouable. Vérifié au `grep` : ce sont les seuls `DROP` des deux
fichiers en dehors des `DROP POLICY`/`DROP TRIGGER` de rejouabilité, et il n'y a
ni `DELETE` ni `TRUNCATE`.

**Ça reste ton feu vert à donner.** Je ne l'ai pas joué.

### 3 · Ce qui a été construit

- **`--meta-since AAAA-MM-JJ`** (`fetch_all.py`) — le rejeu d'historique par date
  forcée, **jamais par un DELETE**. La date remplace le point de reprise ; comme
  `upsert_meta_ads` efface les lignes `ad_id IS NULL` **des seules dates qu'il
  réécrit**, l'historique se nettoie date par date et la table n'est jamais vide.
  Le drapeau force le passage (sinon il ne rendrait rien hors du jour planifié)
  et **exige `--user`** : sans lui, ce forçage vaudrait pour TOUS les comptes et
  leur enverrait à tous l'email hebdo un jour qui n'est le jour de personne —
  `publish_weekly_report` envoie dès qu'il a une adresse, sans contrôle de jour.
- **Il ne touche QUE Meta.** `since_forcee` n'est passé qu'à `_fetch_meta` ;
  `_fetch_google` n'a pas de paramètre pour l'accueillir. Un `--since` global
  aurait fabriqué la panne de §8 (`change_event` rejette la requête *entière*
  au-delà de 30 jours).
- **`_date_forcee` valide les deux bornes AVANT le premier appel** — format ISO,
  pas dans le futur, pas au-delà des **1 126 jours** que Meta accepte (37 mois
  comptés en mois de 30 jours n'en feraient que 36,5 : on refuserait des dates
  valides en affirmant le contraire). Sans ça une date
  refusée ne se lirait pas comme un refus : `_meta_chunk` avale ses erreurs et
  rend une liste vide, donc « refusé par Meta » s'afficherait « ce compte n'a
  rien dépensé ».
- **Entrée `meta_since` au `workflow_dispatch`** (`weekly-fetch.yml`). Passée par
  **variable d'environnement**, pas interpolée en `${{ }}` dans le script : une
  entrée de dispatch est du texte libre et le dépôt est public.
- **Le garde-fou de colonne** — avant la première requête d'insights,
  `_colonne_ad_id_presente` interroge la table. Colonne absente → `ColonneManquante`,
  l'utilisateur est retenu, le canal Meta est marqué en échec, **Instagram,
  Google et GA4 finissent normalement**, et `__main__` sort en **1 une fois tout
  terminé**.
- **Seul le code Postgres `42703`** (« undefined_column ») vaut « colonne
  absente ». Un `except Exception` large aurait lu une coupure réseau comme une
  migration manquante : on sauterait une semaine de récolte Meta sur un hoquet.
  Toute autre erreur remonte telle quelle.
- **Le garde-fou se pose avant les appels réseau, pas juste avant l'écriture** :
  sans colonne, ces requêtes ne servent à rien. Budgets et journal des
  changements sont déjà passés — ils ne touchent pas cette table.
- **`CONTEXT.md`, entrée Annonce** : « Une Annonce est identifiée par son
  `ad_id`, jamais par son nom », avec le chiffre qui l'a tranché et la
  conséquence pour le moteur de conseils (les trois règles Annonce du [07]).

### 4 · Un geste au-delà de la lettre du ticket, à valider ou à retirer

Le ticket demandait que la run finisse rouge. **Le rouge prévient toi, pas le
client** — et pendant ce temps le rapport hebdo se publiait et l'email partait,
sur une semaine dont la dépense Meta manque. C'est exactement le faux verdict que
le garde-fou existe pour éviter, livré au client avant que tu aies vu le rouge.

**Donc : pour un utilisateur dont l'écriture Meta a été sautée, le rapport n'est
pas publié et l'email ne part pas.** Les autres utilisateurs ne sont pas
concernés (c'est pour ça que la retenue porte des identifiants, pas un booléen),
et le journal écrit pourquoi.

C'est une décision que j'ai prise, pas une que le ticket portait. Elle se retire
en supprimant la branche `if a_tente and uid in _ECRITURES_SAUTEES` de
`run()`.

### 5 · Ce qui est vérifié, et ce qui ne peut pas l'être

- `python3.12 -m py_compile` passe sur `fetch_all.py` et `insert_data.py`.
- Le `workflow_dispatch` parse et porte bien ses six entrées.
- **16 vérifications ciblées passent** sur les seams ajoutés : les six refus de
  `_date_forcee` (format FR, mois 13, mot, futur, au-delà de 37 mois, borne
  exacte), les trois cas de `_colonne_ad_id_presente` (table vide → présente,
  42703 → absente, panne réseau → remonte sans mentir), et le garde-fou complet
  de `_fetch_meta` (lève, nomme la migration, retient l'utilisateur, ne gaspille
  aucun appel insights). Le dépôt n'a ni pytest ni suite de tests : ce sont des
  vérifications jetables, pas une suite installée — dire si tu en veux une.
- `--meta-since` rejette une date illisible ou absente **avant** de toucher
  Supabase (`exit=1`, vérifié en ligne de commande).
- **Rien n'est vérifié en base, et ce n'est pas contournable** : le `.env` racine
  nomme `SUPABASE_SERVICE_ROLE_KEY` quand `_service_client()` cherche
  `SUPABASE_SERVICE_KEY`, et son projet Supabase n'existe plus. La production ne
  tourne que parce que le workflow passe le bon nom.

### 6 · Ce qui reste, dans cet ordre

- [ ] **Valider le `DROP CONSTRAINT` du §2**, puis jouer `000_run_me_all.sql`.
- [ ] **Déployer ce code dans la même fenêtre** — le cron passe à 07:00 UTC.
- [ ] **Rejouer l'historique** : `--meta-since 2026-01-01 --user <uid>`, ou
      l'entrée `meta_since` du workflow. Seules les dates réécrites gagnent de
      vrais `ad_id` ; ce que l'API Meta ne rend plus reste perdu.
- [ ] **Attendre que la dépense Meta MONTE** là où des homonymes existaient. Ce
      n'est pas une régression, c'est la dépense qui manquait — et tout ROAS par
      thème calculé dessus bouge avec elle.


## Revue de code — les sept constats, et ce qui en a été fait

La revue a tourné sur le diff. **Cinq constats étaient justes et sont corrigés,
un était faux, un est devenu un ticket.** Les corrections sont dans le même
commit que la construction.

### Corrigé — trois défauts qui cassaient le rejeu lui-même

1. **Le rejeu partait en un seul appel PostgREST, exactement ce que le fichier
   interdisait d'avance.** La note PROFONDEUR D'HISTORIQUE de `fetch_all.py`
   dit : « `upsert_meta_ads` envoie TOUT en un seul appel PostgREST, et 22 500
   lignes d'un coup n'ont jamais été essayées. **À découper avant d'élargir quoi
   que ce soit.** » `--meta-since` élargissait précisément ça, sans découper. Le
   pire n'était pas le corps de l'upsert mais **le DELETE** : `.in_("date_start",
   …)` est un filtre de query-string, donc 1 100 dates font ~16 Ko d'URL — au-delà
   du tampon d'en-têtes habituel (8 Ko). Le serveur aurait répondu 414 et
   **rien** n'aurait été écrit, après plusieurs minutes d'appels à Meta.
   → `_lots_par_date` (`insert_data.py`) découpe par date (90 max) et par lignes
   (5 000 max), **sans jamais couper une date en deux** — son effacement et sa
   réécriture sont une paire. Une récolte de routine tient toujours en un lot.

2. **Une tranche refusée par Meta disparaissait en silence.** `_meta_chunk`
   rendait `[]` aussi bien pour « échec » que pour « ce compte n'a rien
   dépensé ». Sur un rejeu de treize tranches, une limite de débit — probable à
   ce volume — perdait quatre-vingt-dix jours sans un mot, sur une run verte.
   → `_meta_chunk` rend maintenant `(lignes, erreur)`, y compris pour une
   **pagination interrompue** (tranche tronquée, le cas le plus traître). Sur un
   rejeu, une seule tranche manquante **annule toute l'écriture** : une base à
   moitié réparée ne se distingue d'une base réparée par aucune trace. Sur une
   récolte de routine, on écrit ce qu'on a et on le dit — le recouvrement de sept
   jours repassera.

3. **La migration jouée à moitié rendait une run verte.** Le garde-fou prouvait
   que la *colonne* existe, pas que la *contrainte* a été déplacée. Une base où
   seul l'`ADD COLUMN` a été joué passait le garde-fou, puis échouait sur
   `42P10` — un simple canal en erreur : rapport publié, email parti.
   → `42P10` est rattrapé et traité comme le schéma en retard qu'il est.
   L'exception s'appelle désormais `SchemaEnRetard`, elle couvre les deux moitiés.

### Corrigé — deux défauts de sécurité et d'exactitude

4. **`meta_since` sans `user_id` aurait écrit à toute la clientèle.** Le drapeau
   force le passage ; sans `--user`, ce forçage vaut pour **tous** les profils,
   qui recevaient chacun leur rapport et **leur email**, un jour qui n'est le
   jour de personne. Vérifié dans `build_report.py` : `if email_to:` → `send_email`,
   aucun contrôle de jour, et `RESEND_API_KEY` est dans l'environnement du
   workflow. → le worker refuse, et le workflow n'appelle plus que la forme avec
   `--user`.

5. **Mon propre commentaire de workflow annonçait une protection que les lignes
   voisines n'avaient pas.** J'avais fait passer `meta_since` et `user_id` par
   l'environnement en écrivant que les entrées ne sont « pas interpolées » — mais
   quatre branches splicaient encore `${{ inputs.user_id }}` dans le shell. Une
   entrée de dispatch est du texte libre, et le runner porte
   `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`. → **toutes** les
   entrées passent par l'environnement, le script ne contient plus une seule
   interpolation.

6. **La borne des 37 mois était fausse.** `37 * 30` = 1 110 jours ≈ 36,5 mois :
   on refusait des dates que Meta accepte, en affichant « dépasse les 37 mois ».
   → `_PROFONDEUR_META_JOURS = 1126`, le chiffre que la note du fichier portait
   déjà.

### Faux — vérifié avant d'agir

7. La revue annonçait que le rejeu estampillerait `effective_status = "UNKNOWN"`
   sur des années de lignes historiques. **C'est faux** : `upsert_meta_ads`
   n'écrit jamais `effective_status` dans `meta_ads_insights` — le champ ne
   figure pas dans le dictionnaire envoyé. Il ne sert qu'à
   `upsert_campaign_statuses`, table par campagne et non par date. Le rejeu
   n'abîme aucune ligne historique. Ce qui reste vrai — les campagnes ne sont pas
   paginées au-delà de 200 — est pré-existant et part en
   [21](21-campagnes-meta-non-paginees.md).

### Devenu un ticket plutôt qu'un détour

La revue a raison sur un point que je n'ai pas corrigé ici : la raison qui
justifie de retenir le rapport (ne pas publier un trou comme une baisse) vaut
pour **toute** cause de canal muet — jeton Meta expiré en tête — et pas seulement
pour le schéma en retard. C'est un arbitrage produit, pas une correction : un
compte au jeton mort ne recevrait plus aucun rapport. →
[20](20-rapport-publie-sur-un-canal-muet.md).

### Vérifications après corrections

**28 vérifications ciblées passent** (contre 16 avant la revue) :
`_date_forcee` et ses bornes, `_colonne_ad_id_presente` et ses trois cas, le
garde-fou colonne absente, le garde-fou `42P10`, l'abandon d'un rejeu incomplet
(**rien n'est écrit**), et `_lots_par_date` (aucune ligne perdue, aucune date à
cheval, une date énorme jamais coupée, la routine en un seul lot).
`python3.12 -m py_compile` passe sur les deux fichiers ; le workflow parse ; les
deux refus de `--meta-since` (sans `--user`, hors des 37 mois) tombent avant tout
accès réseau ou base.
