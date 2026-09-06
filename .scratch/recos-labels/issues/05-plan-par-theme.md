Type: grilling
Status: resolved

## Question

Né de la résolution du ticket 02 : le prompt de `_theme_ai_recos()` ne
transmet aujourd'hui aucun historique du thème (ni levier précédent, ni
verdict, ni tendance) — seuls les titres des pistes refusées/déjà faites en
texte libre. David veut, au lieu d'un simple dump des dernières hypothèses,
un **"plan" condensé par thème (et par client)** — décrit comme "un peu comme
un agent" — qui garde l'essentiel de l'historique plutôt que de l'accumuler
brut, et qui alimente ensuite le prompt en texte libre (l'IA reste libre
d'en faire ce qu'elle veut, pas de règle d'exclusion codée — décision du
ticket 02).

**Mise à jour post-ticket 03** : ce plan doit aussi porter l'état courant, pas
seulement l'historique — le ticket 03 a décidé de bloquer toute nouvelle
hypothèse pour un thème tant que la précédente n'a pas eu 1-2 cycles de
vérification (fenêtre différenciée par levier : 7 jours contenu/tempo, 14
jours argent/audience). Il faut donc que ce plan sache dire, pour un thème
donné : y a-t-il une hypothèse active en ce moment, depuis quand, et combien
de cycles de vérification a-t-elle déjà eus — sinon le blocage du ticket 03
n'a rien pour s'appuyer.

À spécifier avec David :
- Quel contenu minimal ce plan porte — le(s) dernier(s) levier(s) tenté(s) et
  leur verdict, un résumé en une phrase de "où en est ce thème", la tendance
  sur plusieurs cycles (ex. "3 hypothèses argent d'affilée, aucune n'a
  marché") ?
- Qui le maintient et quand — mis à jour automatiquement à chaque verdict
  (`suivi_actions`) et à chaque retour client (`reco_feedback`), ou une
  étape de condensation séparée (ex. un appel IA qui résume l'historique
  brut en plan condensé, un peu comme un résumé de conversation) ?
- Où il vit — nouvelle table Supabase par (user, theme), ou un champ dans une
  table existante ?
- Est-ce que ce plan est propre au thème, ou est-ce le même mécanisme que le
  "profil client vivant" de la carte sœur (`.scratch/recos-generales/`,
  ticket 05) appliqué à l'échelle du thème plutôt que du compte — auquel cas
  les deux tickets devraient peut-être partager une seule conception plutôt
  que deux mécanismes séparés à maintenir ?
- Volume/coût : condenser à chaque génération de rapport a un coût (appel IA
  supplémentaire si condensation par IA) — acceptable, ou il faut une
  condensation plus simple (règles déterministes) ?

## Answer

Décisions de David :
1. **Mécanisme séparé du "profil client vivant"** (carte sœur) — pas de
   modèle générique partagé. Le profil compte et le plan par thème restent
   deux choses distinctes à maintenir chacune de leur côté.
2. **Contenu à deux couches** :
   - **État** : hypothèse active (texte, levier), date de lancement, nombre
     de cycles de vérification déjà faits, dernier verdict.
   - **Résumé narratif court** : une phrase de tendance (ex. "3 hypothèses
     argent testées, aucune n'a marché — à éviter").
3. **Maintenance** : l'état se met à jour automatiquement, par du code
   déterministe, à chaque génération de rapport (pas besoin d'IA). Le
   résumé narratif est rédigé par un **appel IA de condensation**, mais
   **seulement quand un nouveau verdict tombe** (pas à chaque rapport) — un
   coût contrôlé, pas un appel hebdomadaire systématique. Garde-fou de
   construction : cet appel IA reçoit les chiffres déjà calculés (verdict,
   cycles, dates) et les reformule en phrase — il n'en invente jamais un
   nouveau (CLAUDE.md §7).
4. **Stockage** : nouvelle table Supabase dédiée, une ligne par
   (user_id, theme) — pas un ajout de colonnes à `suivi_actions` ou
   `theme_objectifs`.

Cette réponse ferme aussi la dernière question ouverte de la carte
"Recos labels" — tous les tickets (01 à 05) sont désormais résolus.

