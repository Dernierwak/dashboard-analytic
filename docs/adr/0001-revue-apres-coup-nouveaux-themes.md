# Les nouveaux thèmes de l'IA se revoient après coup, jamais avant

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
