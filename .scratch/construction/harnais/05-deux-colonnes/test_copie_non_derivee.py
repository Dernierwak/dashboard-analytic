"""`000_run_me_all.sql` porte une COPIE de cette migration. Une copie qui dérive
de sa source est pire que pas de copie : le fichier unique qu'on joue
n'installerait pas ce que la source de vérité décrit."""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t

DEBUT = "-- ── 1 · L'auteur ─"
FIN = "WHERE campaign_key IS NOT NULL;"


def extrait(texte):
    i = texte.index(DEBUT)
    j = texte.index(FIN, i) + len(FIN)
    # Les espaces de fin de ligne ne changent rien à ce que Postgres installe.
    return "\n".join(l.rstrip() for l in texte[i:j].splitlines())


def main():
    source = extrait(pg.MIGRATION.read_text())
    bundle = pg.BUNDLE.read_text()
    t.egal("la copie de 000_run_me_all.sql est celle de suivi_actions_auteur_campagne.sql",
           extrait(bundle), source)
    t.ok("le déclencheur n'est déclaré qu'UNE fois dans le fichier unique",
         bundle.count("CREATE TRIGGER trg_suivi_actions_auteur_fige") == 1)
    t.ok("les trois colonnes sont annoncées au contrôle de fin de fichier",
         all(f"('c', 'suivi_actions',            '{c}')" in bundle
             for c in ("author_id", "campaign_channel", "campaign_key")))
    t.ok("...et la fonction du déclencheur aussi",
         "public.suivi_actions_auteur_fige()" in bundle.split("-- ── Fonctions ")[1])
    return t.bilan("La copie du fichier unique")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
