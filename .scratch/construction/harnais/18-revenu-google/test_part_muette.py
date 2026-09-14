"""UN ROAS DONT UNE PART DE LA DÉPENSE NE PEUT PAS RAPPORTER DOIT LE DIRE.

Les deux côtés de la division n'ont jamais le même périmètre : la dépense entre
par la campagne (identifiant chez Google, nom chez Meta), le revenu entre par le
NOM que Google Analytics a enregistré en `utm_campaign`. Une campagne étiquetée
dont le nom n'apparaît nulle part dans `ga4_insights` verse donc sa dépense au
dénominateur sans pouvoir jamais verser son revenu au numérateur : **le ROAS est
écrasé, et rien ne le disait.**

Mesuré sur le compte de production le 2026-09-13 : **10 thèmes jugés sur 17**
sont dans ce cas, pour **48 431 CHF de dépense sur 90 515** — 9 à cause de Meta
seul, dont les noms de campagne ne reprennent presque jamais l'`utm_campaign`.
Exemple lu en base : le thème « Frühlings », ROAS publié **0.00**, dont
**100 %** de la dépense muette.

TRANCHÉ AVEC DAVID : on publie le ROAS et on écrit la part muette à côté. Se
taire complètement — la première réponse — aurait vidé 59 % des thèmes de leur
seul chiffre de rentabilité, une conséquence que la question ne montrait pas.

    python3.12 test_part_muette.py
"""
import pulse  # noqa: F401
from t import ok, egal, proche, bilan

from lecteur_fige import Campagne, compte
from saas.traitement.build_report import build_payload


def carte(payload, label):
    return next((t for t in payload.get("themes_focus", []) if t["label"] == label), None)


def resume(payload, label):
    return (carte(payload, label) or {}).get("summary") or {}


def paye(nom, theme, depense, revenu, canal="google"):
    """`revenu=None` : GA4 ne connaît pas ce nom — la campagne est MUETTE.
    `revenu=0.0` : GA4 connaît le nom, il n'a rien rapporté — c'est mesuré."""
    return Campagne(nom=nom, theme=theme, canal=canal, depense_jour=depense,
                    clics_jour=50, impressions_jour=2000, revenu_jour=revenu)


# UN COMPTE OÙ GOOGLE ANALYTICS RÉPOND. Sans ce témoin, le compte entier serait
# aveugle et la vue se tairait sur TOUT (`ga4_present`, bloc 2 de la vue) — on
# ne mesurerait plus la part muette d'un thème mais l'absence de GA4, qui est
# une autre question et déjà traitée ailleurs. C'est aussi la situation réelle :
# en production, GA4 répond et ce sont CERTAINS thèmes qui sont muets.
TEMOIN = paye("temoin_rattachable", "Témoin", 50.0, 120.0)


def avec_temoin(*campagnes, etoiles):
    return compte([*campagnes, TEMOIN], etoiles=etoiles)


# ── 1 · LE CAS MESURÉ EN PRODUCTION ──────────────────────────────────────────

def test_un_theme_entierement_muet_publie_sa_part_a_cent_pour_cent():
    """Le thème « Frühlings » : une seule campagne, dont GA4 ignore le nom.
    Son ROAS de 0.00 n'est pas une contre-performance, c'est un angle mort."""
    p = build_payload(avec_temoin(paye("frühlings", "Frühlings", 20.0, None),
                                  etoiles=("Frühlings", "Témoin")))
    r = resume(p, "Frühlings")
    egal("toute la dépense est muette", r.get("spend_muette"), r.get("spend"))
    egal("une campagne muette", r.get("campagnes_muettes"), 1)
    proche("la part muette vaut 1", r.get("part_muette"), 1.0)


def test_un_theme_entierement_rattachable_annonce_zero_et_pas_none():
    """Zéro n'est PAS « on ne sait pas » : ici on sait, et on le dit. C'est ce
    qui rend la mention lisible quand elle apparaît ailleurs."""
    p = build_payload(avec_temoin(paye("e-bike", "e-bike", 20.0, 30.0),
                                  etoiles=("e-bike", "Témoin")))
    r = resume(p, "e-bike")
    egal("rien de muet", r.get("spend_muette"), 0.0)
    egal("aucune campagne muette", r.get("campagnes_muettes"), 0)
    proche("la part muette vaut 0", r.get("part_muette"), 0.0)


def test_un_revenu_nul_mesure_n_est_pas_une_part_muette():
    """LA DISTINCTION QUI PORTE TOUT LE TICKET. Une campagne que GA4 connaît et
    qui n'a rien rapporté est MESURÉE : son ROAS de 0 est un vrai résultat. Une
    campagne dont GA4 ignore le nom n'est pas mesurée du tout."""
    p = build_payload(avec_temoin(paye("gravel", "Gravel", 20.0, 0.0),
                                  etoiles=("Gravel", "Témoin")))
    r = resume(p, "Gravel")
    egal("rien de muet malgré un revenu nul", r.get("spend_muette"), 0.0)
    egal("et aucune campagne muette", r.get("campagnes_muettes"), 0)


# ── 2 · LE MÉLANGE, QUI EST LE CAS ORDINAIRE ─────────────────────────────────

def test_la_part_muette_se_calcule_sur_la_depense_pas_sur_le_nombre():
    """C'est la PART de dépense qui dit si un ROAS mérite d'être lu, jamais le
    nombre de campagnes : une petite campagne muette à côté d'une grosse
    rattachable ne change presque rien au ratio."""
    p = build_payload(avec_temoin(paye("grosse", "Mixte", 90.0, 200.0),
                                  paye("petite", "Mixte", 10.0, None),
                                  etoiles=("Mixte", "Témoin")))
    r = resume(p, "Mixte")
    egal("une seule campagne muette sur deux", r.get("campagnes_muettes"), 1)
    proche("mais un dixième de la dépense", r.get("part_muette"), 0.10)
    ok("la dépense publiée reste la somme des deux",
       r.get("spend") is not None and r.get("spend_muette") is not None
       and r["spend"] > r["spend_muette"],
       f"spend={r.get('spend')} muette={r.get('spend_muette')}")


def test_meta_est_concerne_autant_que_google():
    """9 des 10 thèmes touchés en production le sont à cause de Meta SEUL : le
    pont passe par le nom pour les DEUX régies, et un nom de campagne Meta ne
    reprend presque jamais l'`utm_campaign`."""
    p = build_payload(avec_temoin(paye("meta_muette", "Saison", 20.0, None, canal="meta"),
                                  etoiles=("Saison", "Témoin")))
    r = resume(p, "Saison")
    egal("une campagne Meta muette compte comme telle", r.get("campagnes_muettes"), 1)
    proche("et pèse toute la part", r.get("part_muette"), 1.0)


# ── 3 · CE QU'ON NE PRÉTEND PAS SAVOIR ───────────────────────────────────────

def test_sans_reponse_de_ga4_on_ne_dit_pas_zero():
    """Sur un compte où Google Analytics n'attribue rien, `revenue` est déjà
    NULL et aucun ROAS n'est publié. Annoncer « 0 CHF non rattachable » y
    affirmerait que tout est rattaché — l'inverse de la vérité (§7)."""
    p = build_payload(compte([paye("a", "Muet", 20.0, None),
                              paye("b", "Muet", 20.0, None)],
                             etoiles=("Muet",)))
    r = resume(p, "Muet")
    egal("pas de revenu", r.get("revenue"), None)
    egal("donc pas de ROAS", r.get("roas"), None)
    ok("et la part muette ne se prononce pas non plus",
       r.get("part_muette") is None or r.get("spend_muette") is not None,
       f"part={r.get('part_muette')} muette={r.get('spend_muette')}")


def test_la_depense_publiee_n_est_jamais_amputee():
    """L'option « écarter cette dépense du dénominateur » a été écartée : elle
    remplaçait un ROAS écrasé par une dépense fausse. La dépense affichée reste
    la dépense réelle, muette comprise."""
    p = build_payload(avec_temoin(paye("vue", "Mixte2", 60.0, 100.0),
                                  paye("muette", "Mixte2", 40.0, None),
                                  etoiles=("Mixte2", "Témoin")))
    r = resume(p, "Mixte2")
    ok("la dépense contient la part muette",
       r.get("spend") is not None and r.get("spend_muette") is not None
       and r["spend"] > r["spend_muette"],
       f"spend={r.get('spend')} muette={r.get('spend_muette')}")
    proche("deux cinquièmes muets", r.get("part_muette"), 0.40)


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("Ticket 18 — la part muette") else 1)
