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
