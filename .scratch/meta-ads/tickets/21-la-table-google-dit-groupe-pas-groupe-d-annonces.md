# 21: La table Google dit « groupe », pas « groupe d'annonces »

Type: task
Status: resolved
Blocked by: 15

**Trouvé en revue** du ticket 15 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

`CampaignTable` (`saas/web/components/channel-dash.tsx`) écrit « le détail par
groupe », « ses groupes et annonces », « · groupe ». Le terme de `CONTEXT.md`
est « Groupe d'annonces ». Ce n'est pas un mot interdit, mais ce n'est pas celui
du glossaire.

Le remplacement n'est pas mécanique. `groupWord` est mis au pluriel par
concaténation (`{groupWord}s`), ce qui donnerait « groupe d'annoncess ». Il faut
donc un singulier et un pluriel écrits en entier.

À trancher : le faire maintenant, ou avec la refonte de Google Ads (ADR 0011).

## Réponse (2026-10-04)

Tranché : maintenant — le changement ne touche que des libellés, il n'attend
pas la refonte de l'ADR 0011.

`groupWord` est remplacé par deux constantes écrites en entier, `groupe`
(« groupe d'annonces ») et `groupes` (« groupes d'annonces »). Les deux
phrases de pied qui disaient « ses groupes et annonces » disent désormais
« ses groupes d'annonces et leurs annonces ». L'étiquette de ligne devient
« · groupe d'annonces ».

Vérifié : `npx tsc --noEmit` et `npm run build` verts, 18 routes. Pas vu à
l'écran : la table ne se déplie pas tant que `google_ads_ad_insights` n'est
pas alimentée, et seule la phrase « Aucune campagne ne se déplie : le détail
par groupe d'annonces… » est visible aujourd'hui sur `/google`. Aucun passage
du worker n'est nécessaire : c'est du texte du client, il part avec le
déploiement Vercel.

Remarque, déjà présente avant : sur une ligne *annonce*, l'infobulle de
l'écart dit « pas ventilée par groupe d'annonces ». C'est vrai, mais
« par annonce » serait plus juste. Ce n'est pas corrigé ici.
