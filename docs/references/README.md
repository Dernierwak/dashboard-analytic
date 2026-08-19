# Références — ce qu'on a payé cher pour apprendre

Ce dossier existe pour une raison précise : **les contraintes des plateformes ne
se devinent pas, et les redécouvrir coûte une session entière à chaque fois.**
Elles étaient jusqu'ici enfouies dans des messages de commit, où personne ne va
les chercher.

## Comment s'en servir

**Les agents doivent venir lire ici avant d'affirmer une contrainte d'API.** Leur
`.md` doit pointer vers le fichier qui les concerne. Un agent qui invoque « Meta
garde 90 jours d'historique » sans référence invente.

Trois règles de tenue :

1. **Une affirmation sans source n'entre pas.** Si le chiffre vient d'un essai et
   non de la documentation, c'est écrit noir sur blanc — un pari assumé se
   distingue d'un fait.
2. **Ce qui est IMPOSSIBLE compte autant que ce qui est possible.** La moitié de
   la valeur de ce dossier est d'empêcher de reconstruire un chiffre qu'aucune
   API ne donne.
3. **Une contrainte contredite par l'expérience se corrige ici**, avec la date et
   ce qui l'a montrée. On ne laisse pas deux versions cohabiter.

## Le dossier

| Fichier | Ce qu'il porte |
|---|---|
| `plateformes.md` | Meta Marketing API, Google Ads API, GA4, et ce que chacune refuse de donner. |

À venir, au fur et à mesure qu'on paie pour l'apprendre : les références UX, et
les contraintes Supabase / PostgREST aujourd'hui listées dans `CLAUDE.md`.
