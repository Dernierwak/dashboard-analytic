# Rebrancher le plan de thème : la séquence sans l'IA qui l'alimentait

Type: task
Status: resolved
Blocked by: 01

## Question

**Tranché par [22](../../refonte/issues/22-rebrancher-le-plan-de-theme.md).**
C'est l'un des deux tickets que le plan §3 exigeait de résoudre *avant d'écrire
une ligne* de la v1 — il est résolu, il reste à le bâtir.

Le problème : `theme_plan` était **100 % Gemini** depuis le 27 août 2026, et
[11](../../refonte/issues/11-d-ou-viennent-les-conseils.md) (l. 1470) **l'a rendu
orphelin**. Sans ce ticket, le fil mène à une liste pauvre et on jugerait le
mauvais coupable.

### Les deux prémisses fausses, toutes deux dans le sens de l'allègement

- **La table des leviers par clé existe déjà** — `_LEVIER_REGLE` (l. 290), avec un
  cinquième levier `socle` que `LEVIERS_IA` n'a pas. Sur les **cinq colonnes** à
  donner à une règle — durée · levier · indicateur · geste · preuve — **trois sont
  déjà écrites**.
- **`PROOF_KPI` duplique `METRIC_INFO_IA` valeur pour valeur** : le ticket
  **retire dix-sept lignes** au lieu d'en ajouter.

### Le stock réel, mesuré

**Sept conseils, pas douze.** Quatre règles sont des réparations de la mesure ;
une cinquième (`theme_event_cout`) ne demande aucun geste — **c'est un constat**.
Et **six des sept ne parlent qu'à Instagram** : un compte sans Instagram reçoit
**un** conseil par semaine (`roas`). C'est ce trou que le ticket **07** remplit.

### Les décisions à bâtir, telles quelles

- **Les cinq gouvernent.** Le « 2+1 par thème » n'est plus une garantie mais une
  **forme de fabrication** — neuf candidats pour cinq places — et le plafond de
  [14](../../refonte/issues/14-le-conseil-facile-et-la-degradation.md) est un
  filtre **dedans**.
- **Cinq est un plafond, jamais un quota.** Une semaine à deux conseils est
  honnête. **On ne complète pas.**
- **Une table par clé pour le geste et la preuve, mais c'est la RÈGLE qui
  déclare** — `roas` écrit quatre gestes selon le chiffre du jour, et découper sa
  clé **effacerait l'historique des retours**.
- **Pas de sixième geste « vérifier »**, d'où le critère d'entrée : **un conseil
  sans geste est un constat**.
- **Gemini écrit l'échelle des Marches** — mais **seulement la Marche SUIVANTE**
  d'une Stratégie ouverte par une règle, en **listes fermées**, sur un objet
  **présent dans les faits**.
- **Plus rien n'entre au carnet sans un clic.** L'entrée automatique meurt : un
  Verdict sur un geste que personne n'a confirmé attribue un mouvement de chiffres
  à une action qui n'a peut-être jamais eu lieu (§7). `theme_plan` **reste écrit à
  la publication** — c'est la mémoire de Pulse, pas le carnet du client — et
  **l'échéance du Verdict part du clic**.
- **Une Stratégie n'est PAS un objet en base** : zéro table, zéro migration.

### Le vocabulaire

`CONTEXT.md` gagne **Geste** ; **Action suivie**, **Hypothèse** et **Verdict**
sont corrigées par la fin de l'entrée automatique. À faire dans le même passage,
pas « plus tard ».

### Consigne de repli

Livrer les cinq colonnes et la fin de l'entrée automatique, **sans** la Marche
suivante écrite par Gemini, plutôt que les deux à moitié. La partie déterministe
est vérifiable seule ; la partie IA ne l'est pas sans elle.

## Answer

### Les deux prémisses du ticket se sont vérifiées, et les deux allègent

`_LEVIER_REGLE` (l. 290) et `EFFORT_BY_KEY` (l. 85) existaient bien : **le levier
et la durée étaient écrits, mais personne ne les posait sur une reco-règle.**
C'est ça, la panne exacte — `_attach_effort` posait la durée, aucun poseur ne
posait le levier, et `upsert_theme_plan` recevait donc `levier=None`, ce qui
faisait retomber `FENETRE_LEVIER` sur son défaut de 14 jours pour tout le monde.

`PROOF_KPI` dupliquait bien `METRIC_INFO_IA` valeur pour valeur : **dix-sept
lignes retirées**, zéro valeur changée — c'est ce que
`test_indicateur_sans_proof_kpi.py` prouve, en recopiant la table d'avant et en
comparant cinq-uplet par cinq-uplet.

### Ce qui a été bâti

**1 · Les cinq colonnes, et un seul poseur.** `_attach_grammaire` pose le levier,
le geste et la preuve ; `_attach_effort` la durée ; `_attach_metric`
l'indicateur — ce dernier ne lit plus qu'une source (`_METRIC_REGLE` +
`_spec_mesure`), le chemin règle et le chemin IA ayant fusionné.

**2 · La table est un défaut, la règle déclare.** `_GESTE_REGLE` porte neuf clés
à geste invariable. `roas` et `gaspillage` en sont **absents exprès** : ils
écrivent plusieurs gestes selon le chiffre du jour, et les déclarent branche par
branche dans `_reco()`. Mesuré sur les vraies règles : `roas` écrit **augmenter /
couper / couper / corriger / corriger** sous une seule clé — la découper aurait
effacé l'historique de `reco_feedback`.

**3 · Un conseil sans geste est un constat, et il n'est jamais servi.**
`_est_conseil` applique le critère, et le filtre passe **avant** la coupe à trois
(sinon un constat prenait une place et la carte tombait à deux). Deux circuits
restent dehors et ce sont les deux prévus : la **veille** (l'absence de geste est
tout son contenu) et le **socle** (prérequis de mesure — tant qu'on ne sait pas
si le tag marche, il n'y a rien à arbitrer). **Pas de sixième geste « vérifier »** :
la branche « zéro conversion » de `roas`, qui commence par *« vérifie le
tracking »*, déclare `corriger` — vérifier est le premier pas d'une correction,
pas un geste à part.

**4 · L'entrée automatique est morte.** Plus aucune écriture `status="auto"`,
plus aucune lecture de ces lignes, `due = status == "done"`. Le point d'étape à
sept jours ne part plus que de `done_at`. **`theme_plan` continue de s'écrire à
la publication** — c'est la mémoire de Pulse, pas le carnet du client — et
l'échéance du Verdict part du clic, comme `resolveAction` le faisait déjà.

**5 · La mémoire d'un thème a changé de source, sinon elle mourait en silence.**
Elle se nourrissait de `detail.origin == "auto"`, c'est-à-dire de l'écriture
qu'on vient de tuer ; sans rien, `condense_theme_memoire` n'aurait plus jamais
tourné et `theme_plan.resume` aurait gelé. Elle lit maintenant **les actions que
le client a confirmées et dont un verdict est tombé** — la même mémoire, sur une
matière plus sûre : ce qui n'a pas été fait ne raconte rien. Conséquence côté
web : `startTracking` emporte le **levier** dans son `detail`, sinon la mémoire
n'aurait plus vu que des « levier inconnu » (le déduire de l'indicateur serait un
chiffre fabriqué, §7).

**6 · Un libellé corrigé, découvert en chemin.** `reco-card.tsx` choisissait
« Avant d'agir » / « À constater demain » sur la **présence** d'un `role`. Une
reco-règle en portant un désormais, son `verifier` — qui est réellement une
précondition — se serait retrouvé étiqueté « À constater demain ». Le test porte
maintenant sur `r.source`, l'auteur du texte.

### Le vocabulaire : rien à faire, c'était déjà écrit

`CONTEXT.md` porte déjà **Geste** (« cinq valeurs, pas une de plus », « un conseil
sans Geste n'est pas un conseil, c'est un constat »), et **Action suivie**,
**Hypothèse** et **Verdict** y disent déjà « d'un clic seulement », « que si le
client l'a prise », « depuis le jour où le client a dit l'avoir fait ». Vérifié
ligne à ligne, aucune mention de l'entrée automatique n'y subsiste.

### Le repli est appliqué, et pour une raison mesurée

**La Marche suivante écrite par Gemini n'est pas dans ce ticket** →
[24](24-marche-suivante-ecrite-par-gemini.md). Ce n'est pas qu'un choix de
prudence : après ce ticket, **les seules règles qui ouvrent une Stratégie sont
`orga_essoufflement` et `page_endormie`** — les deux seules dont la preuve est
« à mesurer », les deux organiques. Un compte sans Instagram n'ouvre aucune
Stratégie, donc Gemini n'aurait **aucune** Marche à écrire. C'est 07 et 10 qui lui
donneront de la matière, et 08 qui coupera d'abord les pistes libres.

### Ce que David verra bouger

- **Un thème qui ne passe pas par Gemini peut maintenant porter une Hypothèse**
  et donc ouvrir une Stratégie : `theme_plan` se remplit sur le chemin règles,
  ce qu'il ne faisait plus depuis le 27 août 2026.
- **`theme_event_cout` disparaît des cartes de thème.** C'est un constat (il
  demande de comparer un coût à sa marge), et sa place est parmi les constats —
  c'est le ticket **09** qui la lui donne dans `insights.py`. **Entre les deux,
  ce conseil n'est visible nulle part**, et c'est la seule perte d'affichage de
  ce ticket.
- **Plus aucune carte « suivie automatiquement »**, et plus aucun verdict rendu
  sur un geste que personne n'a confirmé.
- Une correction du traitement **ne se voit qu'après un « ↻ Recharger mes
  conseils »**.

### Vérifications

- **257 vérifications** passent, cinq fichiers, aucune base ni secret :
  `.scratch/construction/harnais/06-plan-de-theme/` (son `LISEZMOI.md` dit quoi
  et comment le rejouer).
- `python3.12 -m py_compile` vert sur `build_report.py` et `reco_engine.py`.
- `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` **vert** et
  `npm run build` **vert à 19 routes**.

**Ce qui n'a PAS pu être vérifié, et il faut le dire :** `build_payload` n'a pas
tourné. Elle prend un client Supabase vivant et va chercher ses données
elle-même — la rendre appelable hors ligne est le ticket **16**. L'assemblage du
payload (le filtre appliqué à une vraie liste de recos, l'écriture de
`theme_plan` sur un vrai thème, la mémoire qui se renourrit) n'est donc vérifié
que par lecture et par un test de texte source, qui le dit en tête de fichier.
**Aucune ligne `suivi_actions` n'a été lue, comptée ni effacée en base.**

### Ce qui sort en ticket

- [24 · La Marche suivante écrite par Gemini](24-marche-suivante-ecrite-par-gemini.md)
  — la moitié IA, bloquée par 08 et 10 pour la raison mesurée ci-dessus.
- [25 · Le statut `auto` et ses branches inertes](25-le-statut-auto-et-ses-branches-inertes.md)
  — six fichiers web gèrent encore un statut qui n'arrive plus, et des lignes
  orphelines dorment en base sans que personne les ait comptées.
