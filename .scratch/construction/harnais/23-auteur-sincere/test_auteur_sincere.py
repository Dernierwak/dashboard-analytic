"""UNE NOTE NE SE SIGNE QUE DE SON PROPRE NOM — et tout le reste continue.

Le ticket 23 tient en une phrase : à l'insertion, `author_id` vaut NULL ou
`auth.uid()`, jamais quelqu'un d'autre. La moitié de ce fichier vérifie ce
refus ; l'autre moitié vérifie que la règle n'a rien cassé au passage, parce
qu'une politique RESTRICTIVE s'ajoute à TOUTES les insertions de la table, pas
seulement à celles qui portent un auteur.
"""
import pg, fixtures as F
from t import ok, egal, bilan

db = pg.demarre()
pg.remonte(db)
F.pose(db, pg)

POLITIQUE = "auteur_sincere"


def refus(personne, sql, role="authenticated"):
    return pg.comme(db, personne, sql, role) or ""


# ── Ce que la règle refuse ──────────────────────────────────────────────────
#
# Le cas du ticket : un membre « Peut agir », qui sort de l'interface et écrit
# en PostgREST, attribue sa note à son collègue.
panne = refus(F.MOI, F.note("note:forgee", F.TOI))
ok("un membre ne peut plus signer du nom d'un autre", panne != "")
ok("…et c'est bien CETTE politique qui refuse, pas une autre",
   POLITIQUE in panne, panne[:200])

# La règle ne connaît pas de rang : le propriétaire du compte non plus ne peut
# pas mettre un mot dans la bouche de quelqu'un. `user_id` est à lui, pas la
# parole de ses invités.
ok("le propriétaire non plus ne peut pas signer à la place d'un invité",
   refus(F.PATRON, F.note("note:patron-usurpe", F.MOI)) != "")

# Sans jeton, `auth.uid()` rend NULL. Une politique RLS traite NULL comme un
# refus — À L'INVERSE d'une contrainte CHECK, qui laisse passer ce qui s'évalue
# à NULL (c'est le piège que la migration du ticket 05 a payé sur la campagne).
# La règle est donc écrite pour ne pas dépendre de cette différence, et ce test
# est là pour que personne n'ait à se souvenir de laquelle des deux s'applique.
ok("sans session authentifiée, une note signée est refusée",
   refus(None, F.note("note:anonyme", F.MOI), role="anon") != "")

# ── Ce que la règle laisse passer, et qui est tout aussi important ───────────
ok("une note signée de son propre nom passe",
   refus(F.MOI, F.note("note:sincere", F.MOI)) == "")

egal("…et elle est en base au nom de son vrai auteur",
     pg.lit(db, "SELECT author_id FROM public.suivi_actions "
                "WHERE reco_key = 'note:sincere';"),
     F.MOI)

# Le repli de `poserNote` écrit sans auteur quand la colonne manque, et les
# lignes nées d'un conseil (`kind = 'action'`) n'en ont jamais. L'ADR 0004 tient
# à ce qu'une ligne sans auteur reste écrivable : une note sans auteur est une
# note ancienne, pas une note cassée.
ok("une ligne SANS auteur reste écrivable",
   refus(F.MOI, F.note("note:sans-auteur", None)) == "")

ok("le propriétaire écrit sa propre note comme avant",
   refus(F.PATRON, F.note("note:patron", F.PATRON)) == "")

# ── Ce qui ne bouge pas ─────────────────────────────────────────────────────
#
# Un « viewer » était déjà refusé par `peut_editer` : il doit l'être encore, et
# POUR LA MÊME RAISON. Si la nouvelle politique se mettait à porter ce refus,
# elle aurait pris un pouvoir qu'on ne lui a pas donné.
panne_oeil = refus(F.OEIL, F.note("note:oeil", F.OEIL))
ok("un « viewer » reste refusé", panne_oeil != "")
ok("…et c'est toujours le partage qui le refuse, pas la règle neuve",
   POLITIQUE not in panne_oeil, panne_oeil[:200])

# Marquer une action « faite » est un UPDATE : la règle neuve ne porte que sur
# l'INSERT, elle n'a rien à y dire.
ok("cocher une action continue de marcher",
   refus(F.MOI, "UPDATE public.suivi_actions SET status = 'done' "
                "WHERE reco_key = 'note:sincere';") == "")

# L'UPSERT DE `resoudreAction` (app/actions.ts l. 98) N'ÉCRIT PAS `author_id`.
# Sur conflit, il retombe sur une ligne qui, elle, en a un. PostgreSQL applique
# le WITH CHECK de l'INSERT à la ligne PROPOSÉE (auteur NULL, donc conforme) et
# celui de l'UPDATE à la ligne d'arrivée — mais ça se vérifie, ça ne se récite
# pas : c'est exactement le genre de détail qui casse en production.
ok("un upsert sans auteur sur une ligne qui en a un passe encore",
   refus(F.MOI,
         "INSERT INTO public.suivi_actions "
         "(user_id, reco_key, title, check_at, kind, decided_at) VALUES "
         f"('{F.PATRON}', 'note:sincere', 'retouché', current_date, 'note', current_date) "
         "ON CONFLICT (user_id, reco_key, decided_at) DO UPDATE SET title = EXCLUDED.title;")
   == "")

egal("…et l'auteur de cette ligne n'a pas bougé",
     pg.lit(db, "SELECT author_id FROM public.suivi_actions "
                "WHERE reco_key = 'note:sincere';"),
     F.MOI)

# Le worker hebdo passe par la clé de service, que Supabase exempte de RLS
# (`build_report.py::_service_client`). Il n'insère jamais dans `suivi_actions`
# — il n'y met à jour que `verdict` — mais si un jour il devait le faire, la
# règle ne doit pas être ce qui l'arrête : elle protège une signature, elle ne
# ferme pas une porte au produit.
ok("la clé de service n'est pas filtrée",
   refus(F.PATRON, F.note("note:worker", F.TOI), role="service_role") == "")

# ── Le déclencheur du ticket 05 est toujours debout ─────────────────────────
ok("l'auteur reste FIGÉ après coup (ticket 05)",
   "ne se réécrit pas" in refus(
       F.MOI, "UPDATE public.suivi_actions SET author_id = "
              f"'{F.TOI}' WHERE reco_key = 'note:sincere';"))

# Le départ d'un membre passe par `ON DELETE SET NULL`, donc par un UPDATE sur
# la ligne fille. C'est la page /suppression, donc une demande RGPD : si la
# nouvelle politique l'empêchait, elle transformerait un ticket de confort en
# panne réglementaire.
ok("supprimer un membre reste possible",
   pg.refuse(db, f"DELETE FROM auth.users WHERE id = '{F.MOI}';") is None)

egal("…et sa note lui survit, sans auteur",
     pg.lit(db, "SELECT coalesce(author_id::text, 'NULL') FROM public.suivi_actions "
                "WHERE reco_key = 'note:sincere';"),
     "NULL")

raise SystemExit(0 if bilan("L'auteur d'une note est sincère dès l'écriture") else 1)
