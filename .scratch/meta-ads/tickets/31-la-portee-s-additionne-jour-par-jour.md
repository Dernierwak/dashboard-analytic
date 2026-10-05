# La portée s'additionne jour par jour, et compte deux fois la même personne

Type: task
Status: resolved
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — rangé ici le 2026-10-01 : c'est une réparation, pas une décision.
Rangé dans `meta-ads/tickets/` le 2026-10-05 (depuis `.scratch/corrections/`, supprimé).

## Question

Trouvé en chemin par « Les 3-4 modules du dashboard, et leur ordre », en
**lisant le code**, pas en supposant.

`meta_ads_insights` est récolté en `level=ad`, `time_increment=1`
(`saas/collecte/automatisation/fetch_all.py:356-364`) : une ligne par annonce et
par jour, avec sa `reach`. Or `saas/web/lib/channels.ts:509` et `:515` font
`reach += r.reach` sur toutes ces lignes. **La portée est un compte de personnes
uniques** (le commentaire de `fetch_all.py:296` le dit lui-même) : une personne
touchée trois jours de suite par deux annonces compte **six fois**. Le chiffre
« portée » affiché sur `/meta`, et son écart, sont donc faux au sens de
`CLAUDE.md` §7. Même défaut à `:724` : `Number(r.reach) || 0` écrit zéro pour une
portée absente (au-delà de 13 mois, Meta la rend vide).

**Ce qui est à faire, rien à décider sur le principe** : une portée ne se lit
qu'au niveau et sur la fenêtre où Meta l'a calculée. Deux sorties possibles, à
choisir avec le contrat de données (« Le contrat de données commun Meta / Google,
et sa clé ») :
- récolter la portée **par semaine mesurée** et par niveau (compte, campagne, ad
  set, annonce) — des appels en plus, à compter ;
- ou **ne plus afficher** de portée agrégée tant que la récolte ne la donne pas,
  et le dire à l'écran.

**D'ici là**, le plus petit correctif honnête sur `/meta` : ne plus sommer, et
afficher « — » avec la raison. Le prototype du ticket 05 affiche une portée par
ligne avec un pied qui dit la règle — la décision de ce qui s'affiche se prend là.

**Vérification** : `npx tsc --noEmit`, `npm run build`. Ça se voit en cliquant
(c'est de la lecture, pas de la récolte).

## Tranché ailleurs (2026-10-01)

La carte `meta-ads`, ticket 07, a choisi la seconde sortie : **la portée et la
fréquence ne s'affichent plus** sur le dashboard Meta, tant que la récolte ne
les donne pas au bon niveau (David : « on a meilleur temps de ne pas la
prendre »). Le correctif de `/meta` est donc de les **retirer**, pas de les
afficher à « — ». Le pourquoi et les voies pour plus tard sont au `BACKLOG.md`.

## Answer

Sans objet depuis la page `/meta` neuve (PR #5, mergée le 2026-10-04) : elle
ne lit plus la portée du tout — `COLONNES` de `saas/web/lib/meta/donnees.ts`
ne contient pas `reach`, et `git grep reach` ne trouve rien sous `lib/meta/`
ni `app/meta/`. La somme fautive de `lib/channels.ts` est partie avec
l'ancienne page. Conforme au choix du ticket 07 (portée et fréquence retirées).
