#!/bin/bash
#
# LE HARNAIS DU TICKET 42 — `etat()` répond-il juste, maintenant qu'une ligne
# rangée porte son verdict ?
#
# `saas/web` n'exécute aucun test (ticket 53, encore ouvert) et `CLAUDE.md` §9
# n'y offre que `tsc` + `build` + le compte de 19 routes — qui prouvent que ÇA
# COMPILE, jamais que ÇA RÉPOND JUSTE. Le ticket 42 le dit lui-même : « il n'y a
# aucun runner dans saas/web : ça se vérifie à la main, et ça se dit. »
#
# On peut faire mieux que « à la main », et sans rien installer. C'est la
# technique relevée par le ticket 53 à partir du 29 : une logique qui n'importe
# que des TYPES se compile seule et s'exécute sous node. `etat()` est dans ce
# cas — `etat-action.tsx` n'importe en VALEUR que `components/pente.tsx`, qui
# lui-même ne prend qu'un type de React. Aucun composant n'est rendu ici : on
# n'appelle que `etat()`, qui retourne un objet.
#
# Ni base, ni secret, ni réseau. `python3.12` n'a rien à faire ici — c'est du
# TypeScript, on se sert du `tsc` déjà installé dans `saas/web`.
#
#   bash jouer.sh
#
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$(cd "$ICI/../../../../saas/web" && pwd)"
OUT="$ICI/.build"

rm -rf "$OUT"
mkdir -p "$OUT"

# `--jsx react` (la forme CLASSIQUE) et pas `react-jsx` : celle-ci émettrait un
# vrai `import ... from "react/jsx-runtime"` en tête de module, donc un chargement
# de React au démarrage. La forme classique se contente de `React.createElement`
# À L'INTÉRIEUR des corps de composants — que ce harnais n'appelle jamais.
#
# Les erreurs `TS2307` (les alias `@/…`) et `TS2686` (`React` en global UMD) sont
# attendues et sans effet sur l'émission : `tsc` écrit le JS quand même, et le
# projet réel, lui, est vérifié par `npx tsc --noEmit` dans `saas/web` — c'est là
# que ces alias sont résolus. On ne regarde donc PAS le code de sortie de `tsc`,
# mais la présence du fichier émis, juste en dessous.
cd "$WEB"
npx tsc components/etat-action.tsx components/pente.tsx \
    --outDir "$OUT" --module esnext --target es2020 \
    --jsx react --moduleResolution bundler --skipLibCheck > /dev/null 2>&1 || true

test -f "$OUT/etat-action.js" || { echo "✗ tsc n'a rien émis"; exit 1; }

# `tsc` NE RÉÉCRIT PAS les alias de chemin à l'émission : le JS garde
# `from "@/components/pente"`, que node ne sait pas résoudre. Une ligne de `sed`
# le remplace par le voisin réellement émis. C'est la seule retouche, et elle ne
# touche qu'une chaîne d'import — pas une ligne de logique.
sed -i '' 's#"@/components/pente"#"./pente.js"#' "$OUT/etat-action.js"

cp "$ICI/test_etat.mjs" "$OUT/"
node "$OUT/test_etat.mjs"
