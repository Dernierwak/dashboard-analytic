# L'assistant de configuration bloque tant qu'aucun thème n'est créé

> **⛔ REMPLACÉE — 2026-09-30.** Le thème et le label ont quitté tout le produit
> (écran, code, email ; la base suit au ticket 02) : décision de David pendant le
> chartage de [la carte du dashboard Meta Ads](../../.scratch/meta-ads/map.md),
> ticket « Le thème et le label quittent l'écran et le code ». Cette fiche reste
> au dépôt pour sa raison, et ce qui a été perdu est noté au `BACKLOG.md`
> (« Ce que la refonte Meta Ads met de côté »). Elle ne décrit plus le produit.

Le vrai bénéfice d'un thème (recos, coûts, conversions) existe déjà côté
produit, mais reste invisible tant qu'aucun contenu n'est classé — un compte
qui termine sa configuration sans thème recrée exactement le problème qu'on
essaie de résoudre, et aucune démonstration factice n'est possible sans
enfreindre la règle « aucun chiffre fabriqué » (CLAUDE.md §7).

On préfère donc un gate dur — impossible de terminer l'étape « Construis tes
thèmes » du `setup-wizard` sans au moins un thème créé — à un simple nudge
encouragé mais contournable. Exception : un compte à offre unique ou
homogène, où aucun découpage thématique naturel n'existe, peut valider avec
un seul thème large plutôt que d'être bloqué à inventer une segmentation
artificielle.
