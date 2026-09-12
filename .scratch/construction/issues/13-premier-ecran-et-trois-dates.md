# Le premier écran de celui qui revient, et les trois dates en tête

Type: task
Status: open
Blocked by: 12

## Question

Deux décisions qui vivent sur la même page et se bâtissent ensemble —
[10](../../refonte/issues/10-l-entree-premier-ecran.md) point 6, et
[13](../../refonte/issues/13-entre-deux-jours-de-travail.md).

### L'ordre du premier écran

**Verdict → bilan du carnet → rail des chantiers en cours → résumé IA REPLIÉ.**

La raison, écrite au plan §3 a : **la prose IA est ce qu'il y a de moins
vérifiable sur la page, et elle occupe aujourd'hui les pixels les plus chers.**

Deux défauts mesurés en 06 à corriger dans le même passage :
- **`SetupWizard` est rendu en bas de page**, sous deux écrans de défilement.
- **Le rapport ne renvoie jamais vers `/meta`, `/google`, `/instagram`** — ses
  seuls liens sortants vont vers `/labels`. (La porte est le ticket **14**.)

### Les trois dates

**Mesuré du X au X · publié le X · mis à jour le X.** `updated_at` **existe et
n'est jamais lu**. Toute la clarté du décalage entre deux Jours de travail tient
dans ces trois dates — et dans rien d'autre.

**Ce qui a été refusé, deux fois, et ne se re-propose pas :**
- **Rien à annoncer au client qui classe** : pas de bandeau « mise à jour en
  cours », **pas de mention d'âge par carte**.
- **Un rapport ne se déclare JAMAIS « périmé »** : vieux ≠ faux (§7).

### Le défaut de publication, à réparer ici

**Republier dans une autre semaine calendaire crée une DEUXIÈME ligne** —
`week_start` est dérivé de `today` (`build_report.py` l. 2164), pas de la fenêtre
mesurée. Deux lignes pour une même semaine, c'est deux vérités.

### Ce que 13 a corrigé de 08, et qui évite une fausse piste

**« ↻ Recharger mes conseils » ne déplaçait aucun écart** : la fenêtre est ancrée
sur **la dernière donnée** (`build_report.py` l. 1734), pas sur le jour de
fabrication. Seul « ↻ Mes données » bougeait l'ancre, parce qu'il récolte.
La décision de 08 tient (ticket **15**), **sa raison était trop large**.

### Le piège de §8 qui mord ici

**Une constante exportée depuis un module `"use client"`** devient une référence
client côté serveur : la valeur lue est un proxy, **rien ne lève, TS passe**.
Les valeurs partagées vivent dans un module **sans directive**.

### Consigne de repli

Les **trois dates** d'abord — petites, isolées, et elles répondent à la seule
question que le décalage pose. L'ordre du premier écran ensuite, **en variantes
comparables** : c'est de la hiérarchie, donc de la forme.
