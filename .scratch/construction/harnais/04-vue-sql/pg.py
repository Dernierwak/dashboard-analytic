"""Un PostgreSQL 16 local et jetable, avec le schéma minimal et LA vraie vue."""
import os, pathlib, tempfile, pgserver

RACINE = pathlib.Path(__file__).resolve().parents[4]
VUE = RACINE / "supabase/migrations/theme_regroupement.sql"
ICI = pathlib.Path(__file__).resolve().parent


def demarre():
    """La base vit HORS du dépôt : un répertoire de données PostgreSQL dans
    `.scratch/` finirait dans un commit un jour ou l'autre."""
    d = pathlib.Path(os.getenv("PULSE_HARNAIS_PGDATA")
                     or pathlib.Path(tempfile.gettempdir()) / "pulse-harnais-04-pgdata")
    d.mkdir(parents=True, exist_ok=True)
    return pgserver.get_server(d)


def remonte(db):
    """Schéma vierge + LA VUE TELLE QU'ELLE EST ÉCRITE DANS LA MIGRATION — le
    fichier est lu, jamais recopié : une vérification sur une copie ne prouve
    rien du fichier que David va jouer."""
    entete = "\\set ON_ERROR_STOP on\n"
    db.psql(entete + (ICI / "schema.sql").read_text())
    db.psql(entete + VUE.read_text())
