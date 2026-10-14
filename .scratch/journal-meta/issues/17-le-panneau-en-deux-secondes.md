# 17: Le panneau qui met deux secondes à s'ouvrir

Type: task
Status: ready-for-agent
Blocked by: 16
Spec : [14](14-spec-le-journal-meta.md), Further Notes.

## What to build

En local, le panneau du journal met environ deux secondes à s'ouvrir après un
clic sur un point (ticket 13). Le ticket mesure ce délai en production, avec
les vraies données. Si la lenteur se confirme, il en trouve la cause et la
corrige, pour que le panneau s'ouvre sans attente perceptible.

L'état du panneau (jour, élément) vit dans l'URL, et ça ne se négocie pas
(histoire 36) : la correction garde le lien partagé et le retour arrière.

## Acceptance criteria

- [ ] Le temps entre le clic et le panneau ouvert est mesuré sur `/meta` en
      production, sur au moins trois ouvertures. Les chiffres sont écrits
      dans la réponse.
- [ ] Si le délai est imperceptible, le ticket se ferme avec la mesure,
      sans rien changer au code.
- [ ] Sinon, la cause est nommée avec sa preuve (requête réseau, rendu
      serveur, volume lu…), et non supposée. La correction est mesurée
      avant/après sur la même page.
- [ ] Après correction : le panneau ouvert reste dans l'URL, un lien
      partagé ou un retour arrière rouvre le même jour et le même élément,
      et un second clic sur l'onglet actif referme le panneau.
- [ ] `tsc` et `build` verts sur un `.next` vidé, 18 routes.
