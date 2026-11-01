# Spec — La page hebdomadaire (`/`)

Status: ready-for-agent

Destination de la [carte hebdo](map.md), écrite le 2026-11-01 par
[La spec de la page hebdo](issues/15-la-spec-de-la-page-hebdo.md), remise au
gabarit `/to-spec` le même jour. **Plus rien n'y est à décider.** Chaque
décision renvoie au ticket qui l'a tranchée : le ticket fait foi et porte la
raison, la spec ne la recopie pas.

## Problem Statement

Le client ouvre Pulse le jour du rapport et veut savoir, d'un coup d'œil,
**ce qui a bougé chez lui cette semaine**. La page hebdo d'aujourd'hui ne le
lui dit pas bien :

- elle empile un verdict, une boussole à bascule, un focus KPI, une alerte
  rouge « n'a pas répondu » et des changements **déduits** de la dépense —
  autant de lectures qui interprètent au lieu de montrer, et qu'il faut
  apprendre à lire ;
- elle mélange Meta et Google dans des métriques confondues, alors que
  chaque plateforme se lit avec ses propres chiffres ;
- elle ne dit pas si la semaine est **habituelle** pour ce compte : un CPC de
  0,80 CHF est-il bon ou mauvais chez lui ?
- elle ne montre pas d'un coup d'œil **tout ce qui tourne** — campagnes en
  cours, terminées, prévues, posts publiés — sur l'année ;
- la semaine mesurée **glisse** si le rapport est recalculé un autre jour que
  le Jour de travail, et avale alors le jour du fetch, incomplet ;
- une panne de récolte et un jeton expiré se ressemblent ; une source qui
  n'a rien diffusé et une source qui n'a pas répondu s'écrivent pareil.

David, dans ses mots (2026-10-28), garde : la semaine écoulée face à la
précédente, toutes sources ; le repère « c'est la moyenne de notre compte,
on est sur une bonne lancée » ; la vue rapide de toutes les campagnes et de
tous les posts ; les changements effectués cette semaine.

## Solution

Une page **statique** — la comparaison se lit sans régler de filtre ;
défiler, zoomer, choisir une semaine dans la frise est permis
([01](issues/01-la-structure-de-la-page.md)) — qui dit ce qui a bougé,
plateforme par plateforme, **sans rien conseiller**. De haut en bas
([08](issues/08-la-page-entiere-en-maquette.md), variante E validée) :

0. **Le fil de mise en place**, en tête tant qu'il n'est pas fini (inchangé).
1. **Le titre** : « Semaine du 21 au 27 octobre », la mention que le jour en
   cours n'est jamais compté, et en ligne discrète la date de publication et
   celle du prochain passage.
2. **Le bandeau des totaux** : deux colonnes, dépense et impressions, le
   grand chiffre puis chaque canal en petit avec sa pastille
   ([16](issues/16-ce-que-montre-la-case-instagram-du-bandeau.md)).
3. **Le module des canaux** (« la boussole » pour David), en rail : une
   carte par canal — Meta seul aujourd'hui. À gauche les volumes, puis CTR,
   CPC et CPM placés sur la moustache des 12 semaines du compte ; à droite
   les changements que la plateforme a écrits cette semaine
   ([02](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md),
   [03](issues/03-ce-que-veut-dire-la-moyenne-du-compte.md),
   [05](issues/05-les-changements-de-la-semaine.md)).
4. **« Ce qui a été fait »** : la frise de l'année (posts en points,
   campagnes en barres) qui choisit la semaine, et à côté le panneau de la
   semaine choisie, en onglets Organique · Campagnes
   ([04](issues/04-la-vue-des-campagnes-et-des-posts.md),
   [17](issues/17-le-statut-d-une-campagne-google-supprimee.md)).

Le verdict, la boussole à bascule, le focus KPI, l'alerte « n'a pas
répondu » et les changements déduits partent. Une absence s'écrit « — ».
Le client ne voit qu'une erreur : son jeton a expiré
([13](issues/13-les-etats-de-la-page.md)).

## User Stories

**Lire la semaine**

1. En tant que client, je veux voir en titre les dates exactes de la semaine
   mesurée, pour savoir de quoi parle le rapport sans calculer.
2. En tant que client, je veux que la page me dise que le jour en cours
   n'est jamais compté, pour ne pas croire qu'une journée manque.
3. En tant que client, je veux voir quand le rapport a été publié et quand
   viendra le prochain, pour savoir si je regarde la dernière version.
4. En tant que client, je veux que la semaine mesurée soit la même quel que
   soit le jour où le rapport est recalculé, pour que deux lectures du même
   rapport ne disent pas deux choses.
5. En tant que client, je veux lire la comparaison sans régler aucun filtre,
   pour comprendre ma semaine en arrivant.

**Le bandeau des totaux**

6. En tant que client, je veux voir ma dépense totale de la semaine, toutes
   plateformes additionnées, pour connaître ce que j'ai engagé.
7. En tant que client, je veux voir mes impressions totales de la semaine,
   pour connaître ma visibilité payante.
8. En tant que client, je veux voir sous chaque total la part de chaque
   canal avec sa pastille, pour savoir d'où vient le chiffre.
9. En tant que client dont une source n'a pas répondu, je veux que le total
   additionne celles qui ont répondu et qu'une note nomme l'absente, pour ne
   pas prendre un total partiel pour un total complet.
10. En tant que client, je ne veux voir additionnés que la dépense et les
    impressions, pour ne jamais lire une somme qui mélange des métriques
    propres à chaque plateforme.

**Le module des canaux**

11. En tant que client, je veux une carte par canal connecté, pour lire
    chaque plateforme avec ses propres chiffres.
12. En tant que client, je veux voir dépense, impressions et clics de la
    semaine sur la carte du canal, pour connaître le volume.
13. En tant que client, je veux voir CTR, CPC et CPM de la semaine, pour
    juger l'efficacité.
14. En tant que client, je veux voir chaque ratio placé parmi mes 12
    dernières semaines, pour savoir s'il est habituel **chez moi**.
15. En tant que client, je veux que la bande « tes habitudes » soit nommée
    et la semaine type indiquée au-dessus, pour avoir le repère « c'est la
    moyenne de notre compte ».
16. En tant que client, je veux que la semaine regardée soit colorée en vert
    doux quand elle fait mieux que mes habitudes, en rouge doux quand elle
    fait moins bien et en gris dans la bande, pour juger sans lire d'axe.
17. En tant que client, je veux que le mieux soit toujours à droite, même
    pour CPC et CPM où plus bas est mieux, pour ne jamais devoir retourner
    la lecture.
18. En tant que client, je veux savoir sur combien de semaines porte la
    comparaison, pour mesurer la confiance que je peux lui accorder.
19. En tant que client au compte récent (moins de 6 semaines d'historique),
    je veux voir la valeur sans couleur et « Semaine type dès 6 semaines
    d'historique — encore N », pour ne pas être jugé sur trop peu.
20. En tant que client dont le canal n'a rien diffusé, je veux voir 0 CHF de
    dépense et des ratios « — », pour distinguer « rien diffusé » de « pas
    de donnée ».
21. En tant que client, je veux passer d'une carte de canal à l'autre en
    glissant ou par ‹ ›, la suivante dépassant à droite, pour savoir qu'il
    y en a d'autres.
22. En tant que client, je veux que le nom du canal mène à sa page, pour en
    savoir plus.

**Les changements de la semaine**

23. En tant que client, je veux voir sur la carte du canal les changements
    que la plateforme a enregistrés cette semaine, rangés par catégorie
    (budget, enchère, audience, créatif, objectif, mot-clé, diffusion,
    calendrier, autre), pour savoir ce qui a été touché.
24. En tant que client, je veux voir pour chaque changement le jour, la
    campagne et le résumé, pour le relier à un mouvement des chiffres.
25. En tant que client, je veux qu'un changement hors campagne dise
    « Compte publicitaire » au niveau du compte, sinon le nom de l'objet,
    jamais « Hors campagne ».
26. En tant que client, je veux que la liste défile à la hauteur de la
    carte, pour qu'une semaine chargée n'allonge pas la page.
27. En tant que client, je veux un lien « journal → » ouvert sur la même
    semaine, pour voir le détail.
28. En tant que client, je veux distinguer « Meta n'a écrit aucun changement
    cette semaine » de « Changements en cours de récupération », pour ne
    pas prendre un trou de récolte pour une semaine calme.

**« Ce qui a été fait » : la frise**

29. En tant que client, je veux voir sur une frise de l'année toutes mes
    campagnes, groupées par plateforme, pour avoir la vue d'ensemble.
30. En tant que client, je veux voir le rythme de mes posts en points sous
    les mois, pour savoir si je publie régulièrement.
31. En tant que client, je veux zoomer entre Année et Mois, la frise
    s'ouvrant sur le Mois, pour passer du rythme au détail.
32. En tant que client, je veux qu'une campagne renommée reste une seule
    barre et que deux campagnes homonymes fassent deux barres, pour que la
    frise suive les campagnes et non leurs noms.
33. En tant que client, je veux voir chaque campagne sous son nom actuel.
34. En tant que client, je veux voir en trait plein une campagne jusqu'à sa
    fin déclarée, et en pointillés jusqu'au 31 décembre une campagne vivante
    sans fin, pour distinguer le prévu du supposé.
35. En tant que client, je veux qu'une campagne supprimée finisse à sa
    suppression (sinon à son dernier jour de dépense) et soit dite
    « supprimée », pour savoir qu'elle ne reviendra pas.
36. En tant que client, je veux voir le premier visuel d'une campagne en
    tête de sa barre quand il existe, pour la reconnaître.
37. En tant que client, je veux filtrer légèrement les campagnes par statut
    — terminée, supprimée, problème signalé par Meta, en cours, en pause,
    prévue, statut inconnu — tout étant visible par défaut.
38. En tant que client, je veux choisir une semaine dans la frise (clic,
    ‹ ›) et revenir à la semaine mesurée d'un geste, pour regarder une
    autre semaine sans perdre le rapport.

**« Ce qui a été fait » : le panneau**

39. En tant que client, je veux un panneau collant qui montre la semaine
    choisie, en onglets Organique et Campagnes.
40. En tant que client, je veux voir les posts de la semaine en grille —
    visuel 4:5, format, jour, lien vers le post, aucun chiffre — pour
    retrouver ce que j'ai publié.
41. En tant que client, je veux qu'une vidéo Instagram se dise « Reel »
    quand c'en est un, pour reconnaître le format.
42. En tant que client, je veux voir les campagnes de la semaine en cartes —
    visuel ou « pas de visuel », nom, dates, « lancée / terminée cette
    semaine », dépense de la semaine au survol.
43. En tant que client, je veux qu'une campagne `WITH_ISSUES` se dise
    « problème signalé par Meta ».
44. En tant que client, je veux qu'un onglet vide le dise — « Aucun post
    publié cette semaine », « … en cours de récupération », ou « Meta
    n'était pas encore connecté » pour une semaine antérieure à la
    connexion — pour ne jamais lire un vide muet.

**Les états**

45. En tant que client dont le jeton a expiré, je veux une alerte sur la
    carte du canal avec un lien vers Connexions, pour réparer moi-même.
46. En tant que client victime d'une panne de récolte (la nôtre), je veux
    « — » partout sur la carte et une phrase qui dit que nous relançons,
    sans bouton, pour savoir que ce n'est pas à moi d'agir.
47. En tant que client tout juste inscrit, je veux une seule carte « Ton
    premier rapport arrive le <date>. Il portera sur la semaine du <début>
    au <fin>. », pour savoir quand revenir.
48. En tant que client, je ne veux jamais voir une source que je n'ai pas
    branchée — ni dans le bandeau, ni dans le rail, ni en onglet.
49. En tant que client, je ne veux jamais lire 0 là où la donnée manque,
    pour que chaque chiffre affiché soit mesuré.

**Pour l'équipe**

50. En tant que développeur, je veux que tout ce que la page montre
    sorte du payload du rapport, calculé une fois en Python et figé avec
    lui, pour que la page ne recalcule rien et que le rapport se vérifie
    hors ligne.
51. En tant que développeur, je veux un signal de couverture par source et
    par flux, pour distinguer une semaine sans diffusion d'une semaine non
    récoltée.
52. En tant qu'équipe Pulse, je veux qu'un jeton mort soit marqué par la
    récolte, pour que l'unique erreur montrée au client soit la bonne.

## Implementation Decisions

### Règles qui valent partout

- **Une absence s'écrit « — », jamais 0.** Un 0 ne s'écrit que si la source
  a répondu pour toute la semaine (`CLAUDE.md` §7).
- **La semaine** : 7 jours pleins qui finissent la veille du dernier Jour de
  travail (≤ aujourd'hui), quel que soit le jour du recalcul — jamais ancrée
  sur la dernière donnée ([02](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md),
  point 6). Le harnais l'a prouvé : refait un samedi, le builder actuel
  glisse d'un jour et avale le jour du fetch.
- **Chaque plateforme se lit avec ses propres chiffres** ; seuls dépense et
  impressions s'additionnent, dans le bandeau.
- **Style** : celui de l'hebdo actuel — jetons Tailwind existants,
  mini-modules, table des icônes de plateforme. Si cette table sert à
  plusieurs composants, elle part dans un module **sans** `"use client"`
  (`CLAUDE.md` §8). Ne reprendre ni les couleurs ni le test « a répondu »
  du prototype.

### Le payload (module de construction du rapport hebdo)

La table clé → source → calcul → fenêtre est celle de
[14](issues/14-ce-que-le-traitement-doit-calculer.md), §1 à §6 : elle fait
foi. Les noms de clés y sont proposés ; la construction peut les renommer,
pas en changer le sens. Forme résumée :

```
semaine:  { debut, fin, numero }            # fin = dernier Jour de travail − 1 j
sources:  { [canal]: { etat: recolte | jeton_mort | panne,
                       connecte_le, journal: couvert | non_couvert } }
totaux:   { depense:     { meta, google },  # null si etat ≠ recolte
            impressions: { meta, google } } # pas de totaux.portee (16)
canaux:   { [canal]: {
            volumes: { depense, impressions, clics },
            ratios:  { ctr|cpc|cpm: { valeur, semaines[12], n,
                                      mediane, q1, q3,   # null si n < 6
                                      etat: au_dessus | dans | en_dessous | null } },
            changements: [ { jour, categorie, campaign_id, campagne, objet, resume } ] } }
frise:    { annee,
            campagnes: [ { id, plateforme, nom, debut, fin, fin_declaree,
                           statut, visuels[≤4], depense_par_semaine } ],
            posts:     [ { plateforme, date, format, visuel, lien } ] }
```

- **Sortent** : `verdict*`, `kpi_focus`, `metrics_read/prev/series`,
  `kpis`, `changements` déduits, `canaux_muets`, l'ancienne `frise`,
  `week_label`, et les lectures qui ne servaient qu'à elles (objectif, GA4,
  abonnés, agrégats Instagram).
- **État d'une source**, dans cet ordre : jeton marqué à reconnecter →
  `jeton_mort` ; couverture des insights qui n'atteint pas `semaine.fin` →
  `panne` ; sinon `recolte`. Ni « a une ligne au dernier jour » (Meta
  n'écrit rien un jour sans diffusion) ni l'état de reprise de la récolte
  (remis à zéro à chaque passage, `fini` même avec des tranches refusées)
  ne peuvent servir.
- **Ratios** : CTR = clics ÷ impressions × 100 ; CPC = dépense ÷ clics ;
  CPM = dépense ÷ impressions × 1 000 ; `null` si le dénominateur vaut 0.
  Les 12 semaines précédentes, chacune calée sur le Jour de travail et
  calculée sur ses propres totaux ; une semaine sans ratio n'entre pas.
- **Quartiles, méthode « exclusive »** — celle du prototype validé,
  `statistics.quantiles(valeurs, n=4, method="exclusive")`. Valeurs triées
  x₁…xₙ, position p = k·(n+1)/4 pour k = 1, 2, 3, interpolation linéaire
  entre x⌊p⌋ et x⌊p⌋₊₁. **Pas** `percentile_cont` de Postgres (inclusive).
  Contrôle : [1…6] → q1 = 1,75, q3 = 5,25 (l'inclusive donnerait 2,25 et
  4,75). La bande plus large convient à 6–12 points ; la médiane est la
  même dans les deux méthodes. Le sens (mieux / moins bien) se décide à
  l'affichage.
- **Changements** : ceux que la plateforme a écrits, `occurred_at` dans la
  semaine au fuseau de la ligne. Regroupement et comptes par catégorie à
  l'affichage.
- **Frise dans le payload**, pas lue à part : identité par ID, nom actuel,
  campagnes de l'année (dépense dans l'année, ou dates déclarées qui la
  touchent ; une fin non déclarée seule ne suffit pas). Visuels : créas des
  annonces par dépense décroissante, sans doublon, 4 au plus ; rien pour
  Google. Posts de l'année, sans aucun chiffre.
- **Statut d'une campagne**, testé dans cet ordre : `REMOVED` →
  `supprimee` ; fin déclarée passée → `terminee` ; `WITH_ISSUES` →
  `probleme` ; `ACTIVE`/`ENABLED` → `en_cours` ; `PAUSED` → `en_pause` ;
  début déclaré futur → `prevue` ; non récolté → absent (« statut
  inconnu »). Meta n'a aucun statut « programmé » : `prevue` ne vient que
  d'un début futur.
- **Fin d'une campagne Google supprimée** : le plus récent changement dont
  le statut structuré passe à `REMOVED` ; sinon le dernier jour de
  dépense ; sinon un repère à la date de début. Lue dans un champ
  structuré du journal, jamais dans la phrase de résumé. Aucune supprimée
  n'entre en 2026 aujourd'hui : le repli suffit au lancement.

### Le `Lecteur`

Il gagne : le Jour de travail du profil, l'état de connexion par canal
(date de marquage « à reconnecter », date de connexion), la couverture par
source et par flux, et la lecture du journal des changements restreinte à
la semaine. Les lectures qui ne servaient qu'aux clés sortantes partent.

### La récolte, à construire d'abord

Sans elle, la page ment ou se tait ([14](issues/14-ce-que-le-traitement-doit-calculer.md), §7) :

1. **Brancher la vérification du jeton** Meta et Google — elle existe, rien
   ne l'appelle. Jeton mort → date de marquage posée si absente
   (`coalesce`) et raison, canal sauté ; jeton inconnu → rien.
2. **Un signal de couverture par source et par flux** (insights, journal,
   posts) : « récolté sans trou jusqu'au <date> », écrit seulement quand le
   flux a rendu sans tranche refusée, qui survit aux passages suivants.
   Une petite table créée par ajout seul (`CREATE TABLE IF NOT EXISTS`,
   aucun `DROP`) ; ses colonnes se fixent à la construction. L'échec du
   journal, aujourd'hui imprimé puis avalé, doit empêcher l'écriture.
3. **`permalink` et `media_product_type`** des posts Instagram : deux
   colonnes ajoutées, même permission, aucun re-consentement.
4. **Le statut avant / après** d'un changement de statut de campagne
   Google, dans la colonne de données structurées du journal (existe déjà,
   vide pour Google : aucune migration), forme
   `{"statut": {"avant": "ENABLED", "apres": "REMOVED"}}`.

### La page

- **Bandeau** : deux colonnes séparées par un filet ; ni barre, ni anneau,
  ni colonne portée. Le grand chiffre et la note de la source absente se
  calculent à l'affichage.
- **Rail** : carte à 90 % de la largeur, la suivante dépasse ; ‹ › ou
  glisser. Liste des changements dans le composant de liste défilante
  existant.
- **Moustache** : min → max des 12 semaines en points, boîte q1 → q3
  nommée « tes habitudes », médiane nommée « semaine type », semaine
  regardée en gros point coloré ; axe inversé pour CPC et CPM ; tons
  légers.
- **États** ([13](issues/13-les-etats-de-la-page.md), numéro = son point) :

| Cas | Bandeau | Carte du canal | Panneau |
|---|---|---|---|
| Jeton mort (3) | Total des sources qui ont répondu + note nommant l'absente (2) | Alerte + lien vers Connexions | inchangé |
| Panne interne, semaine partielle comprise (4, 5, 7) | idem | « — » partout, sans moustache : « Une erreur est survenue pendant la récolte de Meta. Nous la relançons dès que possible. », sans bouton | « … en cours de récupération » |
| Historique < 6 semaines (6) | — | Valeur sans état ni couleur ; « Semaine type dès 6 semaines d'historique — encore N » | — |
| Journal non couvert (8) | — | « Changements en cours de récupération », sans compte ; vrai 0 : « Meta n'a écrit aucun changement cette semaine » | — |
| Semaine vide (9) | — | — | Onglet gardé, compte 0 : « Aucun post publié / aucune campagne active cette semaine », ou « … en cours de récupération », ou « Meta n'était pas encore connecté » avant la connexion |
| `WITH_ISSUES` (10) | — | — | « problème signalé par Meta » |
| Changement hors campagne (11) | — | « Compte publicitaire » au niveau du compte, sinon le nom de l'objet | — |
| Compte neuf (12) | rien | rien | une seule carte « Ton premier rapport arrive le <date>. Il portera sur la semaine du <début> au <fin>. » |

- **Ce qui part de la page** : le verdict, le focus KPI, l'alerte « canal
  muet », l'ancien bloc des changements, l'ancienne frise de la semaine,
  les trois dates sous leur forme actuelle (réabsorbées dans le titre), la
  lecture séparée des changements par API (ils arrivent par le payload) et
  l'avertissement de trou de récolte sur cette page. Leurs composants ne
  servent qu'à l'hebdo (vérifié le 2026-11-01) et se suppriment — la table
  des icônes de plateforme sortie d'abord. **Restent** : l'avertissement de
  trou de récolte et la pente (servent ailleurs), le fil de mise en place,
  la liste défilante, et le module de lecture des changements par API (lu
  par les pages plateformes).
- **Aucune route ajoutée ni retirée.**

### Ordre de construction

**Récolte → traitement → page.** Chaque étape ne se voit en ligne
qu'après un passage du worker (`CLAUDE.md` §9).

## Testing Decisions

- **Une seule couture : `build_payload(Lecteur)`, hors ligne.** Un faux
  `Lecteur` gréé sur des lignes fixes, sans base ni secret ; on exécute
  `build_payload` et on vérifie le payload rendu. C'est la couture que
  `CLAUDE.md` §9 impose déjà, et la plus haute : tout ce que la page montre
  sort du payload. Aucune nouvelle couture.
- **Un bon test vérifie une propriété du payload que la page promet**, pas
  la façon de la calculer : « deux homonymes donnent deux barres », « la
  semaine ne glisse pas si on recalcule le samedi », « une source en panne
  a des totaux `null`, pas 0 », « n < 6 → quartiles `null` ». Jamais un
  test sur une fonction interne du builder.
- **Prior art** : le harnais du ticket 14 (dossier `harnais/` de cette
  carte, vert le 2026-11-01), un faux `Lecteur` et des `constat` qui
  échouent si un écart ne tient plus. On part de lui : ses constats d'écart
  doivent **s'inverser** — clés sortantes absentes, semaine du samedi qui
  ne glisse plus, deux homonymes en deux barres et une renommée en une, ID
  et statut sur chaque campagne, visuel et lien sur chaque post, une seule
  année ; celui du jeudi reste vrai. On y ajoute :
  - chaque ligne du tableau des états (jeton mort, panne, semaine
    partielle, historique < 6, journal non couvert, semaine vide, avant
    connexion, `WITH_ISSUES`, hors campagne, compte neuf) ;
  - l'ordre des statuts (`REMOVED` avant la fin passée) et la fin d'une
    campagne Google supprimée (date structurée, puis repli) ;
  - les quartiles sur [1…6] → 1,75 et 5,25 ;
  - CPC/CPM `null` quand le dénominateur vaut 0, et 0 CHF quand la source
    a répondu sans diffusion.
- **La récolte** : `python3.12 -m py_compile` sur ce qui est touché, puis
  vérification **après un passage du worker** lancé à la main depuis
  GitHub Actions (`weekly-fetch.yml` avec `force`) — la couverture, les
  colonnes des posts et le statut structuré Google se remplissent. Pas de
  test hors ligne : la récolte parle aux plateformes.
- **La page** : aucun framework de test côté web, et ce chantier n'en
  ajoute pas. `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit`,
  `npm run build` verts avec un nombre de routes inchangé. Les états se
  contrôlent en rendant un payload construit par le harnais, pas en
  cliquant. En ligne : après un passage `report_only` si la récolte est
  déjà passée.

## Out of Scope

- **Google Ads et Instagram au module des canaux** : quand leurs pages
  seront finies ; Google reprendra les clés de Meta, Instagram rejugera
  vues et interactions ([02](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md),
  [16](issues/16-ce-que-montre-la-case-instagram-du-bandeau.md)).
- **La page plateforme ouverte sur la semaine du rapport** : « journal → »
  ouvre le journal sur la semaine ; le nom du canal mène simplement à sa
  page. Le reste est l'affaire du chantier des pages plateformes.
- **Les campagnes Meta supprimées ou archivées** : la récolte ne les
  rapporte probablement pas (non vérifié) ; la frise applique les mêmes
  statuts à ce qu'on lui donne. Question de récolte, à ouvrir à part.
- **Le meilleur du compte** ([07](issues/07-le-meilleur-du-compte.md)),
  **la remontée des erreurs de récolte** chez nous, **l'email hebdo**,
  **un connecteur LLM**, **le conseil**, **le thème et le regroupement**,
  **les posts Facebook programmés** : voir la section « Out of scope » de
  la [carte](map.md).

## Further Notes

- **La maquette validée** est dans l'historique :
  `git show f83ca2f:.scratch/hebdo/prototype-08/index.html`, variante E
  (`?variant=E`) ; ses données se recréent avec `extraire.py` du même
  commit. Référence de forme pour chaque bloc ; ne pas reprendre son test
  « a répondu » ni ses couleurs.
- **Volumes en base au 2026-11-01** : 462 posts au total ; Meta 395/395
  débuts et 373 fins déclarés, Google 156/158 et 120 ; 3 campagnes Meta sur
  10 ont un visuel, Google aucune ; 122 posts `VIDEO` qui ne se disent
  « Reel » qu'avec `media_product_type`.
- **Découpage en tickets de construction** : `/to-tickets`, sous
  `tickets/` (pas `issues/`, qui porte les tickets de la carte).
