#!/bin/sh
# Lance le harnais du ticket 04 de la construction Google Ads, d'où qu'on l'appelle :
#   sh .scratch/google-ads/harnais/04-le-tableau-detaille/lancer.sh
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
