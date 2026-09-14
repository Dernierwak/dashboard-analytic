"""`000_run_me_all.sql` porte une COPIE de cette migration. Une copie qui dérive
de sa source est pire que pas de copie : le fichier unique qu'on joue
n'installerait pas ce que la source de vérité décrit.

Seul fichier du dossier qui ne demande aucun PostgreSQL.
"""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

DEBUT = "-- Sans `author_id`, la politique porterait"
FIN = "Voir le ticket 23 de la construction.';"


def extrait(texte):
    i = texte.index(DEBUT)
    j = texte.index(FIN, i) + len(FIN)
    # Les espaces de fin de ligne ne changent rien à ce que Postgres installe.
    return "\n".join(l.rstrip() for l in texte[i:j].splitlines())


def main():
    source = extrait(pg.MIGRATION.read_text())
    bundle = pg.BUNDLE.read_text()

    t.egal("la copie de 000_run_me_all.sql est celle de suivi_actions_auteur_sincere.sql",
           extrait(bundle), source)

    t.ok("la politique n'est déclarée qu'UNE fois dans le fichier unique",
         bundle.count('CREATE POLICY "auteur_sincere"') == 1)

    # Le mot qui porte tout le ticket. Sans lui la politique existe, se lit
    # pareil, et n'interdit rien : les permissives se combinent en OU.
    t.ok("la copie est bien RESTRICTIVE", "AS RESTRICTIVE" in extrait(bundle))

    t.ok("la section 26 est annoncée au sommaire",
         "--   26)    suivi_actions" in bundle)

    # Elle doit venir APRÈS la 25 (qui crée la colonne) et APRÈS la 15 (qui pose
    # `partage_insert`). Un fichier unique qui la jouerait trop tôt s'arrêterait
    # net sur le garde — mieux vaut le savoir ici qu'en la jouant.
    t.ok("…et elle est placée après la section 25",
         bundle.index('CREATE POLICY "auteur_sincere"')
         > bundle.index("CREATE TRIGGER trg_suivi_actions_auteur_fige"))

    t.ok("le contrôle de fin de fichier exige la politique ET son caractère restrictif",
         "'auteur_sincere'" in bundle and "permissive = 'RESTRICTIVE'" in bundle)

    return t.bilan("La copie du fichier unique")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
