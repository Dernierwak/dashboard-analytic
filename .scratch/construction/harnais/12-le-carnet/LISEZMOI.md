# Harnais du ticket 12 — le carnet, et la mort de `preuve`

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — **il est ouvert depuis le
2026-09-13**, et son harnais est
[16-le-seam-du-payload](../16-le-seam-du-payload/). Ce
dossier est ce qui a servi à vérifier le ticket 12, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau**.

```bash
cd .scratch/construction/harnais/12-le-carnet
python3.12 test_preuve_est_morte.py
python3.12 test_note_dans_la_memoire.py
python3.12 test_carnet_web.py
```

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_preuve_est_morte.py` | Le moteur de preuve compte-entier n'existe plus : `preuve` n'est plus une clé du payload (lu sur l'**arbre**, pas au grep — le mot survit exprès dans les pierres tombales), `fetch_reco_decisions` n'est plus définie ni importée, `ProofOutcome` a quitté `report.ts`, et les trois pierres tombales nomment le ticket. **Et la relève est intacte** : `_METRIC_REGLE`, `_spec_mesure`, `_kpis_window`, `cur_kpis` et l'écriture de `suivi_actions.verdict` sont toujours là — sans cette écriture il n'y aurait plus rien à compter. Supprimer sans vérifier la relève retirerait la réponse au lieu d'unifier les moteurs (leçon du harnais 09). |
| `test_note_dans_la_memoire.py` | Une note entre dans la mémoire du thème et **jamais** dans le repondérage : elle arrive telle quelle dans le prompt, nommée « faits déclarés », sans indicateur ni verdict, et la ligne qui l'écrit n'a **pas de place** pour en porter un. Aucun nombre des lignes de données n'est absent de l'entrée. Un thème qui n'a que des notes déclenche quand même une condensation et le prompt **écrit** qu'aucune hypothèse n'y a été testée. Côté worker : la boucle de verdict lit toujours `status IN ('running','done')` et exclut toujours les notes — la lecture des notes est **séparée**, bornée, et ignore les `running`. |
| `test_carnet_web.py` | Le module est posé sur **cinq** pages et importé d'un seul endroit ; les deux pages payantes lui passent leur régie et la campagne du bandeau, les trois autres n'en inventent pas. L'accueil ne prend que le **bilan** — le rail n'est pas défait, ses deux montages et sa porte d'écriture sont intacts. **Aucun verdict sur une note** (vérifié sur le code, commentaires retirés), **aucune marque rallumée** sur une courbe. L'écran dit ce qu'il ne montre pas (hors contexte, migration absente, fenêtre et périmètre du bilan). Le bilan **compte** et ne dérive aucun taux. L'auteur ne s'invente pas. L'écriture pose `compte.moi` et la paire de campagne, et le repli **refuse** plutôt que de perdre une campagne en silence. `updateNote`/`deleteNote` filtrent sur l'auteur, lisent les lignes touchées, relisent avant de dire pourquoi, et ne nomment personne. |

Total : **176 vérifications** (29 + 45 + 102).

**Rejouées** : les harnais 06 à 10 (302 + 189 + 83 + 108 + 343), tous verts.
Une correction ailleurs : `06-plan-de-theme/test_plus_rien_sans_clic.py` visait
encore `check_at: isoDate(check)`, nom d'avant le ticket 11 — l'assertion ne
prouvait plus rien depuis `618b950`, elle vise maintenant le jour **choisi**
(`plusJours(jourFait, 14)`).

## Ce qu'il ne prouve pas

- **`build_payload` tourne depuis le ticket 16**
  ([16](../16-le-seam-du-payload/LISEZMOI.md)). La mort de `preuve` se
  lit maintenant sur un payload réellement construit — le champ n'y est pas. La
  lecture des notes du thème reste vérifiée sur le texte : le faux lecteur sert
  une liste de notes vide, ce jeu de lignes-là n'a pas encore été gréé.
- **Rien du rendu web.** Ces tests lisent du **texte** TypeScript, ils ne
  l'exécutent pas — aucun runner dans `saas/web`, décision de David. Ce que la
  page rend se vérifie par `npx tsc --noEmit`, `npm run build`, les **19
  routes**, et le fil parcouru à la main.
- **Aucune note n'a été écrite en base.** `author_id`, `campaign_channel` et
  `campaign_key` n'existent pas encore : la migration
  `suivi_actions_auteur_campagne.sql` est écrite et **non jouée**. Le repli qui
  écrit sans elles n'a donc jamais été exercé pour de vrai, ni la règle
  « une note ne s'efface que par son auteur ».
- **Aucun verdict n'a été compté sur de vraies lignes.** Le bilan est un
  comptage `head` sur `suivi_actions.verdict` ; il n'a jamais tourné.
