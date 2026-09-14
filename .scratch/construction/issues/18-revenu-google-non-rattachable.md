# La dépense Google entre par l'identifiant, son revenu ne peut entrer que par le nom

Type: task
Status: resolved

## Question

**Une question pour David avant une ligne de code** : ce n'est pas un bug à
réparer, c'est une règle d'attribution à choisir — et
[`docs/mesures-impossibles.md`](../../../docs/mesures-impossibles.md) plus
`CLAUDE.md` §7 disent que ça ne se tranche pas en douce.

Sorti par la revue de code du ticket [01](01-roas-gonfle.md). Le défaut est
**antérieur** à 01 et vit aussi dans `build_matrix`
(`saas/recos_ia/insights.py`), qui calcule le ROAS d'un thème affiché
aujourd'hui à l'écran.

### Le fait

Les deux côtés de la division n'utilisent pas la même clé pour rattacher une
campagne Google à un thème :

- **Dépense** : par `campaign_id` → `goog_cfg[cid]["label"]`
  (`_pub_fenetre`, `build_report.py` l. 2624 ; `build_matrix`, l. 95-113).
  Robuste : c'est la clé que porte `google_campaign_config`.
- **Revenu** : par nom normalisé → `name2label` (`build_report.py` l. 2078-2084)
  ou `rev_by_name` (`insights.py` l. 120-122), tous deux construits sur le
  `campaign_name` stocké. Et `name2label` **ignore** une ligne `goog_cfg` dont
  le `campaign_name` est vide — `fetch_google_campaign_config` y met `""` quand
  la colonne est nulle (`saas/commun/fetch_data.py` l. 246).

Donc une campagne Google étiquetée mais dont le nom stocké est vide, ou ne
correspond plus à l'`utm_campaign` que GA4 enregistre après un renommage dans
Google Ads, **verse sa dépense au dénominateur sans jamais pouvoir verser son
revenu au numérateur**.

Scénario : thème « Audio Tour », une campagne Meta (200 CHF, 1 000 CHF de
revenu) et une campagne Google étiquetée dont le nom ne matche pas (300 CHF).
Avant 01 : ROAS = 1000/200 = 5.0 — gonflé, c'est le bug que 01 a réparé.
Après 01 : ROAS = 1000/500 = 2.0 — **écrasé par le même mécanisme, à l'envers.**
Une hypothèse `roas` sur ce thème lira `worse` à chaque mesure.

### Ce qu'il faut faire

1. **D'abord mesurer, sur le compte de David** : combien de lignes
   `google_campaign_config` portent un `label` et un `campaign_name` vide ou
   introuvable dans `ga4_insights.campaign` ? Si c'est zéro, le ticket devient
   une garde préventive et pas une réparation urgente — et ça se dit.
2. **Ensuite demander à David**, avec le chiffre en main. Les deux lectures se
   défendent et aucune n'est neutre :
   - *Compter la dépense quand même* (aujourd'hui) : le ROAS du thème est
     pessimiste, mais la dépense affichée reste vraie.
   - *Écarter cette dépense du dénominateur* : le ROAS redevient cohérent, mais
     une dépense réelle disparaît du calcul — un autre chiffre faux.
   - *Se taire* : pas de ROAS pour ce thème tant qu'une campagne étiquetée n'est
     pas rattachable. Le plus honnête, le plus silencieux.
3. **Ne pas trancher dans le code.** La consigne de repli de 01 s'applique mot
   pour mot : écrire une règle d'attribution en douce serait le chiffre fabriqué
   que §7 interdit.

### Ce qui n'est PAS dans ce ticket

Séparer un ROAS par canal. Ça reste une décision produit non prise, et ce
ticket ne la rouvre pas.

---

## Avancement 2026-09-13 — le harnais de mesure est prêt, la mesure ne l'est pas

**Le ticket reste `open`, et il doit le rester** : l'étape 1 (mesurer) n'a pas pu
être faite d'ici, donc l'étape 2 (demander à David) n'est pas mûre. Rien n'a été
touché dans `build_report.py` ni dans `insights.py` — l'étape 3 tient.

### Ce qui a été vérifié dans le code

L'asymétrie décrite par le ticket est confirmée, aux deux endroits :

- dépense par identifiant — `goog_cfg.get(cid)["label"]`, `build_report.py`
  l. 2440 / 2688 / 2791 / 3198, et `insights.py` l. 117-137 ;
- revenu par nom normalisé — `name2label`, `build_report.py` l. 2143-2149
  (la ligne `if ... and (_c or {}).get("campaign_name")` écarte bien un nom
  vide), et `rev_by_name`, `insights.py` l. 141-149.

Les deux normalisations sont identiques (`str(s or "").strip().lower()`), donc
`trim(lower(...))` en SQL reproduit le pont à l'identique.

### Pourquoi la mesure n'a pas pu être faite

Le `.env` de la racine porte bien une `SUPABASE_SERVICE_ROLE_KEY`, mais **son
hôte ne résout plus** — il se comporte comme une référence de projet morte. Le
projet vivant est celui de `saas/web/.env.local`, qui ne porte que la clé
**anon** : sous RLS et sans session, la requête ne rendrait rien. Demander la
clé `service_role` du projet vivant dans une conversation est exclu (§7).

Au passage, à corriger quand tu passeras par là : **la ligne 5 du `.env` de la
racine est un `q` isolé**. Sans effet sur le lecteur maison (il saute les lignes
sans `=`), mais `source .env` meurt dessus.

### Ce qui est livré à la place

`.scratch/construction/harnais/18-revenu-google/` — trois requêtes en lecture
seule à coller dans l'éditeur SQL Supabase, où la session suffit et où aucun
secret ne circule. `pglast` a parsé les trois : `SelectStmt` uniquement, aucune
écriture possible. Voir le `README.md` du dossier.

### Une quatrième option, trouvée en mesurant, à ajouter aux trois du ticket

`google_ads_insights` stocke le nom que la campagne portait **le jour de la
récolte** (`fetch_google_ads.py` l. 191). Après un renommage, l'historique garde
donc l'ANCIEN nom — exactement celui que GA4 a enregistré en `utm_campaign` à
l'époque, et que `google_campaign_config` a perdu en ne gardant que le nom
courant.

D'où : *rattacher le revenu par n'importe quel nom porté par la campagne dans
son historique*. Ça ne fabrique aucun chiffre — le lien est attesté par une
ligne récoltée — et ça ne touche pas au cas « nom vide », qui reste muet.
`mesure_repli_historique.sql` dit ce que cette option récupérerait, en campagnes
et en francs, avant qu'on en discute.

**Elle ne se code pas plus que les trois autres tant que David n'a pas tranché.**

### La suite, dans l'ordre

1. David joue les trois requêtes dans l'éditeur SQL Supabase et colle les
   résultats ici.
2. Avec le chiffre en main, la question de l'étape 2 se pose — sur quatre
   options désormais.
3. Une fois seulement la règle choisie, le code change aux deux endroits à la
   fois (`build_report.py` ET `insights.py`), sinon l'écran et le rapport
   diront deux choses différentes.

---

## Mesure 2026-09-13 — faite, et elle change la question

Les requêtes ont été jouées dans l'éditeur SQL Supabase du projet **vivant**
(`dctjbteygbgwenhvdnul`), en lecture seule, via la session du dashboard. Aucun
secret n'a circulé. Le brouillon est resté enregistré sous le nom **« État de
rattachement des campagnes GA4/Google Ads »** dans les requêtes privées.

### Étape 1 — le chiffre

| État | Campagnes | Dépense |
|---|---|---|
| nom vide | **0** | — |
| nom introuvable dans GA4 | **2** | **808.87 CHF** |
| rattachable | 30 | 51 178.79 CHF |

Ce n'est donc pas zéro, mais ce n'est pas non plus diffus : **la totalité du
défaut tient sur un seul thème.**

| Thème | Campagnes Google | Non rattachables | Dépense | Dépense muette | Part muette |
|---|---|---|---|---|---|
| **Campagne Générale** | 2 | **2** | 808.87 | 808.87 | **100 %** |
| Audio Tour | 5 | 0 | 4 143.29 | 0 | 0 % |
| e-bike | 6 | 0 | 18 420.49 | 0 | 0 % |
| Famille | 5 | 0 | 6 570.26 | 0 | 0 % |
| Gamme | 1 | 0 | 2 444.85 | 0 | 0 % |
| Gravel | 2 | 0 | 4 521.85 | 0 | 0 % |
| Patrimoine bâti | 1 | 0 | 800.55 | 0 | 0 % |
| (4 autres thèmes) | — | 0 | — | 0 | 0 % |

Le scénario du ticket est donc réel, et il est **total** là où il frappe :
« Campagne Générale » n'a aujourd'hui **aucun** revenu Google rattachable.

### Étape 1 bis — la cause, et elle n'est pas celle qu'on croyait

Les deux campagnes muettes :

| campaign_id | Nom **dans la config** | Nom réel **dans `google_ads_insights`** | Dépense | Revenu GA4 sous le nom réel |
|---|---|---|---|---|
| 24176742897 | `Campagne 24176742897` | `ch_fr_pmax_herbst_2026` | 297.62 | 0.00 (276 sessions, 0 conv.) |
| 24187314124 | `Campagne 24187314124` | `ch_de_pmax_herbst_2026` | 511.26 | **352.00** (617 sessions, 3 conv.) |

**Ce n'est pas un renommage, et ce n'est pas un nom manquant : c'est un nom
fabriqué, écrit par nous.** `google_campaign_config.campaign_name` porte
`Campagne <campaign_id>` — une chaîne que Google n'a jamais émise et que GA4 ne
peut par construction jamais enregistrer en `utm_campaign`.

L'auteur est identifié, et les lignes le prouvent (`label_source = 'ai'`,
`effective_status = NULL`, `budget_max = 0`, `updated_at = 2026-08-29 08:10:26`
pour les deux) :

- `saas/recos_ia/labeling.py` l. 134-139 liste les campagnes Google depuis
  `google_ads_insights` en ne sélectionnant **que `campaign_id`** — alors que
  cette même table porte le vrai `campaign_name` ;
- l. 170, faute de ligne de config existante, il fabrique
  `cname = cfg.get("campaign_name") or f"Campagne {cid}"` ;
- l. 280-283, il **upsert ce nom fabriqué dans `google_campaign_config`**.

Deux dégâts, pas un :

1. **Le pont du revenu est détruit** — c'est ce ticket.
2. **Gemini a classé à l'aveugle.** La description envoyée était
   `[Campagne Google] «Campagne 24176742897»` : aucun mot business. Les deux
   campagnes ont atterri dans le fourre-tout « Campagne Générale ». Avec le vrai
   nom (`ch_fr_pmax_herbst_2026`, `ch_de_pmax_herbst_2026`), l'IA aurait eu de
   quoi travailler.

Rien n'a jamais corrigé ces deux lignes ensuite : `effective_status` est resté
`NULL`, donc `upsert_google_campaign_statuses`
(`saas/commun/insert_data.py` l. 493) ne les a **jamais** touchées — la requête
`FROM campaign` de `fetch_campaign_statuses`
(`saas/collecte/google/fetch_google_ads.py` l. 367-405) ne les a pas rendues.
Voir le ticket 43 : c'est un défaut distinct, en amont.

### Ce que ça fait à la cinquième option

Les trois options du ticket, plus la quatrième de l'avancement précédent,
supposaient toutes qu'on **ne sait pas** rattacher. Ici on sait : le vrai nom
est intact dans `google_ads_insights`, et GA4 le connaît. D'où :

> **5. Réparer la source** — que `labeling.py` cesse d'écrire un nom fabriqué,
> et lise le vrai `campaign_name` dans `google_ads_insights`.

Elle ne fabrique rien, elle **arrête** une fabrication. Elle remet 352.00 CHF de
revenu réel en face de 808.87 CHF de dépense réelle sur « Campagne Générale »
(ROAS 0.00 → 0.44), et elle rend à Gemini de quoi classer. Elle réduit la mesure
de l'étape 1 à **zéro campagne muette**, ce qui ferait de la règle d'attribution
la garde préventive que l'étape 1 espérait.

Elle ne suffit pas seule : elle ne répare pas les deux lignes **déjà** écrites
(un backfill par `campaign_id` depuis `google_ads_insights` s'en charge, sans
inventer davantage), et elle ne dit rien du cas où le vrai nom manquerait
vraiment — le cas « nom vide », mesuré à 0 aujourd'hui.

### Ce qui n'a PAS été touché

`build_report.py` et `insights.py` sont intacts. L'étape 3 tient : aucune règle
d'attribution n'a été écrite. Le ticket reste `open` jusqu'à ce que David
tranche — la question porte maintenant sur **cinq** options, et l'une d'elles
n'est pas une règle d'attribution mais une réparation.

### Au passage

La ligne 5 parasite du `.env` de la racine (un `q` isolé) a été retirée.
`.env` est ignoré par git (`.gitignore` l. 2), rien ne part au dépôt.

---

## Answer — 2026-09-13 : on publie le ROAS, et on écrit la part muette

### Ce que David a tranché, et pourquoi la question a dû être posée deux fois

**Première réponse : « se taire »** — pas de ROAS tant qu'une campagne étiquetée
n'est pas rattachable. Elle a été donnée sur une prémisse que j'avais énoncée et
qui était **fausse** : « une fois la fabrication du ticket 43 arrêtée, la mesure
retombe à zéro ». C'est vrai pour Google. Ça ne l'est pas pour Meta.

Le pont du revenu passe par le NOM pour les **deux** régies, et un nom de
campagne Meta ne reprend presque jamais l'`utm_campaign`. Mesuré avant d'écrire
une ligne de la règle :

| | |
|---|---|
| Thèmes jugés (dépense ≥ 100 CHF) | **17** |
| Thèmes qui se seraient tus | **10** (59 %) |
| …à cause de Meta **seul** | **9** |
| …à cause de Google | 1 |
| Dépense jugée concernée | **48 431.28 CHF** sur 90 514.57 (53 %) |

« Se taire » aurait donc vidé six thèmes sur dix de leur seul chiffre de
rentabilité — une conséquence que la question ne montrait pas.

**Seconde réponse, celle qui est implémentée : on publie le ROAS et on écrit la
part muette à côté.** Aucun chiffre fabriqué, la limite est écrite, et le
produit garde son indicateur.

Les quatre autres options sont écartées, et pour des raisons qui tiennent :

- *compter sans le dire* (l'existant) — c'est publier un ratio en sachant qu'un
  de ses deux côtés est amputé, ce que §7 interdit ;
- *écarter la dépense du dénominateur* — remplace un ROAS écrasé par une dépense
  fausse ;
- *se taire* — mesuré ci-dessus, 59 % des thèmes muets ;
- *repli par nom historique* — devenue sans objet pour le cas mesuré : le ticket
  43 montre que le nom courant n'était pas perdu, il était **écrasé**. Elle
  reste disponible si un vrai renommage apparaît un jour.

### Ce qui a été construit

**`supabase/migrations/theme_regroupement.sql`** — deux colonnes neuves :

- `spend_muette` : la part de `spend` dépensée par des campagnes dont Google
  Analytics ne connaît pas le nom. Elle est **dans** `spend`, elle ne s'en
  retranche pas — la dépense affichée reste vraie.
- `campagnes_muettes` : combien de campagnes.

Toutes deux valent **NULL, pas 0**, sur un compte où Google Analytics
n'attribue aucune campagne payante : y annoncer « 0 CHF non rattachable »
affirmerait que tout est rattaché.

La CTE `noms_ga4_connus` **ne filtre pas sur le `medium`**, contrairement au
revenu : la question posée n'est pas « ce nom a-t-il rapporté ? » mais « ce nom
existe-t-il pour Google Analytics ? ». Un nom vu en organique est rattachable.

La copie de `000_run_me_all.sql` a été resynchronisée — `test_copie_non_derivee`
l'a exigé, et il avait raison.

**`saas/traitement/build_report.py`** — la carte de thème porte `spend_muette`,
`campagnes_muettes` et `part_muette` (le ratio, calculé une fois ici plutôt que
deux fois à l'affichage).

**`insights.py` n'a pas été touché, et c'est correct** : depuis le ticket 04, il
ne calcule plus le ROAS d'un thème — la vue en est la seule source. La consigne
du ticket (« le code change aux deux endroits à la fois ») visait un monde
d'avant 04.

### Ce qui a été vérifié

- **21 vérifications neuves en SQL**, contre un **vrai PostgreSQL** montant la
  vraie migration (`harnais/04-vue-sql/test_part_muette_sql.py`) — dont le cas
  exact de production, casse comprise (`CH_DE_PMax_Herbst_2026` côté Google,
  `ch_de_pmax_herbst_2026` côté GA4, 352 CHF qui rentrent).
- **18 vérifications neuves en Python** sur le payload
  (`harnais/18-revenu-google/test_part_muette.py`).
- Les deux **rejouées d'abord contre le code d'avant, où elles tombent**.
- Le faux lecteur du harnais 16 a été aligné sur la vue : la présence de Google
  Analytics se juge **au compte**, pas au thème. Il disait le contraire.
- **1 874 vérifications au total, aucun échec.**
- Lu en base, la vue modifiée rend bien ce qu'on attend — exemple : le thème
  « Frühlings », ROAS publié **0.00** dont **100 % de dépense muette**
  (10 499.37 CHF). Le ROAS n'était pas une contre-performance, c'était un angle
  mort.

### ⚠ Ce qui n'atteindra PAS la production tout de suite

`theme_regroupement` **n'existe pas** dans la base de production, et la
migration qui l'installe **ne peut pas être jouée** : elle référence
`instagram_organic_posts.eng`, une colonne qui n'existe pas. Voir le ticket
[44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md), qui bloque celui-ci.

### La question qui reste, et qui n'est pas celle-ci

`_kpis_window` (`build_report.py`) calcule un ROAS de thème pour rendre les
**verdicts**, avec la même asymétrie. Un verdict n'a nulle part où écrire une
mention : « publier en le disant » n'y veut rien dire. La bonne nouvelle est que
le biais y est moindre — baseline et mesure sont calculées pareil, donc une part
muette constante s'annule dans la comparaison ; elle ne fausse que le niveau,
pas le sens. **Ça ne se tranche pas ici** : ticket à ouvrir si un verdict suspect
apparaît.
