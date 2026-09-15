# « Aucune campagne ni publication ne porte ce thème » est affirmé sur une absence

Type: bug
Status: open
Blocked by:

## Question

**Trouvé par la revue de code lancée sur le ticket 29**, qui portait sur toute
la branche. Ne vient pas de 29 : c'est le travail du ticket 22 (Pulse lit la
vue).

### Le fait

`components/theme-card.tsx` l. 229 :

```tsx
const rienARegrouper = cases.length === 0;
```

et `cases` (l. 194-208) ne se remplit que si `som.spend != null && som.spend > 0`
ou `som.posts != null && som.posts > 0`. La liste est donc vide dans **deux
situations que rien ne distingue** :

1. **`null` — on ne sait pas.** `fusionneRegroupement` cas 2, dont la
   documentation dit elle-même « inconnu », et le cas 3 (la vue muette).
2. **`0` — on sait, et c'est zéro.**

La carte affirme pourtant, dans les deux cas : « Aucune campagne ni publication
ne porte ce thème. » Dans le premier, c'est un fait fabriqué à partir d'une
absence de donnée — `CLAUDE.md` §7, « une absence de donnée n'est pas un zéro »,
qui est précisément la règle autour de laquelle le reste du ticket 22 est bâti.

Le second cas ment aussi, autrement : un thème dont les campagnes **sont**
étiquetées mais n'ont rien dépensé sur tout l'historique, et qui n'a aucun post,
revient avec `spend: 0, posts: 0`. La carte invite alors le client à étiqueter
ce qu'il a déjà étiqueté.

### Ce qu'il faut faire

Séparer les deux, et ne parler que du cas où on sait :

- `som.spend === null && som.posts === null` → **inconnu**. Dire qu'on n'a pas
  encore de chiffre pour ce thème, pas qu'il est vide.
- `som.spend === 0 && som.posts === 0` → **vraiment vide**… et même là, « rien
  n'est étiqueté » reste une déduction : une campagne étiquetée à 0 CHF est
  étiquetée. La phrase juste parle de ce qui est MESURÉ (« rien n'a été dépensé
  ni publié sous ce thème »), pas de l'étiquetage.

Le besoin d'origine reste valable et ne doit pas se perdre : sans phrase du
tout, la carte s'affichait avec son titre et un blanc dessous, ce qui se lit
comme une panne.

### Comment on le verra

**Après un passage du worker** — la carte lit le payload publié, pas la base en
direct. Le cron du Jour de travail (07:00 UTC), ou un lancement à la main depuis
l'onglet GitHub Actions (`weekly-fetch.yml`, `report_only`).

### Le piège de fichiers

`saas/web/components/theme-card.tsx` (l. 194-229), et `fusionneRegroupement`
pour ce que `null` veut dire côté payload.
