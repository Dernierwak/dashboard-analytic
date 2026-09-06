Type: grilling
Status: resolved
Blocked by: 01

## Question

**Mise à jour post-ticket 01** : cette question était posée comme une
conception à faire ("qui génère l'hypothèse, quelle structure, une ou
plusieurs en parallèle") en supposant le module 2A à l'état ○. Le ticket 01
a trouvé que le code l'a déjà tranchée le **27 août 2026** :

- Générée par IA libre (Gemini), pas par une bibliothèque de gabarits —
  `_theme_ai_recos()` (`build_report.py:1277-1479`) force exactement 1 piste
  sur 3 avec `role="hypothese"` (`_forcer_une_hypothese`, `:165-184`).
- Structure minimale : un `levier` obligatoire parmi `LEVIERS_IA = ("argent",
  "contenu", "tempo", "audience")` (`:108`) — la "catégorie légère" imaginée
  ici existe déjà sous ce nom exact.
- Une seule hypothèse par thème à la fois — jamais plusieurs en parallèle,
  tranché par construction (le "exactement 1" est forcé par le code).

La question n'est donc plus de concevoir, mais d'**évaluer ce qui tourne déjà
en prod** :
- Ce mécanisme (IA libre plutôt que gabarits, un seul levier obligatoire par
  thème, une seule hypothèse active à la fois) convient-il à David tel quel ?
- Le fait que l'IA choisisse librement le levier — plutôt qu'une logique qui
  couvrirait les 4 leviers en rotation dans le temps pour un même thème — pose
  problème ou pas ?
- Si rien à changer : ce ticket se ferme en confirmant l'existant, pas en
  construisant quoi que ce soit de neuf.

## Answer

Fait vérifié en cours de route (par un agent d'exploration) : le prompt de
`_theme_ai_recos()` ne transmet aujourd'hui **ni** le levier de l'hypothèse
précédente du thème, **ni** son verdict (`suivi_actions`), **ni** aucune
logique de rotation — seuls les titres des pistes refusées/déjà faites en
texte libre (`eviter`/`deja_fait`) passent. Vérifié par lecture intégrale du
bloc `_call_gemini` (`build_report.py:1396-1447`) et grep de
`levier_precedent`/`historique_levier`/`_diversifier` (aucun résultat côté
rôle `"hypothese"`).

Décisions de David :
1. **IA libre gardée** — pas de bibliothèque de gabarits, le texte et le
   levier de l'hypothèse restent générés librement par Gemini.
2. **Une seule hypothèse active par thème gardée** — confirmé, avec
   l'attente que le suivi produise des actions claires et concrètes
   (améliorer des mots-clés, proposer les prochains posts), pas un verdict
   abstrait — à vérifier au ticket 03/04.
3. **La rotation des leviers doit suivre le retour client** (verdict +
   réactions), pas une rotation arbitraire round-robin sur les 4 leviers —
   ce qui n'existe pas aujourd'hui (voir fait vérifié ci-dessus).
4. **Comment transmettre cet historique** : pas un dump brut des 2-3
   dernières hypothèses — David veut un **"plan" condensé par thème (et par
   client)**, qui garde le principal plutôt que d'accumuler tout
   l'historique brut, un peu comme la mémoire d'un agent. Ce plan est ensuite
   injecté en **texte libre** dans le prompt — l'IA reste libre d'en faire ce
   qu'elle veut, pas de règle d'exclusion codée en dur.

**Conclusion** : le mécanisme actuel (IA libre, un levier obligatoire, une
hypothèse à la fois) est bon, **rien à changer dessus**. Le vrai manque :
il n'existe aucun "plan par thème" condensé qui capture l'historique des
hypothèses/leviers/verdicts/retours client pour nourrir la prochaine
génération. Ce manque graduate en un nouveau ticket — voir
`05-plan-par-theme.md`.
