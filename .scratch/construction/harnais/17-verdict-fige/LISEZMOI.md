# Harnais du ticket 17 — le verdict figé

Trois défauts du même bloc de `build_report.py`, et le seul moyen honnête de les
prouver est de faire **tourner la construction** : chacun se manifeste au
DEUXIÈME rapport, jamais au premier. Un test de structure ne peut pas voir ça —
il lit un fichier une fois.

Même convention que les autres dossiers : pas de runner, rien à installer.

```bash
cd .scratch/construction/harnais/17-verdict-fige
python3.12 test_verdict_fige.py
python3.12 test_memoire_du_theme.py
python3.12 test_rattrapage_borne.py
```

## Les pièces

| Fichier | Ce qu'il est |
|---|---|
| `pulse.py` | Le chemin d'import — et il ajoute le harnais 16 au `sys.path` : le faux lecteur y est **réutilisé**, pas recopié (voir plus bas). |
| `gree.py` | Le compte du ticket : un thème à 30 CHF et 100 clics par jour (**CPC de 0,30**, jamais écrit à la main), des lignes de `suivi_actions` (`action(...)`), des lignes de `theme_plan` (`theme_plan(...)`), et un lecteur qui **enregistre** les condensations de mémoire au lieu de les avaler. |
| `test_verdict_fige.py` | Ce que la construction **écrit en base** et **sert au client**. |
| `test_memoire_du_theme.py` | Ce que Gemini **relira** avant de proposer l'hypothèse suivante. |
| `test_rattrapage_borne.py` | Combien d'**appels IA** sont payés, et pour quelle écriture. |

### Pourquoi le compte est daté du 15 octobre 2026

`_BASCULE_PUB` vaut `2026-09-19` : une hypothèse `cpc` ou `roas` décidée avant
cette date part **sans verdict automatique** (sa baseline a été prise sur la
dépense Meta seule, ticket 01). Un harnais daté d'aujourd'hui ne verrait donc
jamais tomber un verdict `cpc` — il prouverait une bascule, pas un verdict.

### Pourquoi le faux lecteur du harnais 16 est importé, pas copié

`lecteur_fige.py` fait descendre **tout** le compte des campagnes décrites : les
totaux par thème, le contexte GA4, la fenêtre. Une seconde copie divergerait au
premier ticket qui touche l'un des deux, et les deux harnais ne prouveraient
plus la même chose sur le même compte. C'est le premier partage entre deux
harnais du dépôt ; il porte sur un **gréement**, jamais sur une assertion.

## Ce qu'il prouve

| Fichier | Ce qu'il prouve |
|---|---|
| `test_verdict_fige.py` | **Un verdict s'écrit une fois.** Le jour de la chute, il se mesure (CPC 0,40 → 0,30, soit −25 % sur un indicateur qu'on veut voir baisser → `better`) et s'écrit. Une ligne qui porte déjà `worse` n'est **plus jamais réécrite ni remesurée**, et le test qui suit prouve que ce n'était pas gagné d'avance : sur le **même** compte, colonne vide, la construction rend `better`. Deux rapports enchaînés — le second relisant la colonne écrite par le premier — rendent le **même** verdict et n'écrivent rien. Le triplet `then/now/delta` ne repart pas les semaines suivantes. Et ce qui n'avait pas de verdict n'en reçoit toujours pas : pas à échéance, seulement décidée, ou baseline d'avant la bascule pub. **21 vérifications.** |
| `test_memoire_du_theme.py` | **Une hypothèse jugée reste dans le récit sans mesure fraîche** — un `roas` sans revenu GA4 rattachable cette semaine, une ligne d'un autre périmètre de dépense. **Trois hypothèses restent trois**, dont une seule est mesurable aujourd'hui, en **un seul** appel IA. Le triplet mesuré part **le jour de la chute** et pas après : trois mois plus tard il mesurerait la dérive du compte, pas l'idée (`CLAUDE.md` §7). Et il ne part **que si l'écriture du verdict a pris** : sur un refus RLS, rien n'entre dans le récit — sinon la ligne serait remesurée la semaine suivante et la dérive reviendrait par le prompt. Un levier absent reste **inconnu**. **18 vérifications.** |
| `test_rattrapage_borne.py` | **Le rattrapage garde sa raison d'être** (une mémoire vide avec un plan est reprise) **et ne tourne plus dans le vide** : zéro appel IA sur un thème sans ligne `theme_plan`, sur un thème renommé côté client, et tant que la colonne `resume` n'est pas migrée. Un thème renommé **à la casse près** passe le garde (les clés sont normalisées) mais raterait l'écriture (`.eq("theme", …)` ne l'est pas) : la condensation reçoit donc le libellé du **plan**, pas celui du carnet. Le verdict du jour, lui, **s'écrit quand même** — c'est la mémoire seule qui attend son plan. **8 vérifications.** |

Total : **47 vérifications**.

### Les trois défauts sont reproduits, pas seulement corrigés

Chaque fichier a été rejoué contre le code **d'avant** la correction. Il tombe,
et il tombe à l'endroit exact que le ticket décrit :

| Fichier | Sur le code d'avant |
|---|---|
| `test_verdict_fige.py` | 15/21 — `aucune écriture n'est tentée — obtenu [('a-1', 'better')]` sur une ligne qui portait `worse`, et `et elle garde SON verdict — obtenu 'better', attendu 'worse'`. |
| `test_memoire_du_theme.py` | 10/16 — `les trois sont dans le récit — obtenu ['Baisser le budget']`. Deux hypothèses sur trois tombées du prompt. |
| `test_rattrapage_borne.py` | 3/7 — un appel Gemini sur chacun des quatre thèmes dont l'écriture ne pouvait pas aboutir. |

**Deux vérifications de plus ont été écrites APRÈS coup**, sur des défauts que
la revue de code a trouvés dans la correction elle-même — les deux rejoués
contre la première version du correctif, où ils tombent :

| Vérification | Sur la première version du correctif |
|---|---|
| `rien n'entre dans le récit` (mémoire) | Le triplet était versé **avant** de savoir si l'écriture du verdict avait pris. Sur un refus RLS, la ligne repasse en mesure la semaine suivante et Gemini reçoit un chiffre neuf chaque semaine : la dérive déplacée d'un cran, pas retirée. |
| `la condensation vise le libellé du plan` | `obtenu ['été'], attendu ['Été']` — le garde compare des clés normalisées, l'écriture non. |

**Rejoués sans régression** : les harnais 06 (342), 07 (189), 08 (85), 09 (108),
10 (347), 12 (178), 13 (77) et 16 (298) — **1 624** vérifications. Les harnais
04 et 05 demandent un PostgreSQL et n'ont pas été rejoués.

**Deux assertions ont dû être réécrites, et c'est le signe attendu** — les deux
lisaient du TEXTE, ce que ce harnais remplace par une exécution :

- harnais 16, `test_l_ecriture_du_verdict_rejoue_la_meme_requete` comparait la
  chaîne PostgREST de `ecrire_verdict` à celle du commit d'avant l'injection.
  Elle a gagné un `.is_("verdict", "null")`. Le test le dit maintenant en
  toutes lettres, avec sa raison — c'est la seule divergence assumée de ce
  fichier ;
- harnais 12, `test_la_releve_est_intacte_le_rail_mesure_toujours` épelait
  `self.sb.table("suivi_actions").update(` sur une seule ligne. Le garde a
  coupé la chaîne en plusieurs. L'assertion lit désormais les trois pièces qui
  portent le sens, pas la mise en forme.

## Ce qu'il ne prouve pas

- **Rien n'est joué en base.** `.is_("verdict", "null")` est vérifié comme
  chaîne PostgREST (harnais 16), jamais contre un PostgreSQL : que le filtre
  empêche réellement une seconde écriture **sur la base réelle** reste à
  constater. Le garde côté appelant, lui, est exécuté ici.
- **Le rendu web n'est pas couvert** — il n'y a toujours aucun runner dans
  `saas/web`. Que `Effet` écrive « on suit le CPC » quand `then`/`now` manquent
  se lit dans `saas/web/components/etat-action.tsx`, ça ne se joue pas ici.
- **La condensation elle-même n'est pas jouée.** On compte les appels et on lit
  l'historique qui leur est passé ; le prompt rendu par `build_prompt` est
  couvert par le harnais 12.
- **Le payload produit ici n'est pas celui de David.** Il sort de lignes fixes
  choisies pour éclairer une propriété : il prouve un **comportement**, jamais
  un chiffre de production.

## Un défaut trouvé en chemin, pas corrigé ici

[42 · Le verdict persisté ne remonte jamais à
l'écran](../../issues/42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md) —
`saas/web/lib/report.ts` lit le verdict d'une action dans le **payload**
(`tracking.verified`) et jamais dans la colonne `suivi_actions.verdict`, qu'il
ramène pourtant avec un `select("*")`. Une action rangée après son verdict perd
donc sa pastille, pendant que le bilan du carnet la compte toujours.
