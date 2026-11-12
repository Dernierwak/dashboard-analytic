#!/bin/sh
# Lance le harnais du ticket 19bis, d'où qu'on l'appelle :
#   sh .scratch/meta-ads/harnais/19bis-une-regle-pour-la-vignette/lancer.sh
# `resoudre.mjs` est une copie de celui d'instagram-construction (ticket 09) :
# le harnais ne dépend pas d'un autre chantier.
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
