"""Un PostgreSQL 16 local et jetable, le schéma d'AVANT la migration, puis LA
migration telle qu'elle est écrite dans le dépôt."""
import os, pathlib, subprocess, sys, tempfile, pgserver

# `psql` est embarqué par pgserver ; son chemin n'est pas exporté en haut du
# paquet, il vit dans le module qui définit le serveur.
PSQL = sys.modules[pgserver.PostgresServer.__module__].POSTGRES_BIN_PATH / "psql"

RACINE = pathlib.Path(__file__).resolve().parents[4]
MIGRATION = RACINE / "supabase/migrations/suivi_actions_auteur_campagne.sql"
BUNDLE = RACINE / "supabase/migrations/000_run_me_all.sql"
ICI = pathlib.Path(__file__).resolve().parent
STOP = "\\set ON_ERROR_STOP on\n"


def demarre():
    """La base vit HORS du dépôt : un répertoire de données PostgreSQL dans
    `.scratch/` finirait dans un commit un jour ou l'autre."""
    d = pathlib.Path(os.getenv("PULSE_HARNAIS_PGDATA")
                     or pathlib.Path(tempfile.gettempdir()) / "pulse-harnais-05-pgdata")
    d.mkdir(parents=True, exist_ok=True)
    return pgserver.get_server(d)


def remonte(db):
    """Schéma vierge, puis LE FICHIER DE MIGRATION LU, jamais recopié : une
    vérification sur une copie ne prouve rien du fichier que David va jouer."""
    db.psql(STOP + (ICI / "schema.sql").read_text())
    db.psql(STOP + MIGRATION.read_text())


def lit(db, sql):
    """Une valeur scalaire, sans en-tête ni décor."""
    sortie = db.psql("\\t\n\\a\n" + sql)
    return [l for l in sortie.splitlines() if l.strip()][-1]


def refuse(db, sql):
    """Le message d'erreur si PostgreSQL refuse, None s'il accepte. Sans ça un
    harnais ne peut prouver QUE ce qui passe — or ici l'essentiel est ce qui ne
    passe pas.

    `db.psql()` n'est pas utilisable ici : il laisse `stderr` filer vers le
    terminal, donc le refus s'afficherait sans jamais revenir au vérificateur —
    et un test qui ne lit pas le message ne peut pas distinguer « refusé pour la
    bonne raison » de « refusé pour une autre »."""
    r = subprocess.run(f"{PSQL} {db.get_uri()}",
                       input=(STOP + sql).encode(), shell=True, capture_output=True)
    return None if r.returncode == 0 else (r.stdout + r.stderr).decode()
