"""La migration se rejoue sans risque, et refuse clairement d'être jouée trop
tôt. David joue ces fichiers à la main dans le SQL editor de Supabase : une
migration qui casse au deuxième passage est une migration qu'on n'ose plus
rejouer, donc une base dont plus personne ne connaît l'état.
"""
import pg, fixtures as F
from t import ok, egal, bilan

db = pg.demarre()
pg.remonte(db)
F.pose(db, pg)

# Une note en base AVANT le second passage : on veut pouvoir dire qu'elle est
# encore là, intacte, après. Une politique ne touche aucune ligne — mais ça se
# montre, ça ne se promet pas.
pg.comme(db, F.MOI, F.note("note:temoin", F.MOI))

ok("la migration se rejoue sans erreur",
   pg.refuse(db, pg.MIGRATION.read_text()) is None)

egal("…et la politique n'existe toujours qu'en un exemplaire",
     pg.lit(db, "SELECT count(*) FROM pg_policies WHERE schemaname = 'public' "
                "AND tablename = 'suivi_actions' AND policyname = 'auteur_sincere';"),
     "1")

egal("…RESTRICTIVE, et sur l'INSERT",
     pg.lit(db, "SELECT permissive || ' ' || cmd FROM pg_policies "
                "WHERE schemaname = 'public' AND tablename = 'suivi_actions' "
                "AND policyname = 'auteur_sincere';"),
     "RESTRICTIVE INSERT")

egal("la note témoin n'a pas bougé",
     pg.lit(db, "SELECT title || '|' || coalesce(author_id::text, 'NULL') "
                "FROM public.suivi_actions WHERE reco_key = 'note:temoin';"),
     f"refait les visuels|{F.MOI}")

egal("…et rien d'autre n'a été effacé au passage",
     pg.lit(db, "SELECT count(*) FROM public.suivi_actions;"), "1")

# Le fichier ne détruit rien : c'est ce que le commentaire promet, vérifié sur
# le texte plutôt que cru sur parole. `DROP POLICY IF EXISTS` est la seule
# destruction admise, et elle ne porte que sur la politique qu'on recrée juste
# après (CLAUDE.md §7 : rien de destructeur sans le signaler).
#
# LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER, et ce n'est pas un détail de
# confort : le fichier PROMET en toutes lettres « aucun DROP TABLE, aucun
# TRUNCATE ». Un test qui lit le texte entier trouve ces mots dans la phrase qui
# jure qu'ils n'y sont pas, et échoue sur la promesse au lieu du code.
texte = "\n".join(l for l in pg.MIGRATION.read_text().splitlines()
                  if not l.lstrip().startswith("--")).upper()
for interdit in ("DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM"):
    ok(f"la migration ne contient aucun {interdit}", interdit not in texte)
ok("le seul DROP est celui de la politique qu'elle recrée",
   texte.count("DROP ") == 1 and "DROP POLICY IF EXISTS" in texte)

# Jouée sur une base où la section 25 n'est pas passée, elle doit s'arrêter en
# DISANT QUOI FAIRE. Sans ce garde, PostgreSQL refuserait aussi — mais sur un
# « column author_id does not exist » qui n'indique aucune suite.
pg.remonte(db, avec_migration=False, etapes=pg.AVANT[:-1])
panne = pg.refuse(db, pg.MIGRATION.read_text()) or ""
ok("sans la colonne, la migration s'arrête", panne != "")
ok("…et elle nomme le fichier à jouer d'abord",
   "suivi_actions_auteur_campagne.sql" in panne, panne[:200])

raise SystemExit(0 if bilan("La migration du ticket 23 se rejoue") else 1)
