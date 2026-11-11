#!/bin/sh
# Lance le harnais du ticket 06 de la construction Google Ads, d'où qu'on l'appelle :
#   sh .scratch/google-ads/harnais/06-les-points-de-changement-et-le-panneau-du-jour/lancer.sh
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
