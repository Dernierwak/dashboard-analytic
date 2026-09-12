# « Engagement du compte » est filtré par thème, et la page jure le contraire

Type: task
Status: open
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
