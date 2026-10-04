# 12: Lire une annonce dans le Panneau latéral

Type: task
Status: ready-for-human
Blocked by: 05, 08, 11

**What to build:** depuis la Comparaison, le client lit le contenu d'une annonce
tel qu'il s'affiche dans le fil, et vérifie la page vers laquelle elle envoie, sans
retourner sur Meta. Spec : § « Les créas », § « Comparaison — la mécanique » ;
user stories 34, 37 à 45. Décision d'origine : ticket 06 de la carte.

- [x] Chaque annonce de la Comparaison porte une cible « Lire », visible au repos
      et distincte de la case qui coche ; les groupes d'annonces n'en ont pas
- [x] Le panneau montre texte, titre, description, bouton et visuel ; chaque
      variante numérotée et en entier ; chaque carte d'un carrousel
- [x] Un lien sortant « l'annonce envoie vers… », lu dans la créa ; aucun lien
      quand la créa n'a pas d'adresse (testé)
- [x] Aucun chiffre à côté d'un texte, d'un visuel ou d'une variante, et une phrase
      qui dit pourquoi
- [x] Les visuels viennent de Storage, pas des URL de Meta qui expirent
- [x] L'annonce lue vit dans l'URL (`annonce`, par ID) : l'ouvrir retire `jour`, et
      inversement ; une annonce inconnue ne s'ouvre pas
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Comments

**2026-10-04 — construit et vérifié hors ligne. Bloqué en amont par le 05 :
rien ne s'affiche encore sur de vraies données.** La ligne `Blocked by` dit
05, et le 05 n'est pas construit. Le côté web a été fait quand même, sur la
forme des tables que le `000` (§ 0bis) définit déjà. Les tables
`meta_ads_creatives` et `meta_ads_creative_assets` sont vides tant que le 05
n'est pas fait.

Ce qui a été fait :
- `saas/web/lib/meta/annonce.ts` — le seam, pur. `annonceDe` (créa + assets →
  aperçu du fil, champs en entier, variantes, cartes, liens) lit les trois
  montages et le carrousel. Les variantes (`asset_feed`) et les cartes
  (`child_attachment`, une par rang) ne se mélangent jamais. Autour :
  - `adresseSure` : http(s) seulement, l'adresse telle que saisie ;
  - `depuisStorage` : Storage public du projet seulement ;
  - `nomBouton` : libellés français ;
  - `annonceOuverteDe` : l'annonce de l'URL, par ID, si elle a des chiffres
    sur la période et la campagne du Bandeau.
- `lib/meta/donnees.ts` lit la créa et ses assets **seulement quand le panneau
  s'ouvre**. Il distingue trois cas : `absente` (pas encore récoltée),
  `illisible` (lecture en échec) et le contenu lu.
- `components/meta/lecture-annonce.tsx` — le contenu du Panneau latéral du
  ticket 11 (variante P du prototype). Dans l'ordre :
  - l'aperçu du fil ;
  - « L'annonce envoie vers… » ;
  - chaque champ en entier, avec ses variantes numérotées ;
  - les visuels et les cartes du carrousel ;
  - la phrase qui dit pourquoi aucun chiffre (sourcée : recherche
    `metriques-par-asset.md`) ;
  - la date de lecture (`recolte_le`).
- `components/meta/comparaison.tsx` : chaque annonce porte une cible
  « Lire », un lien **frère** de celui qui coche, visible au repos. Les
  groupes n'en ont pas. Une annonce sans ID n'en a pas non plus, la place
  reste vide.
- `app/meta/page.tsx` : `annonce` dans l'URL. « Lire » écrit
  `{ annonce, jour: null }`, la fermeture `{ annonce: null }`. Le point de la
  Tendance retirait déjà `annonce`. Si une URL tapée à la main porte les deux
  paramètres, le jour l'emporte et l'annonce n'est pas lue.

**Harnais** : `.scratch/meta-ads/harnais/12-lire-une-annonce/annonce.test.ts`,
**23 verts**, lancé par
`node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs --test .scratch/meta-ads/harnais/12-lire-une-annonce/annonce.test.ts`.
Il couvre :
- les trois montages, et la créa qui passe avant ses variantes, sans doublon ;
- le carrousel, ses cartes dans l'ordre du rang et son lien par carte ;
- une carte qui n'est jamais lue comme une variante ;
- **une créa sans adresse : aucun lien** ; une adresse blanche ou en
  `javascript:` non plus ;
- un champ vide qui reste absent ;
- une URL de Meta jamais affichée ; une URL signée, ou d'un autre projet,
  refusée ;
- la vidéo montrée par sa vignette ;
- l'annonce inconnue, hors période, d'une autre campagne, ou cherchée par le
  nom : rien ne s'ouvre ;
- les deux liens (`annonce` retire `jour`, et inversement).

Les sept harnais Meta (06 à 12) font **150 verts**. `tsc --noEmit` et
`npm run build` sont verts, **19 routes**.

**Pas vu** :
- rien dans Chrome : ni la cible « Lire », ni le panneau, ni « retour », ni
  la largeur téléphone ;
- rien sur de vraies données, puisque les tables sont vides.

Choix faits, à renverser si David le veut :
- **Le visuel ne s'affiche que depuis le Storage PUBLIC.** Une URL signée
  stockée en base expire comme celle de Meta. Si David choisit un bucket privé
  au ticket 05, `lireAnnonce` devra signer à la lecture, et `depuisStorage`
  changer avec lui. Un visuel que Meta a mais que Pulse n'a pas copié s'écrit
  « Visuel pas encore copié dans Pulse ».
- **Les libellés des boutons** (`SHOP_NOW` → « Acheter »…) viennent d'Ads
  Manager en français, **sans vérification sur un appel réel**. Une constante
  inconnue ne s'écrit pas en anglais (`CONTEXT.md`) : elle s'écrit « Bouton
  que Pulse ne sait pas encore nommer », dans le champ seulement, pas dans
  l'aperçu. Le premier passage du 05 dit quelles constantes arrivent
  vraiment.
- **L'aperçu n'a ni nom de Page ni photo de profil** : la récolte ne les lit
  pas, et un faux en-tête serait un contenu fabriqué.
- **« Inconnue » veut dire « sans chiffres sur la période et la campagne
  choisies »**, pas « absente de la liste affichée ». En niveau « groupes »,
  une URL qui porte `annonce` ouvre donc encore le panneau.
- **Toutes les adresses distinctes** sont listées sous « L'annonce envoie
  vers… » : celle de la créa, les variantes de lien, celle de chaque carte.

Revue `/code-review` (deux axes). Corrigé :
- l'URL signée acceptée ;
- l'anglais affiché pour un bouton inconnu ;
- la phrase du carrousel sans source ;
- le carrousel d'une seule carte, absent de l'aperçu ;
- la lecture inutile quand `jour` l'emporte ;
- le composant `Image`, qui masquait le global (renommé) ;
- le sens « jour retire annonce », non testé.

Laissé, en le sachant :
- `getDonneesMeta(c, annonce)` prend l'annonce hors de `Commandes` ;
- `annonceDe` re-trie par rang, que la requête ordonne déjà (le harnais ne
  passe pas par la requête) ;
- le mot « créa » dans les identifiants, qui calque la table.

**Trouvé en chemin** → ticket **19** : la vignette de la Comparaison prend
`vignette_url` sans filtre, donc peut-être une URL de Meta qui expire.

**Pour David** : rien à faire tant que le 05 n'est pas construit. Ensuite, il
faudra un passage du worker : `weekly-fetch.yml` lancé à la main depuis
l'onglet GitHub Actions, ou le cron du Jour de travail. Puis ouvrir `/meta`,
cliquer « Lire » sur une annonce et faire « retour ». La recette Chrome du
ticket 14 couvre le reste.
