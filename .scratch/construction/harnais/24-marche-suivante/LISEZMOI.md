# Harnais du ticket 24 — la Marche suivante écrite par Gemini

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune. Ce
dossier est ce qui a servi à vérifier le ticket
[24](../../issues/24-marche-suivante-ecrite-par-gemini.md), gardé pour qu'il
soit rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau, ni clé Gemini** : le
seul point d'entrée du modèle est `redige(prompt) -> str|None`, et on lui fait
rendre ce qu'on veut.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_les_trois_barrieres.py` | Le **module** seul, 111 vérifications. **Barrière 1** : pas de Marche faite → **aucun appel IA payé** ; `role="hypothese"` rejeté *alors qu'il est dans la liste fermée*. **Barrière 2** : chacune des cinq colonnes (`nature`, `role`, `levier`, `metric`, `effort`) hors liste — ou absente — fait tomber la piste **entière** ; les cinq textes de la carte sont obligatoires. **Barrière 3** : seuls les `nom` des `facts` sont nommables (un créneau, une régie, un agrégat ne le sont pas), une cible inventée tombe, et une graphie approchée est **ramenée au nom de la base** parce que la cible entre dans l'empreinte. Plus : la clé porte l'**étape** et pas la stratégie (sinon l'échelle s'arrête à sa première marche), le prompt **ne contient aucun chiffre du compte**, il interdit d'en écrire un et d'affirmer quoi que ce soit sur ce que l'étape précédente a donné, et `repere` — la pastille chiffrée — n'est même pas un champ que Gemini peut remplir. |
| `test_branchement_de_la_marche.py` | Le **rapport entier, exécuté** via le seam du ticket 16, 60 vérifications. Sans plan de thème, sans clic « ✓ Je l'ai fait », sur une ligne `running`, sur une ligne `done` sans `done_at`, ou sur une Stratégie ouverte par une vieille piste `ai_` : **Gemini n'est pas appelé du tout**. Quand les deux conditions sont réunies, la Marche **sort sur la carte du thème**, sa grammaire déclarée **traverse intacte** (`_attach_grammaire` et `_attach_effort` ne l'écrasent pas), son canal vient du `snapshot` de la Stratégie, et son indicateur reçoit une **baseline mesurée** par `_attach_metric`. Une piste hors liste est appelée puis **jetée sans rien laisser**. Une panne de Gemini retire la carte, jamais le rapport. Une **Note cochée** ne fait avancer aucune Stratégie (elle n'en a jamais ouvert une), mais elle ne masque pas une vraie Marche faite à côté d'elle. Un **vieux clic ne refait pas avancer chaque semaine** : la borne est le `week_start` du dernier rapport publié, et sans rapport publié tout clic est nouveau. Et la vérification qui compte le plus : **rien n'entre dans `theme_plan`** — lu sur les écritures réellement tentées par la construction, pas supposé. |

Total : **171 vérifications** (111 + 60), plus les **2 000+** des harnais 04 à 43 rejouées
sans régression (`python3.12 ../jouer_tout.py`).

## Ce qu'il ne prouve pas

- **La qualité de ce que Gemini écrit.** Le faux `redige` rend un JSON qu'on a
  écrit nous-mêmes : le harnais prouve ce qui est **accepté** et ce qui est
  **rejeté**, jamais qu'un vrai modèle produit une étape pertinente. Ça ne se
  verra qu'au premier passage du worker sur un compte qui a une Stratégie
  ouverte et une Marche confirmée faite.
- **Que le cas se produise.** Sur le compte de production, il faut une règle qui
  pose une Hypothèse (`orga_essoufflement`, `page_endormie`, `adset_inegal`,
  `theme_deux_regies`) **et** un clic « ✓ Je l'ai fait » dessus. Tant que ces
  deux-là ne se rencontrent pas, ce code ne tourne jamais — c'est voulu, c'est
  la barrière 1.

## Le jouer

```sh
cd .scratch/construction/harnais/24-marche-suivante
python3.12 test_les_trois_barrieres.py
python3.12 test_branchement_de_la_marche.py
```

Ou tout le dépôt d'un coup : `python3.12 .scratch/construction/harnais/jouer_tout.py`
