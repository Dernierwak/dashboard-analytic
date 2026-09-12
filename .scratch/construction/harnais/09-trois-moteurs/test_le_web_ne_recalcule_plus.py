"""Le troisième moteur — celui qui vivait en TypeScript — n'existe plus.

CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS. Il lit du TEXTE TypeScript, il ne
l'exécute pas : le dépôt n'a aucun runner de test dans `saas/web`, et c'est une
décision de David (ticket 16, § « Testing Decisions » de la spec). Un test de
texte prouve qu'un calcul a disparu et qu'un composant est posé ; il ne prouve
pas ce que la page rend. Ça, c'est `npx tsc --noEmit`, `npm run build` et le fil
parcouru à la main.
"""
import pulse
from t import ok, egal, bilan

CANAUX = pulse.SOURCE_CANAUX.read_text(encoding="utf-8")
INSTA = pulse.SOURCE_INSTAGRAM.read_text(encoding="utf-8")
RACINE = pulse.RACINE


def _page(nom):
    return (RACINE / "saas" / "web" / "app" / nom / "page.tsx").read_text(encoding="utf-8")


def test_le_calcul_des_formats_et_des_creneaux_a_disparu():
    for mort in ("const heatmap", "bestSlot =", "FormatStat", "SlotCell",
                 "INSTA_SLOTS", "INSTA_DAYS"):
        ok(f"{mort} · plus calculé ni exporté", mort not in CANAUX, mort)
    # La pierre tombale reste : sans elle, le prochain qui cherche « où est
    # passée la heatmap » recalcule une quatrième fois.
    ok("la raison est écrite dans le fichier",
       "ILS SONT MORTS LE" in CANAUX and "09-trois-moteurs-un-seul" in CANAUX)


def test_ce_qui_reste_du_dashboard_instagram_est_intact():
    """On a coupé deux modules, pas la page : le top 3 et la performance par
    thème lisent le même `pool` qu'avant."""
    for vivant in ("const topPosts", "const byLabel", "const pool =", "topMetric"):
        ok(f"{vivant} · toujours là", vivant in CANAUX, vivant)


def test_la_page_instagram_affiche_au_lieu_de_recalculer():
    # Les titres RENDUS, pas les mots : la page garde le commentaire qui
    # explique où ces deux modules sont partis, et il les nomme.
    for mort in ('Quand publier ?{" "}', "d.heatmap", "d.bestSlot", "d.formats"):
        ok(f"« {mort} » a quitté la page", mort not in INSTA, mort)
    ok("le bloc du rapport le remplace", '<CeQuiMarche page="instagram" />' in INSTA)
    # Le rang 4 se lit APRÈS le rang 3 (« par thème »), pas avant : c'était le
    # seul écart d'Instagram au gabarit des trois pages.
    ok("le thème (rang 3) précède la conclusion (rang 4)",
       INSTA.index("<ByLabelInsta d=") < INSTA.index('<CeQuiMarche page="instagram" />'))


def test_les_quatre_pages_le_montrent_et_disent_laquelle_elles_sont():
    attendu = {"meta": "meta", "google": "google", "instagram": "instagram",
               "labels": "themes"}
    for page, valeur in attendu.items():
        src = _page(page)
        ok(f"/{page} · affiche le bloc", f'<CeQuiMarche page="{valeur}" />' in src)
        ok(f"/{page} · importe le bloc",
           'from "@/components/ce-qui-marche"' in src)


def test_la_promesse_de_labels_est_tenue():
    """La page disait « les constats… se concentrent dessus » alors que rien ne
    les rendait. Elle doit maintenant dire où ils se lisent."""
    src = _page("labels")
    ok("la promesse est toujours écrite", "les constats" in src)
    ok("et elle dit où les lire", "en bas de cette page" in src)


def test_le_filtre_par_page_vit_a_UN_seul_endroit():
    src = (RACINE / "saas" / "web" / "lib" / "constats.ts").read_text(encoding="utf-8")
    egal("une seule fonction de placement", src.count("export function constatsDeLaPage"), 1)
    ok("« pub » couvre les deux régies",
       'if (p === "pub") return page === "meta" || page === "google";' in src)
    ok("l'angle mort ne conclut aucune plateforme",
       'if (c.kind === "angle_mort") return false;' in src)
    ok("un constat de thème se lit partout", "if (p === null) return true;" in src)
    # Le repli pour les payloads d'avant la `platform` ne devine que ce qui est
    # certain — la régie d'une campagne locomotive n'en fait pas partie.
    ok("le repli par genre existe", "const PLATEFORME_PAR_GENRE" in src)
    i = src.index("const PLATEFORME_PAR_GENRE")
    j = src.index("};", i)
    ok("il ne devine pas la régie d'une campagne",
       "campagne_locomotive" not in src[i:j])
    for genre in ("format_best", "slot_best", "cout_conversion"):
        ok(f"{genre} · repli posé", genre in src[i:j])
    # Aucune page ne doit refaire ce tri dans son coin.
    for page in ("meta", "google", "instagram", "labels"):
        ok(f"/{page} ne filtre rien lui-même", "constatsDeLaPage(" not in _page(page))


if __name__ == "__main__":
    test_le_calcul_des_formats_et_des_creneaux_a_disparu()
    test_ce_qui_reste_du_dashboard_instagram_est_intact()
    test_la_page_instagram_affiche_au_lieu_de_recalculer()
    test_les_quatre_pages_le_montrent_et_disent_laquelle_elles_sont()
    test_la_promesse_de_labels_est_tenue()
    test_le_filtre_par_page_vit_a_UN_seul_endroit()
    raise SystemExit(0 if bilan("Le web n'a plus de moteur") else 1)
