"""`000_run_me_all.sql` porte une COPIE de la vue. Une copie qui dérive de sa
source est pire que pas de copie : le fichier unique qu'on joue n'installerait
pas ce que la source de vérité décrit."""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

DEBUT = "DROP VIEW IF EXISTS public.theme_regroupement;"
FIN = "END $$;"


def extrait(texte):
    i = texte.index(DEBUT)
    j = texte.index(FIN, i) + len(FIN)
    # Les espaces de fin de ligne ne changent rien à ce que Postgres installe.
    return "\n".join(l.rstrip() for l in texte[i:j].splitlines())


def main():
    source = extrait(pg.VUE.read_text())
    copie = extrait((pg.RACINE / "supabase/migrations/000_run_me_all.sql").read_text())
    t.egal("la copie de 000_run_me_all.sql est celle de theme_regroupement.sql",
           copie, source)
    t.ok("la vue n'est déclarée qu'UNE fois dans le fichier unique",
         (pg.RACINE / "supabase/migrations/000_run_me_all.sql").read_text()
         .count("CREATE VIEW public.theme_regroupement") == 1)
    return t.bilan("La copie du fichier unique")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
