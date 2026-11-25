#!/bin/sh
# Lance le harnais du ticket stories 02 (la page), d'où qu'on l'appelle :
#   sh .scratch/instagram-stories/harnais/02-la-page/lancer.sh
# Node ≥ 23.6 (type stripping natif) ; `resoudre.mjs` est le crochet des
# harnais Instagram (imports sans extension, alias `@/`).
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../../../.." && pwd)"
cd "$RACINE" || exit 1
WEB="$RACINE/saas/web" exec node --no-warnings --import "$ICI/resoudre.mjs" --test "$ICI"/*.test.ts
