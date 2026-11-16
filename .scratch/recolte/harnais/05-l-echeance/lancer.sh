#!/bin/sh
# Lance le harnais du ticket 05 (l'échéance), d'où qu'on l'appelle :
#   sh .scratch/recolte/harnais/05-l-echeance/lancer.sh
# `resoudre.mjs` est une copie de celui de meta-ads (ticket 20) :
# le harnais ne dépend pas d'un autre chantier.
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
