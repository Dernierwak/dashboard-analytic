#!/bin/sh
# Lance le harnais du ticket 14, d'où qu'on l'appelle :
#   sh .scratch/instagram-construction/harnais/14-la-tendance/lancer.sh
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
