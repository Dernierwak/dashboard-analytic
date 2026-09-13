# Le carnet : un module unique posé partout — et `preuve` meurt

Type: task
Status: resolved
Blocked by: 05

## Question

**Tranché par [08](../../refonte/issues/08-la-memoire-du-travail.md).** Le carnet
est **le seul mécanisme de rétention de toute la carte** — aucun des dix produits
lus en 02 n'en a un. David, en 03 : *« tu as à la fin un peu tout ton historique
de ce que tu fais pour travailler. Cela permet de garder le client. »*

### Les trois prémisses que 08 a corrigées — à ne pas re-corriger

- **La note est DÉJÀ sur la frise, deux fois** (`_markers` ne filtre pas `kind`).
- **Le worker relit DÉJÀ les 8 derniers rapports publiés.**
- **`preuve` n'est pas un trou mais un moteur CONCURRENT**, plus vieux et moins
  juste que le rail : il mesure sur le **compte entier** là où le rail mesure sur
  le **thème**. (142 l. de worker, `ProofOutcome` inutilisé, **calculé et affiché
  nulle part** — relevé en 06.)

Et la correction de 06 qui vaut avertissement : **le carnet SE RELIT déjà.**
« Ton historique d'actions » n'a pas été perdu, il a été **fusionné exprès** dans
la carte du thème (`685a3e9`, 615 l. supprimées) parce qu'il fallait traverser
900 px pour relier un conseil à son effet. Le **rail des actions** porte le cycle
de vie complet avec l'effet chiffré. **Ne pas le défaire.**

### Les décisions à bâtir

- **`preuve` meurt.** Le bilan compte-entier devient un **comptage** de
  `suivi_actions.verdict` déjà persisté — motif de 11 rejoué : un seul moteur.
- **La mémoire est le fil continu, pas l'archive rejouée.** On ne rouvre **aucune**
  semaine passée : deux vérités à l'écran. (`weekly_reports` est lu `.limit(1)` —
  l'historique est en base et n'est jamais ouvert. **C'est voulu.**)
- **Une note entre dans la mémoire du thème, JAMAIS dans le repondérage** —
  narratif ≠ mesuré (§7).
- **Le carnet devient un module unique posé partout**, sur le patron de 12, **avec
  auteur et campagne en base** — les deux colonnes du ticket **05**.
- **Une note du client ne reçoit AUCUN verdict.** David a renversé la
  recommandation de la session, et en mieux : juger sa note obligerait Pulse à
  choisir le chiffre à sa place, **donc à inventer une intention**. **Pulse
  marque, le client juge.**

### Le piège d'août, à ne pas rejouer

**Les marques sur une courbe ont existé et David les a fait retirer le 24 août** —
points noirs parasites sur la série. Les props `markers` / `marqueurs` de
`line-chart.tsx` **vivent encore et ne dessinent plus rien**. Marquer, oui ; salir
la courbe, non. Si ce ticket rallume des marques, **c'est en variantes
comparables**, pas en décision d'agent.

### La correction de David qui vaut au-delà du ticket

**Les thèmes ne découpent pas l'application en deux axes, ils DÉBLOQUENT des
modules** — coûts par plateforme, puis coûts par thème ; posts individuels, puis
moyenne par thématique.

### Consigne de repli

Faire mourir `preuve` d'abord : c'est net, c'est isolé, et ça retire un moteur
concurrent. Le module unique ensuite.

## Avancement — session du 2026-09-13 (construction)

**Les cinq décisions sont bâties.** Repli appliqué dans l'ordre annoncé :
`preuve` d'abord, le module ensuite. **Rien n'est vérifié en service** — aucune
note écrite en base, aucun verdict compté sur de vraies lignes.

### 1 · `preuve` est morte, et le bilan la remplace par un COMPTAGE

Quarante-deux lignes de worker, `fetch_reco_decisions` (son seul appelant),
`ProofOutcome` et le champ `payload.preuve` sont partis. Trois pierres tombales
restent — dans `build_report.py`, `fetch_data.py` et `report.ts` — parce que le
prochain qui cherchera « où est passé le bilan des actions » doit trouver la
réponse là où il la cherche, et non remesurer une deuxième fois.

**Ce qui le remplace ne mesure rien** : `compterVerdicts` (`saas/web/lib/carnet.ts`)
compte les `suivi_actions.verdict` déjà persistés par la boucle du rail, sur
**30 jours** — « 6 actions jugées sur 30 jours, 4 ont marché · sur tout le
compte ». Deux comptages `head` : PostgREST rend le nombre sans transporter une
ligne, donc **le plafond des 1 000 lignes ne s'applique pas** (§8). **Aucun taux
n'est dérivé** : un pourcentage sur quatre actions serait un chiffre juste qui
ment. La fenêtre et le périmètre sont écrits dans la phrase, sinon le bilan se
lirait comme celui du filtre posé juste au-dessus.

**La relève est vérifiée, pas supposée** : `_METRIC_REGLE`, `_spec_mesure`,
`_kpis_window`, `cur_kpis` et **l'écriture de `suivi_actions.verdict`** sont
intacts — sans cette écriture il n'y aurait plus rien à compter. C'est la leçon
du harnais 09 : supprimer sans vérifier la relève retire la réponse au lieu
d'unifier les moteurs.

### 2 · Le module unique, posé sur cinq pages — et l'accueil qui n'en prend que le bilan

`components/carnet.tsx` + `lib/carnet.ts` + `components/carnet-ligne.tsx`, montés
sur **`/meta`, `/google`, `/instagram`, `/labels`, `/couts`**. Ce qui le filtre
est **exactement ce que le bandeau de la page filtre** : ses thèmes, sa campagne.
Rien d'autre — c'est le patron de [refonte 12](../../refonte/issues/12-module-de-commandes.md).

**La page n'est pas un filtre, elle est un contexte d'écriture.** `/meta` ne
cache pas les notes de Google : rien en base ne rattache à un canal une note qui
ne désigne aucune campagne, et filtrer là-dessus lui prêterait un sujet qu'elle
n'a jamais eu (§7). Ce que la page apporte, c'est la **régie** de la campagne
qu'on y écrit — une note posée depuis `/meta`, campagne cochée, naît
`('meta', 'Été')` sans qu'on demande rien à personne. C'était l'argument le plus
fort de l'inventaire du ticket 19 de la refonte, et il est maintenant vrai.

**L'accueil ne monte PAS le module, seulement son bilan** (`BilanDuCarnet`,
posé entre le hero et « À faire » — la deuxième marche de l'ordre décidé). Le
rail des cartes de thème porte déjà la chronologie complète avec l'effet chiffré :
le relire en liste à 900 px de là referait très exactement ce que la fusion de
`685a3e9` avait défait. **Le rail n'est pas touché**, ses deux montages et sa
porte d'écriture non plus — un test le vérifie.

**Une seule porte d'écriture pour toute l'application** : `NoteAjout` est la
même sur la carte d'un thème, dans le filet hors thème et dans le Carnet ; ce
qui change, c'est ce que la note HÉRITE. Et **ce qui est hérité est écrit à
l'écran** (« Rattachée à : thème Été · campagne X ») : une note qui se rattache
toute seule à une campagne sans le dire attribuerait un travail à une campagne
que personne n'a choisie.

### 3 · L'auteur et la campagne en base — et un repli qui ne ment pas

`author_id` prend **`compte.moi`**, pas `compte.uid` : c'est le seul endroit de
tout `actions.ts` où la PERSONNE compte et non le COMPTE (quarante-trois écritures
font l'inverse). `updateNote` (neuf) et `deleteNote` filtrent sur l'auteur, avec
le **Propriétaire en exception** — sans lui, la note d'un membre parti serait
ineffaçable sur un compte qui est le sien — et une **note sans auteur reste à
tout le monde** (aucun backfill, ADR 0004 : « une note ancienne, pas une note
cassée »). Les deux lisent les lignes touchées (`.select("id")`) et **relisent**
avant de dire pourquoi rien n'a été écrit : un refus RLS ne lève aucune erreur,
il touche zéro ligne (§8). Le message **ne nomme personne**.

**La règle reste APPLICATIVE, pas RLS** — c'est la décision du ticket 05 (une
règle sur ce qu'un Membre a le droit d'écrire se propose, elle ne se glisse pas).
Conséquence écrite dans le code : un appel forgé contourne cet écran. C'est le
même fait que [23](23-auteur-forge-a-l-insertion.md).

**Le repli de migration refuse plutôt que de perdre une campagne en silence.**
Sans auteur, on réécrit sans lui. Avec une campagne désignée, on REFUSE : l'écran
vient d'afficher « rattachée à : campagne X ». Et **on ne dit « migration pas
jouée » que si c'est ce que la base a dit** — une panne réseau afficherait sinon
une cause fausse, qui est un fait fabriqué comme un autre.

**L'auteur ne s'invente pas.** `dashboard_members` ne se lit pas en entier par
n'importe qui (`dm_select`) : un Membre voit sa seule invitation. Un Membre qui
lit la note d'un AUTRE Membre ne peut donc pas le nommer — l'écran écrit « un
membre », c'est-à-dire ce qu'on sait. Et l'auteur ne s'affiche **que sur un
compte à plus d'une personne** (08 §5).

### 4 · La note entre dans la mémoire du thème, jamais dans le repondérage

La lecture des notes est **séparée** de la boucle de verdict, et c'est le point
qui compte : élargir le filtre `status` de cette boucle y aurait fait entrer les
notes — celle-là même qui **écrit `verdict` en base**. Seules les notes
`archived` qui portent un thème sont lues (une note `running` est ce qu'on compte
faire), bornées à 200, et passées à `condense_theme_memoire` comme `faits`.

Le prompt les nomme **« FAITS DÉCLARÉS, pas des hypothèses jugées »**, et la
fonction qui écrit leur ligne **n'a pas de place** pour un indicateur ou un
verdict — c'est la seule garantie qui tienne. Un thème qui n'a **que** des notes
déclenche quand même une condensation, et le prompt écrit alors qu'aucune
hypothèse n'y a été testée : « rien de testé » et « testé sans effet » ne sont
pas la même chose.

**Limite écrite, pas un oubli** : une note écrite sur un thème qui a DÉJÀ une
mémoire n'y entre qu'à la prochaine condensation, donc à la chute du prochain
verdict de ce thème. La cadence est événementielle et rien en base ne dit quand
la mémoire a été écrite — la corriger demanderait une colonne, pas une constante.

### 5 · Les deux pièges tenus

- **Aucune marque n'est rallumée sur une courbe.** Un test vérifie que ni
  `lib/carnet.ts`, ni `carnet.tsx`, ni `carnet-ligne.tsx` ne touchent
  `LineChart`, `MetricChart`, `markers` ou `marqueurs`. La question « comment
  marquer sans salir le tracé » reste celle des quatre variantes du ticket 19 de
  la refonte, **et elle attend ton jugement**.
- **Aucune semaine passée ne se rouvre.** `weekly_reports` reste lu `.limit(1)`,
  et un test existe pour qu'une prochaine session ne le « corrige » pas.

### 6 · Ce qui est vérifié — 179 vérifications, aucune base, aucun secret

Harnais rejouable dans `.scratch/construction/harnais/12-le-carnet/`
(29 + 45 + 105). **Les harnais 06 à 10 rejoués**, tous verts — une seule
correction ailleurs, dans `06-plan-de-theme/test_plus_rien_sans_clic.py`, dont
l'assertion visait encore `check_at: isoDate(check)`, nom d'avant le ticket 11 :
elle ne prouvait plus rien depuis `618b950`.

`saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` vert,
`npm run build` vert, **19 routes**. Python : `python3.12 -m py_compile` sur les
trois fichiers touchés.

**Une correction du traitement ne se voit qu'après un « ↻ Recharger mes
conseils »** — ici, la mort de `preuve` et la note dans la mémoire du thème. Le
Carnet, lui, se lit tout de suite : il ne passe pas par le rapport.

### 7 · Ce qui n'est PAS vérifié, et qui ne l'est pas par ma faute

- **La migration n'est pas jouée.** `author_id`, `campaign_channel` et
  `campaign_key` n'existent pas en base. Tant qu'elle ne l'est pas, le Carnet
  s'affiche **sans auteur ni campagne** et le DIT à l'écran. Le repli n'a donc
  jamais été exercé pour de vrai, ni la règle « une note ne s'efface que par son
  auteur », ni le déclencheur qui fige l'auteur.
- **`build_payload` n'a pas tourné** (ticket 16). La mort de `preuve` et la
  lecture des notes sont vérifiées sur le texte et sur l'arbre.
- **Rien du rendu web n'est exécuté** — aucun runner dans `saas/web`, décision
  de David au ticket 16.
- **Aucun verdict n'a été compté sur de vraies lignes.**

### 8 · Ce que ça fait naître

[33 · Une note pas encore faite marque déjà la frise](33-une-note-pas-encore-faite-marque-la-frise.md)
— `_markers` est la **seule** lecture des notes du dépôt qui n'a pas appris
qu'une Note peut naître `running`. Elle pose un repère ▲ pour un geste que
personne n'a posé, à une date destinée à être réécrite. Trouvé en chemin, écrit
en ticket plutôt qu'en détour.
