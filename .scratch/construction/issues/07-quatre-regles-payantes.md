# Les quatre règles payantes qui se livrent seules

Type: task
Status: resolved
Blocked by: 03, 06

## Question

**Tranché par [24](../../refonte/issues/24-conseils-payants-manquants.md).**
Un compte sans Instagram ne reçoit qu'**un** conseil par semaine (mesuré en 22).
Ces quatre règles ferment ce trou, et **David a choisi de les livrer d'abord**
parce qu'elles n'ont **aucun seuil inventé** — tous sortent de `SEUILS`
(`reco_engine.py` l. 55-71) — qu'elles couvrent **cinq Gestes et cinq Leviers**,
et qu'elles demandent **zéro migration**.

### Les quatre

| clé | ce que le client lit | geste | levier | preuve |
|---|---|---|---|---|
| `annonce_sans_conversion` | 138 CHF sans une vente, sa voisine en a fait 7 | couper | contenu | constatable |
| `annonce_locomotive` | accroche 2× mieux — monte le budget de son Groupe | augmenter | argent | constatable |
| `annonce_chere` | 2,40 CHF le clic contre 0,95 pour les autres | couper | argent | constatable |
| `theme_hors_budget` | 800 CHF prévus, tu finiras à 1 070 | corriger | argent | constatable |

### Le gisement, et pourquoi il était invisible

**On récolte chaque jour le détail annonce par annonce, Meta et Google, et
aucune règle ne le lit** — `grep ad_name` ne renvoie rien sur les trois moteurs.
À l'échelle d'un thème, l'unité de comparaison n'est plus la campagne mais
l'**Annonce** et le **Groupe d'annonces** (`CONTEXT.md`).

### Les garde-fous, tels que David les a posés

- **Le critère d'admission de 02 est SUPPRIMÉ.** La gratuité d'un conseil chez la
  régie **n'est plus un motif de refus** : *« les dashboards montrent des données
  Meta et Google, mais l'hebdomadaire, ces recos, les personnes ne les voient pas
  seules »*. La valeur, c'est qu'un seul endroit rassemble tout — et que Pulse n'a
  rien à vendre là où l'Opportunity Score pousse à dépenser plus.
  **L'ADR 0003 est intact, sa justification est réécrite.**
- **Le geste « couper » survit, avec deux garde-fous** : jamais sur une campagne
  **jeune**, jamais sur une **part de budget** — rien en base ne dit qu'une
  campagne est un test. Seulement sur un résultat **mesuré**.
- **Les conseils vivent dans l'hebdo, jamais sur les pages plateforme.**
- **`_compares_channels` meurt entièrement**, règles et IA. David : *« filtre à la
  poubelle, on verra si ça pose problème »*.
- **L'alerte budget est un CONSTAT, pas un conseil** — accepté par David.

### Le plafond qui reste, et qui est assumé

Un thème ne porte que **trois conseils au maximum** (22) : un compte à un seul
thème prioritaire plafonne donc à trois. **C'est assumé, ne pas le « réparer ».**

### Le piège à ne pas rejouer

**Une Annonce est identifiée par `ad_id`, jamais par son nom.** Trois de ces
règles comparent des Annonces : sans le ticket **03** en service, elles rejouent
dans le moteur de conseils le bug des homonymes.

### Consigne de repli

Livrer deux règles finies et vérifiées plutôt que quatre à moitié. Chacune est
indépendante des autres — c'est ce qui rend ce repli honnête.

## Answer

Les quatre règles sont écrites, branchées et vérifiées — **188 vérifications**,
aucune base, aucun secret, aucun réseau
([harnais](../harnais/07-quatre-regles/LISEZMOI.md)). Les **302** du harnais 06
sont rejouées sans régression.

### Une prémisse fausse, et elle est lourde → ticket [26](26-les-regles-payantes-n-atteignent-pas-le-rapport.md)

**Un conseil-règle n'atteint pas le rapport d'un client qui a trois thèmes
étoilés ou moins.** `_ia_redigee` est vrai pour les `_THEMES_IA = 3` premiers
thèmes de `theme_list`, `theme_list` **est** la liste des étoiles, et un thème
rédigé par Gemini ne reçoit **aucun** conseil-règle (décision de David du
27 août 2026). Le chemin des règles ne s'ouvre qu'à partir de la **quatrième
étoile**.

Ça ne vaut pas que pour ces quatre règles : `roas` — le *« un conseil par
semaine »* que 22 a mesuré — ne sort pas non plus. Les quatre règles sont donc
**livrées au bon endroit et prêtes**, et c'est une **porte** en amont qui décide
qui les verra. C'est une question produit, elle va à David, elle ne se glisse
pas : ticket 26.

### Les quatre règles — `saas/recos_ia/regles_payantes.py`

Module neuf, **pur** : listes de dicts en entrée, dicts en sortie, ni base, ni
réseau, ni pandas, ni notion de thème au-delà de son nom dans les phrases. Même
partage que `_orga_recos` et `_reco_evenements` — c'est l'appelant qui sait
rattacher une Annonce à un thème.

| clé | seuils, tous issus de `SEUILS` | geste · levier · preuve · indicateur · durée |
|---|---|---|
| `annonce_sans_conversion` | `roas_spend_min` (50 CHF) | couper · contenu · constatable · roas · 10 min |
| `annonce_locomotive` | `ctr_ratio` (1.5), `ctr_impressions_min` (1 000) | augmenter · argent · constatable · roas · 10 min |
| `annonce_chere` | `cpc_ratio` (2.0), `cpc_spend_min` (50 CHF) | couper · argent · constatable · cpc · 10 min |
| `theme_hors_budget` | `cpc_spend_min` (50 CHF) | corriger · argent · constatable · spend · 30 min |

**Aucun seuil inventé**, et les tests le prouvent en se plaçant *pile* dessus :
un centième en dessous, la règle se tait ; à la valeur exacte, elle parle.

**Les deux garde-fous du geste « couper » tiennent, et le second va plus loin
que la lettre du ticket** : une annonce de campagne jeune n'est jamais dénoncée,
**et elle ne compte pas dans la médiane non plus** — une campagne en
apprentissage paie ses premiers clics plus cher, la laisser dans le repère
masquerait la vraie annonce chère. Aucune des quatre ne regarde une part de
budget : toutes regardent un résultat mesuré.

**`annonce_locomotive` désigne le Groupe d'annonces, jamais l'Annonce** — sans
Groupe connu, elle se tait plutôt que de demander un budget là où aucune
plateforme n'en prend.

**La comparaison se fait DANS un Groupe d'annonces, et c'est la revue de code
qui l'a imposé.** La première version comparait toutes les Annonces d'un thème
entre elles. Un thème qui tourne sur Google Search ET sur Display — ou sur Meta
ET Google le jour où la migration 03 passe — n'a pas *un* prix du clic ni *un*
taux de clic, il en a deux, et ils n'ont rien à voir : un clic Search se paie
plusieurs fois un clic social, un taux de clic Search tourne entre 3 et 10 %
contre ~1 % sur un fil. L'annonce « la plus chère du thème » était donc
mécaniquement une annonce Search, et la « locomotive » aussi. À
`ctr_ratio = 1.5`, la règle aurait désigné la même annonce Search **toutes les
semaines** en demandant +20 % de budget à chaque fois — et le champ `pourquoi`
aurait affirmé « elles partagent la même audience », ce qui était **faux**.
Deux Annonces d'un même Groupe, elles, partagent audience, placement et
enchère : ce qui les sépare est bien ce qu'elles montrent. Les trois règles
d'annonce évaluent maintenant Groupe par Groupe, et entre plusieurs Groupes
c'est l'argent en jeu (ou les impressions, pour la locomotive) qui décide
lequel se lit.

**Un arbitre a été ajouté, il n'était pas dans le ticket.** Trois de ces règles
peuvent tomber sur la MÊME Annonce, et la carte d'un thème n'a que trois places :

- **muette ET chère** — les deux disent de couper la même annonce. Zéro
  conversion pendant qu'une voisine en rapporte est une **preuve**, un clic
  cher n'est qu'un prix : on garde la preuve, on retire le prix. Sans ça, deux
  des trois places disaient la même chose ;
- **locomotive ET chère** — « monte le budget de son Groupe » et « coupe-la »
  se contredisent. **On ne sert ni l'un ni l'autre** : dire lequel des deux
  signaux l'emporte demanderait une règle qui n'existe pas, et l'inventer
  serait trancher à la place du client là où la donnée ne tranche pas.

### Ce que la donnée a imposé, et qui n'était pas dans le ticket

**`annonce_sans_conversion` est Google seul aujourd'hui, et ce n'est pas un
choix.** `meta_ads_insights` ne porte **pas** la conversion au niveau de
l'Annonce ; `google_ads_ad_insights` si. Les lignes Meta arrivent donc à
`conversions=None` — **une absence de mesure n'est pas un zéro** (`CLAUDE.md`
§7) : elles ne sont ni dénoncées, ni utilisées comme preuve. Les compter à zéro
aurait fait couper une annonce Meta qui vend très bien.

**Meta n'entre dans les trois règles d'annonce que si `ad_id` est en base.**
C'est le piège que le ticket nommait. La colonne est posée par le ticket
[03](03-identifiant-annonce-meta.md), **dont le SQL n'est pas joué** : tant
qu'il ne l'est pas, `_annonces_theme` ne voit pas la colonne et **Meta sort
entièrement** des comparaisons d'Annonces. Regrouper par nom aurait rejoué le
bug des homonymes *dans le moteur de conseils* — en comparant une annonce
fantôme à ses voisines. Google, lui, a son `ad_id` depuis toujours : les trois
règles tournent sur Google dès aujourd'hui, et gagnent Meta le jour où la
migration passe. **Rien à recoder ce jour-là.**

**`theme_hors_budget` ne projette que l'avenir.** `depense_mois` est ce qui a
réellement été dépensé du 1er au dernier jour plein ; seuls les jours qui
**restent** sont estimés, au rythme que le rapport mesure déjà (sa fenêtre de
sept jours pleins). Extrapoler aussi le passé aurait fabriqué un chiffre là où
on en a un vrai. Son angle mort **date le relevé** : une photo hebdomadaire ne
sait pas ce que le budget valait il y a trois semaines, et aucune API ne le
donne.

### Les deux lectures qu'il a fallu brancher

- **`fetch_google_ads_ad_insights` est maintenant PAGINÉE.** Elle existait,
  n'était appelée par personne, et faisait un seul `.execute()` : PostgREST
  tronque à 1 000 lignes **en silence** (`CLAUDE.md` §8). Un compte à
  40 annonces aurait perdu tout ce qui précède ses 25 derniers jours, et les
  règles auraient comparé un échantillon tronqué sans que rien ne le dise.
- **`fetch_platform_budgets` est écrite** (seul l'`upsert` existait). Le relevé
  est choisi **par canal**, jamais un seul pour les deux : le jour où le jeton
  Google expire, seul Meta est photographié — un relevé commun ferait
  s'effondrer le budget posé puis doubler la semaine suivante sans que rien
  n'ait bougé chez le client. Même règle que `getBudgetPlanifie`
  (`saas/web/lib/budgets.ts`), dont le prorata est **porté tel quel** en Python :
  la page Coûts et le conseil hebdo doivent dire le même nombre.

### `_compares_channels` est morte, entièrement

Définition, les deux appels (génération et tri), et les trois commentaires qui
la mentionnaient. Une pierre tombale reste à sa place, qui dit pourquoi. Une
conséquence à connaître : les **deux tentatives** de Gemini existaient en partie
parce que ce filtre pouvait faire tomber un thème de 3 pistes à 1 — elles
restent, une piste au levier ou à l'indicateur hors liste est toujours rejetée
et c'était l'autre moitié de la raison.

### `spend` entre, `sessions` non

`theme_hors_budget` est le seul conseil dont la réussite est une **dépense qui
redescend** : sans `spend` déclaré, il n'aurait aucun verdict possible.
`_kpis_window` le calculait déjà, sur les deux régies depuis le ticket 01 —
aucune mesure neuve, juste une déclaration qui manquait.

`sessions`, proposé au même moment par 24, **n'est pas ajouté** : `_kpis_window`
ne sait pas le mesurer, et un indicateur qu'on ne sait pas remesurer à
l'échéance ne rend pas un verdict, il en fabrique un.

`spend` n'est **pas proposé à Gemini** (son prompt énumère ses six indicateurs
et n'a pas celui-ci) : « dépenser moins » n'est un succès que comparé à un
budget posé. Offerte seule à une piste libre, la baisse de dépense se lirait
comme une réussite même quand le revenu s'est effondré avec elle.

### Une assertion assouplie dans le harnais 06, et laquelle

`test_indicateur_sans_proof_kpi.py` exigeait que `_METRIC_REGLE` ait
**exactement** les clés de l'ancienne `PROOF_KPI`. Quatre clés neuves la
faisaient tomber sur un ajout au lieu d'une valeur déplacée. Elle vérifie
maintenant qu'aucune clé de `PROOF_KPI` n'a disparu, **et nomme les quatre
ajoutées** — une cinquième qui apparaîtrait sans ticket ferait toujours tomber
le test. Ce que le test protégeait (aucune valeur n'a bougé) est vérifié
ailleurs dans le même fichier, et reste entier.

### Ce qui n'est PAS dans ce ticket, et pourquoi

- **L'alerte budget « c'est 2× la moyenne, c'est normal ? »** reste à écrire
  dans `insights.py`. C'est un constat, pas un conseil (24, décision 6), et sa
  version conseillable est `budget_non_depense` — les deux appartiennent aux six
  règles restantes, ticket [10](10-six-regles-payantes-restantes.md).
- **Les six autres règles** — elles portent au moins un seuil à calibrer sur
  données réelles, et le ticket 07 est précisément celui des quatre qui n'en ont
  aucun.

### Ce que la revue de code a rendu, et ce que j'en ai fait

Trois de ses relevés portaient sur ce ticket, les trois sont corrigés : la
comparaison inter-canaux sur `annonce_chere` et `annonce_locomotive` (ci-dessus),
et `fetch_platform_budgets` qui jetait les lignes Meta déjà lues quand la
requête Google échouait — un `continue` au lieu d'un `return []`, comme sa
voisine juste en dessous.

Deux autres portaient sur des conséquences du ticket **06**, pas de celui-ci :
`theme_event_cout` devenu inatteignable (déjà écrit dans 06 et porté par
[09](09-trois-moteurs-un-seul.md)), et l'Hypothèse d'une règle qui peut changer
de théorie chaque semaine sur le chemin des conseils-règles → ticket
[27](27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md). Les quatre
règles de ce ticket sont toutes « constatable » et n'ouvrent aucune Stratégie :
elles ne sont pas en cause.

Le reste de ses relevés (`lib/couts.ts`, `bandeau-commandes.tsx`, le prototype
`?variant=` sur `/meta`) concerne du travail en cours qui n'est pas de ce
ticket — je n'y ai pas touché.

### Vérifications

- `python3.12 -m py_compile` vert sur `build_report.py`, `reco_engine.py`,
  `regles_payantes.py`, `fetch_data.py`, et l'import réel de `build_report`
  passe.
- **188 vérifications** (harnais 07) + **302** (harnais 06, rejouées).
- **`saas/web` n'a pas été vérifié, et n'avait pas à l'être : aucun fichier
  TypeScript n'est touché par ce ticket.** L'arbre de travail en porte
  beaucoup d'autres, qui ne sont pas de ce chantier.
- **Aucune règle n'a jamais tourné sur de vraies données**, et `build_payload`
  n'a pas tourné non plus — c'est le ticket
  [16](16-le-seam-du-payload.md). `_annonces_theme` et `_budget_theme` sont
  vérifiées **par lecture seule**.
- **Aucune migration, aucune récolte nouvelle, rien de joué en base.**
- Une correction du traitement **ne se voit qu'après un « ↻ Recharger mes
  conseils »**.
