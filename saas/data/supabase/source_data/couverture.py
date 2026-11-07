"""La couverture : jusqu'où chaque flux de chaque source a été récolté sans trou.

Ni les lignes d'insights (Meta n'écrit rien un jour sans diffusion) ni
`fetch_progress` (remis à zéro à chaque passage, `fini` même avec des tranches
refusées) ne distinguent une semaine sans diffusion d'une semaine non
récoltée. Cette table le fait : une plage `[sans_trou_depuis,
sans_trou_jusqu_au]` par (compte, source, flux), écrite seulement par un
passage qui n'a essuyé aucun refus.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from saas.data.fetch_data.shared.date_ranges import Fenetre
from saas.data.fetch_data.shared.http_client import sans_jeton
from saas.data.supabase.source_data.platform import _table_absente

_TABLE = "couverture_recolte"
_UN_JOUR = timedelta(days=1)


@dataclass(frozen=True)
class Couverture:
    depuis: date
    jusqu_au: date


def etendre(existante: Couverture | None, fenetre: Fenetre,
            trous: list) -> Couverture | None:
    """La couverture à écrire après un passage sur `fenetre`, ou None.

    La fin est la VEILLE de `fenetre.fin` : le jour du fetch est incomplet
    (CLAUDE.md §7). La plage ne s'étend que si elle touche l'acquise ; sinon
    il y a entre les deux des jours dont on ne sait rien, et la nouvelle
    plage repart du début du passage plutôt que d'enjamber ce trou — sans
    quoi une panne de plus d'un recouvrement passerait pour récoltée.
    `jusqu_au` ne recule jamais.
    """
    if trous:
        return None
    lue = Couverture(fenetre.debut, fenetre.fin - _UN_JOUR)
    if lue.jusqu_au < lue.depuis:
        return None
    if existante is None:
        return lue
    se_touchent = (lue.depuis <= existante.jusqu_au + _UN_JOUR
                   and lue.jusqu_au >= existante.depuis - _UN_JOUR)
    if se_touchent:
        jointe = Couverture(min(lue.depuis, existante.depuis),
                            max(lue.jusqu_au, existante.jusqu_au))
        return None if jointe == existante else jointe
    return lue if lue.jusqu_au > existante.jusqu_au else None


def debut_des_posts_complets(medias: list[dict], ids_en_base: set[str]) -> date:
    """Le premier jour à partir duquel chaque post de l'inventaire est en base.

    `medias` est l'inventaire COMPLET de Meta (`[{id, timestamp}]`) ; un
    gratuit n'importe pas ce qui est plus ancien que sa base, un post refusé
    par Meta n'est pas écrit (`_a_relire`), donc un post peut manquer. Le jour d'un post manquant n'est pas couvert : la couverture
    commence au lendemain du plus récent d'entre eux. Rien ne manque →
    `date.min` : l'inventaire est complet, aucun jour n'a de post inconnu.
    """
    manquants = [m["timestamp"][:10] for m in medias if str(m["id"]) not in ids_en_base]
    if not manquants:
        return date.min
    return date.fromisoformat(max(manquants)) + _UN_JOUR


def _lire(sb, uid: str, source: str, flux: str) -> Couverture | None:
    lignes = (sb.table(_TABLE)
              .select("sans_trou_depuis, sans_trou_jusqu_au")
              .eq("user_id", uid).eq("source", source).eq("flux", flux)
              .limit(1).execute().data) or []
    if not lignes:
        return None
    return Couverture(date.fromisoformat(lignes[0]["sans_trou_depuis"]),
                      date.fromisoformat(lignes[0]["sans_trou_jusqu_au"]))


def avancer_couverture(sb, uid: str, flux: tuple[str, str], fenetre: Fenetre,
                       trous: list) -> None:
    """Étend la couverture `(source, flux)` après un passage. JAMAIS bloquant.

    Lire puis écrire, parce que PostgREST n'a pas de `greatest` dans un
    upsert : c'est `etendre` qui garantit que la date ne recule pas. Une
    couverture manquée coûte un « — » sur la page ; une couverture qui fait
    échouer la récolte coûterait la semaine d'insights qu'elle décrit.
    """
    source, nom = flux
    try:
        neuve = etendre(_lire(sb, uid, source, nom), fenetre, trous)
        if neuve is None:
            return
        ecrites = sb.table(_TABLE).upsert({
            "user_id": uid, "source": source, "flux": nom,
            "sans_trou_depuis": neuve.depuis.isoformat(),
            "sans_trou_jusqu_au": neuve.jusqu_au.isoformat(),
            "maj_a": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id,source,flux").execute().data
        # Un refus RLS ne lève pas, il n'écrit rien (CLAUDE.md §8).
        if not ecrites:
            print(f"    couverture {source}/{nom} : aucune ligne écrite")
    except Exception as e:
        if _table_absente(e, _TABLE):
            print(f"    couverture {source}/{nom} : table {_TABLE} absente — lance "
                  "saas/data/supabase/migrations/000_run_me_all.sql")
        else:
            print(f"    couverture {source}/{nom} KO : {sans_jeton(str(e))}")
