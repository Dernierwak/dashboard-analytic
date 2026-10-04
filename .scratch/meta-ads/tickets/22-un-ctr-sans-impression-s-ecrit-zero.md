# 22: Un CTR sans impression s'écrit « 0.00 % »

Type: task
Status: resolved
Blocked by: —

**Trouvé en revue** du ticket 15 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Dans `buildDash` (`saas/web/lib/channels.ts`), le CTR, le CPC et le CPM d'une
campagne et du total valent `0` quand leur dénominateur est nul. Le CPC et le CPM
s'affichent alors « — », parce que le composant teste `> 0`. Le CTR, lui, s'écrit
`ctr.toFixed(2) %`, donc « 0.00 % » pour une campagne sans aucune impression :
une absence de donnée lue comme un zéro (`CLAUDE.md` §7). Même chose dans la
tuile « CTR moyen » de `AdsKpis`.

Pas encore vérifié : une ligne Google à zéro impression existe-t-elle dans la
fenêtre d'un compte réel ? Il faut le lire en base avant de juger l'urgence.

- [x] Le taux non calculable vaut `null`, pas `0`, et s'affiche « — »
- [x] `tsc` et build verts, 18 routes

## Réponse

`taux(num, den, echelle)` (`saas/web/lib/channels.ts`) rend `null` quand le
dénominateur est nul ; `buildDash` l'emploie pour le CTR/CPC des annonces, des
groupes et des campagnes, le CPM des campagnes, et le total des deux périodes.
`AdRow`, `Campaign` et `ChannelDash` portent `number | null`. Les deltas passent
par `pctTaux` : un taux absent d'un côté ne se compare pas.

À l'écran (`components/channel-dash.tsx`) : la tuile « CTR moyen », les tuiles
CPM/CPC et les trois niveaux de la table écrivent « — ». Les tuiles CPM/CPC
testent maintenant `!== null` au lieu de `> 0` : un vrai CPC à 0 (des clics
sans dépense) s'écrit « 0.00 », parce qu'il a été mesuré. Au tri par écart, une
campagne sans taux part en fin de table, et sa cellule d'écart écrit « — ».

Vérifié : `tsc --noEmit` et `npm run build` verts, 18 routes. Revue en deux
volets (standards et spec) : rien ne manque au ticket.

Pas vérifié : la question en base (une ligne Google à zéro impression dans la
fenêtre d'un compte réel ?). `.env.local` ne porte que la clé anonyme, et la RLS
refuse la lecture sans session.

Hors périmètre, tracé au **24** : la courbe, la mini-série de la tuile,
`METRIQUES_ECART` et la comparaison recalculent encore le taux à 0.
