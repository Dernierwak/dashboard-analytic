# 15: Le code Meta mort de `channel-dash.tsx`

Type: task
Status: resolved
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

## Answer

**2026-10-04 — tranché : retiré maintenant**, pas laissé à la refonte Google.
Rien n'appelait plus le chemin Meta. Le garder, c'était laisser vivre deux mots
interdits (« adset », un zéro sur la Portée) à un argument près.

- `AdsKpis` n'a plus de `channel`. Sa tuile de tête (`firstTile`) est partie
  avec : elle portait la Portée sur l'ancien Meta et **recopiait le CPC sur
  Google, qui l'affichait donc deux fois côte à côte** dans « Coûts
  unitaires ». C'est le seul changement visible : sur `/google`, ce panneau
  replié passe à deux tuiles (CPM, CPC) et son libellé devient « Coûts unitaires
  — voir ».
- `CampaignTable` n'a plus ni `channel` ni `isMeta` : la colonne Portée et le
  mot « adset » sont partis. Le reste de la table Google ne bouge pas d'un pixel :
  mêmes colonnes, même mot « groupe », même pied de tableau.
- `reach` / `reachDelta` sont retirés de `ChannelDash`, `Campaign`, `RawAd` et
  `buildDash` (ventilation de la comparaison comprise). **S'affichait-il
  encore ?** Non : seul le chemin `channel="meta"` le lisait, et plus personne ne
  le passait. Le « 0 si non suivi (Google) » n'existe plus non plus, donc plus
  rien ne peut le ressortir. Les `reach` d'Instagram, qui mesure vraiment la
  portée, ne sont pas touchés.

Vérifié : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` et
`npm run build` verts, **18 routes**. Une recherche dans `saas/web` ne trouve
plus `channel="meta"`, `isMeta` ni `reachDelta`. Revue sur deux axes
(Standards, Spec) : spec conforme, aucune violation dure. Deux constats hors
périmètre deviennent les tickets 21 et 22.

Non vérifié à l'écran : la page `/google` n'a pas été ouverte dans un
navigateur. Aucun passage du worker n'est nécessaire, c'est une lecture côté
web ; il suffit du prochain déploiement de `main`.
