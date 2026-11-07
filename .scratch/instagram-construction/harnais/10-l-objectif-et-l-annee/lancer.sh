#!/bin/sh
# Lance le harnais du ticket 10, d'où qu'on l'appelle :
#   sh .scratch/instagram-construction/harnais/10-l-objectif-et-l-annee/lancer.sh
# Le crochet de résolution (`.ts`, `@/`) est celui du ticket 09.
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/../09-la-lecture/resoudre.mjs" --test "$ICI"/*.test.ts
