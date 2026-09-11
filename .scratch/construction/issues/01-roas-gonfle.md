# Le ROAS gonflé : un revenu deux régies divisé par une dépense Meta seule

Type: task
Status: resolved

## Question

**Un chiffre faux est à l'écran aujourd'hui, et il fausse des Verdicts.**
Tranché par [24](../../refonte/issues/24-conseils-payants-manquants.md), qui l'a
mesuré : *« passe avant tout le reste »*.

`_kpis_window` (`saas/traitement/build_report.py` l. 3344-3351) divise un revenu
**Meta + Google** par une dépense **Meta seule**. Tout thème qui tourne sur les
deux régies affiche donc un ROAS gonflé — et comme le Verdict d'une action se
rend sur ce chiffre, **le verdict est faux dans le même sens**.

C'est le premier ticket de la carte parce qu'il ne dépend de rien, qu'il est
petit, et qu'il ment tant qu'il n'est pas fait.

### Ce qu'il faut faire

- Lire `_kpis_window` en entier avant de toucher quoi que ce soit, et vérifier
  à la ligne **quelles sources composent le numérateur et le dénominateur**.
  Le relevé de 24 est un point de départ, pas une dispense.
- Rendre les deux cohérents. **Ce n'est pas forcément « ajouter Google au
  dénominateur »** : c'est une règle d'attribution, et
  [`docs/mesures-impossibles.md`](../../../docs/mesures-impossibles.md) rappelle
  que le ROAS par canal est **une décision, pas une donnée manquante**, depuis
  que `ga4_insights` porte `campaign`. Si les deux lectures se défendent, la
  question monte à David au lieu d'être tranchée dans le code.
- Vérifier l'effet sur les Verdicts déjà rendus. **Un Verdict déjà rendu ne se
  recalcule pas** ([17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md)) :
  il jugeait une action sur le périmètre qui existait alors. Donc on corrige le
  calcul **sans** rejouer l'historique — et si ça se voit, on l'écrit.
- Commenter le POURQUOI avec la mesure qui a tranché, jamais ce que le code fait.

### Ce qui n'est PAS dans ce ticket

Le regroupement par thème qui descend en vue SQL — c'est le ticket **04**.
Ici on répare une division, on ne déplace rien.

### Consigne de repli

Si la lecture du code montre que la correction n'est pas une division mais une
règle d'attribution à choisir, **rendre l'analyse et s'arrêter là**. Écrire une
règle d'attribution en douce serait exactement le chiffre fabriqué que §7
interdit.

## Answer

**Réparé, et sans choisir de règle d'attribution neuve.**

### Ce que la lecture ligne à ligne a confirmé

Le relevé de 24 est exact. Dans `_kpis_window`, `spend` et `cpc` ne lisaient que
`df_meta_raw` ; `roas` divisait ce `spend` par `_rev`, qui vient de
`by_campaign` (GA4) filtré sur `name2label` — or `name2label`
(`build_report.py` l. 2078-2084) est construit à partir de `meta_cfg` **et** de
`goog_cfg`. Le numérateur couvrait donc les deux régies, le dénominateur une
seule : revenu(Meta+Google) ÷ dépense(Meta). Sans thème, même écart au niveau du
compte — `paid_revenue` couvre tout le payant, la dépense n'était que Meta.

### Pourquoi additionner n'est pas une décision produit

`docs/mesures-impossibles.md` interdit de **séparer** un ROAS par canal sans
décision de David. Ici on ne sépare rien, on **répare une somme incomplète**, et
la somme est déjà la convention du rapport, vérifiée avant d'être invoquée :

- `build_matrix` (`saas/recos_ia/insights.py` l. 70-113, 205-266) empile les
  campagnes Meta et Google dans une même liste, cumule `t["spend"]` par thème
  sans distinguer la régie, et calcule `t["roas"] = revenue / spend` dessus.
  C'est exactement le chiffre que le rapport affiche déjà par thème.
- `_pub_fenetre` (ex-`_pub_theme`, l. 2600) portait déjà la raison écrite :
  on additionne des **dépenses** et des **clics**, deux grandeurs que chaque
  régie mesure elle-même. C'est le **revenu** qu'on ne saurait pas ventiler.

Donc pas de remontée à David : la lecture alternative (garder Meta seul des deux
côtés) aurait au contraire *créé* un ROAS par canal, c'est-à-dire la décision
non prise.

### Le code

- `_pub_theme` → **`_pub_fenetre`**, et `lbl=None` ne filtre plus rien : c'est
  toute la pub du compte sur la fenêtre. Un seul lecteur de dépense payante
  sert maintenant les deux échelles (thème et compte), donc les deux ne peuvent
  plus diverger. Appelants mis à jour : `_semaine_theme`, `_reco_theme_arret`.
- `_kpis_window` lit `_pub_fenetre(theme, …)` pour `spend` et `cpc`. Rien
  d'autre n'a bougé dans la fonction ; on répare une division, on ne déplace
  rien (ticket 04).

### Les Verdicts déjà rendus — non rejoués

Conforme à [17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) :
l'historique n'est pas recalculé. Une action décidée avant la bascule porte une
`baseline` figée en base, prise sur la dépense Meta seule ; lui opposer la
mesure d'aujourd'hui comparerait deux périmètres — et ce faux verdict
repondérerait ensuite les conseils (`_DONE_W`, `saas/recos_ia/reco_engine.py`).

D'où `_BASCULE_PUB` et `_METRICS_PERIMETRE_PUB = ("cpc", "roas")`, sur le modèle
de `_BASCULE_THEME` qui existait déjà pour la bascule compte → thème.

**La bascule est datée du 2026-09-19, pas du jour de la correction** — la revue
de code a trouvé ce piège et il est réel : la seule date que porte une action
est `decided_at`, et `startTracking` (`saas/web/app/actions.ts` l. 84) y écrit
le jour du **clic**, quand `baseline` (l. 83) est recopiée du payload affiché,
donc photographiée au dernier rapport construit — jusqu'à une semaine plus tôt.
Sans marge, un clic du 13 sur un rapport du 8 aurait porté une baseline Meta
seule tout en passant le test. Coût assumé : les actions décidées pendant la
semaine de transition partent sans verdict automatique, même celles dont la
baseline était déjà bonne.

**Limite qui reste, écrite dans le code** : si aucun rapport n'est construit
pendant plus d'une semaine, un payload plus vieux que la marge survit à l'écran
et son clic repasse le test. Aucune colonne de `suivi_actions` ne dit sur quel
périmètre sa baseline a été prise — la réparer demande une colonne, pas une
constante. Pas fait ici : ce ticket répare une division. Les actions concernées retombent dans « échéance atteinte, à
juger soi-même », comme une action dont l'indicateur n'est pas mesurable. Le
garde est posé aux **deux** endroits qui comparent une baseline stockée à une
mesure du jour (l. 3820 et l. 3920), pas seulement au premier.

Les autres verdicts ne sont pas concernés : la boucle `outcomes` (l. 3434-3437)
et `_jugement_theme` (l. 3487) **recalculent** leur « avant » et leur
« maintenant » par deux appels à `_kpis_window` — même code, donc même
périmètre des deux côtés.

**Ce qui se verra** : un ROAS de thème multi-régie baisse à l'écran, un CPC de
compte monte, et quelques actions anciennes cessent d'afficher un verdict
automatique. Aucun chiffre n'a été effacé ni réécrit en base.

### Effet de bord réglé

Le commentaire de `PROOF_KPI` sur les `veille_theme_…` invoquait cet écart de
périmètre comme **seconde** raison de les laisser sans baseline. Cette
raison-là a expiré aujourd'hui ; le commentaire le dit. La première tient
toujours — une veille n'a pas de verdict à mériter — et c'est elle qui les
garde là. Leur donner une baseline maintenant serait un changement de produit,
pas une conséquence de cette réparation : pas fait.

### Vérification

`python3.12 -m py_compile saas/traitement/build_report.py saas/recos_ia/insights.py`
— vert. `git grep _pub_theme` — aucun reste.

**Pas vérifié sur données réelles** : le calcul ne se voit qu'après un
« ↻ Recharger mes conseils » sur le compte de David. Aucun test automatisé
n'existe encore côté Python (le seam de test de la v1 est le ticket 16).

### Ce que la revue de code a sorti, et qui n'est pas dans ce ticket

Cinq constats. Un m'appartenait — la date de bascule, corrigée ci-dessus. Les
quatre autres sont devenus deux tickets, pas des détours silencieux :

- **[17 · Le verdict « figé » qui se réécrit chaque semaine](17-verdict-persiste-qui-derive.md)**
  — trois défauts du bloc mémoire livré par `cf84957` : le verdict persisté
  dérive au lieu d'être figé, la mémoire se reconstruit en perdant les
  hypothèses non mesurables cette semaine, et le rattrapage de condensation
  n'est pas borné. Le plus grave fait dire à Gemini qu'une hypothèse ratée a
  réussi.
- **[18 · La dépense Google entre par l'identifiant, son revenu par le nom](18-revenu-google-non-rattachable.md)**
  — asymétrie de clé de rattachement, antérieure à 01 et présente aussi dans
  `build_matrix`. Une campagne Google étiquetée mais non rattachable côté GA4
  verse sa dépense sans son revenu : le ROAS du thème est alors écrasé, par le
  même mécanisme que celui réparé ici, à l'envers. **Question à David, pas
  correction en douce** — c'est une règle d'attribution.
