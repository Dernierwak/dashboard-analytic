# Le verdict « figé » qui se réécrit chaque semaine

Type: task
Status: resolved

## Question

Sorti par la revue de code du ticket [01](01-roas-gonfle.md), sur le commit
`cf84957` (« la mémoire d'un thème »). **Trois défauts qui vivent tous dans le
même bloc de `build_report.py` (l. 3800-3995)** — donc un seul ticket, une
seule session : la carte interdit deux agents sur ce fichier.

Aucun n'a été corrigé en 01, qui réparait une division et n'avait pas mandat de
toucher à la mémoire.

### 1 · Le verdict persisté n'est pas figé — il dérive (le plus grave)

Le bloc mémoire refuse délibérément le `then/now/delta` d'une vieille ligne
`auto` et ne garde que `_verdict_fige = a.get("verdict")`, au motif écrit :
*« lui n'a pas dérivé, il a été figé à sa date »*.

**La prémisse est fausse.** Vingt lignes plus bas, la même branche exécute
`update({"verdict": _verdict})` à **chaque** rapport, et `_verdict` vient d'être
recalculé contre le KPI du jour (`now = _kpis_du_theme(...)`). Une ligne `auto`
restant `due` pour toujours, la colonne est réécrite toutes les semaines. Le
commentaire qui l'accompagne — *« idempotent, même valeur tant que rien ne
bouge »* — décrit une propriété que le code n'a pas : ce qui bouge, c'est le
compte, pas l'hypothèse.

Scénario : hypothèse « baisse le budget X » sur le thème T, échéance atteinte au
1er juin avec CPC +22 % → `worse` persisté. L'été passe, le CPC du thème
redescend. Le 14 septembre, `_verdict` est recalculé à `better`, la colonne est
écrasée, et la mémoire raconte à Gemini que cette hypothèse a **réussi** — donc
que le levier « argent » vaut d'être rejoué. C'est exactement le mensonge que la
fonctionnalité existait pour empêcher, et la même valeur dérivée nourrit déjà
`fetch_reco_verdicts` → `_DONE_W` (`saas/recos_ia/reco_engine.py`), donc le
poids des conseils.

Piste : n'écrire le verdict qu'une fois — `.is_("verdict", "null")` sur l'update,
ou garde sur `_verdict_fige is None`. **À vérifier avant de coder** : un refus
RLS sur un `update` ne lève rien et touche zéro ligne (`CLAUDE.md` §8).

### 2 · La mémoire se reconstruit à partir des seules lignes mesurables cette semaine

`_mem_hist` n'est rempli que dans la branche
`if due and _meme_perimetre and metric and base is not None and now is not None`.
Une hypothèse dont le verdict est **déjà** persisté n'a besoin d'aucune mesure
fraîche pour faire partie du récit — elle tombe pourtant dès que `now` vaut
`None` cette semaine (`cpc` sans clic, `roas` sans revenu GA4 attribuable ou
sans dépense), ou dès que `_meme_perimetre` est faux, ce qui est le cas de
**toutes** les lignes `cpc`/`roas` d'avant le 2026-09-19 depuis 01.

Et `condense_theme_memoire` réécrit `resume` **en entier**, ce n'est pas une
fusion : le récit passe de trois hypothèses à deux, et la troisième disparaît
pour de bon si elle n'est pas mesurable le jour d'une condensation suivante.

### 3 · Le rattrapage de condensation n'est pas borné (mineur)

Le rattrapage (l. 3967-3995) rejoue une condensation pour tout thème dont le
`resume` est vide, en s'appuyant sur : *« dès qu'une condensation réussit,
`resume` cesse d'être vide »*. Or `save_theme_resume` est un `.eq("theme", …)`
sur `theme_plan` et renvoie `False` **définitivement** dans les deux cas que sa
propre docstring liste : pas de ligne `theme_plan`, ou thème renommé côté client
pendant que `suivi_actions` porte encore l'ancien libellé — or `_mem_labels`
vient justement de `a["theme"]`, l'ancien.

Conséquence : un appel Gemini par thème concerné, à chaque rapport, pour une
écriture qui touche zéro ligne. Invisible pour le client (l'exception est
avalée), mais c'est un coût IA récurrent que le commentaire affirme impossible.

## Ce qu'il faut faire

- Vérifier les trois à la ligne avant de corriger : ce relevé est un point de
  départ, pas une dispense.
- Les commentaires de ce bloc affirment des propriétés que le code n'a pas.
  Corriger le code **et** les commentaires : un commentaire faux coûte plus
  cher qu'un commentaire absent.
- Ne rien rejouer de l'historique. Un verdict déjà rendu jugeait sur le
  périmètre d'alors ([17 de la refonte](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md)).

## Consigne de repli

Les trois points sont indépendants et classés par gravité. Rendre le 1 fini et
vérifié plutôt que les trois à moitié.

---

## Réponse

**Les trois sont corrigés et vérifiés** par `harnais/17-verdict-fige/` — 47
vérifications, chacune rejouée d'abord contre le code d'avant, où elle tombe à
l'endroit que le relevé décrit. Le relevé était juste à la ligne près, à un mot
près : la branche ne lit plus de lignes `auto` depuis le ticket 06, mais une
ligne `done` reste `due` pour toujours exactement pareil — le défaut est
intact.

### 1 · Le verdict s'écrit une fois, et il est servi figé

Le garde est aux deux bouts. **Chez l'appelant** (`build_report.py`) : une
branche `if _verdict_fige:` en tête de boucle détourne toute ligne déjà jugée
avant la moindre remesure — elle ne calcule rien, n'écrit rien, et repart avec
son verdict. **En base** (`lecteur.ecrire_verdict`) : `.is_("verdict", "null")`
dans le `WHERE`, pour le cas où deux constructions se croiseraient sur la même
ligne. La condition est dans la requête et pas dans une relecture préalable —
un `select` puis un `update` laisse la place entre les deux, et un refus RLS ne
lèverait de toute façon rien (`CLAUDE.md` §8).

Une écriture qui ne passe pas (colonne pas migrée, refus RLS) laisse la colonne
vide : la ligne repasse par la branche de mesure au rapport suivant. **Le coût
d'une panne est un verdict retardé** — à une condition, que la revue de code a
dû rappeler : `ecrire_verdict` rend maintenant `True` **seulement si une ligne
a été touchée** (comme `save_theme_resume`, et pour la même raison), et la
mémoire du thème ne se nourrit qu'après ça. Sans ce retour, la première version
du correctif versait le triplet mesuré dans le prompt **avant** de savoir si le
verdict avait pris : sur un refus RLS, Gemini recevait un chiffre neuf chaque
semaine pour la même hypothèse. La dérive déplacée d'un cran, pas retirée.

Le payload suit la même règle : `tracking.verified` porte le verdict figé, et
le triplet `then/now/delta` **n'est servi que la semaine de la chute**. Ensuite
l'écran écrit « on suit le CPC » plutôt que « CPC 1,2 → 0,9 » (`Effet`,
`saas/web/components/etat-action.tsx`, qui gérait déjà ce cas). Ce n'est pas
une perte : ce `now`-là ne mesurait plus l'action. Sans ça, la colonne aurait
été figée pendant que l'écran, lui, aurait continué de dériver — on aurait
déplacé le mensonge au lieu de le retirer.

### 2 · La mémoire se nourrit du verdict persisté

Le même `if _verdict_fige:` verse l'hypothèse dans `_mem_hist` sans demander ni
mesure fraîche ni même périmètre. Les deux trous du relevé sont fermés d'un
coup, et le test qui compte le plus s'appelle
`test_trois_hypotheses_restent_trois` : trois hypothèses sur un thème, une seule
mesurable aujourd'hui, **un seul** appel IA, et trois lignes dans le prompt. Sur
le code d'avant, il en restait une.

Le triplet mesuré, lui, ne part toujours qu'une fois — cette partie-là était
déjà juste, et le commentaire qui la porte est le seul du bloc à ne pas avoir
été réécrit.

### 3 · Le rattrapage ne tourne plus dans le vide

Une condition, lue dans `theme_plan_by` déjà en main : **on n'appelle l'IA que
si la mémoire a un endroit où se poser** — une ligne `theme_plan` à ce nom, et
la colonne `resume` réellement présente. Ça ferme les deux cas que la docstring
de `save_theme_resume` listait, plus un troisième trouvé en écrivant le harnais
et absent du relevé : **quand la migration `resume` n'est pas jouée**,
`fetch_theme_plan` retombe sur son `select` sans elle, aucune ligne ne porte la
clé, et *tous* les thèmes avec de la matière redevenaient éligibles chaque
semaine.

Ce que ça décale : un thème dont la toute première Stratégie s'ouvre aujourd'hui
attend le rapport suivant (`theme_plan_by` est lu avant les `upsert` de ce
rapport-ci). Une semaine de retard sur une mémoire qui n'existait pas encore, au
lieu d'un appel IA par semaine pour toujours.

**Un quatrième cas, trouvé par la revue de code du correctif** : le garde
compare des clés NORMALISÉES (`_nrm`), `save_theme_resume` écrit avec un
`.eq("theme", …)` qui ne l'est pas. Un thème renommé « été » → « Été » passait
donc le garde et ratait l'écriture — la même dépense hebdomadaire, désormais
masquée par un garde qui avait l'air de la couvrir. La condensation reçoit
maintenant le libellé de la ligne `theme_plan` dont on vient de prouver
l'existence, jamais celui du carnet.

### Les commentaires

Le bloc entier a été réécrit, et trois docstrings avec lui :
`ecrire_verdict` (`lecteur.py`), `save_theme_resume` (`insert_data.py`,
« `build_report.py` repassera » était devenu faux) et `condense_theme_memoire`
(`theme_memoire.py`). Chacun dit maintenant ce que le code fait **et** ce qu'il
coûte.

### Ce que ça coûte, et qui n'est pas rattrapable

**Les actions déjà jugées perdent leur `then/now/delta` d'un coup, dès le
premier passage du worker après ce déploiement** — pas seulement les verdicts à
venir. Elles portent toutes un verdict (l'ancien code en écrivait un chaque
semaine), elles prennent donc la branche figée immédiatement, et l'archive passe
de « CTR 3,1 → 5,8 ▲ +87 % » à « on suit le CTR » pour tout le monde en même
temps. Aucune colonne ne garde la valeur constatée le jour du verdict : c'est
**irrécupérable**, et c'est le prix assumé de ne plus servir un chiffre qui
mesure la dérive du compte plutôt que l'action. Les lignes rangées, elles, ne
sont pas concernées — elles n'ont jamais eu ces chiffres, `suivi_en_cours` ne
les lit pas. La question « faut-il deux colonnes pour garder la photo du
verdict ? » est posée dans le ticket
[42](42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md), §2.

### Ce qui n'a pas été fait

- **Rien n'est joué en base.** Que `.is_("verdict", "null")` empêche réellement
  une seconde écriture sur la base réelle **reste à constater** : le harnais le
  vérifie comme chaîne PostgREST, pas contre un PostgreSQL.
- **Ça ne se verra qu'après un passage du worker** — cron du Jour de travail
  (07:00 UTC) ou lancement à la main depuis **GitHub Actions**
  (`weekly-fetch.yml`, `report_only`). Le client ne déclenche rien ici.
- **Un défaut trouvé en chemin, laissé en ticket** :
  [42](42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md) — `report.ts` lit
  le verdict dans le payload et jamais dans la colonne, qu'il ramène pourtant.
  Une action rangée après son verdict perd sa pastille pendant que le bilan du
  carnet la compte encore. C'est du `saas/web/`, et il n'y a aucun runner
  là-bas.
