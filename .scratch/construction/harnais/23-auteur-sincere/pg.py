"""Un PostgreSQL 16 local et jetable, le décor Supabase, puis LES VRAIES
migrations du dépôt — lues, jamais recopiées.

Ce harnais-ci diffère de celui du ticket 05 sur un point : il ne suffit pas d'y
jouer la migration vérifiée, il faut aussi jouer TOUT CE QUI POSE DES POLITIQUES
D'INSERTION sur la même table. C'est le cœur du ticket 23 : PostgreSQL combine
les politiques PERMISSIVES d'une même commande EN OU, donc une règle nouvelle ne
restreint rien tant qu'une autre dit oui. Vérifier la nouvelle politique seule
prouverait exactement le contraire de ce qu'on cherche à savoir.
"""
import os, pathlib, subprocess, sys, tempfile, pgserver

# `psql` est embarqué par pgserver ; son chemin n'est pas exporté en haut du
# paquet, il vit dans le module qui définit le serveur.
PSQL = sys.modules[pgserver.PostgresServer.__module__].POSTGRES_BIN_PATH / "psql"

RACINE = pathlib.Path(__file__).resolve().parents[4]
MIGRATIONS = RACINE / "supabase/migrations"
MIGRATION = MIGRATIONS / "suivi_actions_auteur_sincere.sql"
BUNDLE = MIGRATIONS / "000_run_me_all.sql"
ICI = pathlib.Path(__file__).resolve().parent
STOP = "\\set ON_ERROR_STOP on\n"

# L'ORDRE COMPTE, et il est celui du bundle. `equipe_partage.sql` DÉTRUIT puis
# recrée `partage_insert` : jouée après la migration du ticket 23, elle ne la
# toucherait pas (les noms diffèrent) — mais la jouer avant est ce que David
# fera, et un harnais qui choisit un autre ordre vérifie un autre schéma.
AVANT = [
    "suivi_actions.sql",              # la table + ses politiques « chacun ses lignes »
    "suivi_actions_notes.sql",        # kind = 'note'
    "suivi_actions_verdict.sql",      # verdict
    "equipe_partage.sql",             # a_acces / peut_editer + les politiques partage_*
    "suivi_actions_auteur_campagne.sql",  # author_id, figé par déclencheur (ticket 05)
]


# Supabase donne les privilèges de table à `authenticated` tout seul (défaut de
# `ALTER DEFAULT PRIVILEGES` sur le schéma public) ; un PostgreSQL nu, non. Sans
# ce GRANT, toute écriture serait refusée pour PRIVILÈGE MANQUANT — un refus qui
# ressemble à s'y méprendre à un refus de RLS, et le harnais crierait victoire
# sans avoir jamais atteint la politique qu'il vérifie.
GRANTS = """
-- `service_role` en a besoin lui aussi : BYPASSRLS fait sauter les POLITIQUES,
-- pas les privilèges de table. Les confondre ferait échouer le worker pour une
-- raison qui n'a rien à voir avec la règle vérifiée.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
"""


def demarre():
    """La base vit HORS du dépôt : un répertoire de données PostgreSQL dans
    `.scratch/` finirait dans un commit un jour ou l'autre."""
    d = pathlib.Path(os.getenv("PULSE_HARNAIS_PGDATA")
                     or pathlib.Path(tempfile.gettempdir()) / "pulse-harnais-23-pgdata")
    d.mkdir(parents=True, exist_ok=True)
    return pgserver.get_server(d)


def remonte(db, avec_migration=True, etapes=None):
    """Décor, puis les fichiers de migration LUS. `avec_migration=False` rend le
    schéma tel qu'il est AUJOURD'HUI en base — c'est lui qui montre le trou que
    le ticket 23 décrit, et sans cette bascule le harnais ne pourrait pas
    prouver que la règle neuve change quelque chose.

    `etapes` remplace la liste jouée avant : de quoi remonter une base à qui il
    manque une migration, et voir ce que la nouvelle en dit."""
    db.psql(STOP + (ICI / "decor.sql").read_text())
    for nom in (AVANT if etapes is None else etapes):
        db.psql(STOP + (MIGRATIONS / nom).read_text())
    if avec_migration:
        db.psql(STOP + MIGRATION.read_text())
    db.psql(STOP + GRANTS)


def lit(db, sql):
    """Une valeur scalaire, sans en-tête ni décor."""
    sortie = db.psql("\\t\n\\a\n" + sql)
    return [l for l in sortie.splitlines() if l.strip()][-1]


def _joue(db, sql):
    """Le message d'erreur si PostgreSQL refuse, None s'il accepte.

    `db.psql()` n'est pas utilisable ici : il laisse `stderr` filer vers le
    terminal, donc le refus s'afficherait sans jamais revenir au vérificateur —
    et un test qui ne lit pas le message ne peut pas distinguer « refusé pour la
    bonne raison » de « refusé pour une autre »."""
    r = subprocess.run(f"{PSQL} {db.get_uri()}",
                       input=(STOP + sql).encode(), shell=True, capture_output=True)
    return None if r.returncode == 0 else (r.stdout + r.stderr).decode()


def comme(db, personne, sql, role="authenticated"):
    """Jouer `sql` DANS LA PEAU de quelqu'un : c'est la seule façon d'atteindre
    la RLS. Sans `SET ROLE`, psql entre en propriétaire de la table, que
    PostgreSQL exempte de ses propres politiques — le harnais verrait alors tout
    passer et conclurait, à tort, qu'il n'y a rien à corriger.

    `personne=None` est la session sans jeton : `auth.uid()` y rend NULL."""
    jeton = f"select set_config('request.jwt.claim.sub', '{personne or ''}', false);"
    return _joue(db, f"{jeton}\nSET ROLE {role};\n{sql}")


def refuse(db, sql):
    """Le refus d'une instruction jouée en propriétaire (DDL, contrôles)."""
    return _joue(db, sql)
