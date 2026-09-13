# Harnais du ticket 16 — le seam du payload

**C'est le premier harnais du dépôt qui EXÉCUTE `build_payload`.** Les neuf
autres écrivaient tous la même limite, ticket après ticket : *« `build_payload`
n'a pas tourné — elle prend un client Supabase vivant »*. Elle prend maintenant
un **lecteur** (`saas/traitement/lecteur.py`), et un faux lecteur gréé sur des
lignes fixes la fait tourner sans base, sans secret, sans réseau.

Ce n'est toujours **pas une suite de tests installée** : même convention que les
neuf autres dossiers, `python3.12 test_x.py`, rien à installer. Décidé avec
David en ouvrant le ticket.

```bash
cd .scratch/construction/harnais/16-le-seam-du-payload
python3.12 test_le_seam.py
python3.12 test_conseils_du_payload.py
python3.12 test_chiffres_du_payload.py
```

## Les pièces

| Fichier | Ce qu'il est |
|---|---|
| `lecteur_fige.py` | Le faux lecteur, et `compte(campagnes, etoiles=…)` qui grée un compte entier à partir d'une poignée de campagnes décrites. **Tout descend des lignes d'entrée** : les totaux par thème (ce que la vue `theme_regroupement` rendrait) et le contexte GA4 sont calculés ici, jamais posés à la main à côté d'elles. Il **enregistre** les deux écritures (`lecteur.ecrits`) au lieu de les jouer, et rend une IA muette par défaut. |
| `test_le_seam.py` | Que l'injection est complète et qu'elle n'a rien déplacé. |
| `test_conseils_du_payload.py` | Ce que la construction SERT au client. |
| `test_chiffres_du_payload.py` | Ce que la construction CHIFFRE, mesuré contre les lignes d'entrée. |

## Ce qu'il prouve

| Fichier | Ce qu'il prouve |
|---|---|
| `test_le_seam.py` | **Le seam est fermé** : dans `build_payload` et `_labels_prioritaires`, plus aucune trace de `sb`, `user_id`, d'un `fetch_*`, de l'appel Gemini, de `upsert_theme_plan` ni de `date.today()` — lu sur l'**arbre**, donc un commentaire qui nomme `fetch_meta_ads` ne fait pas échouer le harnais et un appel caché dans une closure ne lui échappe pas. Les **sept imports locaux** cachés au milieu de la fonction ont disparu. **Et rien n'a été déplacé** : chaque méthode du lecteur est jouée contre un espion, et on vérifie qu'elle atteint la même fonction, la même table, la même chaîne PostgREST et les mêmes arguments qu'avant l'injection — la référence étant le fichier tel qu'il était au dernier commit (`git show HEAD:…`), pas une liste écrite de mémoire. Les deux écritures et les quatre fenêtres GA4 comprises. **182 vérifications.** |
| `test_conseils_du_payload.py` | **L'ADR 0003 est vérifiable, enfin** : un thème classé mais non étoilé n'a même pas de carte, et au-delà de la troisième étoile la carte existe avec `conseille: false` et zéro conseil. Un balayage du payload confirme qu'aucun conseil servi ne nomme un thème hors des trois premières étoiles. Le **plafond de cinq** tient sur cinq étoiles ; une semaine calme rend **moins** de cinq et **rien ne vient compléter** ; jamais plus de deux gestes lourds. **Zéro étoile** rend zéro conseil, avec les cartes et le point de vue de la semaine quand même. Une **IA muette** ne casse rien et ne change pas la liste des clés servies — seul le résumé change. Un conseil **déjà servi ne revient pas** la semaine suivante. Et aucune écriture n'est tentée sur un compte sans Stratégie ouverte. **59 vérifications.** |
| `test_chiffres_du_payload.py` | **Le ROAS d'un thème bi-régie** porte les deux régies au numérateur ET au dénominateur (ticket 01), et ne se prononce pas sous le seuil de jugement. **Un thème sans revenu confirmé ne porte ni zéro ni estimation** sur sa carte et dans la matrice. **Deux Annonces homonymes restent deux** — la comparaison entre voisines parle, et se tait quand il n'y a vraiment qu'une annonce (ticket 03). La **fenêtre** fait sept jours pleins, finit à la dernière donnée, n'atteint jamais aujourd'hui ; et la **semaine déclarée sort de la fenêtre, pas du jour de fabrication** : la même construction rejouée le jour même, trois jours après et trois semaines après retombe sur **la même ligne d'écriture** (ticket 13, jusqu'ici démontré sur un calcul recopié). Enfin, les montants du payload se **rebâtissent à la main** depuis les lignes servies, et aucun `inf` ni `NaN` n'y survit. **57 vérifications.** |

Total : **298 vérifications**.

**Rejoués sans régression** : les harnais 06 (342), 07 (189), 08 (85), 09 (108),
10 (347), 12 (178) et 13 (77) — **1 326** vérifications. Les harnais 04 et 05
demandent un PostgreSQL et n'ont pas été rejoués.

### Seize assertions ont dû être réécrites, et c'est le signe attendu

Six fichiers des harnais 06, 07, 08, 10, 12 et 13 cherchaient dans le **texte**
de `build_report.py` des choses comme `fetch_platform_budgets(sb, user_id)` ou
`sb.table("suivi_actions").update(`. Ces appels ont changé de point d'entrée —
pas de destination. Chaque assertion a été réécrite pour lire la demande dans le
worker **et** l'appel dans le lecteur, sans rien changer à ce qu'elle prouve.
C'étaient exactement les substituts de texte que ce seam remplace par une
exécution.

### La revue de code a trouvé un trou que ce harnais ne voyait pas

`_themes_tips`, fonction du module **appelée depuis** `build_payload`, appelait
`_call_gemini` directement : la construction partait sur le réseau dès qu'une
clé Gemini existait dans l'environnement. La première version de `test_le_seam.py`
ne regardait que le **corps** de `build_payload`, donc elle ne pouvait pas le
voir. Le détecteur est maintenant **transitif** — il suit les appels vers les
fonctions du module — et il retrouve le défaut quand on le remet en place. Un
seam se vérifie sur ce que la fonction **atteint**, pas sur ce qu'elle écrit.

## Ce qu'il ne prouve pas

- **Rien n'est joué en base.** Aucun `upsert`, aucune écriture, aucun décompte
  de lignes. Le `.env` racine pointe un projet Supabase qui ne répond plus
  (§ Testing de [`spec.md`](../../spec.md)) — et c'est précisément ce que le
  faux lecteur remplace.
- **Le payload produit ici n'est pas celui de David.** Il sort de lignes fixes
  choisies pour éclairer une propriété : il prouve un **comportement**, jamais
  un chiffre de production.
- **Le « rapport identique avant/après » demandé par le ticket n'existe pas.**
  Avant l'injection, la fonction ne pouvait pas tourner hors ligne du tout — il
  n'y a pas de « avant » à comparer. Ce qui est vérifié à la place est une
  **équivalence de routage**, et le fichier le dit dans son en-tête.
- **La moitié de la propriété d'empreinte.** La spec veut aussi qu'un conseil
  « avec un chiffre différent réapparaisse ». Il ne peut pas : l'empreinte est
  `(clé, cible)` et aucune des règles servies ici ne pose de `cible` — c'est le
  ticket [31](../../issues/31-un-conseil-sans-cible-ne-sort-qu-une-fois.md),
  ouvert avant celui-ci. Le harnais ne prétend pas la vérifier.
- **Trois jeux de lignes ne sont pas encore gréés** par le faux lecteur, donc
  trois familles de règles ne tournent pas ici : les publications Instagram et
  les abonnés (donc toutes les règles organiques), la portée quotidienne Meta
  (`annonce_usee`), et les événements GA4 rattachés à un thème
  (`theme_event_cout`, `theme_event_muet`). Ce n'est plus une limite de
  structure — c'est du gréement à ajouter quand un ticket en aura besoin.
- **Rien du rendu web**, et il n'y a toujours **aucun runner dans `saas/web`** —
  décision de David prise en même temps que le seam. Conséquence assumée :
  **la garde de collision (ticket 02) et la date libre (ticket 11) ne sont
  couvertes par aucun test automatisé.** Elles se vérifient à la main.

## Deux défauts trouvés en faisant tourner la fonction

Aucun n'a été corrigé ici — le ticket 16 s'interdit toute correction de
comportement, et `CLAUDE.md` §4 en fait des tickets :

- [40 · Un thème sans revenu confirmé est publié à zéro
  franc](../../issues/40-un-theme-sans-revenu-confirme-est-publie-a-zero.md) —
  `themes.rows[].rev` écrit `0.0` là où la carte et la matrice écrivent `null`.
  Mesuré ; **aucun écran ne le montre aujourd'hui**, et le ticket le dit.
- [41 · La fenêtre ne s'ancre pas sur
  Google](../../issues/41-la-fenetre-ne-s-ancre-pas-sur-google.md) — un compte
  Google seul mesure des jours vides. Même compte, même dépense :
  **210 CHF en Meta, 90 CHF en Google.** C'est le plus lourd des deux.
