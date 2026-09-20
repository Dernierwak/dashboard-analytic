# Harnais 47 — l'escalade du canal muet

```
cd .scratch/construction/harnais/47-escalade-canal-muet && python3.12 test_escalade.py
```

Ni base, ni secret, ni réseau. Il fait tourner `build_payload` pour de vrai, à
travers le seam du ticket 16, et rend l'email pour de vrai depuis
`emailing/render.py`.

## Ce qu'il prouve

Qu'un rapport sait **depuis combien de rapports publiés d'affilée** un canal est
muet, que ce compte se fait sur la seule preuve qu'on ait, et que la deuxième
semaine change le **registre** de ce qui est dit — pas son volume.

## Pourquoi le compteur ne se lit pas dans `fetch_progress`

Cette table n'a **aucun historique** : une ligne par (utilisateur, canal),
réécrite à chaque passage. Elle ne sait que le dernier. En déduire des semaines
consécutives serait un chiffre fabriqué (`CLAUDE.md` §7).

`weekly_reports` garde une ligne par semaine avec son `canaux_muets`, et le seam
du ticket 16 le sert déjà (`lecteur.rapports_publies`). L'escalade ne coûte donc
**aucune lecture nouvelle, aucune migration, rien à stocker** — le compteur est
recalculé à chaque construction.

## Les deux pièges que le harnais tient

**① Une semaine sans rapport publié ne casse pas la série et ne compte pas.**
Elle a deux causes opposées — un compte sans données, un worker tombé — et
aucune des deux ne dit que le canal est revenu. La traiter comme une guérison
remettrait le compteur à zéro précisément sur les comptes les plus cassés ; la
traiter comme une semaine muette inventerait un fait. C'est
`test_une_semaine_sans_rapport_publie_ne_casse_pas_la_serie` qui le tient, et
c'est pour ça que `publie()` prend un **rang de semaine**, pas une suite.

**② Un payload d'avant le ticket 20 arrête le compte au lieu de l'inventer.**
Il n'a pas la clé `canaux_muets` : il ne dit pas « aucun trou », il dit « je ne
sais pas répondre ». La série est alors **sous-estimée, jamais surestimée** —
c'est le seul sens où se tromper est permis.

## Le piège que la revue de code a trouvé, et que trois tests tiennent

Toujours le même, à trois endroits : **une phrase écrite pour UN canal,
appliquée à la LISTE.** Deux canaux peuvent avoir deux âges — Google tombé
lundi, Meta mort depuis deux mois — et `canaux_muets` est trié par clé de canal
(« google » avant « meta »), donc **celui qui a déclenché l'escalade n'est
presque jamais le premier de la liste**.

L'email prenait « la » date de la liste : une panne de sept semaines s'affichait
datée du jour où l'autre canal était tombé — une durée **mesurée, affichée
fausse, et raccourcie de six semaines**. Le bandeau web promouvait de même le
`>= 2` d'un canal en titre sur l'ensemble, pendant que sa propre liste, plus
bas, disait le contraire. Et la run rouge annonçait « le client a déjà été
prévenu » sur les canaux à `chiffres_tus` faux — c'est-à-dire précisément ceux
dont le client n'a jamais entendu parler.

C'est `deux_ages()` qui grée le cas, et les trois tests de la section 5 bis plus
`test_la_run_ne_dit_pas_que_le_client_a_ete_prevenu_quand_il_ne_l_a_pas_ete` qui
le tiennent.

## L'asymétrie entre les deux destinataires, et pourquoi elle est testée

Le client ne voit que les canaux avec `chiffres_tus: true` — alarmer sur un
canal qui ne lui cache rien userait l'alarme. David les voit **tous** : un
Google Ads mort depuis cinq semaines sur un compte 100 % organique ne cache rien
aujourd'hui et cassera tout le jour où ce client lancera sa première campagne.
Deux tests la tiennent des deux côtés, parce qu'une seule des deux moitiés
passerait aussi bien si on filtrait partout pareil.

## Ce qu'il ne couvre pas

**La sortie en rouge elle-même.** Le harnais vérifie ce que
`_note_canaux_qui_durent` retient ; le `sys.exit(1)` et le texte imprimé vivent
dans le `__main__` de `fetch_all.py`, qui ne se rejoue pas hors ligne. Ce qui
n'est pas vérifié ici, c'est donc : que la ligne s'imprime bien, et qu'une panne
de migration (`_ECRITURES_SAUTEES`) et une panne qui dure tombent toutes les
deux sans se masquer.

**Les canaux hors pub.** `canaux_muets` ne porte que `meta` et `google`
(`_PUB_MUETTE`, ticket 20) : un Instagram ou un GA4 muet n'y entre pas, donc
n'escalade pas. C'est le périmètre du ticket 20, pas une décision de celui-ci.
