# 06: Le premier passage d'un compte

**What to build:** quand un compte Instagram n'a encore aucun jour en base,
le passage remonte 90 jours de portée et d'interactions et **la courbe des
abonnés sur 30 jours** (total d'un jour passé = total du jour − gagnés +
perdus des jours suivants), arrêtée au premier jour manquant.

Spec : § La récolte — Ce qui s'ajoute, « Au premier passage d'un compte » ;
§ Ce qu'on ne mesure pas (abonnés au-delà de 30 jours).

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] 90 jours de portée (1 appel) et d'interactions (~90 appels).
- [ ] Remontée de 30 jours jour par jour ; un jour manquant arrête la courbe
      là, rien n'est interpolé.
- [ ] Harnais : la remontée sur un cas écrit à la main, et son arrêt.
- [ ] Dit dans la réponse : la remontée n'a jamais été essayée avec un vrai
      jeton (vérifiée au premier passage du worker).
