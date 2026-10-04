# 21: La table Google dit « groupe », pas « groupe d'annonces »

Type: task
Status: needs-triage
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
