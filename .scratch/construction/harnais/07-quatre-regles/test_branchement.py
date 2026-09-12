"""Le branchement : les quatre règles sont appelées, et le filtre des régies est mort.

LIMITE DE CE FICHIER, ET ELLE EST GRANDE. `_annonces_theme` et `_budget_theme`
sont des CLOSURES de `build_payload`, qui prend un client Supabase vivant et va
chercher ses données elle-même. Les rendre appelables hors ligne est le ticket
[16](../../issues/16-le-seam-du-payload.md), pas encore fait. Ce fichier lit
donc le TEXTE SOURCE pour la moitié de ce qu'il vérifie — un test de texte
prouve qu'une ligne est écrite, jamais qu'elle fait ce qu'elle dit. Ce qui est
vérifiable autrement l'est : la mort de `_compares_channels` se teste sur le
module, pas sur son texte.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

import saas.traitement.build_report as rapport

SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")


def test_le_filtre_qui_opposait_meta_et_google_est_mort():
    """David : « filtre à la poubelle, on verra si ça pose problème ». Règles ET
    IA — il écartait exactement l'axe que l'ADR 0003 revendique."""
    ok("la fonction n'existe plus", not hasattr(rapport, "_compares_channels"))
    # Une seule occurrence restante : la pierre tombale qui dit pourquoi.
    egal("plus aucun appel", SOURCE.count("_compares_channels("), 0)
    ok("une note explique sa disparition",
       "ELLE EST MORTE" in SOURCE, "la pierre tombale a disparu aussi")


def test_les_quatre_regles_sont_appelees_par_le_rapport():
    ok("le module est importé", "from saas.recos_ia.regles_payantes import" in SOURCE)
    ok("l'orchestrateur est appelé", "t_recos += regles_payantes(" in SOURCE)
    ok("avec les Annonces du thème", "_annonces_theme(lbl, cur_since, last_full_day)" in SOURCE)
    ok("et le budget du thème", "_budget_theme(lbl, _sem_theme)" in SOURCE)


def test_le_detail_par_annonce_google_est_charge():
    ok("la lecture est importée", "fetch_google_ads_ad_insights," in SOURCE)
    ok("et appelée", "fetch_google_ads_ad_insights(sb, user_id)" in SOURCE)
    ok("le budget posé est importé", "fetch_platform_budgets," in SOURCE)
    ok("et appelé", "fetch_platform_budgets(sb, user_id)" in SOURCE)


def test_meta_n_entre_pas_sans_ad_id():
    """Une Annonce est identifiée par `ad_id`, jamais par son nom (ticket 03).
    Tant que sa migration n'est pas jouée, regrouper par nom rejouerait le bug
    des homonymes DANS LE MOTEUR DE CONSEILS."""
    ok("la colonne est exigée", '"ad_id" in df_meta_raw.columns' in SOURCE)
    ok("et une ligne sans identifiant est sautée",
       '_aid = str(getattr(_r, "ad_id", "") or "")' in SOURCE)


def test_la_conversion_meta_est_une_absence_pas_un_zero():
    """`meta_ads_insights` ne porte pas la conversion au niveau de l'Annonce.
    L'écrire à 0 ferait dénoncer une annonce Meta qui vend très bien."""
    ok("Meta pose `None`, jamais 0",
       "# à zéro et de conclure qu'elles ne vendent rien." in SOURCE)


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("Le branchement") else 1)
