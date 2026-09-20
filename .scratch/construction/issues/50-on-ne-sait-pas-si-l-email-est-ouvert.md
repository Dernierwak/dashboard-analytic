# On ne sait pas si l'email hebdo est ouvert

Type: task
Status: open

## Question

**Né de la réalisation de [47](47-un-canal-muet-deux-semaines-de-suite.md).**

Tout l'arbitrage du 47 — alerter David plutôt que réécrire au client — repose
sur une phrase qu'on ne peut pas vérifier : « le client a déjà été prévenu ». Il
a été prévenu dans un rapport et dans un email. **On ne sait pas s'il les a
ouverts.**

La différence commande la suite :

- si l'email est **ouvert et ignoré**, le problème est la friction du parcours
  de reconnexion (ticket [49](49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md)) ;
- si l'email n'est **pas ouvert**, un email dédié — celui que le 47 a écarté —
  redevient légitime, parce qu'il change alors vraiment quelque chose.

`saas/emailing/send.py` passe par Resend, qui remonte les événements de
délivrance et d'ouverture. C'est le fait le moins cher à acquérir de tout ce
dossier, et le seul qui départage les deux hypothèses.

### Ce qu'il faudrait décider

- Par webhook Resend, ou par lecture de leur API au passage suivant du worker ?
  Le worker ne tourne qu'une fois par semaine, ce qui suffit largement ici.
- Où ranger le fait — une table, ou une colonne sur le rapport de la semaine ?
- **Ce qu'on n'en fait PAS** : un taux d'ouverture affiché au client, ou un
  quelconque chiffre de « performance Pulse » dans son rapport. C'est une mesure
  d'exploitation, pas une information produit.
- Une ouverture d'email n'est pas une mesure fiable (pixel bloqué, prévisualisation
  qui compte comme une ouverture). **Une non-ouverture ne prouve donc rien**, et
  ce qu'on en déduit doit être écrit avant d'être invoqué — candidat pour
  `docs/mesures-impossibles.md`.
