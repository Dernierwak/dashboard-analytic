# 03: La couverture par source et par flux

**What to build:** Pulse sait jusqu'à quelle date chaque flux de chaque
source a été récolté **sans trou** — insights, journal des changements,
posts. C'est ce qui distingue une semaine sans diffusion (vrai 0) d'une
semaine non récoltée (« — »). Ni les lignes d'insights (Meta n'écrit rien
un jour sans diffusion) ni l'état de reprise de la récolte (remis à zéro à
chaque passage, `fini` même avec des tranches refusées) ne le disent.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — La récolte, à construire d'abord
(point 2), Le payload (état d'une source) ; ticket 14 de la carte, §3 et
§7 point 2.

- [ ] Une petite table créée **par ajout seul** (`CREATE TABLE IF NOT
      EXISTS`, aucun `DROP`, `DELETE` ni `TRUNCATE`), ajoutée au schéma ;
      ses colonnes se fixent ici. **Faire valider la migration par David
      avant de l'appliquer.**
- [ ] RLS : le client lit sa propre couverture, jamais celle d'un autre.
- [ ] La date « sans trou jusqu'au » n'avance que si le flux a rendu sans
      tranche refusée ; elle survit aux passages suivants (un passage raté
      ne la recule pas).
- [ ] L'échec de la récolte du journal, aujourd'hui imprimé puis avalé,
      empêche l'écriture de sa couverture.
- [ ] `python3.12 -m py_compile` sur ce qui est touché.
- [ ] Vérifié **après un passage du worker** (`force`) : une ligne par
      source connectée et par flux, à la bonne date.
