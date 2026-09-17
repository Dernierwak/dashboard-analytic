# Deux colonnes pour garder la photo du verdict ?

Type: question
Status: open
Blocked by:

## Question

**Posée par le §2 du [ticket 42](42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md)**,
lui-même corollaire du [17](17-verdict-persiste-qui-derive.md). Sortie en ticket
parce qu'elle n'est pas du même métier que le 42 : celui-ci était une lecture
dans `saas/web/`, celle-ci demande une **migration**, une écriture dans
`saas/traitement/build_report.py` et un affichage — trois dossiers, et une
décision de schéma qui ne se glisse pas dans un correctif.

### Le fait

`suivi_actions` porte le verdict (`better`/`worse`/`stable`) mais **pas les deux
chiffres qui l'ont produit**. Depuis le 17, le triplet `then/now/delta` n'est
servi dans le payload que **la semaine où le verdict tombe** : après, le
remesurer donnerait la dérive du compte, pas l'effet de l'action.

Conséquence déjà en production : l'écran écrit « on suit le CTR » là où il
écrivait « CTR 3,1 → 5,8 ▲ +87 % » (`Effet`, `saas/web/components/etat-action.tsx`),
et **pour toute l'archive d'un coup** — dès le premier passage du worker après
le déploiement du 17.

### Ce qu'il faut trancher

Est-ce que ces deux chiffres méritent deux colonnes — `verdict_depart` /
`verdict_constate` — écrites **au même instant que `verdict`**, et donc figées
comme lui ?

## Ma recommandation : oui

Trois raisons, dans l'ordre où elles pèsent.

**1 · C'est la seule question que l'archive existe pour répondre.** Le carnet
d'actions ne sert pas à se souvenir de ce qu'on a fait — ça, le titre le dit.
Il sert à savoir **si ça a marché**. « on suit le CTR » ne répond rien : c'est
le nom de l'indicateur, pas son mouvement. Un verdict `better` sans ses deux
chiffres demande au client de croire Pulse sur parole, ce qui est exactement ce
que la doctrine maison refuse partout ailleurs.

**2 · Le coût est petit, et il n'ouvre aucune surface de dérive.** Les deux
colonnes s'écrivent dans **le même `update` que `verdict`**, donc sous le même
garde `.is_("verdict", "null")` (`lecteur.ecrire_verdict`) : une écriture, une
fois, atomique. Rien de neuf à défendre — le figeage est déjà construit et
vérifié par le harnais du 17. Deux colonnes suffisent : `delta` se recalcule
depuis les deux autres, le stocker serait une troisième vérité à tenir d'accord.

**3 · Le refus irait au mauvais endroit.** Le §2 du 42 propose, si on dit non,
de l'écrire dans `docs/mesures-impossibles.md`. Ce serait une faute : ce
document dit **ce qu'on ne saura jamais mesurer**. Or on sait parfaitement
mesurer ces deux chiffres — on les a en main le jour du verdict, ils sont dans
le payload. On choisit seulement de ne pas les garder. Y ranger un choix de
stockage abîmerait le seul document qui dise honnêtement où sont nos limites.

### Ce qui est déjà tranché, quoi qu'on décide

**On ne rejoue pas l'historique.** Les actions jugées avant ces colonnes
n'auront jamais leur photo — `then/now` ne se retrouvent pas après coup sans
remesurer, et remesurer c'est précisément le mensonge que le 17 a retiré. Ces
lignes-là garderont « on suit le CTR » pour toujours, et c'est honnête.

## Ce qu'il faudra faire, si c'est oui

- Migration : deux colonnes `numeric` nullables sur `suivi_actions`, plus leur
  entrée dans le registre d'auto-vérification de `000_run_me_all.sql` (la liste
  `('c', 'suivi_actions', …)`, §23 pour le voisinage).
- `build_report.py` : les verser dans l'`update` existant, **jamais dans un
  second**. Le garde du verdict doit rester le seul.
- `saas/web/lib/report.ts` : les lire sur la ligne, comme le verdict depuis le
  42 — et le payload cesse alors d'être la source du triplet le jour de la
  chute aussi.
- `Effet` (`etat-action.tsx`) n'a **rien** à changer : il sait déjà afficher
  `then`/`now`/`delta`, et il retombe déjà sur « on suit X » quand ils manquent.
- Ne pas rejouer l'historique. Aucun `UPDATE` de rattrapage.

## Consigne de repli

C'est une question, pas une tâche. Ce qui doit sortir d'ici d'abord, c'est
**oui ou non** — écrit, avec sa raison. Le code vient après, et pas dans la même
session que `build_report.py` s'il est déjà tenu par un autre chantier (la carte
interdit deux agents sur ce fichier).
