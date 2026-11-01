# 02: Le jeton mort marqué par la récolte

**What to build:** quand le jeton Meta ou Google d'un client est mort, la
récolte le marque au lieu d'échouer en silence. C'est la seule erreur que
le client verra (ticket 13 de la carte) : elle doit donc être détectée par
nous, pas devinée. La vérification du jeton existe pour les deux
plateformes, mais aucun code ne l'appelle.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Références :** [spec](../spec.md) — La récolte, à construire d'abord
(point 1) ; ticket 14 de la carte, §7 point 1.

- [ ] La vérification du jeton est appelée dans le plan de récolte, pour
      Meta et pour Google, avant de récolter le canal.
- [ ] Jeton mort → la date « à reconnecter depuis » est posée si elle est
      absente (`coalesce`, jamais écrasée), la raison est écrite, et le
      canal est sauté.
- [ ] Jeton dont l'état est inconnu (erreur réseau, réponse ambiguë) → rien
      n'est marqué.
- [ ] Un message d'erreur nomme la variable ou le canal, jamais un jeton.
- [ ] `python3.12 -m py_compile` sur ce qui est touché.
- [ ] Vérifié **après un passage du worker** lancé à la main
      (`weekly-fetch.yml`, `force`) : un compte au jeton valide n'est pas
      marqué.

## Réponse (2026-11-01)

`execution_plan.planifier` décide (mort → marquer et sauter, inconnu → rien) ; `account_sync.verifier_jetons` appelle les vérifications existantes ; `source_data/account.marquer_a_reconnecter` pose la date si vide (jamais écrasée). Harnais 02. **Préalable** : `META_APP_ID` et `META_APP_SECRET` absents de `weekly-fetch.yml` — sans eux le jeton Meta reste « inconnu ».

Vérifié hors ligne sur la branche d'intégration `worktree-hebdo-carte` (870963f) : les 13 harnais de `.scratch/hebdo/harnais/` et les `rendu.js` 07/08 tiennent, `py_compile`, `tsc` et `build` verts, 18 routes. **Pas vu en ligne** : le contrôle après passage du worker est le ticket 11.
