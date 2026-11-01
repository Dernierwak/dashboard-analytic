# 09: La fin d'une campagne Google supprimée

**What to build:** une campagne Google supprimée finit dans la frise à la
date de sa suppression, lue dans un champ structuré du journal — jamais
dans la phrase de résumé. Faute de date, elle finit à son dernier jour
de dépense, sinon à un repère au début. Aucune supprimée n'entre en 2026
aujourd'hui : le repli du ticket 07 suffit au lancement, ce ticket rend
la règle juste pour la suite.

**Blocked by:** 07 (la frise des campagnes)

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — La récolte, à construire d'abord
(point 4), Le payload (fin d'une campagne Google supprimée) ; ticket 17 de
la carte.

- [ ] La récolte du journal Google écrit, pour un changement de statut de
      campagne, l'ancien et le nouveau statut dans la colonne de données
      structurées du journal (elle existe, vide pour Google : **aucune
      migration**), forme `{"statut": {"avant": "ENABLED", "apres":
      "REMOVED"}}`.
- [ ] Le traitement prend le plus récent `occurred_at` où `apres =
      REMOVED` ; sinon le dernier jour de dépense ; sinon un repère au
      début.
- [ ] Harnais : `REMOVED` passe avant une fin déclarée dépassée ; date
      structurée présente, puis absente (repli).
- [ ] `python3.12 -m py_compile` sur ce qui est touché.
- [ ] Vérifié après un passage du worker **avec `force`** : les
      changements de statut Google récoltés portent le statut structuré.
