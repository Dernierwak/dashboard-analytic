"""`frise.annee` et `frise.campagnes` : les campagnes de l'année, une barre par
campagne (ticket 07), et la fin d'une Google supprimée lue dans le journal
(ticket 09).

Les posts vivent dans `posts.py`, à part, pour que 08 et 09 ne se croisent pas.

IDENTITÉ PAR ID, JAMAIS PAR NOM. L'ancienne frise groupait par nom : le harnais
du ticket 14 a montré deux homonymes fusionnés en une barre et une campagne
renommée coupée en deux. Le nom affiché est le nom actuel — celui de la config,
sinon celui de la ligne d'insights la plus récente.

LE RAPPORT EST FIGÉ À `semaine.fin`. « Passée », « future », la dépense et le
dernier jour de dépense se jugent par rapport à elle, jamais par rapport au jour
du calcul : un rapport refait plus tard dit la même chose, et le jour du fetch,
incomplet, n'entre nulle part (`CLAUDE.md` §7).
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import UNE_SEMAINE, Semaine

CONFIG = {"meta": "meta_campaign_config", "google": "google_campaign_config"}
VISUELS_MAX = 4

VIVANTS = {"ACTIVE": "en_cours", "ENABLED": "en_cours", "PAUSED": "en_pause"}


@dataclass
class _Campagne:
    id: str
    plateforme: str
    config: dict | None = None
    nom_insights: str | None = None
    jour_nom_insights: date | None = None
    jours_depense: set[date] = field(default_factory=set)
    par_semaine: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    par_annonce: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    supprimee_le: date | None = None


def frise_campagnes(lecteur, semaine: Semaine) -> dict | None:
    """`None` quand une lecture échoue — même règle que `canaux.py` : une
    lecture ratée n'est pas une année sans campagne. La page tolère la clé
    absente, et le reste du rapport part."""
    try:
        creas = {c.get("ad_id"): c for c in lecteur.creas() if c.get("ad_id")}
        lectures = {
            "meta": (list(_lignes_meta(lecteur.meta_ads())),
                     lecteur.campagnes_config(CONFIG["meta"]) or []),
            "google": (list(_lignes_google(lecteur.google_ads())),
                       lecteur.campagnes_config(CONFIG["google"]) or []),
        }
    except Exception:
        return None
    suppressions = _suppressions_google(lecteur, semaine)

    campagnes = []
    for plateforme, (lignes, config_rows) in lectures.items():
        rangees = _rassembler(plateforme, lignes, config_rows, semaine)
        if plateforme == "google":
            for cid, jour in suppressions.items():
                if cid in rangees:
                    rangees[cid].supprimee_le = jour
        campagnes += sorted(
            (c for c in (_sortie(r, semaine, creas) for r in rangees.values()) if c is not None),
            key=lambda c: (c["debut"], c["id"]))
    return {"annee": semaine.fin.year, "campagnes": campagnes}


def _suppressions_google(lecteur, semaine: Semaine) -> dict[str, date]:
    """{campaign_id: jour de la suppression la plus récente}, lu dans le champ
    structuré du journal (`extra_data.statut.apres == "REMOVED"`), jamais dans
    la phrase. Les 10 premiers caractères suffisent : Google écrit l'heure du
    compte sans décalage, stockée telle quelle (`lib/changements-api.ts`).

    Une suppression après `semaine.fin` n'existe pas encore pour ce rapport
    figé. Une lecture du journal qui échoue rend {} : la frise retombe sur le
    repli (dernier jour de dépense), comme pour une suppression de plus de
    30 jours avant le premier passage outillé — `change_event` ne remonte pas
    plus loin (`CLAUDE.md` §8)."""
    try:
        lignes = list(lecteur.statuts_google() or [])
    except Exception:
        return {}
    out: dict[str, date] = {}
    for ligne in lignes:
        statut = (ligne.get("extra_data") or {}).get("statut") or {}
        jour, cid = _jour(ligne.get("occurred_at")), ligne.get("campaign_id")
        if statut.get("apres") != "REMOVED" or not cid or jour is None or jour > semaine.fin:
            continue
        cid = str(cid)
        if cid not in out or jour > out[cid]:
            out[cid] = jour
    return out


# ── Lecture des insights ─────────────────────────────────────────────────────

def _lignes_meta(rows):
    for r in rows:
        yield r, float(r.get("spend") or 0)


def _lignes_google(rows):
    # Google donne la dépense en micros de la devise du compte.
    for r in rows:
        yield r, float(r.get("cost_micros") or 0) / 1_000_000


def _jour(x) -> date | None:
    try:
        return date.fromisoformat(str(x)[:10]) if x else None
    except ValueError:
        return None


def _rassembler(plateforme, lignes, config_rows, semaine: Semaine) -> dict[str, _Campagne]:
    rangees: dict[str, _Campagne] = {}

    def rangee(cid) -> _Campagne:
        return rangees.setdefault(cid, _Campagne(id=cid, plateforme=plateforme))

    for ligne, depense in lignes:
        cid, jour = ligne.get("campaign_id"), _jour(ligne.get("date_start"))
        # Après `semaine.fin` : le jour du fetch, partiel, ou un rapport refait
        # plus tard — hors du rapport figé.
        if not cid or jour is None or jour > semaine.fin:
            continue
        c = rangee(str(cid))
        nom = ligne.get("campaign_name")
        if nom and (c.jour_nom_insights is None or jour >= c.jour_nom_insights):
            c.nom_insights, c.jour_nom_insights = str(nom), jour
        if depense <= 0:
            continue
        c.jours_depense.add(jour)
        c.par_semaine[_fin_de_semaine(jour, semaine).isoformat()] += depense
        if ligne.get("ad_id"):
            c.par_annonce[str(ligne["ad_id"])] += depense

    # Une ligne de config sans ID (Meta d'avant le ticket 13 de meta-ads) n'est
    # jamais rattachée par son nom : elle reste dehors.
    for cfg in config_rows:
        if cfg.get("campaign_id"):
            rangee(str(cfg["campaign_id"])).config = cfg
    return rangees


def _fin_de_semaine(jour: date, semaine: Semaine) -> date:
    """Le dernier jour de la semaine calée sur le Jour de travail qui contient
    `jour` — la clé de `depense_par_semaine` (voir `lib/hebdo/frise.ts`)."""
    return semaine.fin - UNE_SEMAINE * ((semaine.fin - jour).days // 7)


# ── Une campagne de la frise ─────────────────────────────────────────────────

def _sortie(c: _Campagne, semaine: Semaine, creas: dict) -> dict | None:
    cfg = c.config or {}
    debut_declare, fin_declaree = _jour(cfg.get("start_date")), _jour(cfg.get("end_date"))
    if not _dans_l_annee(c, debut_declare, fin_declaree, semaine.fin.year):
        return None

    debut = debut_declare or (min(c.jours_depense) if c.jours_depense else None)
    if debut is None:
        return None
    statut = _statut(c.config, semaine)
    derniere_depense = max(c.jours_depense) if c.jours_depense else None

    if statut == "supprimee":
        # La date de suppression du journal (ticket 09) ; sinon le repli du
        # ticket 17 : le dernier jour de dépense, sinon un repère au début.
        # Jamais avant le début : la barre aurait une longueur négative.
        fin = max(c.supprimee_le, debut) if c.supprimee_le else (derniere_depense or debut)
        declaree = False
    elif fin_declaree is not None:
        fin, declaree = fin_declaree, True
    else:
        # Sans fin déclarée, `fin` est le dernier jour MESURÉ. Une campagne
        # vivante (en cours, en pause, problème) se dessine pourtant jusqu'au
        # 31 décembre, en pointillés après `semaine.fin` : la page le calcule,
        # il n'y a rien à stocker.
        fin, declaree = derniere_depense, False

    sortie = {
        "id": c.id,
        "plateforme": c.plateforme,
        "nom": str(cfg.get("campaign_name") or c.nom_insights or c.id),
        "debut": debut.isoformat(),
        "fin": fin.isoformat() if fin else None,
        "fin_declaree": declaree,
        "visuels": _visuels(c, creas),
        # Creux : seules les semaines qui ont dépensé, de la première qui
        # finit dans l'année jusqu'à `semaine.fin`.
        "depense_par_semaine": {k: round(v, 2) for k, v in sorted(c.par_semaine.items())
                                if k >= f"{semaine.fin.year}-01-01"},
    }
    # Clé ABSENTE, et non `None`, quand le statut n'a pas été récolté : la page
    # dit « statut inconnu » (spec, statut d'une campagne).
    if statut is not None:
        sortie["statut"] = statut
    return sortie


def _dans_l_annee(c: _Campagne, debut: date | None, fin: date | None, annee: int) -> bool:
    """A dépensé dans l'année, ou ses dates déclarées la touchent. Une fin non
    déclarée seule ne suffit pas : le prototype a mesuré des campagnes
    « actives » sans fin qui n'avaient rien diffusé depuis des années."""
    if any(j.year == annee for j in c.jours_depense):
        return True
    if debut is not None and debut.year == annee:
        return True
    if fin is not None and fin.year == annee:
        return True
    return (debut is not None and fin is not None
            and debut.year < annee < fin.year)


def _statut(cfg: dict | None, semaine: Semaine) -> str | None:
    """L'ordre de la spec. Meta n'a aucun statut « programmé » : `prevue` ne
    vient que d'un début déclaré futur. Un statut Google `null` retombe sur les
    dates, sinon reste inconnu."""
    if cfg is None:
        return None
    etat = cfg.get("effective_status")
    debut, fin = _jour(cfg.get("start_date")), _jour(cfg.get("end_date"))
    if etat == "REMOVED":
        return "supprimee"
    # Finie le dernier jour de la semaine, elle est finie quand le rapport sort.
    if fin is not None and fin <= semaine.fin:
        return "terminee"
    if etat == "WITH_ISSUES":
        return "probleme"
    if etat in VIVANTS:
        return VIVANTS[etat]
    if debut is not None and debut > semaine.fin:
        return "prevue"
    return None


def _visuels(c: _Campagne, creas: dict) -> list[str]:
    """Les créas des annonces, par dépense décroissante, sans doublon. Google
    n'en a pas : `par_annonce` reste vide (ses insights n'ont pas d'`ad_id`)."""
    if c.plateforme != "meta":
        return []
    vus: list[str] = []
    for ad_id, _ in sorted(c.par_annonce.items(), key=lambda kv: (-kv[1], kv[0])):
        crea = creas.get(ad_id) or {}
        url = crea.get("image_url") or crea.get("vignette_url")
        if url and url not in vus:
            vus.append(url)
        if len(vus) == VISUELS_MAX:
            break
    return vus
