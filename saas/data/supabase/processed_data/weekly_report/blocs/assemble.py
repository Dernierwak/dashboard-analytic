"""Assemble les blocs neufs du payload en un dict que `build_payload` fusionne.

UN BLOC QUI REND `None` N'ÉCRIT AUCUNE CLÉ. La page lit une clé absente comme
« rien à montrer ici » : une lecture ratée, ou un payload publié avant ce bloc,
ne la casse donc pas. `build_payload` ne publie que si `sources` est écrit.
"""

from __future__ import annotations

from saas.data.supabase.processed_data.weekly_report.blocs.canaux import canaux
from saas.data.supabase.processed_data.weekly_report.blocs.changements import changements_par_canal
from saas.data.supabase.processed_data.weekly_report.blocs.frise import frise_campagnes
from saas.data.supabase.processed_data.weekly_report.blocs.posts import frise_posts
from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine
from saas.data.supabase.processed_data.weekly_report.blocs.sources import sources_et_totaux


def blocs_neufs(lecteur, semaine: Semaine) -> dict:
    blocs: dict = {"semaine": semaine.en_payload()}

    sources = sources_et_totaux(lecteur, semaine)
    if sources is not None:
        blocs.update(sources)

    # L'état de chaque source se lit une fois, dans `sources` : la carte du
    # canal le reprend au lieu de le recalculer.
    par_canal = canaux(lecteur, semaine, sources)
    changements = changements_par_canal(lecteur, semaine)
    if par_canal is not None:
        for canal, liste in (changements or {}).items():
            if canal in par_canal:
                par_canal[canal]["changements"] = liste
        blocs["canaux"] = par_canal

    # Seules les sources branchées entrent dans la frise (spec, user story 48) :
    # `sources` le dit, comme pour la carte du canal.
    frise = frise_campagnes(lecteur, semaine, sources)
    posts = frise_posts(lecteur, semaine, sources)
    if frise is not None or posts is not None:
        frise = dict(frise or {})
        if posts is not None:
            frise["posts"] = posts
        blocs["frise"] = frise

    return blocs
