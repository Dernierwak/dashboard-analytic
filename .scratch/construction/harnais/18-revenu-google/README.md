# Harnais du ticket 18 — mesurer avant de trancher

Trois requêtes **en lecture seule**, à coller dans l'**éditeur SQL Supabase**
(Dashboard → SQL Editor). Aucun secret ne transite : la session du dashboard
suffit, rien à exporter, rien à coller dans une conversation.

L'ordre compte — chacune répond à une question de plus :

| Fichier | Ce qu'il répond |
|---|---|
| `mesure.sql` | **Combien**, et **combien de francs** ? Les campagnes Google étiquetées, rangées en « nom vide » / « nom introuvable dans GA4 » / « rattachable ». Si les deux premières lignes sont à zéro, le ticket devient une garde préventive. |
| `mesure_par_theme.sql` | **Quels thèmes sont touchés**, et à quel point. C'est la part muette d'un thème — pas le nombre de campagnes — qui dit si son ROAS est écrasé. |
| `mesure_repli_historique.sql` | **Ce que vaudrait la quatrième option** : combien de campagnes redeviendraient rattachables en acceptant n'importe quel nom porté dans l'historique `google_ads_insights`, au lieu du seul nom courant. |

## Pourquoi du SQL et pas un script Python

Le script aurait eu besoin de la clé `service_role` du projet vivant. Elle
n'appartient pas à une conversation (`CLAUDE.md` §7), et le `.env` de la racine
pointe de toute façon sur un projet mort — voir la note dans le ticket.

## Ce que ces requêtes ne font pas

Elles ne réparent rien et ne tranchent rien. Le ticket 18 dit explicitement que
la règle d'attribution se choisit avec David, chiffre en main. Le contrôle est
mécanique : `pglast` a parsé les trois fichiers, tous sont des `SelectStmt` et
rien d'autre.

```
python3.12 -c "import pglast,glob;[print(f,sorted({type(x.stmt).__name__ for x in pglast.parse_sql(open(f).read())})) for f in glob.glob('*.sql')]"
```

---

## 2026-09-13 — la mesure a été faite, et le dossier a changé de métier

Les trois requêtes ci-dessus ont été jouées dans l'éditeur SQL Supabase du
projet vivant. Résultats et conclusions dans le ticket 18 ; en deux lignes :
le défaut était réel (2 campagnes, 808.87 CHF, **tout sur un seul thème**) mais
sa cause n'était pas celle qu'on croyait — un nom **fabriqué par nous**, pas un
nom manquant (ticket 43).

Le dossier porte maintenant **`test_part_muette.py`** : les vérifications du
correctif retenu — on publie le ROAS et on écrit la part de dépense dont le
revenu n'est pas rattachable. Son pendant SQL, contre un vrai PostgreSQL montant
la vraie migration, vit dans `../04-vue-sql/test_part_muette_sql.py` — c'est là
que la vue est montée.

```
python3.12 test_part_muette.py
```

Les trois `.sql` restent : ils se rejouent pour remesurer, notamment après que
David aura joué `supabase/migrations/nom_google_fabrique.sql`, où les deux
campagnes doivent disparaître du compte « nom introuvable ».
