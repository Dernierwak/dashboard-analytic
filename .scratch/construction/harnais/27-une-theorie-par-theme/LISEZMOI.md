# Harnais du ticket 27 — une théorie par thème

Le ticket demandait de **trancher deux questions** et, à défaut, de **rendre la
mesure**. Ce dossier fait les deux : il mesure d'abord, il tranche ensuite.

```bash
cd .scratch/construction/harnais/27-une-theorie-par-theme
python3.12 mesure.py                     # trois semaines d'affilée
python3.12 mesure2.py                    # les quatre situations d'un plan ouvert
python3.12 test_une_theorie_par_theme.py # 17 vérifications
```

## Les pièces

| Fichier | Ce qu'il est |
|---|---|
| `gree.py` | **Le gréement organique qui manquait au faux lecteur.** Le harnais 16 listait les publications Instagram et les abonnés parmi « ce qui n'est pas gréé, donc ces règles ne tournent pas ici — du gréement à ajouter quand un ticket en aura besoin ». Ce ticket en avait besoin : les deux Hypothèses organiques (`orga_essoufflement`, `page_endormie`) sont exactement celles dont on veut voir la concurrence. Les publications sont décrites par jour et par portée ; les règles se déclenchent parce que **leurs seuils** sont franchis, pas parce qu'on aurait posé un booléen à côté. |
| `lecteur_fige.py`, `pulse.py`, `t.py` | Repris tels quels du harnais 16. |
| `mesure.py` / `mesure2.py` | La mesure. Pas des tests — des scripts qu'on lit. |
| `test_une_theorie_par_theme.py` | Les 17 vérifications. |

## Ce que la mesure a trouvé

La consigne de repli demandait de compter, sur le compte de David, les lignes
`theme_plan` dont le `decided_at` bouge. **La base ne répond plus** (§ Testing de
[`spec.md`](../../spec.md)) : la même construction a donc été rejouée hors ligne,
semaine après semaine, sur des lignes fixes. Ce n'est pas le compte de David —
c'est le **comportement**, mesuré au lieu d'être raconté.

**Trois défauts, dont un que le ticket ne nommait pas :**

1. **Deux théories sur le même thème, toutes les semaines.** `adset_inegal` et
   `page_endormie` sortaient ensemble sur le même thème ; `theme_plan` n'en
   suivait qu'une (`next(...)`, au hasard de l'ordre de tri) et rien sur la
   carte ne disait laquelle. C'est le second point du ticket, confirmé.
2. **Le compteur repartait quand l'épinglage lâchait.** Sur une ligne sans
   `snapshot`, ou dont le verdict était tombé, la carte servait la règle la
   mieux classée de la semaine pendant que la garde d'écriture cherchait
   l'ancienne **clé**, ne la trouvait pas, et laissait `decided_at` repartir sur
   la date du jour. C'est le premier point du ticket.
3. **La Stratégie épinglée pouvait s'afficher DEUX FOIS** — trouvé en mesurant,
   pas en lisant. Quand le plan portait la *seconde* Hypothèse de la carte,
   l'épinglage posait sa version mémorisée à la place de la *première*, et la
   règle du jour restait à côté : le thème servait la même théorie en deux
   formulations.

**Et une correction de cap au passage :** le ticket situait le blocage d'attente
« à l'intérieur de la branche `_ia_redigee` ». Cette branche n'existe plus — tout
le bloc vit sous `if _conseille:`, et le chemin des règles **a** l'épinglage. Le
défaut n'était donc pas son absence, mais son **désaccord** avec la garde
d'écriture.

## Ce qui a été tranché

**« La garde d'attente doit-elle porter sur le THÈME plutôt que sur la clé ? »
— oui, et ce n'est pas une règle nouvelle.** La question « cette Stratégie
tourne-t-elle encore ? » se posait à **deux** endroits et se répondait **deux
fois**, avec deux conditions différentes. Elle est maintenant produite une seule
fois, là où l'épinglage la calcule (`_plans_en_cours`), et la boucle d'écriture
la **lit** au lieu de la refaire.

Ça ne change pas ce qu'un Verdict mesure, et c'est la raison pour laquelle cette
forme-là a été retenue : un thème n'entre dans `_plans_en_cours` que quand sa
carte **rejoue** la Marche du plan — même `reco_key`, même baseline. Quand la
Stratégie est finie (Verdict rendu, ou fenêtre écoulée), le thème n'y est pas, la
nouvelle Hypothèse s'écrit avec sa propre date, et le Verdict suivant mesure bien
ce cycle-là.

**« Le chemin des règles doit-il forcer une seule Hypothèse ? » — oui.**
`regles_payantes` tranchait déjà ses deux Hypothèses à elle sur l'argent en jeu
et renvoyait explicitement le cas général à ce ticket. L'arbitrage général vit
maintenant dans `_une_seule_hypothese`, **entre** le classement et la coupe à
trois : après le tri, parce que « la meilleure » n'a de sens qu'une fois
`_importance` passé ; avant la coupe, pour que la place libérée revienne à un
vrai conseil au lieu d'amputer la carte.

L'arbitre est `_importance`, et pas `_enjeu` : les règles organiques ne déclarent
aucun enjeu en francs, et comparer un thème qui s'essouffle sur Instagram à un
Groupe d'annonces cher demanderait une échelle commune qui n'existe pas —
l'inventer serait trancher là où la donnée ne tranche pas (`CLAUDE.md` §7).

## Ce qu'il prouve

| Ce qui est vérifié | Comment |
|---|---|
| **La situation existe** — trois règles de trois familles ouvrent une Stratégie sur le même thème la même semaine (`adset_inegal`, `orga_essoufflement`, `page_endormie`) | Les trois règles appelées directement sur les lignes gréées, le rôle lu dans `_GESTE_REGLE` |
| **Une carte ne porte jamais deux Hypothèses** | `build_payload` exécutée |
| **La place libérée revient à un conseil** — quatre candidats, trois places, la carte reste à trois | `build_payload` sur deux campagnes |
| **La Stratégie épinglée n'est pas affichée deux fois** | Plan posé sur la seconde Hypothèse de la carte |
| **Trois semaines d'affilée, une seule écriture** | La construction rejouée, le plan repassé d'une semaine à l'autre |
| **Le plan tient même quand la règle de la semaine change de clé** | Plan sur `page_endormie`, règle du jour `adset_inegal` |
| **Une ligne sans `snapshot` se referme une fois, pas chaque semaine** | Deux semaines consécutives |
| **Un verdict tombé rouvre bien une théorie** (décision du wayfinder 06, intacte) | `verdicts` gréé |
| **Une clé `ai_` ne se réaffiche toujours pas** (coupe du ticket 11, intacte) | Plan sur `ai_…` |

**Rejoués sans régression** : les 59 fichiers de `jouer_tout.py`, **tout passe**
— 2 207 vérifications.

Deux assertions de **texte** ont dû être réécrites, et c'est le signe attendu :
`06/test_plus_rien_sans_clic.py` et `08/test_filtre_dur.py` recopiaient le code
exact de deux lignes que ce ticket réécrit. Chacune prouve la même chose
qu'avant — la fenêtre d'attente borne toujours la réécriture du plan,
l'empreinte filtre toujours avant la coupe à trois — sur des repères qui ne se
périment plus à la première reformulation.

## Ce qu'il ne prouve pas

- **Rien n'est joué en base.** Aucune écriture ne part : `lecteur.ecrits`
  enregistre ce que la construction a **voulu** écrire.
- **Le compte gréé ici n'est pas celui de David.** Le comptage réel demandé par
  la consigne de repli — combien de lignes `theme_plan` de production portent un
  `reco_key` de règle, et combien ont vu leur `decided_at` bouger — **n'a pas pu
  être fait** : la base ne répond plus. Ce harnais prouve un comportement,
  jamais un chiffre de production.
- **Rien ne se verra à l'écran avant un passage du worker.** Cette correction
  touche le traitement : elle ne se voit qu'au cron du Jour de travail
  (07:00 UTC) ou par un lancement à la main depuis l'onglet **GitHub Actions**
  (`weekly-fetch.yml`, `report_only`).
- **Le verdict qui libère l'épinglage reste indexé par `reco_key` sur tout le
  compte** (`fetch_reco_verdicts`, quatre semaines glissantes). Un verdict rendu
  sur la même clé, mais sur un **autre thème**, libère donc la Stratégie de
  celui-ci. Ce n'est pas ce ticket : c'est le
  [51](../../issues/51-un-verdict-libere-la-strategie-d-un-autre-theme.md),
  ouvert en trouvant celui-là.
