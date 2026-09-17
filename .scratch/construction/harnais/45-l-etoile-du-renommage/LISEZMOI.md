# Harnais du ticket 45 — l'étoile qui ne suivait pas son thème

**Ce n'est pas une suite de tests installée.** `saas/web` n'en a aucune (ticket
[53](../../issues/53-saas-web-n-execute-aucun-test.md)), et le ticket
[16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de test de
la v1 serait le payload du rapport. Ce dossier est ce qui a servi à vérifier le
ticket 45, gardé pour qu'il soit **rejouable** plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau, ni installation**.

```bash
cd .scratch/construction/harnais/45-l-etoile-du-renommage
python3.12 test_etoile.py          # lance aussi verifier_deplacement.js
node verifier_deplacement.js       # la moitié exécutée, toute seule
```

## Le défaut

L'étoile « thème prioritaire » n'est pas une colonne : c'est une ligne
`insight_feedback` dont la **clé** porte le nom du thème (`priority_label:<nom>`).
Les retours sur les conseils, pareil : `theme` est dans la clé d'unicité de
`reco_feedback` depuis TASK-025.

La fusion de deux thèmes traitait les deux. Le renommage **simple**, non :

- renommer un thème étoilé lui **retirait son étoile sans un mot** — et Pulse ne
  conseille que dans les thèmes étoilés (`CLAUDE.md` §1) ;
- un « pas pour moi » restait sur l'ancien nom, donc **le conseil écarté
  revenait** ;
- supprimer un thème **laissait son étoile derrière lui**, et `build_report.py`
  la comptait parmi les trois thèmes qu'il conseille : un thème effacé consommait
  une des trois places.

## Ce qui est EXÉCUTÉ, et pas seulement lu

| Vérificateur | Ce qu'il exécute | |
|---|---|---|
| `verifier_deplacement.js` | `saas/web/lib/deplacer-theme.ts` **tel quel** — node 22+ retire les types lui-même, donc aucune copie du code à vérifier | **48 cas** |

C'est la raison d'être de ce module : la logique a été **sortie** d'`actions.ts`
au lieu d'y être recopiée depuis la fusion, parce qu'`actions.ts` porte
`"use server"` et ouvre une connexion Supabase au chargement — rien de ce fichier
ne peut tourner hors ligne. `lib/deplacer-theme.ts`, lui, **reçoit** son client
et n'importe que des types (effacés à l'exécution). Même raison que
`lib/cascade.ts` au ticket 19.

`fausse-base.js` rend la forme de réponse de supabase-js (`{ data, error }`,
jamais une exception) **et refuse ce que la vraie refuse** : les deux contraintes
d'unicité de `000_run_me_all.sql` y sont reproduites, `.range()` sert des
tranches bornes comprises comme PostgREST, et une panne suffixée `:zero`
reproduit le refus RLS — **l'écriture ne passe pas, et rien ne lève**. Sans elles le cas qui
compte — une clé d'arrivée déjà prise — passerait tout seul, et un UPDATE aveugle
serait déclaré bon alors que PostgREST le rejetterait. Un **cas témoin** le
vérifie au passage : l'UPDATE aveugle heurte bien la contrainte.

Ce que `verifier_deplacement.js` joue pour de bon :

- l'étoile suit le thème renommé, **par UPDATE** : `created_at` — donc le rang de
  priorité, qui décide des trois thèmes que l'IA rédige — est intact, et c'est la
  **même ligne**, pas une recréée ;
- un thème sans étoile n'en gagne pas une au passage ;
- **la clé d'arrivée est déjà prise** (l'orpheline d'un thème supprimé, que ce
  ticket empêche désormais de naître mais qui traîne déjà en base) : le
  déplacement ne casse pas, une seule étoile reste, sous le nouveau nom ;
- une orpheline qui n'est pas la nôtre **n'est pas touchée** — l'effacer serait
  un geste destructeur sur des données existantes, il se décide avec David
  (`CLAUDE.md` §7) ;
- les retours sur les conseils suivent le thème, ligne à ligne ; ceux d'un autre
  thème et ceux d'un autre compte ne bougent pas ;
- deux retours qui se heurtent sur (conseil, semaine) : la ligne d'arrivée gagne,
  celle du départ est écartée — le musellement reste posé ;
- **même conseil, autre semaine** : pas de collision, les deux retours vivent ;
- une panne de lecture, d'écriture ou de suppression est **rendue** dans les
  trois fonctions — c'est ce qui fait que la cascade s'arrêtera et le dira ;
- **le même nom des deux côtés n'efface rien.** `renameLabel` trime le nouveau
  nom : « Soldes » renommé en « Soldes  » passe le garde de l'écran (qui compare
  AVANT le trim) et descend par le chemin simple avec `de === vers`. Sans le
  retour sec, la ligne de départ serait sa propre ligne d'arrivée, le code de
  conflit la verrait « déjà prise » et l'effacerait — une espace en trop
  coûterait l'étoile du thème et tous ses retours. **Ce cas-là a été trouvé en
  relisant le correctif, pas en l'écrivant** : les trois cas qui le gardent
  échouent si le garde saute ;
- **une écriture qui touche zéro ligne se voit.** Un refus RLS sur un update ne
  lève rien (`CLAUDE.md` §8) : sans le `.select("id")` qui la relit, la cascade
  dirait « renommé partout » sur une étoile restée à l'ancien nom ;
- **au-delà de mille lignes, la lecture se pagine.** PostgREST plafonne à 1 000
  et tronque en silence (§8) : 1 500 retours suivent le thème, pas seulement les
  mille premiers, et une page pile pleine ne fait ni s'arrêter trop tôt ni
  boucler ;
- rien à déplacer → **aucune écriture tentée**.

## Ce que `test_etoile.py` prouve — 29 vérifications

Il lit du **texte** (pas de runner dans `saas/web`), commentaires retirés : le
CÂBLAGE dans `actions.ts`, que rien ne peut exécuter ici.

- les deux étapes manquantes sont dans la cascade de `renameLabel`, la troisième
  dans celle de `deleteLabel` ;
- elles passent **avant la liste maîtresse**, qui reste la dernière étape des
  deux — l'ordre est la seule chose qui rend un arrêt rattrapable (ticket 19) ;
- les trois appelants (`renameLabel`, `deleteLabel`, `_fusionnerLabels`) passent
  par le **même** module : un seul exemplaire de la gestion de conflit, donc plus
  d'occasion de diverger — c'est très exactement ce défaut-ci ;
- aucune des trois ne compose plus `priority_label:` à la main : cinq lecteurs
  dépendent de cette forme, dont `build_report.py` ;
- le module reste **jouable hors ligne** : aucune directive, aucun import de
  valeur. Une seule ligne d'import de valeur, et la moitié exécutée disparaît.

Les nombres d'étapes sont **mesurés sur le fichier**, pas recopiés du ticket : le
ticket 45 en annonçait huit et six, il y en a neuf et sept (leçon du ticket 44).

## Ce qui n'est PAS vérifié ici

- **Les étoiles orphelines déjà en base.** Les compter demande un accès à la
  base ; les effacer est un geste destructeur, donc il se propose (`CLAUDE.md`
  §7). Un thème renommé il y a trois semaines a peut-être déjà perdu ses
  conseils sans que personne l'ait vu.
- **Ce que l'écran affiche.** Le client ne déclenche rien : l'effet d'un thème
  redevenu prioritaire ne se voit qu'après un passage du worker — le cron du Jour
  de travail, ou un lancement à la main (`weekly-fetch.yml`, `report_only`).
