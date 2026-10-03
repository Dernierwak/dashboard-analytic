# 15: Le code Meta mort de `channel-dash.tsx`

Type: task
Status: needs-triage
Blocked by: 06

**Trouvé en chemin** par la revue du ticket 06 (pas demandé, donc un ticket et
pas un détour — `CLAUDE.md` §4.4).

Depuis que `/meta` lit `lib/meta/`, seule la page Google passe par `buildDash`
(`lib/channels.ts`) et par les modules de `components/channel-dash.tsx`. Il y
reste du code qui ne sert plus qu'à l'ancienne page Meta :

- `AdsKpis` prend `channel = "meta"` par défaut ;
- `CampaignTable` porte `isMeta` (colonne Portée, mot « adset » — un mot que
  l'écran ne doit plus écrire, spec user story 4) ;
- `ChannelDash.reach` est documenté « 0 si non suivi (Google) » : un zéro posé
  sur une valeur non mesurée (`CLAUDE.md` §7). Vérifier s'il s'affiche encore.

À trancher : retirer maintenant, ou laisser mourir avec la refonte de Google Ads
(qui reprendra les cinq modules, ADR 0011). Rien de visible ne casse tant que
personne ne passe `channel="meta"`.
