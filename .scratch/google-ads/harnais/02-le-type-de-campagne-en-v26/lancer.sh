#!/bin/sh
# Lance le harnais du ticket 02 de la construction Google Ads, d'où qu'on l'appelle :
#   sh .scratch/google-ads/harnais/02-le-type-de-campagne-en-v26/lancer.sh
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
