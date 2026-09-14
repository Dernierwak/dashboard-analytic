"""LE TROU, MONTRÉ AVANT D'ÊTRE BOUCHÉ.

Ce fichier ne vérifie pas la correction : il vérifie que le ticket 23 dit vrai.
Il joue le schéma TEL QU'IL EST EN BASE AUJOURD'HUI — sans la migration neuve —
et demande à un membre « Peut agir » de signer une note du nom de son collègue.

Il reste VERT pour toujours, et c'est voulu : il remonte exprès le schéma
d'avant. Sa valeur n'est pas dans son propre résultat mais dans le CONTRASTE
avec `test_auteur_sincere.py`, qui joue le même décor, les mêmes personnes et la
même écriture — à un fichier de migration près. Sans lui, le vert de l'autre ne
dirait pas si la règle neuve sert à quelque chose ou si elle enfonce une porte
déjà fermée.
"""
import pg, fixtures as F
from t import ok, egal, bilan

db = pg.demarre()
pg.remonte(db, avec_migration=False)
F.pose(db, pg)

# MOI est membre « editor » du compte de PATRON : `peut_editer(user_id)` lui dit
# oui, et c'est la seule question que la politique d'insertion pose aujourd'hui.
ok("un membre « Peut agir » peut écrire une note chez le patron",
   pg.comme(db, F.MOI, F.note("note:sincere", F.MOI)) is None)

# La même écriture, signée de quelqu'un d'autre. Rien dans le schéma actuel ne
# regarde `author_id` à l'insertion : ni la politique (elle lit `user_id`), ni
# le déclencheur du ticket 05 (il est BEFORE UPDATE, il ne voit pas les INSERT).
ok("AUJOURD'HUI la base accepte une note signée de quelqu'un d'autre",
   pg.comme(db, F.MOI, F.note("note:forgee", F.TOI)) is None)

egal("…et elle est bien en base, au nom de TOI",
     pg.lit(db, "SELECT author_id FROM public.suivi_actions "
                "WHERE reco_key = 'note:forgee';"),
     F.TOI)

# Et le déclencheur de 05 la fige dans cet état : le faux devient définitif.
# TOI, à qui la note est attribuée, ne peut même pas la rendre à son vrai
# auteur — ce que 05 voulait (un auteur ne se réécrit pas) devient ici le
# verrou du mensonge. La correction doit donc se jouer à l'INSERTION, seul
# moment où la valeur est encore négociable.
ok("le déclencheur de 05 fige ensuite le faux auteur, rendant le faux définitif",
   "ne se réécrit pas" in (pg.comme(
       db, F.TOI,
       "UPDATE public.suivi_actions SET author_id = '%s' WHERE reco_key = 'note:forgee';" % F.MOI
   ) or ""))

raise SystemExit(0 if bilan("Le trou du ticket 23, sur le schéma d'aujourd'hui") else 1)
