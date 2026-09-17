# `docs/mesures-impossibles.md` n'est dans aucun commit, et dix fichiers y renvoient

Type: task
Status: open

## Question

**Trouvé en livrant le ticket [32](32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md)**,
dont la réponse de David demandait précisément de faire gagner une nuance à ce
fichier. `CLAUDE.md` §4 : ça devient un ticket.

### Le fait

`docs/mesures-impossibles.md` **existe dans l'arbre de travail du dépôt
principal et dans aucun commit, sur aucune branche.** L'historique complet du
chemin est vide, et `docs/` ne porte que `docs/adr/` en fichiers suivis.

Conséquence immédiate, et c'est comme ça qu'il s'est vu : **un worktree ne voit
pas ce fichier du tout.** Une session qui travaille dans
`.claude/worktrees/<n'importe lequel>` et qui suit un lien vers ce document
tombe sur un fichier absent.

### Pourquoi ce n'est pas un détail de rangement

`CLAUDE.md` §6 le nomme comme **source de savoir** — « Ce qu'on ne saura jamais
mesurer, et pourquoi. Un écran qui affiche une de ces valeurs ment. » Et **dix
fichiers suivis y renvoient** :

- `CLAUDE.md` et `.scratch/construction/map.md`
- les tickets [01](01-roas-gonfle.md), [10](10-six-regles-payantes-restantes.md),
  [18](18-revenu-google-non-rattachable.md),
  [32](32-un-conseil-compare-deux-regies-que-le-tableau-de-bord-refuse-de-separer.md),
  [42](42-le-verdict-persiste-ne-remonte-jamais-a-l-ecran.md),
  [59](59-la-mediane-muette-existe-une-deuxieme-fois-dans-le-moteur.md)
- `saas/recos_ia/regles_payantes.py` et `saas/traitement/build_report.py`

Plusieurs de ces renvois sont des liens relatifs cliquables
(`../../../docs/mesures-impossibles.md`). **Ils sont morts pour quiconque clone
le dépôt.** Un document qui interdit d'afficher certains chiffres, et que le
dépôt ne porte pas, ne protège que la machine de David.

### Ce n'est pas un oubli, c'était un choix — qui a fait son temps

Le ticket [10](10-six-regles-payantes-restantes.md) a constaté le fait et a
choisi de ne pas commiter, avec sa raison écrite :

> Ces deux fichiers ne sont PAS dans le commit de ce ticket, et il faut le
> dire : ils portaient déjà, avant cette session, un gros travail de
> documentation non commité […] le fichier entier pour l'autre, qui n'est pas
> encore suivi par git. Commiter mes lignes aurait emporté ce travail-là avec
> elles.

La raison tenait ce jour-là. Le travail en question est écrit depuis plusieurs
jours et n'avait pas bougé depuis le 2026-09-12, hors la nuance du ticket 32
posée le 2026-09-17. `CONTEXT.md`, l'autre fichier cité par 10, **est** suivi :
la question ne porte donc que sur celui-ci.

## Ce qu'il faut trancher

**Le commiter, ou écrire pourquoi il reste dehors.** Les deux réponses se
défendent, aucune ne se prend en douce :

- **Le commiter.** Les liens revivent, les worktrees le voient, la limite
  protège tout le monde. C'est ce que `CLAUDE.md` §6 suppose déjà.
- **Le garder dehors** — s'il y a une raison, elle n'est écrite nulle part. Il
  faut alors la poser, et **retirer ou requalifier les dix renvois** pour
  qu'ils cessent de promettre un fichier qui n'arrive jamais.

## Ce que ce ticket NE demande pas

Le contenu du document. Il est à jour et porte la décision du ticket 32 ; seule
sa présence dans git est en cause.

## Consigne de repli

Rendre le constat et rien d'autre : l'historique vide du chemin et la liste des
dix renvois suffisent à poser la question. **Ne pas commiter le fichier de sa
propre initiative** — c'est du travail de David, non suivi, et `CLAUDE.md` §7
dit de regarder avant d'écraser.
