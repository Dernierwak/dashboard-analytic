# Harnais du ticket 09 — trois moteurs, un seul

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — il n'est pas encore ouvert. Ce
dossier est ce qui a servi à vérifier le ticket 09, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau**.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_moteur_unique.py` | Les deux règles du moteur (`_rule_format_gagnant`, `_rule_creneau`) n'existent plus — ni la fonction, ni leur clé dans les **cinq** tables de grammaire, ni leur mention dans la pondération par constat (`VISION_RULES`, lue sur l'arbre), ni les deux seuils qui ne servaient qu'à elles — **sauf leur indicateur**, gardé en lecture seule pour qu'une décision déjà prise reçoive encore son Verdict (trouvé par la revue de code). **Et la relève sort** : `format_best` et `slot_best` sont toujours produits par `build_constats`, le créneau nommant son jour et son heure. Supprimer sans vérifier la relève retirerait la réponse au lieu d'unifier les moteurs. |
| `test_constats_plateforme.py` | Chaque constat dit **sur quelle page il conclut** : un constat de THÈME n'appartient à aucune plateforme (il traverse les régies et l'organique — ce qu'aucune régie ne sait dire), le format et le créneau sont organiques, la locomotive appartient à sa régie, l'angle mort à aucune. Et la `platform` **ne déplace pas la clé** : le verdict déjà posé par le client continue de s'appliquer. |
| `test_constat_cout.py` | `theme_event_cout` n'est toujours pas un conseil (aucun geste, `_est_conseil` le refuse) mais il n'est plus **jeté** : il devient un constat, avec sa clé stable qui porte le thème **et** l'événement (changer d'événement principal change le chiffre, donc la clé), son angle mort qui voyage avec le chiffre — **jusque dans le brief de Gemini** —, sa fenêtre de sept jours écrite dans son détail (il est le seul du bloc à ne pas porter tout l'historique), et le verdict du client réappliqué. La récolte est lue sur la source : elle précède le filtre qui le jette. |
| `test_le_web_ne_recalcule_plus.py` | Le troisième moteur, celui qui vivait en TypeScript, a disparu de `lib/channels.ts` (`heatmap`, `bestSlot`, `FormatStat`, `SlotCell`, les deux constantes de la heatmap) sans emporter le reste du dashboard (top 3, performance par thème). Les quatre pages affichent le bloc et disent laquelle elles sont ; le rang 4 se lit **après** le rang 3 sur Instagram ; le placement d'un constat vit à **un seul endroit** (`constatsDeLaPage`), aucune page ne le refait dans son coin ; le repli pour les payloads publiés avant la `platform` ne devine que ce qui est certain (jamais la régie d'une campagne) ; un verdict **se retire** (le repli se décide sur la panne de la table, pas sur l'absence d'une ligne — sinon un refus figé dans un rapport publié se réafficherait pour toujours) ; et la promesse de `/labels` dit enfin où les constats se lisent. |

Total : **107 vérifications** (36 + 10 + 20 + 42), plus les **696** des harnais 04
à 08 rejouées (101 + 42 + 282 + 188 + 83). Une seule correction ailleurs : `06-plan-de-theme/
test_indicateur_sans_proof_kpi.py` recopiait `PROOF_KPI` telle qu'elle était
avant le ticket 06, `creneau` et `format_gagnant` comprises. Les deux clés en
sortent — avec, à leur place, la vérification qu'elles ont **vraiment** quitté
`_METRIC_REGLE`, sans quoi les retirer de la recopie suffirait à faire passer le
test en les laissant vivre à moitié dans le code.

## Ce qu'il ne prouve pas

- **`build_payload` n'a pas tourné.** Elle prend un client Supabase vivant : le
  constat de coût n'a jamais été récolté sur un vrai rapport, et `_constat_cout`
  est vérifiée sur un dict écrit à la main. C'est le seam du ticket 16.
- **Rien du rendu web.** `test_le_web_ne_recalcule_plus.py` lit du **texte**
  TypeScript, il ne l'exécute pas — aucun runner dans `saas/web`, décision de
  David. Un test de texte prouve qu'un calcul a disparu et qu'un composant est
  posé ; ce que la page rend se vérifie par `npx tsc --noEmit`, `npm run build`,
  les **19 routes**, et le fil parcouru à la main.
- **Aucun verdict n'a été cliqué en base.** `ConstatVerdict` appelle une server
  action qui existait déjà (`saveInsightFeedback`) et qui n'a jamais servi non
  plus, faute d'écran pour l'appeler.

## Le jouer

```sh
cd .scratch/construction/harnais/09-trois-moteurs
python3.12 test_moteur_unique.py
python3.12 test_constats_plateforme.py
python3.12 test_constat_cout.py
python3.12 test_le_web_ne_recalcule_plus.py
```
