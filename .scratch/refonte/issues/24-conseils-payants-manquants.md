# Les conseils payants qui manquent : un compte sans Instagram n'en reçoit qu'un

Type: grilling
Status: resolved
Blocked by: 22

## Question

Gradué par [22](22-rebrancher-le-plan-de-theme.md), qui a compté le stock réel
au lieu de le supposer.

Sur les sept clés déterministes qui concourent pour les cinq places de la
semaine, **six ne parlent qu'à Instagram** (`silence`, `page_endormie`,
`orga_rythme`, `orga_essoufflement`, `orga_format`, `orga_reaction`). Il en
reste **une** pour un compte qui ne fait que de la pub Meta/Google : `roas`,
avec ses trois branches.

Deux conséquences mesurées, pas supposées :

- **Un client sans Instagram reçoit un conseil par semaine.** Le plafond de
  cinq ([11](11-d-ou-viennent-les-conseils.md)) ne sera jamais approché par lui.
- **Une Stratégie ne peut naître que sur l'organique.** Les deux seules clés
  dont la preuve est « à mesurer » (`orga_essoufflement`, `page_endormie`) sont
  organiques ; une Stratégie s'ouvre sur une Hypothèse, donc un compte payant
  n'en ouvre aucune, et l'échelle des Marches écrite par Gemini
  ([22](22-rebrancher-le-plan-de-theme.md) §6) ne tourne jamais chez lui.

Ce n'est pas un accident : c'est la somme de la coupe de
[11](11-d-ou-viennent-les-conseils.md) (`gaspillage`, `scaler` — les régies le
font gratuitement) et du refus de David en 22 de les ressusciter (*« non
supprime, il apporte rien »*). 14 l'avait annoncé : *« le plancher devient un
ticket d'écriture de règles, il ne se décrète pas »*.

### Ce qu'il faut trancher

- **Quels conseils payants aucune régie ne donne déjà.** C'est le seul critère
  qui survit à [02](02-sur-quoi-se-differencient-les-autres.md) : Google Ads et
  Meta livrent leurs recommandations *dans l'écran où le clic s'applique*. Reste
  ce qu'aucune des deux ne peut voir — un thème qui traverse Meta ET Google, un
  thème qui vit en payant ET en organique, un budget arbitré entre canaux. C'est
  l'axe que 02 a mesuré comme le seul encore libre sur dix produits.
- **Combien il en faut pour qu'une semaine payante tienne.** Cinq est un
  plafond, pas un quota (22 §2) : une semaine à deux conseils est honnête. Mais
  à un seul conseil, le fil de la semaine — ce que
  [04](04-ce-qui-doit-etre-valide-en-premier.md) a désigné comme la chose à
  valider en premier — n'a plus rien à montrer.
- **Ce qui est écrivable sans nouvelle récolte.** À croiser avec
  [23](23-recolte-des-quatre-manques.md), qui porte les quatre données absentes
  (mots-clés, découpage d'audience Meta, texte d'annonce, page d'atterrissage) :
  une règle qui les demande n'est pas écrivable aujourd'hui.
- **Au moins un conseil payant dont la preuve est « à mesurer »**, sinon aucun
  compte payant n'ouvre jamais de Stratégie.

### Consigne de conduite

Ticket **HITL**. Lire d'abord la résolution de
[22](22-rebrancher-le-plan-de-theme.md) (le tableau des sept clés) et celle de
[02](02-sur-quoi-se-differencient-les-autres.md) (ce que les régies donnent
gratuitement). Agent `recos` pour la pertinence et la variété, puis `grilling` +
`domain-modeling`. Toute règle proposée déclare ses cinq colonnes — geste,
preuve, levier, indicateur, durée — ou elle n'est pas servie.

### Condition d'entrée

Avant qu'un client sans Instagram voie la v1. Pas avant : rien ne se construit
pour un client qui n'existe pas encore (§4 du plan de refonte).

### Consigne de repli

Rendre la liste des conseils payants candidats avec, pour chacun, la donnée
qu'il exige et si elle est déjà récoltée. Une liste vérifiée vaut mieux que
trois règles à moitié écrites.

## Answer

### Ce que le ticket croyait chercher, et ce qu'il a trouvé

Le ticket partait d'une contrainte héritée de
[02](02-sur-quoi-se-differencient-les-autres.md) : *« quels conseils payants
aucune régie ne donne déjà »* — le seul critère qui était censé survivre.
**David a supprimé ce critère.** C'est le fait qui commande tout le reste :

> *« Les dashboards montrent des données Meta et Google, mais l'hebdomadaire,
> ces recos, les personnes ne les voient pas seules. Ceux qui ne connaissent pas
> ne les voient jamais, ceux qui connaissent ont le travail prémâché. »*

La gratuité d'un conseil chez Meta ou Google **n'est plus un motif de refus**.
La valeur de Pulse n'est pas l'exclusivité du conseil, c'est qu'un seul endroit
rassemble tout chaque semaine — et qu'il n'a rien à vendre, là où l'Opportunity
Score de Meta pousse à dépenser plus sur Meta. `docs/adr/0003` est amendé :
décision intacte, justification réécrite, et elle repose désormais sur *« Pulse
n'arbitre pas entre tes thèmes »* et non sur *« c'est gratuit ailleurs »*.

Conséquence immédiate : `_rule_gaspillage` et `_rule_scaler`, supprimés par
[11](11-d-ou-viennent-les-conseils.md) **pour ce seul motif**, sont réhabilités.
Pas leur code — voir §5.

### Le gisement que personne n'avait vu

**On récolte chaque jour le détail annonce par annonce, Meta et Google, et pas
une seule règle de conseil ne le lit.** `grep ad_name` sur `build_report.py`,
`reco_engine.py` et `insights.py` ne renvoie **rien**. `meta_ads_insights` porte
`adset_name`, `ad_name`, clics, dépense, portée, `link_clicks` ; 
`google_ads_ad_insights` porte `ad_group`, `ad_id`, clics, coût, **conversions**.
Les pages web les affichent depuis toujours. Le moteur, lui, n'est jamais
descendu sous la campagne.

C'est le résultat structurel du ticket : **à l'échelle d'un thème, l'unité de
comparaison n'est plus la campagne, c'est l'Annonce et le Groupe d'annonces.**
Une campagne n'a plus personne à qui se comparer quand on l'a filtrée sur un
thème — c'est exactement pourquoi `gaspillage` et `scaler`, qui comparaient à la
médiane des campagnes, ne pouvaient pas être rebranchés tels quels.

### Trois prémisses du ticket corrigées, dont un bug

**1 · `docs/mesures-impossibles.md` §1 était faux, et je l'ai retiré.** Il
affirmait que GA4 rend le revenu « par campagne, sans dates ». `ga4_insights`
porte `date`, `source`, `medium` **et** `campaign` (`000_run_me_all.sql` l. 341
et l. 381), et `fetch_ga4_insights` fait `select("*")`. C'est
`build_ga4_context` (`saas/collecte/ga4/ga4.py` l. 291-306) qui **écrase la
date** en agrégeant. Le revenu hebdomadaire d'un thème n'est donc pas une mesure
absente, c'est une agrégation à changer — et c'est ce qui permet enfin à un
conseil payant d'avoir une preuve « à mesurer ». La limite avait nommé le
symptôme au lieu de la source ; elle s'est périmée sans que personne le voie.

**2 · Un ROAS gonflé est affiché aujourd'hui, sur tout thème qui tourne sur les
deux régies.** `_kpis_window` (`build_report.py` l. 3344-3351) calcule
`k["spend"]` et `k["cpc"]` depuis `df_meta_raw` **seul** ; Google n'est jamais
ajouté. Mais `k["roas"]` divise par ce `spend` un revenu GA4 qui, lui, agrège
**les deux régies** (l. 3371-3373 : `by_campaign` filtré par `name2label`, qui
couvre Meta comme Google). Résultat : revenu(Meta+Google) ÷ dépense(Meta) — un
ROAS trop élevé, donc des Verdicts qui disent « ça a marché » plus souvent que
la réalité. **Bug préexistant, non causé par ce ticket, mais bloquant** : la
moitié des règles ci-dessous déclarent `cpc` ou `roas`. C'est un chiffre
fabriqué au sens du §7, et il se répare en premier.

**3 · `meta_ads_insights` n'a pas d'identifiant d'annonce dans le fichier de
migration unique.** `000_run_me_all.sql` (l. 137-152) crée la table avec
`UNIQUE (user_id, date_start, ad_name)` et **aucun `ad_id`** — les deux seules
occurrences d'`ad_id` dans ce fichier appartiennent à `google_ads_ad_insights`.
La migration `meta_ads_ad_id.sql` existe mais **n'y est pas repliée**, alors que
`CLAUDE.md` §2 désigne `000_run_me_all.sql` comme le fichier unique à jouer.
Conséquence mesurée : `upsert_meta_ads` (`insert_data.py` l. 37-44) déduplique
sur `(date_start, ad_name)` avec un `seen` qui *skip* — **deux annonces
homonymes dans deux Groupes différents fusionnent, et la dépense de la seconde
disparaît en silence.** « Video 1 » réutilisé est le cas courant. → ticket
[25](25-identifiant-annonce-meta.md).

À corriger dans le rapport de l'agent : il a écrit que l'identifiant *« arrive
déjà dans la réponse de l'API Meta, on ne le stocke simplement pas »*. **Faux** —
`fetch_all.py` l. 299 ne le demande pas (`campaign_name,adset_name,ad_name,
impressions,clicks,reach,spend,actions,date_start`). L'ajouter touche
`saas/collecte/`, que David a mis hors carte.

### Les décisions

**1 · Le périmètre du conseil ne bouge pas, sa profondeur si.** Un conseil ne
sort toujours que sur un **thème prioritaire** (ADR 0003, re-confirmé par David).
Mais il descend désormais jusqu'à l'**Annonce**, toujours accroché au thème :
jamais *« ton annonce est mauvaise »* (la régie le dit déjà, dans l'écran du
clic), toujours *« sur ce thème, voilà où part ton argent »*. Un Geste
« augmenter » désigne le **Groupe d'annonces**, jamais l'Annonce — on ne finance
pas une Annonce. `CONTEXT.md` gagne les deux mots.

**2 · `_compares_channels` meurt entièrement, règles et IA.** David : *« filtre à
la poubelle, on verra si ça pose problème. »* Le filtre (`build_report.py`
l. 1302) écartait tout conseil nommant Meta **et** Google avec un mot de
comparaison, à la génération (l. 2874) et avant le tri (l. 3004) — c'est-à-dire
exactement l'axe que 02 avait mesuré comme le seul encore libre, et que l'ADR
0003 revendique. Son commentaire *« le client n'en veut pas »* précédait 02.
Deux commentaires le mentionnent encore (l. 233, l. 1559) et partent avec lui.

**3 · Les conseils vivent dans le rapport hebdo, jamais sur les pages
plateforme.** David : *« les recos doivent être sur l'hebdomadaire, cela est
clair, pas sur la plateforme. »* Confirme et étend
[11](11-d-ou-viennent-les-conseils.md) : les pages canal montrent des chiffres,
le cockpit reste l'hebdo.

**4 · Le geste « couper » survit, avec deux garde-fous.** L'objection de David
était double et juste : *« si elle fait de bonnes perfos pourquoi la stopper, ou
si c'est une campagne test pourquoi la couper »*. Donc : **jamais sur une
campagne trop jeune** (un test a le droit d'être mauvais le temps de tourner) et
**jamais fondé sur une part de budget** — seulement sur un résultat mesuré. Fait
à connaître : **rien en base ne dit qu'une campagne est un test.** On n'a que
`start_date` / `end_date` déclarées (`campagnes_dates_declarees.sql`) ; l'âge est
donc le seul proxy honnête.

**5 · Dix règles, dont quatre se livrent seules.** Elles sont détaillées au §3 du
rapport de l'agent `recos`. Les cinq Gestes et les cinq Leviers sont couverts,
et **deux portent une preuve « à mesurer »** (`adset_inegal`, `theme_deux_regies`)
— l'exigence n°4 du ticket est remplie : un compte payant ouvre enfin une
Stratégie. **Aucune migration, aucune récolte nouvelle.**

| clé | ce que le client lit | geste | levier | preuve |
|---|---|---|---|---|
| `annonce_sans_conversion` | 138 CHF sans une vente, sa voisine en a fait 7 | couper | contenu | constatable |
| `annonce_locomotive` | accroche 2× mieux — monte le budget de son Groupe | augmenter | argent | constatable |
| `annonce_chere` | 2,40 CHF le clic contre 0,95 pour les autres | couper | argent | constatable |
| `theme_hors_budget` | 800 CHF prévus, tu finiras à 1 070 | corriger | argent | constatable |
| `adset_inegal` | ton Groupe « Retargeting » coûte 3× « Lookalike » | tester | audience | **à mesurer** |
| `theme_deux_regies` | ce thème rend 4× mieux sur Google — bascule 25 % | tester | argent | **à mesurer** |
| `budget_non_depense` | 25 CHF/jour posés, 9 dépensés | corriger | argent | constatable |
| `annonce_usee` | même personne touchée 2,3×/jour, le clic double | créer | contenu | constatable |
| `page_arrivee_muette` | 640 clics envoyés, GA4 en compte 180 | corriger | socle | constatable |
| `creneau_pub` | le dimanche coûte 2× la semaine | corriger | tempo | constatable |

**On livre les quatre premières d'abord** (décision de David) : elles n'ont
**aucun seuil inventé** — tous sortent de `SEUILS` (`reco_engine.py` l. 55-71),
déjà calibrés. Les six autres portent au moins un seuil « à calibrer sur données
réelles » et attendent de voir tourner un vrai compte. `page_arrivee_muette` est
la plus rentable du lot mais son Levier `socle` la sort des cinq places : elle
répare la mesure dont toutes les autres dépendent.

Deux conditions posées par l'agent et retenues : `theme_deux_regies` ne se sert
que si son champ `pourquoi` **nomme le biais last-click de GA4** (une campagne
Meta de prospection qui déclenche une recherche de marque puis un achat via
Google est comptée entièrement pour Google — le biais est dans l'outil de mesure,
pas dans les campagnes, et sans cette phrase la règle pousse le budget dans une
seule direction) ; `creneau_pub` reste **Meta seulement**, parce qu'on ne récolte
pas la stratégie d'enchère et qu'imposer une plage horaire par-dessus une enchère
intelligente dégrade la performance.

**6 · L'alerte budget de David est un constat, pas un conseil — et il l'a
accepté.** Sa formulation : *« attention, tu as un budget quotidien de X, c'est 2
fois plus que la moyenne, c'est normal ? »*, précisée ensuite en **« 2 fois la
dépense moyenne »**. Elle se termine par une question, donc elle n'a pas de
Geste, donc c'est un constat ([22](22-rebrancher-le-plan-de-theme.md) §4 : pas de
sixième geste « vérifier »). Elle part dans `insights.py` et ne compte pas dans
les cinq places. C'est `budget_non_depense` qui en porte la version conseillable,
parce qu'elle, elle désigne la campagne et demande de corriger le budget posé.

**7 · Le trou n'était pas seulement un manque de règles.** Un thème ne porte que
**trois conseils au maximum** ([22](22-rebrancher-le-plan-de-theme.md), décision
1). Donc un compte payant avec **un seul thème prioritaire** reçoit trois
conseils, quelle que soit la longueur du catalogue. Il en faut **deux thèmes**
pour approcher cinq. **David l'accepte** : cinq est un plafond, pas un quota, et
une semaine légère est une semaine honnête. Le manque était donc *règles payantes
× plafond par thème* — on répare la première moitié, et on assume la seconde.

**8 · Le ticket [23](23-recolte-des-quatre-manques.md) attend.** David :
*« j'attendrais, on a déjà énormément. »* Mots-clés, texte d'annonce, découpage
d'audience Meta et dimension de page GA4 restent hors périmètre. Conséquence
assumée, mesurée par l'agent : **aucune règle payante au-dessus de 30 min
d'effort** — le bac « 2 h+ » reste vide côté pub, et il le restera jusqu'à 23,
parce qu'un vrai chantier payant a besoin du texte de l'annonce ou des mots-clés.

### L'ordre de construction

Rien ne part avant la réparation, sinon les Verdicts mentent :

1. **`_kpis_window` ajoute la dépense Google** à `k["spend"]` et `k["cpc"]`
   (`build_report.py` l. 3344-3351). Purement local, aucune donnée nouvelle.
2. **`build_ga4_context` garde la date** — le revenu par thème devient
   hebdomadaire (`ga4.py` l. 291-306).
3. **Deux indicateurs à déclarer** dans `METRICS_IA` / `METRIC_INFO_IA` :
   `spend` (que `_kpis_window` calcule **déjà**) et `sessions`.
4. **Trois branchements de lecture, aucune récolte** :
   `fetch_google_ads_ad_insights` (existe, `fetch_data.py` l. 174, jamais appelée
   par le worker) · `fetch_channel_budgets` (existe, l. 94, idem) ·
   `fetch_platform_budgets` **à écrire** (seul l'`upsert` existe).
5. **Le retrait de `_compares_channels`.**
6. **Les quatre règles**, dans l'ordre du tableau.

**Aucune migration.** Aucune colonne, aucune table — sauf si
[25](25-identifiant-annonce-meta.md) est pris, et il ne l'est pas maintenant.

### Vocabulaire

`CONTEXT.md` gagne **Annonce** et **Groupe d'annonces**. **Levier** est corrigé :
il avait quatre valeurs, il en a cinq — `socle` manquait, alors que
`_LEVIER_REGLE` (`build_report.py` l. 290) le porte depuis toujours.

### Ce qui sort en ticket

[25](25-identifiant-annonce-meta.md) — **l'identifiant d'annonce Meta**, pour que
deux annonces homonymes cessent de fusionner. Touche `saas/collecte/`, hors carte
aujourd'hui, reporté par David.
