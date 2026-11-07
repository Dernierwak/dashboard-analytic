# 13: L'âge d'un post à l'écran

**What to build:** un post trop jeune ne se juge pas trop tôt : sous 48 h il
est un point vide hors de la foule ; sous 7 jours il porte son âge et l'icône
« peut encore changer » et se compare aux autres posts **au même âge**, à
partir de leurs relevés.

Spec : § La lecture, lignes « âge » et « place à âge égal » ; § La page, nuage
et Panneau ; User Stories 20, 21.

**Blocked by:** 10, 01

**Status:** resolved

- [x] Lecture paginée des relevés ; place à âge égal sur le **premier**
      relevé tombé dans [n × 24 ; (n+1) × 24) h ; minimum 6, sinon une
      mention.
- [x] Point vide sous 48 h, icône et âge sous 7 jours, partout où le post
      paraît.
- [x] Harnais : l'âge égal sur le premier relevé du bon J+n ; sans
      `releve_a` = plus de 7 jours.
- [x] Dit dans la réponse : l'âge égal n'aura de matière qu'après des
      semaines de relevés.

## Réponse

**Ce qui est fait.**

- `lib/instagram/lecture.ts` — la forme commune de l'âge : `ageLu` (déplacé
  de `panneau.ts`, même sortie : « moins de 48 h » / « J+n », `null` à 7
  jours) et `texteAge` (« J+3 · peut encore changer »). Les relevés :
  `LigneReleve`, `relevesDe` (par post, **triés par âge ici**, pour que « le
  premier » ne dépende pas de l'ordre de pagination ; un âge illisible n'est
  pas un relevé), `premierReleveDuJour`. `Contexte.releves?` les porte
  jusqu'à `placeDuPost` sans changer aucune signature. `Foule.eligibles`
  (format, 12 mois, ≥ 48 h, avec ou sans valeur aujourd'hui).
- `placeDuPost` : un post de 48 h à 7 jours se place face aux AUTRES posts
  de `foule.eligibles` pris à leur premier relevé du même J+n (leurs brutes
  d'alors, recalculées par `valeurDe` — un taux se refait sur la portée
  d'alors) ; mêmes quartiles et Tukey ; trois états :
  `age_egal_place` (« au-dessus à J+3 »), `age_egal_mince` (« J+3 · 4 / 6
  au même âge », infobulle « 4 Reels ont un relevé à J+3 sur les 12 derniers
  mois, il en faut 6 : sa place à âge égal attendra. ») et `age_egal`
  (relevés **non lus** — base sans la section 23 ou lecture ratée : « ne se
  calcule pas », pas « 0 post au même âge »).
- Les écartés du ticket 12 : la foule passée à `placeDuPost` vient déjà des
  `retenus`, donc ses `eligibles` aussi — un boosté écarté sort de l'âge égal
  comme de la référence (testé).
- `lib/instagram/donnees.ts` — `lireReleves` : `instagram_post_releves`,
  `age_heures` ∈ [48 ; 168), `releve_a` dans les 12 mois, paginé par
  `lireToutesLesPages` avec l'ordre total de la clé (`post_id, releve_a`).
  Lue **seulement** si un post a entre 48 h et 7 jours. Table absente →
  `null`, journalisé (`[instagram] instagram_post_releves illisible`).
- Écran : `components/instagram/age.tsx` (`AgePost`, sans directive ni
  hook) — « ↻ J+3 · peut encore changer » en ambre, infobulle « Instagram
  met encore ses chiffres à jour… », rien au-delà de 7 jours. Posé dans la
  liste des 5 (ligne format · date), le Tableau (sous la date), le Panneau
  (remplace la forme simple du 11). Le nuage : point vide sous 48 h (déjà là)
  et l'âge dans l'infobulle. `aUnePlace` (`tableau.ts`) : une place à âge
  égal s'écrit en encre pleine au Tableau et au Panneau, comme une place.

**Arbitrages pris en construisant (à relire).**

- Le post jugé garde sa valeur du **dernier** relevé (n = ⌊âge ÷ 24⌋ de ce
  relevé, donc il tombe dans la même fenêtre que les autres).
- La mention sous 6 à âge égal ne compte pas les écartés (« — 1 est écarté
  par ton filtre ») : `Ecartes` ne sait pas qui avait un relevé à ce J+n.
  Le minimum se juge bien après le retrait ; seule la raison manque.
- Lecture des relevés conditionnée à la présence d'un post de 48 h à 7
  jours : sinon personne ne la consulte.

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/13-l-age-d-un-post/lancer.sh`
  → 10 tests, 10 verts (premier relevé du bon J+n, face à des valeurs
  finales qui l'auraient mis en dessous ; un second relevé J+3 et un J+4
  ignorés ; sous 6 → mention ; relevé sans la valeur ≠ 0 ; le post lui-même,
  un Reel, un post de plus de 12 mois exclus ; boosté écarté sorti de l'âge
  égal ; relevés non lus ; sans `releve_a` = plus de 7 jours, aucun âge,
  placé sur la référence ; bornes 47,9 h / 48 h / 167,9 h / 168 h ; même
  place au Tableau, au nuage, dans la liste et au Panneau ; libellés).
- Harnais 09 : 28/28 ; 10 : 15/15 ; 11 : 15/15 ; 12 : 12/12 ; 14 : 23/23.
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, 18 routes.

**Ce qui ne se vérifie qu'en vrai.**

- **L'âge égal n'aura de matière qu'après des semaines de relevés** : il
  faut au moins 6 posts du même format relevés au même J+n, donc 6 posts
  publiés APRÈS la section 23 et relevés par le passage léger quotidien
  (ticket 04) pendant leur première semaine. D'ici là, chaque post de 48 h à
  7 jours dira « J+n · k / 6 au même âge » — c'est l'état attendu, pas une
  panne.
- Les relevés ne s'écrivent qu'aux passages du worker : le **cron de 07:00
  UTC** (passage léger chaque jour, complet le Jour de travail) ; un
  lancement à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`)
  ajoute un relevé mais ne remplace pas des semaines de cron.
- La requête sur `instagram_post_releves` n'a tourné contre aucun Supabase
  (section 23 à jouer par David). Rien n'a été regardé dans un navigateur
  (l'étiquette ambre sous la date du Tableau, sa largeur dans la carte de la
  liste sur téléphone).

Corrigé après revue : quand un filtre fait tomber l'âge égal sous 6, la mention dit combien il en a écartés — ceux qui avaient un relevé au même J+n (« 5 Images ont un relevé à J+3 …, il en faut 6 — 1 est écarté par ton filtre : … »).
