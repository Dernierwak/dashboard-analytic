# Le carnet : un module unique posé partout — et `preuve` meurt

Type: task
Status: open
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
