# Trois moteurs, deux langages, trois jeux de seuils : `insights.py` gagne

Type: task
Status: open
Blocked by: 07, 08

## Question

**Tranché par [11](../../refonte/issues/11-d-ou-viennent-les-conseils.md).**

**« Qu'est-ce qui marche chez toi » est calculé TROIS fois**, dans deux langages,
avec trois jeux de seuils qui **peuvent se contredire** :

1. `insights.py` — tout l'historique, **zéro IA**, clés stables… et **jamais
   affiché**.
2. Deux règles de `reco_engine.py` — `format_gagnant`, `creneau`, fenêtre courte.
3. La page `/instagram`, qui **recalcule en TypeScript**.

Le bloc « ce qui marche » et le conseil ne sont pas deux noms du même objet : ce
sont trois moteurs concurrents.

### Les décisions

- **`insights.py` gagne, les deux autres meurent.** Et ça **remplit le rang 4 de
  [07](../../refonte/issues/07-gabarit-de-plateforme.md) sur les trois
  plateformes sans un calcul nouveau**.
- **On arrête tout conseil portant sur une campagne d'une seule régie.**
  ⚠️ **Attention — cette décision a été partiellement renversée par
  [24](../../refonte/issues/24-conseils-payants-manquants.md)** : David y a
  supprimé le critère d'admission, et `gaspillage` et `scaler`, coupés par 11
  pour ce seul motif, sont **réhabilités**. En cas de conflit entre 11 et 24,
  **24 est plus récent et gagne** — mais le dire dans le ticket plutôt que de
  trancher en silence.
- **`/labels` promet au client des constats que RIEN ne rend à l'écran** —
  troisième tuyau mort après `preuve`. Le raccorder fait partie de ce ticket.

### Le piège de fichiers

Ce ticket touche `insights.py`, `reco_engine.py` **et** `/instagram` côté
TypeScript. Il croise le territoire des tickets **06**, **07** et **08** : ne pas
le lancer en parallèle de ceux-là (`CLAUDE.md` §5 — jamais deux agents sur les
mêmes fichiers).

### Consigne de repli

Faire mourir le recalcul TypeScript de `/instagram` en premier — c'est le plus
isolé, et c'est celui qui fait diverger deux langages.
