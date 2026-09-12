# Construction : le fil d'une semaine, en service

## Destination

**La v1 du plan de refonte en service sur le compte de David** : le fil d'une
semaine parcouru de bout en bout, sur de vraies données, **sans cul-de-sac** —
du premier écran au verdict de la semaine suivante.

Fin de carte = les quinze tickets construits et vérifiés, le fil parcouru une
fois en entier par David, et son jugement rendu. Ce que 04 a tranché : **le juge
est son jugement, pas un chiffre** — Pulse ne mesure rien de ses utilisateurs, et
on n'ajoute pas d'outil de mesure d'audience pour ça.

**La spec de cette carte est [`spec.md`](spec.md)** — le document unique de la
v1, écrit le 2026-09-11 par `/to-spec` à partir de la carte de refonte. Elle ne
décide rien : elle rassemble en un endroit ce que les vingt-et-un tickets de la
refonte ont tranché, pour qu'un agent qui prend un ticket d'ici sache ce que son
morceau sert. **En cas d'écart entre la spec et un ticket de la refonte, le
ticket gagne** — il porte la mesure, la date et les mots exacts de David.

La carte de refonte — [`../refonte/map.md`](../refonte/map.md) — est **fermée** :
21 tickets résolus, destination atteinte
([`plan-de-refonte.md`](../refonte/plan-de-refonte.md)). Cette carte-ci ne décide
plus rien de ce qu'elle a tranché ; elle le bâtit.

## Notes

### Cette carte EXÉCUTE — c'est l'exception, pas la règle

Wayfinder planifie par défaut. **Cette carte est l'exception prévue** : ses
tickets ne résolvent pas des décisions, ils livrent du code vérifié. Le plan le
prescrit lui-même — *« la construction se charte comme une carte neuve »*.
Tous les tickets sont donc de type `task`.

### La règle qui tient toute la carte

**Chaque ticket pointe le ticket de la refonte qui l'a tranché, et ne le
re-litige pas.** Une session qui rouvre une décision déjà prise travaille à
l'envers — s'il faut y revenir, ça se dit à David, ça ne se glisse pas.

Si le code contredit la décision, **c'est un fait, pas une permission** : on le
remonte dans le ticket et on demande. Quatre tickets de la refonte sur cinq ont
trouvé une prémisse fausse ; celle qu'on trouvera ici vaut la même attention.

### Vérifier avant de dire que c'est fait — `CLAUDE.md` §9

- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` **et**
  `npm run build` verts, **19 routes**. Un écart signale une page de contrôle
  oubliée. *(19 depuis que 18 a publié `/privacy`, `/terms`, `/suppression`.)*
- Python : `python3.12 -m py_compile` sur ce qui a été touché. **`python3.12`,
  jamais `python3`.**
- Une correction du traitement ne se voit **qu'après un « ↻ Recharger mes
  conseils »**, une correction de récolte après « ↻ Mes données ». Le dire à
  chaque fois — **jusqu'à ce que le ticket 15 retire ces boutons**.
- Ce qui n'a pas pu être vérifié se dit franchement. Pas de résultat prédit.

### Le partage des fichiers — la contrainte qui commande le parallélisme

**Trois agents au maximum, et jamais deux sur les mêmes fichiers.** Les arêtes de
blocage de cette carte sont posées autant pour ça que pour la logique :
`build_report.py` (4 775 l.), `reco_engine.py` et `supabase/migrations/` sont des
goulots où deux sessions concurrentes se marchent dessus.

### Ce qui ne se négocie jamais ici

`CLAUDE.md` §7, et deux points mordent particulièrement sur cette carte :

- **Aucun chiffre fabriqué.** Une absence de donnée n'est pas un zéro, un
  « +∞ % » n'existe pas. **Trois tickets de cette carte existent parce qu'un
  chiffre faux est à l'écran aujourd'hui.**
- **Rien de destructeur sans regarder d'abord.** Aucun `DROP`, `DELETE` ou
  `TRUNCATE` dans une migration sans le signaler et le faire valider. Le ticket
  03 en porte un — et la migration qu'il corrige est un piège armé.

### Les pièges déjà payés — `CLAUDE.md` §8

Ils s'appliquent tous, et quatre reviendront à coup sûr : la constante exportée
d'un module `"use client"` ; `min-w-0` en grille et en flex ; **un refus RLS sur
un `update` ne lève rien, il touche zéro ligne** (le ticket 02 est exactement
ça) ; **PostgREST plafonne à 1 000 lignes** et tronque en silence (le ticket 04
l'a déjà en tête) ; et **un lien énumère ce qu'il CHANGE**, jamais ce qu'il garde.

### Comment David reçoit le travail

Posé en 08 : *« quand je veux améliorer une partie, je reçois des prototypes que
j'accepte, et ensuite ils vont dans l'application avec un check pour voir si
l'app fonctionne »*. Un ticket qui touche à la **forme** d'un module le propose
en **variantes comparables** via `PrototypeSwitcher`
(`saas/web/components/prototype-switcher.tsx`), pas en description.

### Skills à consulter

`vision-produit` (quelle information mérite d'exister), `vision-ux` (hiérarchie
et uniformisation), `ux` (une action de bout en bout), `hebdo` (structure du
rapport), `recos` (pertinence et variété des conseils). Côté code :
`py-boy-scout` et `ts-boy-scout`.

### Le vocabulaire

`CONTEXT.md` est la source. Le mot est **« thème »**, jamais « label » — alors
que le code dit `label` partout, y compris dans les URL (`l`). Les mots gagnés
pendant la refonte : Carnet, Retour, Jour de travail, Note, Mise en place,
Stratégie, Marche, Mise en veille, Geste, Annonce, Groupe d'annonces, Mesure
prise, Regroupement, Point de vue de la semaine, À faire, Propriétaire, Membre.

### Ce qui tourne en parallèle, hors de cette carte

[18](../refonte/issues/18-passer-en-production.md) et
[26](../refonte/issues/26-gemini-palier-payant.md) — David seul, délai
administratif. **Le fait qui mord pendant ce temps** : en statut *Testing*, le
refresh token Google meurt à **7 jours** pour `adwords` et `analytics.readonly`,
donc le worker casse chaque semaine, **y compris sur le compte de David**. Le
bouton « Reconnecter » existe déjà (`app/comptes/page.tsx` l. 353 et 373) : il
faut recliquer avant chaque Jour de travail, et une semaine oubliée est une
semaine de données perdue.

## Decisions so far

<!-- l'index : une ligne par ticket clos, le détail vit dans le ticket -->

**[01 · Le ROAS gonflé](issues/01-roas-gonfle.md)** — le premier des trois
chiffres faux est réparé. `_kpis_window` divisait un revenu Meta+Google par une
dépense Meta seule ; elle lit maintenant `_pub_fenetre` (ex-`_pub_theme`, élargi
au compte entier par `lbl=None`) des deux côtés. **Aucune règle d'attribution
neuve** : additionner les dépenses des deux régies est déjà ce que fait
`build_matrix` pour le ROAS d'un thème — c'est *séparer* un ROAS par canal qui
resterait une décision non prise. L'historique n'est pas rejoué : les actions
décidées avant le `_BASCULE_PUB` portent une baseline d'un autre périmètre et
finissent donc sans verdict automatique.

**Deux tickets nés de sa revue de code**, hors des seize :
[17](issues/17-verdict-persiste-qui-derive.md) (le verdict persisté dérive au
lieu d'être figé — il fait dire à Gemini qu'une hypothèse ratée a réussi) et
[18](issues/18-revenu-google-non-rattachable.md) (la dépense Google se rattache
par identifiant, son revenu par nom — **une question pour David, pas une
correction**).

**[02 · La garde de collision](issues/02-garde-de-collision-resolveaction.md)** —
« le premier verdict tient » existe maintenant en code. `resolveAction`
conditionne son `update` au statut de départ **et** lit les lignes touchées
(`.in("status", …)` + `.select("id")` : l'un sans l'autre remplace un écrasement
silencieux par un refus silencieux). Sur zéro ligne, le statut réel est **relu**
avant qu'un message soit écrit — on nomme l'état, jamais une personne (ADR 0004),
et on ne l'affirme pas sans l'avoir lu (§7). `reco_feedback` n'est plus écrit sur
un geste refusé. **Repli appliqué** : la suppression d'une note par son auteur
attend `author_id`, que [05](issues/05-migration-deux-colonnes.md) n'a pas encore
posé. **Non vérifié en base** — aucune collision réelle jouée ; le projet Supabase
de `saas/web/.env.local` répond mais ne donne que la clé anon. La revue des
voisines a ouvert
[19 · Trente écritures qui ne se relisent pas](issues/19-ecritures-qui-ne-se-relisent-pas.md).

**Un seizième ticket est né hors des quinze** :
[16 · Le seam du payload](issues/16-le-seam-du-payload.md). C'est **le seul que
la refonte n'a pas tranché** — il vient de la session `/to-spec` du 2026-09-11,
où David a choisi le seam de test de la v1 : **le payload du rapport, seam
unique**, et **aucun runner de test dans `saas/web`**. Conséquence assumée, à
écrire dans les rapports de vérification concernés : la garde de collision (02)
et la date libre (11) ne seront couvertes par aucun test automatisé.

**[03 · L'identifiant d'annonce Meta](issues/03-identifiant-annonce-meta.md)** —
une Annonce s'identifie par son `ad_id`, jamais par son nom. Le rejeu
d'historique passe par `--meta-since` (Meta seul : un `--since` global ferait
rejeter la requête Google `change_event`), jamais par un `DELETE` ; le code se
défend si la colonne manque et la run finit rouge, l'utilisateur concerné ne
recevant ni rapport ni email — un trou lu comme une baisse est un faux verdict.
28 vérifications ciblées. **Le SQL n'est PAS joué** : son `DROP CONSTRAINT`
attend le feu vert de David, et le code déployé et la migration doivent partir
dans la même fenêtre. La migration est entrée dans le dépôt le 2026-09-12
(`03aa183`) — elle y était restée non commitée.

**[04 · La vue SQL du regroupement](issues/04-vue-sql-du-regroupement.md)** — le
regroupement par thème descend en base : `theme_regroupement`, une seule
implémentation, `security_invoker`, seuil des 100 CHF compris (`juge`), lecture
paginée et bornée au compte. `C_SEUILS["theme_spend_min"]` a disparu de Python
et `build_matrix` ne calcule plus les thèmes, elle les reçoit. **Trois chiffres
bougeront en service, tous dans le sens du §7** : le revenu GA4 ne se compte plus
une fois par campagne homonyme (1 560 CHF affichés pour 520 réels sur le jeu de
vérification), deux orthographes d'un nom ne s'écrasent plus, dépense et revenu
couvrent enfin le même périmètre. **103 vérifications** sur un PostgreSQL 16 réel.
**Le SQL n'est PAS joué**, et ce code déployé sans la vue ne publie plus aucun
rapport — c'est volontaire. La moitié web est [22](issues/22-pulse-lit-la-vue.md).

**[05 · La migration, deux colonnes](issues/05-migration-deux-colonnes.md)** —
`suivi_actions` gagne `author_id` (posé à la création, **figé par un déclencheur**
et non par une politique : une politique ne voit que la ligne d'arrivée) et la
campagne qu'une ligne désigne. **Aucun backfill** : une note sans auteur est une
note ancienne, pas une note cassée (ADR 0004). **Écart assumé avec la lettre du
ticket** : la campagne prend DEUX colonnes (`campaign_channel` + `campaign_key`),
parce que dans ce code l'identité d'une campagne est une paire — Meta par le nom,
Google par l'identifiant — et que deviner la régie rejouerait le bug du ticket 03.
42 vérifications sur un PostgreSQL 16 réel, dont le cas qui casse un garde-fou
trop zélé : supprimer un membre passe par le même UPDATE que le déclencheur
surveille. **Le SQL n'est PAS joué.** Les écritures TypeScript qui s'en servent
sont [12](issues/12-le-carnet-et-la-mort-de-preuve.md) et
[19](issues/19-ecritures-qui-ne-se-relisent-pas.md). Sa revue a ouvert
[23 · L'auteur peut être FAUX dès l'écriture](issues/23-auteur-forge-a-l-insertion.md) :
la colonne est figée après coup, mais la politique d'insertion contrôle le
compte et jamais la personne — une règle sur ce qu'un Membre a le droit
d'écrire, donc elle se propose.

## Not yet specified

- **Le jugement de David sur le fil, une fois la v1 en service.** C'est la
  destination, et c'est le seul endroit où cette carte peut découvrir qu'elle
  s'est trompée. Ce qu'il en sortira — un module qui ne sert pas, un ordre à
  refaire, un conseil qui tombe à plat — ne se charte pas d'avance.
- **Ce que les quatre premières règles payantes donneront sur de vraies
  données.** 24 a livré leurs seuils depuis `SEUILS`, aucun n'est inventé ; reste
  qu'aucune n'a jamais tourné. Si elles se taisent ou se répètent, c'est un
  ticket, pas une retouche silencieuse.
- **La doc du produit.** Table des matières au §6 du plan, décision dans
  [05](../refonte/issues/05-carte-du-savoir.md) : elle s'écrit **thématique par
  thématique, quand la brique est construite** — c'est le produit qui dicte la
  doc, pas l'inverse. Chaque thématique graduera en ticket à ce moment-là.

## Out of scope

- **Tout ce que la carte de refonte a tranché.** On bâtit ses décisions, on ne
  les rouvre pas.
- **Les briques 2 à 7 du plan §4** — [10](../refonte/issues/10-l-entree-premier-ecran.md)
  la mise en place, [07](../refonte/issues/07-gabarit-de-plateforme.md) les six
  rangs, [12](../refonte/issues/12-module-de-commandes.md) /
  [15](../refonte/issues/15-le-bandeau-en-variantes.md) le bandeau,
  [16](../refonte/issues/16-compteur-partage.md) au-delà de sa migration,
  [19](../refonte/issues/19-module-mes-notes.md) les notes sur la courbe,
  [23](../refonte/issues/23-recolte-des-quatre-manques.md) les quatre récoltes.
  Chacune a une condition d'entrée qui n'est pas remplie. **Le principe : rien ne
  se construit pour un client qui n'existe pas encore.**
- **La récolte de données** (`saas/collecte/`) — David la dit bonne. Seule
  exception, portée par le ticket 03 : l'identifiant d'annonce Meta, parce que
  c'est une **réparation** d'un bug de récolte, pas un ajout.
- **[18](../refonte/issues/18-passer-en-production.md) et
  [26](../refonte/issues/26-gemini-palier-payant.md)** — David seul, et ils
  tournent en parallèle sans rien bloquer ici.
- **Le nettoyage pour le nettoyage.** Garde-fou posé en 04 : il est interdit de
  répondre « il faut d'abord tout nettoyer ». Un chantier de propreté ne valide
  aucune hypothèse. Les 32 worktrees et 8,6 Go relevés en 01 restent où ils sont.
