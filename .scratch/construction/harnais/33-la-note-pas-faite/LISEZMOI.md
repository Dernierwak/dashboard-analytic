# Harnais du ticket 33 — une note pas encore faite ne marque plus la frise

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune. Ce dossier
est ce qui a servi à vérifier le ticket
[33](../../issues/33-une-note-pas-encore-faite-marque-la-frise.md), gardé pour
qu'il soit rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau** — il construit un
payload avec le faux lecteur du ticket 16, qu'il importe au lieu de le recopier.

```bash
cd .scratch/construction/harnais/33-la-note-pas-faite
python3.12 test_note_pas_faite.py
```

## Ce qu'il vérifie

**17 vérifications**, toutes sur un payload réellement construit par
`build_payload` — jamais sur le texte du filtre.

| Ce qu'on donne à lire | Ce qui doit sortir |
|---|---|
| Une Note `running` (ce que `saveNoteOuverte` écrit) | **Aucun repère**, ni sur la frise du thème (`themes_focus[].series.marqueurs`) ni sur la courbe de la boussole (`kpi_focus.marqueurs`) — les deux lectures du même dict `_markers` |
| La **même** note, cochée | Le repère revient — c'est la preuve que le test d'au-dessus mesure le filtre et non une frise absente |
| Une note cochée dont le jour choisi ≠ le jour de frappe | Le repère porte le **jour choisi**, celui que le cochage a réécrit dans `decided_at` |
| Une hypothèse ordinaire `running` | **Garde** son repère : son `decided_at` est une vraie décision, et il ne sera pas réécrit |
| Une hypothèse `auto` sans `done_at` | Reste exclue (garde du ticket 06, intact) |
| Une hypothèse `auto` **avec** `done_at` | Garde son repère (l'autre moitié du même garde) |
| Une note `running` **à côté** d'une action décidée | L'action survit — le piège du ticket : un filtre posé dans la requête aurait fait lever l'`except` sur une base sans colonne `kind` et vidé **tous** les repères en silence |

Chaque ligne écartée est rejouée en version admise, **même thème** : seul le
cochage change. Sans ça, un vert ne dirait pas si le filtre marche ou si la date
tombait hors des dix semaines.

**LE COCHAGE EST CELUI DU VRAI CODE, PAS CELUI QU'ON IMAGINE.** La première
version de ce harnais modélisait une note cochée par `status: "done"` + un
`done_at` — un état que rien ne produit. `completeNote`
(`saas/web/app/actions.ts` l. 635) écrit en réalité
`{ status: "archived", decided_at: quand, check_at: quand }` : pas de `done`,
**aucun** `done_at`, et c'est `decided_at` lui-même qui est RÉÉCRIT au jour
choisi. Le repère d'une note cochée vient donc du `decided_at`, jamais de la
branche `done_at` de `build_report.py`. Relevé par la revue, puis vérifié dans
la source — le correctif tenait dans les deux cas, mais le harnais, lui,
documentait un mécanisme faux.

**Avant le correctif** : 12/17 — les cinq échecs étaient exactement les
assertions « une note `running` ne marque rien ».

## Ce qu'il ne prouve pas

- **Rien du rendu web.** Le ▲ lui-même se regarde à l'œil ; ici on ne vérifie
  que ce que le payload porte.
- **Aucune note n'a été écrite en base.** La colonne `kind` n'existe que dans
  les lignes fixes du harnais. Le repli « base où la migration n'est pas jouée »
  est couvert par construction — le filtre est en Python, après la lecture — mais
  il n'a pas été exercé contre un vrai PostgREST.
- **Rejeu du reste** : `jouer_tout.py` passe partout, sauf les deux harnais de
  `31-la-cible-des-regles`, **déjà en échec avant ce ticket** (travail en cours,
  non commité, sur `reco_engine.py` / `regles_payantes.py` — vérifié en
  neutralisant le filtre de ce ticket : échecs identiques).
