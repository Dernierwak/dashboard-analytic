# 10: La vue Conversion

Type: task
Status: ready-for-human
Blocked by: 03, 08, 09

**What to build:** le client sait ce que ses campagnes rapportent en actions — le
même nombre que la colonne « Résultats » de son Ads Manager — et ne lit jamais un
total qui additionne des choses différentes. La troisième carte du Sélecteur
apparaît, et la Tendance, la Comparaison et le Tableau se reconfigurent avec elle.
Spec : § « Les conversions » ; user stories 16, 18, 52 à 56.

**Ce ticket part de la base, pas de la doc** : la forme réelle de `results`
(recopiée au ticket 03), ce qu'il rend pour une campagne de notoriété, et l'effet
de la fenêtre d'attribution se lisent dans les lignes récoltées avant d'écrire
l'affichage.

- [x] Vue Conversion : résultats, coût par résultat, taux de conversion
      (résultats ÷ **tous les clics** × 100, dénominateur écrit à l'écran)
- [~] Une campagne de notoriété affiche « — », jamais « 0 » (testé)
- [x] Le type du résultat voyage avec son nombre ; des types différents ne
      s'additionnent pas — le total affiche « — » et l'info-bulle dit pourquoi (testé)
- [x] Une annonce sans résultat rendu affiche « — » (testé)
- [x] L'info-bulle « ⓘ » des conversions dit le réglage d'attribution ; une
      sélection qui en mélange plusieurs l'écrit à l'endroit du chiffre
- [x] Toutes les campagnes restent présentes dans la vue
- [x] Aucune jointure GA4, aucun chiffre d'une autre plateforme (ADR 0010)
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Comment

**2026-10-03 — pas commencé : le verrou de la spec tient toujours.**

La spec (§ « Les conversions ») bloque ce ticket jusqu'au premier passage du
worker qui récolte `results`, et le ticket dit « part de la base, pas de la
doc ». Constat du jour sur la base de production :
`select results … from meta_ads_insights` → `42703 column
meta_ads_insights.results does not exist`. Le `000` du ticket 02 n'est pas
joué, donc aucun des passages du worker (le dernier : planifié, 2026-10-03
12:21 UTC, vert) n'a pu écrire `results` ni `attribution_setting`. La forme
d'un élément, le cas notoriété et l'effet de l'attribution restent inconnus ;
construire l'affichage maintenant reviendrait à le bâtir sur la forme inventée
du harnais du 03.

**Pour débloquer, dans l'ordre :**
1. David joue le `000` (ticket 02) sur Supabase ;
2. un passage du worker **sur le code de cette branche** (celui de `main` ne
   demande pas `results`). ⚠ Corrigé le jour même : `force` ne touche pas la
   fenêtre de récolte, il fait passer **tous** les comptes — et tout passage
   publie le rapport et **envoie l'email** à chaque compte traité. Viser un
   compte par `user_id` ;
3. recopier dans le ticket 03 la forme réelle d'un élément de `results`, une
   ligne de campagne de notoriété et les réglages d'attribution présents ;
4. relancer ce ticket.

## Answer

**2026-10-04 — construite sur la forme réelle de `results`**, lue en base
après le passage du worker et le rejeu (le détail est au ticket 03).

**Le code** :
- `lib/meta/lecture.ts` — `resultatsDe` lit `results` tel que la base le porte
  (NULL → non lu, `[]` → aucun type, indicateur sans `values` → pas de
  nombre ; la fenêtre `default`, jamais une somme de fenêtres) ; les totaux
  portent `resultats` (le type et le nombre, ou la raison de « — ») et les
  `attributions` ; trois métriques : Résultats, Coût par résultat (dépense ÷
  résultats), Taux de conversion (résultats ÷ clics (tous) × 100) ;
  `ecartEntre` refuse de comparer deux types ; `precisionDe`, `aideDe` et
  `attentionDe` disent le type, l'attribution, ou pourquoi « — ».
- `lib/meta/tableau.ts` — type sous le chiffre, raison au survol, colonne
  « Type de résultat » dans le CSV de la vue Conversion.
- `lib/meta/donnees.ts` lit `results` et `attribution_setting` ;
  `components/meta/*` : troisième carte (icône cible), type sous chaque
  chiffre, attribution mélangée en orange à côté du chiffre principal, une
  phrase au lieu d'un axe à zéro quand rien ne se trace.

**Harnais** : `.scratch/meta-ads/harnais/10-la-vue-conversion/conversion.test.ts`,
lancé depuis la racine par
`node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs --test .scratch/meta-ads/harnais/10-la-vue-conversion/conversion.test.ts`
— **24 verts**, formes recopiées de la base. Une mutation (types mélangés
acceptés) en fait tomber 3. Les harnais 06 (attendu des cartes mis à jour :
trois cartes), 07, 08, 09, 11 restent verts — **127 en tout**.
`tsc --noEmit` et `npm run build` verts, **19 routes**.

**Vu dans Chrome, sur la vraie base** (compte `11043e9a`, `next dev` local) :
- semaine du 21 au 27 sept. 2026 : 1 286 vues de page de destination, recoupé
  en SQL (1 286 ; la semaine d'avant 1 280 + 453 = 1 733, écart −26 %) ;
- décembre 2025 (trois types, deux attributions) : « — » partout, la raison
  écrite sous « Résultats », « Réglages d'attribution mélangés : 1 jour après
  un clic ; 7 jours après un clic ou 1 jour après un affichage » en orange ;
  le Tableau donne à chaque campagne son type (Adventskalender 21 151 vues de
  page, Velöle Socken 894 visites du profil) et « — » à celle qui en mêle deux.

**Revue de code (deux axes)** — corrigé : coût et taux revenus à la règle de
la spec (dépense et clics de toute la sélection) ; les `values` ne se somment
plus (deux fenêtres compteraient deux fois) ; une période lue en partie ne
trace plus de courbe ; le « avant » d'un autre type n'est plus exposé ;
expression dupliquée extraite (`nomTypeDe`). Laissé : la répétition de
`estMetriqueResultat` (une propriété de `DefMetrique` serait plus propre).

**Pas vérifié / à trancher par David** :
1. **La notoriété n'a jamais été vue** : aucune campagne de notoriété dans
   l'historique du compte, aucune liste vide. Le « — » est testé sur la règle
   de la récolte (`[]`), pas sur une vraie ligne. Si Meta rend pour elle un
   indicateur avec un nombre (la portée ?), la vue l'affichera sous son
   nom, pas « — ». À relire à la première campagne de notoriété.
2. **La Comparaison classe ensemble des éléments de types différents** (des
   vues de page à côté de clics sur un lien, même barre, même axe) ; seul
   l'intitulé « · vues de page de destination » le dit. User story 54 : faut-il
   ne lister que le type dominant, ou séparer par type ?
3. **Les appels (`click_to_call…`) n'ont jamais de nombre mais comptent comme
   un type** : un compte qui a une campagne d'appels verra le total « — » tant
   qu'aucune campagne n'est choisie (juillet 2025 sur ce compte). Conforme à la
   lettre (« des types différents ne s'additionnent pas ») — à confirmer.
4. **Taux de conversion > 100 %** possible : Velöle Socken, 894 visites du
   profil pour 879 clics → 101,71 %. Le calcul est celui de la spec ; une
   visite du profil ne passe pas forcément par un clic compté.
5. L'attribution mélangée ne s'écrit qu'à la Tendance, pas sur la carte du
   Sélecteur ni dans le Tableau.

**Pour David** : rien à jouer de plus pour voir la vue — le `000` est en
base. Elle se voit après le merge dans `main` (Vercel). Le compte `0b83e564`
a encore ses lignes sans `results` : sa vue Conversion affichera « — » (non
lu) jusqu'à son rejeu (`weekly-fetch.yml`, `user_id` + `meta_since`).
