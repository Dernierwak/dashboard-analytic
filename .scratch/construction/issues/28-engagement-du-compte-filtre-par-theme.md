# « Engagement du compte » est filtré par thème, et la page jure le contraire

Type: task
Status: resolved
Blocked by:

## Question

**Trouvé par la revue de code du ticket [09](09-trois-moteurs-un-seul.md).**
Ce n'est pas 09 qui l'a produit — le défaut vient du travail du bandeau de
commandes, non commité, que le commit de 09 a emporté avec lui (`CLAUDE.md` §5 :
jamais deux agents sur les mêmes fichiers, et ces fichiers en portaient déjà).

### Le fait

`/instagram` affiche trois tuiles sous « Ta page », et **écrit noir sur blanc**,
dès qu'un thème est coché (`app/instagram/page.tsx` l. 363) :

> *« ces trois chiffres sont ceux du compte entier — un abonné n'appartient à
> aucun thème »*

**C'est vrai pour deux d'entre elles, faux pour la troisième.** `followers` et
`growth30` viennent de `followers_history` et ne se filtrent pas. Mais la tuile
« Engagement du compte » lit `d.avgEng`, et sa sous-ligne « portée moyenne … /
post » lit `d.histReach` — tous deux calculés sur `all`
(`lib/channels.ts` l. 1225-1226), qui est **filtré par thème** depuis que le
bandeau existe (l. 1037 : `tous.filter((p) => p.labels.some(...))`).

Avec `?l=Promo`, le client lit donc l'engagement **du thème Promo** sous un
titre qui dit « du compte », **plus une phrase qui lui garantit que non**.

C'est `CLAUDE.md` §7 de face : le chiffre n'est pas fabriqué, mais il répond à
une autre question que celle que son étiquette pose — et la garantie écrite
rend le malentendu impossible à rattraper par le lecteur.

### Ce qu'il faut trancher

Les deux réparations sont légitimes et elles ne disent pas la même chose :

- **Calculer `avgEng`/`histReach` sur `tous`** (non filtré) — la tuile tient sa
  promesse, et le seuil « au-dessus de ton post moyen » de la table des posts
  reste celui du compte, comme son pied l'annonce.
- **Renommer la tuile** — elle devient « Engagement du thème » quand un thème
  est coché, et la phrase du bandeau ne parle plus que de deux chiffres.

**Attention au second effet** : `histReach` sert aussi de seuil à la colonne
Portée de la table des posts (vert = au-dessus de ton post moyen) et à la phrase
de son pied. Changer son périmètre change ce que le vert veut dire.

### Le piège de fichiers

`lib/channels.ts` et `app/instagram/page.tsx` — les deux fichiers que le travail
du bandeau a encore en cours.

## Ce qui a été fait

**Le premier des deux : `avgEng` et `histReach` se calculent sur `tous`**
(`saas/web/lib/channels.ts` l. 1232-1243), la liste des posts D'AVANT le filtre
de thème. La tuile « Engagement du compte » tient donc sa promesse, et la phrase
du bandeau redevient vraie pour les trois chiffres.

### Pourquoi celui-là et pas le renommage

Trois raisons, dans l'ordre où elles pèsent :

1. **`histReach` n'est pas qu'une tuile, c'est un repère.** Il colore en vert la
   portée d'une ligne de la table des posts (« au-dessus de ton post moyen »),
   il écrit le pied de cette table, et il écrit l'état vide (« ton compte porte
   d'habitude à N par post »). Filtré, ce repère bouge avec le thème coché : la
   MÊME ligne, la même portée, change de couleur selon la case cochée. Et un
   repère pris à l'intérieur du groupe qu'il note met à peu près la moitié des
   lignes en vert par construction — il cesse de dire quoi que ce soit.
2. **L'engagement DU THÈME n'est pas perdu** : il est déjà sur la page, colonne
   « Eng. » de « Performance par thème » (`byLabel`, qui part bien de `all`).
   Renommer la tuile aurait donné deux chemins vers le même chiffre.
3. Le renommage demandait de retoucher quatre textes (tuile, pied de table,
   « vs ton habitude », état vide) au lieu d'une ligne.

### Un zéro fabriqué qui part avec

Effet non prévu par le ticket : avec `all`, cocher un thème sur lequel rien n'a
jamais été publié donnait `mean([])` → **« Engagement du compte : 0,0 % »**. Un
zéro affiché là où il n'y a pas de mesure, `CLAUDE.md` §7 (« une absence de
donnée n'est pas un zéro »). Sur `tous`, ce cas n'existe plus : la moyenne ne
tombe à 0 que si le compte entier n'a aucun post.

### La phrase du bandeau

Elle gardait sa justification d'origine — « un abonné n'appartient à aucun
thème » — qui ne vaut que pour DEUX des trois tuiles. Elle renvoie maintenant
vers la colonne « Eng. » de « Performance par thème », **et seulement si cette
table est rendue** : `ByLabelInsta` ne rend rien quand `byLabel` est vide, et
envoyer le lecteur vers une section absente aurait été la même faute par
l'autre bout.

## Vérifié

`rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` vert et
`npm run build` vert, **19 routes** — `/privacy`, `/terms` et `/suppression`
comprises. Pas de harnais possible ici : `saas/web` n'a aucun lanceur de tests
(`package.json` ne porte que `dev`/`build`/`start`/`lint`), et
`getInstaDash` va chercher Supabase — il n'y a pas de seam équivalent au
`Lecteur` du traitement.

## Comment on le verra

**Tout de suite, à la lecture** — c'est du rendu de page, pas du traitement :
aucun passage du worker n'est nécessaire. Ouvrir `/instagram?l=<un thème>` et
comparer la tuile « Engagement du compte » avec et sans le thème coché : elle ne
doit plus bouger.

## Ce qui reste non mesuré

**L'écart que le défaut a produit en vrai** — pas d'accès à la base depuis cet
environnement, donc on ne sait pas de combien l'engagement d'un thème s'écartait
de celui du compte chez un client réel, ni combien de fois la page a été lue
avec un thème coché.
