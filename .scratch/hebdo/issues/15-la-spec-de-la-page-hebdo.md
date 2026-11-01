# 15: La spec de la page hebdo

Type: task
Status: resolved
Blocked by: —

## Question

La destination de la carte : **écrire la spec de la page hebdo**, prête à
remettre à la construction, à partir de ce que les tickets ont tranché (la
forme : [La page entière, en maquette](08-la-page-entiere-en-maquette.md) ;
les états : 13 ; le payload : 14 ; la case Instagram du bandeau : 16).

La spec dit ce que la page montre, dans quel ordre, sous quelle forme, ses
états, et ce que le traitement calcule — en renvoyant aux tickets plutôt
qu'en les recopiant. À sa clôture, `.scratch/hebdo/prototype-08/` quitte
l'arbre (l'historique le garde).

## Answer

Écrite seule le 2026-11-01 : **[la spec](../spec.md)**. Elle renvoie aux
tickets pour le détail et tranche les trois points qu'ils lui laissaient :

- **La méthode de quartile** (14, §8) : celle de la maquette validée,
  `statistics.quantiles(n=4, method="exclusive")`, écrite par sa formule —
  ce n'est pas `percentile_cont`. Sur six semaines, la bande va de 1,75 à
  5,25 au lieu de 2,25 à 4,75 : elle ne crie pas « hors habitudes » sur un
  historique court.
- **La date de suppression Google** (17) : un champ structuré dans
  `platform_changes.extra_data` (colonne déjà là, NULL pour Google, aucune
  migration), jamais la phrase `resume` ; repli sur le dernier jour de
  dépense, qui suffit au lancement (aucune supprimée en 2026).
- **`TroisDates`** : la carte ne l'avait pas tranché ; « mesuré du … au … »
  devient le titre, publication et prochain passage restent en ligne
  discrète.

Vérifié : le harnais du ticket 14 tourne (sept constats verts) et la spec
dit lesquels doivent s'inverser ; les composants à supprimer ne servent
qu'à l'hebdo (`grep`), `lib/changements-api.ts` reste (deux autres
lecteurs). Les fichiers suivis de `.scratch/hebdo/prototype-08/` ont quitté
le dépôt (historique : `f83ca2f`) ; y restent `donnees.local.js`, extrait
client non suivi, et son `.gitignore`, gardé tant que l'extrait existe —
les deux à effacer à la main.
