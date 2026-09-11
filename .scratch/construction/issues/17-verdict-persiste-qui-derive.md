# Le verdict « figé » qui se réécrit chaque semaine

Type: task
Status: open

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
