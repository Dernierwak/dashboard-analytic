# Les tableaux de bord lisent le trou en direct, sans passer par le rapport

Type: task
Status: resolved

## Question

**Trouvé en réalisant [20](20-rapport-publie-sur-un-canal-muet.md).** Le
ticket 20 a fait taire les mesures trouées **dans le payload** — donc dans le
rapport hebdo et dans l'email, qui le lisent tous les deux. Les pages de
l'application, elles, **ne lisent pas le payload** : elles interrogent les tables
brutes elles-mêmes.

`getWeeklyData` (`saas/web/lib/report.ts`) recalcule `spend`, `clicks`, `ctr` et
le ROAS depuis `meta_ads_insights` et `google_ads_insights`. Les mêmes lignes,
donc **le même trou**, par un autre chemin — et aucune des protections du ticket
20 ne s'applique sur ce chemin-là. Concrètement, la semaine où Meta est muet :

- l'en-tête du rapport dit « — » (payload, corrigé) pendant que les **tuiles
  KPI** de la même page affichent un total amputé (calcul direct, pas corrigé) :
  deux chiffres contradictoires à trente pixels d'écart ;
- `/couts` additionne jour, mois et année sur une dépense incomplète, et
  surtout **l'alerte de dépassement de budget se désarme toute seule** — une
  semaine creuse fait repasser le compte du bon côté et fabrique un « tu es dans
  ton budget » faux ;
- `/meta` et `/google` montrent des courbes qui tombent à zéro sur la semaine,
  ce qui se lit comme un arrêt de campagne.

Le `ChannelSpend` de `report.ts` est le cas le plus net : il pose `spend: mSpend`
et `spend: gSpend` par canal, donc il affiche **zéro** en face du canal tombé —
exactement ce que `CLAUDE.md` §7 interdit.

### Ce qu'il faudrait faire

Le signal existe déjà et il est lisible côté web : `fetch_canaux_muets`
(`saas/commun/fetch_data.py`) lit `fetch_progress`, et la table a déjà ses
policies de partage. Il n'y a rien à mesurer de plus, seulement à faire
traverser une deuxième fois — cette fois vers `lib/report.ts`, `lib/couts.ts` et
les pages canal.

La règle à appliquer est celle qui est déjà écrite :
`docs/adr/0005-un-canal-muet-fait-taire-sa-mesure-pas-le-rapport.md` — chaque
mesure se tait si sa source est muette, et l'alerte de budget **se désarme**
plutôt que de se prononcer sur une dépense incomplète.

Attention au piège des trois états (ADR 0005) : « jamais connecté », « échec »
et « zéro mesuré » rendent le même nombre de lignes. Le web ne doit pas essayer
de deviner lequel — seul `fetch_progress` le sait.

### Ce qui est déjà vrai et ne change pas

Le rapport hebdo et l'email sont corrigés et vérifiés
(`.scratch/construction/harnais/20-canal-muet/`). Ce ticket ne porte que sur les
écrans qui court-circuitent le payload.

## Answer

Résolu le 2026-09-20. Le signal traverse une seconde fois : `lib/canaux-muets.ts`
est le jumeau web de `fetch_canaux_muets` — même table, même filtre sur le
dernier passage (`run_id` max, état `echec`), même restriction aux canaux
payants — et il rapporte en plus, pour chaque canal muet, **la dernière date
qu'il a réellement écrite**. C'est elle qui borne le trou : une mesure se tait
APRÈS cette date, et nulle part ailleurs, donc les fenêtres d'avant restent des
chiffres.

**Le rapport (`lib/report.ts`).** Un canal muet n'ancre plus la fenêtre — sinon
la semaine entière reculait et le client relisait l'ancienne sous les dates du
jour. Les dépenses par canal valent `null` pour le canal tombé, les totaux
(dépense, clics, CTR) valent `null` dès qu'une des deux régies manque, et le
ROAS ne se calcule plus : c'est le vrai piège, GA4 écrit pendant que Meta
échoue, donc le ratio ne s'effondre pas, **il gonfle**. Les deltas se taisent
avec leurs deux termes.

Le bandeau du rapport reste `CanalMuetAlerte`, qui lit `report.canaux_muets` :
deux listes du même fait sur un écran finiraient par se contredire. La liste
lue en direct sert à **un seul endroit**, l'état vide — un compte qui vient de
brancher Meta et dont la première récolte a échoué n'a ni ligne ni payload, et
s'entendait répondre « branche une source » alors qu'il venait de le faire.
`hasData` reste donc une question de LIGNES : ce verrou-ci choisit entre
l'écran de bienvenue et le corps du rapport, il n'a rien à voir avec le
`has_data` du worker, qui décide s'il PUBLIE.

**`/couts`.** L'alerte **se désarme** au lieu de se prononcer, comme le demande
l'ADR 0005. Dépense de l'année, du mois, moyenne quotidienne, repère de rythme,
total de période et dépense par thème valent `null` quand une régie muette les
traverse ; la barre d'enveloppe, la pastille « dans les clous » et « reste à
dépenser » disparaissent avec eux — ce dernier est un feu vert à dépenser, et un
cumul amputé le rendait trop généreux. Les deux anneaux sortent entièrement :
une part calculée sur une seule des deux régies gonfle celle qui reste. La
courbe et les sparklines sautent les jours non lus au lieu de les poser à zéro.
Les alertes de dépassement quotidien ne jugent plus une journée dont on n'a
qu'une moitié.

**`/meta` et `/google`.** Les chiffres y étaient déjà justes sans qu'on le
sache : `makeWindow` s'ancre sur la dernière ligne écrite, et
`batirComparaison` refuse déjà toute référence au-delà (« les jours qui
manquent compteraient comme des zéros »). Deux trous restaient. Une **plage
tapée à la main** prenait les dates du client telles quelles : les jours d'après
la panne entraient comme des jours à zéro, la courbe tombait, et ça se lit comme
un arrêt de campagne. Elle s'arrête désormais au dernier jour lu, et le libellé
le dit. Et surtout, la fenêtre **reculait en silence** : c'est la sortie la plus
discrète du problème, la panne devenait invisible pour tout le monde. Un bandeau
`TrouDeRecolte` l'explique maintenant sur `/couts`, `/meta` et `/google`.

**Une alarme qui s'allume sans rien cacher s'use.** Un canal tombé APRÈS avoir
écrit toute la fenêtre ne creuse aucun trou : il n'est signalé sur aucune de ces
trois pages, exactement comme `chiffres_tus` le décide côté rapport.

**Le piège des trois états a décidé d'un choix précis.** On ne rogne QUE sur un
canal muet, jamais sur « plus de lignes récentes » : un canal qui a bien répondu
et n'a simplement plus de campagne active a des zéros **mesurés**, et ils
doivent continuer à s'afficher (ADR 0005, état ③). Seule `fetch_progress` sépare
les deux, et c'est le seul endroit où le web se le demande.

**Une couture a été posée pour pouvoir vérifier.** `lib/channels.ts` importe le
client Supabase, donc `next/headers`, donc React : il ne se charge pas hors de
Next, et ses règles de fenêtre étaient invérifiables autrement qu'en
production. Elles vivent dans `lib/fenetre-canal.ts`, sans aucun import, et
`channels.ts` les importe — `customWindow` garde sa signature, c'est une
couture, pas une réécriture.

### Ce que la revue de code a rattrapé

Sept défauts, tous corrigés dans la foulée :

- les tuiles de budget disaient « à fixer juste en dessous » à un compte qui
  avait déjà posé son enveloppe — « à fixer » et « on ne sait pas » sont deux
  absences différentes et tombaient sur le même texte ;
- une plage sur mesure entièrement postérieure au trou était **jetée**, donc
  remplacée en silence par la présélection de 7 jours pendant que les deux
  champs de date continuaient d'annoncer la plage tapée. Elle se rabat
  maintenant sur le dernier jour lu et le dit — même remède qu'au ticket 46, et
  le défaut existait déjà sur le seul rognage du jour en cours. Les deux pages
  canal réaffichent désormais la fenêtre RÉELLE, plus les dates brutes ;
- `hasData` incluait les canaux muets, donc un compte n'ayant jamais rien reçu
  sautait l'écran de bienvenue pour un corps de rapport vide et inexpliqué ;
- « Meta Ads et Google Ads **n'a** pas répondu » : l'accord du verbe ;
- sur un compte sans enveloppe ET avec une régie muette, le module de dépense
  parlait de la panne au lieu du seul geste possible — poser l'enveloppe ;
- la phrase des anneaux nommait toutes les régies muettes de l'ANNÉE puis
  affirmait qu'il n'en manquait qu'une : elle ne nomme plus que celles qui
  taisent la période ;
- « les jours suivants ne sont pas mesurés, **elles** ne valent pas zéro » :
  l'accord du pronom.

**Un point a été confirmé plutôt que corrigé.** Un canal muet qui n'a JAMAIS
rien écrit est aveugle sur toute fenêtre, y compris des mois antérieurs à sa
connexion : brancher Google Ads sur un compte Meta de huit mois et rater la
première récolte fait passer la page Coûts entièrement en « — ». C'est la règle
exacte du worker (`_pub_aveugle`), et en changer une seule des deux
recréerait la divergence que ce ticket vient défaire. Le raisonnement et son
coût sont écrits dans `aveuglesSur` — à rouvrir si le cas se présente vraiment.

Vérifié par **26 tests hors ligne** (`.scratch/construction/harnais/48-trou-en-direct/`,
`node --test --experimental-strip-types`), le harnais du ticket 20 rejoué
(31/31), `npx tsc --noEmit` et `npm run build` sur un `.next` propre : **19
routes**.

**Rien de tout ça ne se voit en cliquant** — il faut une vraie panne de récolte.
Ce qui se constate à l'écran demande un passage du worker : le cron du Jour de
travail (07:00 UTC) ou un lancement à la main depuis GitHub Actions
(`weekly-fetch.yml`).

### Trouvé en chemin

`WeeklyData.kpis` et `WeeklyData.channels` **ne sont lus par aucun composant** —
la contradiction « deux chiffres à trente pixels d'écart » décrite plus haut ne
peut donc pas se produire. Ils ont été rendus honnêtes quand même (c'était le
cas le plus net du ticket), mais un calcul que personne ne lit ne se vérifie
pas : ticket [51](51-les-tuiles-kpi-du-rapport-ne-sont-lues-par-personne.md).

`lib/couverture.ts` lit lui aussi les tables brutes. Il n'est pas touché ici :
sa fenêtre s'ancre sur la dernière ligne écrite, donc elle ne traverse pas le
trou, et il mesure une COUVERTURE (l'argent qui échappe aux thèmes), pas un
verdict de budget. Le ticket ne le nommait pas.
