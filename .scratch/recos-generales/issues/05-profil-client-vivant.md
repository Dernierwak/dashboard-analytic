Type: grilling
Status: resolved
Blocked by: 01

## Question

David (grilling initial de cette carte) : il faut un document/profil qui dit
qui est le client, quel objectif il poursuit, où il en est par rapport à cet
objectif — et ce profil doit être mis à jour par les recos faites et par ce
qu'on apprend de la façon dont le client interagit. L'artifact documente déjà
deux pièces existantes mais non reliées : `user_persona.py` (construit,
disponible, "pas encore branché" selon `build_report.py`) et le pont
onboarding (`onboarding_profile.sql` + `onboarding-card.tsx`, alimente
aujourd'hui `labeling.py` mais pas `user_persona.py`).

À trancher :
- Quelles données composent ce profil exactement — réponses onboarding,
  objectif déclaré, historique de `reco_feedback`, `suivi_actions` (verdicts
  better/worse/stable), commentaires libres du client ?
- Qui/quoi le met à jour, et à quelle fréquence (à chaque retour client ? une
  fois par semaine avec le rapport ?) ?
- Sous quelle forme il est lisible par le Graphe A (ton du brief IA, niveau
  de détail selon que le client "maîtrise le sujet" ou pas — cf. réponse
  initiale de David) ?
  **Note** : ce profil n'a pas besoin de porter l'objectif par thème — le
  ticket 01 de la carte sœur `.scratch/recos-labels/` a trouvé que
  `_obj_theme()` existe déjà comme champ propre au thème, indépendant du
  profil compte (voir `recos-labels/issues/01-verifier-etat-graphe-b.md`).
- **Chevauchement — tranché** : David a confirmé (ticket 05 de la carte
  sœur) que le profil client vivant et le "plan par thème" sont **deux
  mécanismes séparés**, pas un modèle générique partagé. Pas à re-trancher
  ici.
- Couvre aussi la question ouverte "compréhension du client" de l'artifact :
  l'avis du client porte sur les constats génériques d'`insights.py`
  (`insight_feedback`, déjà en place) ou sur les thèmes eux-mêmes ? Réponse de
  David : **les deux** comptent — à préciser comment le profil capture les
  deux.

## Answer

Décisions de David — **dernier ticket des deux cartes** :

1. **Contenu** : tout regroupé — onboarding (business_type, budget_range,
   time_budget, frustration), objectif déclaré, historique `reco_feedback` +
   `suivi_actions`, commentaires libres, et l'avis sur les constats
   génériques (`insight_feedback`).
2. **Mise à jour, en deux couches** :
   - **Base fixe** : les réponses d'onboarding, capturées une fois, ne sont
     pas redérivées chaque semaine.
   - **État évolutif** : le "niveau" (maîtrise du sujet par le client) et
     les attentes sont recalculés **une fois par semaine**, avec la
     génération du rapport, à partir des retours accumulés depuis la
     dernière fois — c'est cette partie qui bouge, pas la base.
   - Ça implique de construire enfin le pont onboarding → `user_persona.py`
     (aujourd'hui construit mais isolé, jamais branché).
3. **Forme de lecture par le Graphe A** : confirmée telle que proposée — un
   texte de contexte libre inséré dans le prompt du brief IA (même logique
   que le `eviter`/`deja_fait` du Graphe B), avec un niveau de détail qui
   varie selon le "niveau" évolutif du client (plus technique s'il maîtrise,
   plus pédagogique sinon).
4. **Deux entrées séparées** pour les avis — "avis sur les constats
   génériques" et "avis sur les thèmes" restent distincts dans le profil,
   pas fondus dans un flux unique, pour que l'IA sache lequel des deux un
   rejet ou un commentaire concerne.

**Ce ticket clôt la charte des deux cartes** ("Recos générales" et "Recos
labels") — tous les tickets des deux maps sont résolus.

