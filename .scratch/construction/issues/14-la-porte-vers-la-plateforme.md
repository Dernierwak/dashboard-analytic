# La porte vers la plateforme : le thème ET la fenêtre

Type: task
Status: open

## Question

**Tranché par [09](../../refonte/issues/09-la-porte-vers-la-plateforme.md).**
Le rapport ne renvoie **jamais** vers `/meta`, `/google`, `/instagram` — ses seuls
liens sortants vont vers `/labels` (mesuré en 06). C'est un cul-de-sac du fil,
et c'est le profil n°2 de 04 qui le paie : *celui qui se sert de l'hebdo comme
travail prémâché puis va creuser seul.*

### Pourquoi ce ticket est presque gratuit

**Rien à construire côté données.** `ThemeCampaign` porte **déjà** `channel` et la
clé de chaque campagne, et `label` est **déjà** un paramètre reconnu des pages
canal — **`/meta?label=…` marche aujourd'hui.**

### Les décisions

- **La porte part de la carte du thème, et d'elle seule** (David) : un chiffre du
  point général ne désigne aucune plateforme, le lien serait vague.
- **Le lien emporte le thème ET la fenêtre du rapport.** Sinon « 4 520 CHF »
  devient « 103 CHF » au clic, **et ça se lit comme un bug**.
- **On ne ramène rien** — écrire depuis une page canal appartient au carnet
  (ticket **12**) — **mais la page dit d'où on vient et propose d'y retourner**.
- **`/instagram` devient filtrable par thème** : `ByLabelInsta` existe déjà, **il
  manque le paramètre**. Sans ça, le rang 3 de
  [07](../../refonte/issues/07-gabarit-de-plateforme.md) ne tient pas — c'est le
  seul rang qui parle la même langue sur les trois pages, donc le seul qui empêche
  `/meta`, `/google` et `/instagram` d'être trois produits séparés.

### Les deux pièges, tous deux déjà écrits

- **Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde** (§8) — sinon il perd
  par construction tout paramètre ajouté après lui, **en produisant une URL
  valide**. C'est l'en-tête de `lib/liens.ts`, et `lienDash` est là pour ça.
- **Le piège des pastilles inertes est déjà couvert** par `exclusifs()` dans
  `lib/liens.ts`. Ne pas le réécrire.

### Ce qui n'est PAS dans ce ticket

Le module de commandes unique — [12](../../refonte/issues/12-module-de-commandes.md)
et [15](../../refonte/issues/15-le-bandeau-en-variantes.md), **brique 4, hors
périmètre de cette carte**. Ici on ouvre une porte avec `?label=` et la fenêtre,
rien de plus. Le vocabulaire d'URL `d` / `l` appartient au bandeau, pas ici.

### Consigne de repli

Le paramètre de thème sur `/instagram` d'abord si la porte prend du temps : c'est
lui qui manque en base de code, le reste marche déjà.
