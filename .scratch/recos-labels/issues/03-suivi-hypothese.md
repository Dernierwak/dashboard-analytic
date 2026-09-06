Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

**Mise à jour post-ticket 01** : cette question supposait une nouvelle table
et une fenêtre "2-3 semaines ajustable", en s'appuyant sur la description de
l'artifact du 26 août. Le ticket 01 a trouvé que le code, depuis le
**27 août 2026**, a tranché différemment :

- Pas de nouvelle table — réutilisation de `suivi_actions` (existante),
  upsertée automatiquement avec un statut dédié `"auto"` dès qu'un thème a
  une hypothèse rédigée, baseline capturée immédiatement.
- Fenêtre **fixe à 14 jours** pour toutes les hypothèses, quel que soit leur
  levier (`_hyp_check = today + timedelta(days=14)`, `build_report.py:3341-3390`)
  — pas d'ajustement par type d'hypothèse.
- Verdict `better`/`worse`/`stable` au seuil **±5 %**
  (`build_report.py:3462-3468`) — le même seuil que le Graphe A
  (`_attach_metric`), pas une logique propre au thème.
- Fin de fenêtre : implicite dans le fonctionnement décrit (le ticket 01 ne
  précise pas explicitement ce qui se passe après le verdict à J+14 — à
  vérifier si besoin lors de la discussion).

La question n'est donc plus de concevoir un schéma, mais d'**évaluer ce choix
déjà en prod** :
- 14 jours fixes pour tout type de levier (une hypothèse "contenu" se juge
  peut-être plus vite qu'une hypothèse "budget") — ça convient, ou faut-il
  différencier ?
- Réutiliser `suivi_actions` avec un statut `"auto"` plutôt qu'une table
  dédiée — un problème pour toi, ou c'est très bien ainsi (plus simple, un
  seul endroit à lire) ?
- Le seuil ±5 % identique au Graphe A — logique, ou le enjeu d'un thème
  mérite un seuil différent ?
- Ce qui se passe exactement à la fin de la fenêtre de 14 jours (nouvelle
  hypothèse proposée automatiquement, ou il faut relire le code pour
  vérifier) — point à combler avec David ou par une relecture ciblée.

## Answer

Fait vérifié en cours de route (par un agent d'exploration), plus grave que
prévu : le mécanisme actuel **force une nouvelle hypothèse à chaque rapport
hebdomadaire**, sans jamais vérifier si l'hypothèse `"auto"` précédente du
même thème est arrivée à échéance ou a reçu un verdict
(`build_report.py:3341-3388` — seule les lignes du **même jour** sont
purgées, `decided_at == today`, ligne 3348-3350). Résultat : plusieurs
hypothèses "auto" peuvent coexister pour un même thème, non dédupliquées, et
le verdict de l'une n'influence jamais la génération de la suivante (le
verdict alimente uniquement `reco_engine.py`, jamais le prompt de
`_theme_ai_recos`). Ça contredit directement l'intention de David de suivre
une seule théorie à la fois par thème.

Décisions de David :
1. **Fenêtre différenciée par levier**, pas 14 jours fixes pour tout :
   - Contenu : 7 jours
   - Tempo : 7 jours
   - Argent : 14 jours
   - Audience : 14 jours
2. **`suivi_actions` reste partagé** avec le Graphe A (statut `"auto"`) —
   pas de table dédiée.
3. **Seuil de verdict ±5 % partout** — pas de différenciation par thème ou
   par enjeu.
4. **Correction du bug de fond** : ne plus lancer de nouvelle hypothèse pour
   un thème tant que la précédente n'a pas eu **1 à 2 cycles de
   vérification** (donc environ 14 à 21 jours selon le levier, en comptant
   plusieurs points de contrôle) pour confirmer qu'elle ne fonctionne pas,
   avant de tester une hypothèse différente. Objectif explicite de David :
   « suivre 1 théorie, une hypothèse » — le rythme hebdo actuel de
   génération casse ça, il faut le bloquer.
5. **Documentation et visibilité** : ce mécanisme (fenêtres par levier, règle
   d'attente avant de changer d'hypothèse) doit être bien documenté pour
   être visible et ajustable — David veut garder une bonne vision de ce qui
   se passe avec les recos, pas une boîte noire qu'on doit relire le code
   pour comprendre.

Lien avec les autres tickets : le blocage "pas de nouvelle hypothèse avant
1-2 cycles" a besoin de savoir où en est l'hypothèse en cours pour chaque
thème — c'est exactement ce que le "plan par thème" du ticket 05 doit porter
(pas seulement l'historique passé, mais l'état courant : hypothèse active,
depuis quand, combien de cycles déjà vérifiés).

