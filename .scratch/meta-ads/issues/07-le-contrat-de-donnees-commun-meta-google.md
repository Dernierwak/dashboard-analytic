# Le contrat de données commun Meta / Google, et sa clé

Type: grilling
Status: open
Blocked by: 02, 05, 06

## Question

De quoi est fait « un insight publicitaire » — la forme unique que Meta et Google
remplissent, et que les modules du dashboard sont seuls à connaître ?

C'est le ticket qui rend vraie la promesse « Google Ads ne repart pas de zéro ».
Il vient **après** les prototypes, exprès : la forme révèle les données
nécessaires, l'inverse est faux.

**Le point dur, mesuré le 2026-09-28.** `meta_ads_insights` identifie la campagne
et l'ad set **par leur nom** (`campaign_name`, `adset_name` en `text`), et
`meta_campaign_config` a pour clé primaire `(user_id, campaign_name)`. Seul
`ad_id` est un vrai identifiant, ajouté après coup (`meta_ads_ad_id.sql`, TASK-018,
justement parce que deux annonces peuvent porter le même nom). Conséquences :
- **Une campagne renommée dans Meta devient une campagne neuve dans Pulse**, son
  historique coupé en deux, sans erreur et sans trace.
- Google Ads, lui, a de vrais identifiants. Les deux ne peuvent pas entrer dans la
  même forme tant que Meta est clé par nom.

**Ce qu'il faut décider**
1. Le contrat est-il une **vue SQL** (`theme_regroupement` était le précédent de ce
   motif dans ce dépôt, en `security_invoker` — il disparaît au ticket 02, mais le
   motif est connu et il a marché), un **type TypeScript** avec une fonction de
   lecture par plateforme, ou les deux ?
2. Quelles colonnes exactement : `plateforme, jour, niveau, identifiant, nom,
   identifiant du parent`, puis les métriques des trois modules. Les métriques
   dérivées (CPM, CTR, CPC, fréquence, taux de conversion) sont-elles **dans** le
   contrat ou recalculées à la lecture ? Précédent tranché en ADR 0008 :
   « l'engagement est un taux recalculé, jamais une colonne ». La même logique
   s'applique-t-elle ici ?
3. La migration qui ajoute `campaign_id` / `adset_id` à `meta_ads_insights` et
   change une clé d'unicité. **Destructeur au sens de `CLAUDE.md` §7** : à
   proposer, pas à jouer. Et le backfill a un précédent à relire avant d'écrire
   quoi que ce soit : `meta_ads_ad_id.sql` raconte exactement ce piège (les lignes
   anciennes sans identifiant, une valeur commune au backfill qui les écrase les
   unes sur les autres).
4. **PostgREST plafonne à 1 000 lignes et tronque en silence** (`CLAUDE.md` §8).
   Un dashboard qui lit des annonces jour par jour dépasse ce seuil vite. La
   pagination fait-elle partie du contrat, ou du code de lecture ?

**Livrable** : la forme du contrat, écrite ; la migration proposée ; et une ADR si
le choix est structurant — il l'est probablement (dur à inverser, surprenant sans
le contexte, vrai arbitrage).

## Ce que le ticket 04 apporte à ce contrat

Résolu le 2026-09-28 (rapport :
[`../recherche/champs-api-meta.md`](../recherche/champs-api-meta.md)).

**Une forme de stockage est déjà proposée, à valider ou à refuser ici** — 3 colonnes
sur `meta_ads_insights` (`date_stop`, `attribution_setting`, `inline_link_clicks`)
et 3 tables neuves : `meta_ads_actions` (une ligne par `action_type`),
`meta_ads_creatives` (une ligne par **annonce**, pas par jour),
`meta_ads_creative_assets` (clé = le rang de l'asset, aucun identifiant n'étant
documenté).

**L'argument contre une colonne `conversions` unique est solide et rejoint l'ADR
0008** (« l'engagement est un taux recalculé, jamais une colonne ») : une colonne
figerait dans l'historique le choix du type d'action qui compte comme « la »
conversion, et un type absent y deviendrait `0`. Une table par `action_type` garde
la question ouverte sans perdre de donnée.

**Deux contraintes dures pour le contrat**
- **Les `action_type` s'emboîtent** : `link_click` ⊂ `post_engagement` ⊂
  `page_engagement`. Une vue qui somme la liste compte le même clic trois fois. Le
  contrat doit rendre cette somme **impossible**, pas seulement déconseillée — c'est
  un choix de conception, pas un commentaire à écrire.
- **Aucun champ « taux de conversion » n'existe chez Meta.** Il se recalcule, son
  dénominateur est un choix produit, et il n'a donc pas sa place dans le contrat
  (même raison que l'ADR 0008). À trancher ici explicitement.
