# 09: La lecture `lib/instagram/` et « Tous tes posts »

**What to build:** le calcul unique de la foule, neuf, et son premier écran :
le Tableau détaillé « Tous tes posts » — tout l'historique, triable par date
et par métrique, la Place sur la métrique choisie, la date du dernier relevé,
« plus d'un an », l'export `.csv` pour Excel.

Spec : § Implementation Decisions — la lecture (tout le tableau des calculs,
sauf l'âge égal et les filtres) ; § La page, Tableau détaillé ; vocabulaire ;
§ Testing Decisions, seam 2.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Fonctions pures sans `"use client"` : format (Vidéo du fil ≠ Reel,
      format inconnu hors foule), métriques brutes null = null, taux à quatre
      termes, réactions fortes, abonnés pour 1 000, portée ÷ abonnés,
      référence 12 mois glissants, quartiles exclusifs, place avec les bornes
      de la spec, rien sous 6, totaux sans portée ni taux.
- [ ] Lecture paginée (`lireToutesLesPages`) des posts, `permalink` compris.
- [ ] Le Tableau remplace le bas de la page actuelle : tri date (récent
      d'abord par défaut) et métriques, colonne Place, dernier relevé,
      « plus d'un an », temps de visionnage (« – » hors Reel), « – » pour
      toute absence.
- [ ] Export `.csv` : point-virgule, Date en première colonne, absence =
      cellule vide.
- [ ] Harnais : [1…6] → 1,75 / 3,5 / 5,25 ; null jamais compté 0 ; rien sous
      6 ; aucun total de portée ni de taux ; plus de 12 mois et moins de 48 h
      hors de la foule ; format inconnu hors foule ; l'export.
- [ ] `tsc` et `build` verts.
