# Le socle commun Meta / Google : des modules nommés, et la clé par ID

Type: grilling
Status: resolved
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

## Answer

Tranché avec David le 2026-10-01, en grilling. **La question était mal posée** :
David ne veut pas d'une forme de données commune à Meta et Google, mais d'une
**structure de dashboard nommée** (« que le code ne soit pas un code qui
s'applique pour tous »). Le mot « contrat » sort du vocabulaire de cette carte.
Fiche : [`docs/adr/0011`](../../../docs/adr/0011-le-socle-est-une-structure-de-modules-pas-une-forme-de-donnees.md).

**1 · Le socle, ce sont des modules nommés.** Même nom, même rôle, même place
sur toutes les plateformes : Bandeau de commandes, Sélecteur de vue, Tendance,
Comparaison, Tableau détaillé — plus le Panneau latéral, qui s'ouvre depuis un
module. Le contenu (métriques, graphes) s'adapte à chaque plateforme. Écrit dans
`CONTEXT.md`, entrée **Module**. « Vue d'ensemble » est écarté pour le module 2 :
`CONTEXT.md` l'interdit déjà, et « vue » désigne Notoriété / Trafic / Conversion.

**2 · Le code est propre à chaque plateforme.** Un module Tendance Meta et un
module Tendance Google sont deux fichiers. Ils ne partagent que des briques
visuelles neutres (carte, graphe, panneau, bandeau) qui ne savent rien de la
plateforme. Pas de vue SQL, pas de type unique rempli par les deux.

**3 · L'identité est l'ID, jamais le nom.** Campagne, ad set et annonce sont
identifiés par leur ID Meta ; le nom affiché est le plus récent. Une campagne
renommée dans Meta reste la même campagne. Les assets n'ont pas d'ID chez Meta
(recherche 04) : une image a son `image_hash`, un texte son rang.

**4 · Les métriques qui sont une division se recalculent sur la période,
total ÷ total**, jamais stockées, jamais moyennées — c'est le chiffre d'Ads
Manager (même logique que l'ADR 0008). Formules :
CPM = dépense ÷ impressions × 1 000 ; CTR = clics ÷ impressions × 100 ;
CPC = dépense ÷ clics ; coût par conversion = dépense ÷ conversions ; taux de
conversion = conversions ÷ clics. Diviseur nul ou absent → « — ».

**5 · Le clic, c'est tous les clics, partout** (David : « on prend le plus
haut ») : CTR, CPC, métrique principale de la vue Trafic, diviseur du taux de
conversion. C'est aussi la définition des champs `ctr` et `cpc` de Meta
(« click (all) », référence Insights). L'écran l'écrit. `CONTEXT.md`, entrée
**Clic**. **Modifie le ticket 05**, qui mettait les clics sur le lien à ces deux
dernières places.

**6 · Les conversions : ce que Meta affiche, la colonne « Résultats » d'Ads
Manager**, sans règle maison (David : « on ne va pas s'amuser à faire des trucs
nous-mêmes »). Quel champ de l'API rend exactement ce chiffre n'est pas établi —
`conversions` est une liste de types d'action, pas un nombre (recherche 04) :
ticket de recherche [15](15-quel-champ-de-l-api-rend-la-colonne-resultats.md).
Le choix du type par le client part au `BACKLOG.md`.

**7 · Portée et fréquence ne s'affichent pas, pour l'instant.** La portée compte
des personnes uniques et Meta la déduplique sur la période demandée (« at least
once », « This metric is estimated ») : la somme des portées journalières est
fausse, et le vrai chiffre exige un appel par période. David : « on a meilleur
temps de ne pas la prendre ». La vue Notoriété garde impressions et CPM.
**Modifie le ticket 05.** Au `BACKLOG.md`, avec ce qu'on sait déjà.

**8 · La pagination** au-delà de 1 000 lignes vit dans le code de lecture Meta,
pas dans un objet partagé. Le patron existe (`saas/web/lib/couts.ts:206`). La
réparation de `/meta` actuel est le ticket de correction 03.

### La migration proposée — rien n'est joué

**Étape A, sans risque, à replier dans `000_run_me_all.sql`.**

```sql
-- POURQUOI : une campagne renommée dans Meta devenait une campagne neuve dans
-- Pulse, son historique coupé en deux (carte meta-ads, ticket 07). L'ID, lui,
-- ne change jamais. Nullable, sans DEFAULT : même raison que `ad_id`
-- (meta_ads_ad_id.sql) — une valeur commune au backfill mentirait.
ALTER TABLE public.meta_ads_insights
    ADD COLUMN IF NOT EXISTS campaign_id text,
    ADD COLUMN IF NOT EXISTS adset_id    text;

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS campaign_id text;
```

La récolte (`fetch_all.py`, `level=ad`) demande en plus `campaign_id,adset_id`
— zéro appel de plus, ce sont des champs de la requête existante. Les lignes
anciennes se remplissent par un **rejeu** depuis l'onglet GitHub Actions
(`weekly-fetch.yml`, `meta_since` à la plus vieille date en base), jamais par
une jointure sur le nom. `insert_data.py` écrit `meta_campaign_config` par
`campaign_id` dès que l'étape B est jouée.

**Étape B, destructive au sens de `CLAUDE.md` §7 — à faire valider, à jouer à
la main, une fois, après le rejeu.** Elle change la clé primaire de
`meta_campaign_config` de `(user_id, campaign_name)` à `(user_id, campaign_id)`,
reporte d'abord l'ID depuis les lignes rejouées, puis **refuse de tourner**
tant qu'une ligne n'a pas d'ID, au lieu de la perdre :

```sql
-- Report de l'ID sur la config, SEULEMENT quand un nom désigne une seule
-- campagne. Deux campagnes homonymes restent à NULL : choisir serait deviner.
UPDATE public.meta_campaign_config c
SET    campaign_id = u.campaign_id
FROM  (SELECT user_id, campaign_name, min(campaign_id) AS campaign_id
       FROM   public.meta_ads_insights
       WHERE  campaign_id IS NOT NULL
       GROUP  BY user_id, campaign_name
       HAVING count(DISTINCT campaign_id) = 1) u
WHERE  c.user_id = u.user_id
  AND  c.campaign_name = u.campaign_name
  AND  c.campaign_id IS NULL;

DO $$
DECLARE manquantes int;
BEGIN
  SELECT count(*) INTO manquantes
  FROM public.meta_campaign_config WHERE campaign_id IS NULL;
  IF manquantes > 0 THEN
    RAISE EXCEPTION '% campagne(s) sans campaign_id : rejouer la récolte, ou les traiter à la main avant de changer la clé', manquantes;
  END IF;
END $$;

ALTER TABLE public.meta_campaign_config
    DROP CONSTRAINT meta_campaign_config_pkey,
    ALTER COLUMN campaign_id SET NOT NULL,
    ADD PRIMARY KEY (user_id, campaign_id);
```

Le nom de la contrainte (`meta_campaign_config_pkey`) est celui que Postgres
donne par défaut ; à vérifier sur la base avant de jouer. **Le cas qui fera
refuser l'étape B** : une campagne renommée. Le rejeu réécrit les lignes avec le
nom actuel, et la config porte encore l'ancien — le report ne la trouve pas.
C'est voulu : on la rattache à la main plutôt qu'on la devine.

**Ce qui n'est pas vérifié** : aucune de ces deux étapes n'a tourné, même sur
un PostgreSQL jetable — elles se vérifient au moment où un ticket de
construction les reprend, comme la `998` l'a été au ticket 02.
