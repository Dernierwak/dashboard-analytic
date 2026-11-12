# Les nouveaux thèmes de l'IA se revoient après coup, jamais avant

> **⛔ REMPLACÉE — 2026-09-30.** Le thème et le label ont quitté tout le produit
> (écran, code, email ; la base suit au ticket 02) : décision de David pendant le
> chartage de [la carte du dashboard Meta Ads](../../.scratch/meta-ads/map.md),
> ticket « Le thème et le label quittent l'écran et le code ». Cette fiche reste
> au dépôt pour sa raison, et ce qui a été perdu est noté au `BACKLOG.md`
> (« Ce que la refonte Meta Ads met de côté »). Elle ne décrit plus le produit.

> **⚠️ CADUQUE — 2026-09-21.** Le classement IA (`labeling.py`) a été retiré du
> produit avec les recommandations : un thème se pose désormais à la main, sur
> la page Thèmes. Cette fiche reste au dépôt parce qu'une décision et sa raison
> ne s'effacent pas — elle dit pourquoi l'application appliquait puis laissait
> revoir, et ce qu'on acceptait en échange. Elle ne décrit plus le produit.

Le classement IA (`labeling.py`) tourne comme un job GitHub Actions
asynchrone, suivi par polling depuis le navigateur (`triggerClassify` /
`checkFetchStatus`, `classify-button.tsx`) — au moment où le résultat revient,
il est déjà écrit en base. On ne peut donc pas mettre le job en pause pour
demander confirmation en plein vol sans construire un second appel Gemini
synchrone dédié à la seule prévisualisation des nouveaux thèmes, ce qui a été
écarté comme travail disproportionné pour ce que ça change.

On garde l'architecture : le job applique directement (comme pour les
assignations, déjà couvertes par l'annulation en bloc de `classify-button.tsx`),
et on ajoute une revue **après coup**, spécifique aux thèmes que l'IA vient de
créer (pas aux assignations) — garder ou supprimer chacun, en comparant la
liste de thèmes avant/après le job plutôt qu'en persistant une métadonnée de
provenance en base.

## Statut au 2026-09-13 — la décision tient, son mécanisme n'existe plus

Le ticket
[`construction/15`](../../.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md)
a retiré les quatre boutons de déclenchement de l'app, dont « ✨ Étiqueter tout
via l'IA ». **La décision de cette ADR reste juste — on revoit APRÈS coup,
jamais avant — et elle se renforce** : le classement tourne désormais à chaque
Jour de travail, sans que personne ne le demande.

**Mais tout ce que ce texte décrit comme mécanisme est parti** :
`triggerClassify`, `classify-button.tsx`, l'annulation en bloc et la comparaison
avant/après des thèmes. Tous bornaient leur périmètre par un `depuis` gardé dans
le `sessionStorage` de l'onglet qui avait cliqué — sans clic, il n'y a plus rien
à borner. Ne pas lire les paragraphes ci-dessus comme une description du code
actuel.

Le remplacement est à décider dans
[`construction/39`](../../.scratch/construction/issues/39-l-annulation-des-etiquettes-ia-a-perdu-son-declencheur.md),
qui dira si cette ADR se met à jour ou si une ADR neuve la remplace.
