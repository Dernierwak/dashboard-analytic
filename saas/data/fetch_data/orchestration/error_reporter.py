"""Les alarmes de fin de run : ce qui doit faire finir le worker en ROUGE.

Rempli pendant le passage (`account_sync.py`), lu une fois à la fin par `signaler()`,
que les points d'entrée (`scheduled_update.py`, `full_history.py`) appellent
avant de rendre leur code de sortie. Ces ensembles vivaient en tête de
`fetch_all.py` jusqu'au ticket 07 de `.scratch/recolte/`.
"""
from __future__ import annotations

import threading

from saas.data.fetch_data.sources.meta.ads.sync import COLONNES_META_ECRITES, _RECOUVREMENT_JOURS_META

# UNE RUN VERTE SANS META EST PIRE QU'UNE RUN ROUGE. Si la colonne `ad_id`
# manque — SQL pas encore joué, code neuf déjà déployé — la récolte Meta ne
# peut pas écrire. Laisser la run finir au vert, c'est une semaine de dépense
# publicitaire absente que personne ne voit passer, et que le rapport de la
# semaine suivante lirait comme une BAISSE : un faux verdict, pas un trou
# visible.
#
# CE QUE CET ENSEMBLE NE FAIT PLUS : retenir la publication. Depuis le
# ticket 20, un trou de récolte ne fait plus taire le rapport entier — il fait
# taire les mesures qui le traversent, et le rapport NOMME le canal muet
# (`build_payload`, clé `canaux_muets`). Retenir ne couvrait qu'une cause sur
# cinq et privait le client du seul message capable de lui dire de reconnecter.
#
# CE QU'IL FAIT ENCORE, ET QUI RESTE UTILE : finir la run en ROUGE. C'est le
# seul signal qui dise à David qu'une migration attend — le client, lui, voit
# déjà le trou dans son rapport. Les fils
# Meta de plusieurs utilisateurs n'écrivent jamais en même temps (les profils
# se suivent en série), mais l'ensemble est quand même verrouillé — il coûte
# trois lignes et se relit sans avoir à vérifier cette hypothèse.
_ECRITURES_SAUTEES: set[str] = set()
_VERROU_SAUTEES = threading.Lock()


def note_ecriture_sautee(uid: str) -> None:
    with _VERROU_SAUTEES:
        _ECRITURES_SAUTEES.add(uid)


# LES PANNES QUI DURENT (ticket 47). Un canal muet UNE semaine est une note dans
# le rapport, et ça suffit : le prochain passage réussi réécrit la semaine
# trouée (ADR 0005). À la DEUXIÈME, le client a reçu deux fois la même absence
# poliment formulée, la run est restée verte, et personne n'a vu le compte
# dériver. On aurait remplacé un chiffre faux par un message que personne n'agit.
#
# L'ESCALADE CHANGE DE DESTINATAIRE, PAS DE VOLUME. Le client a DÉJÀ été
# prévenu par un bandeau ambre en tête du rapport avec un lien vers la
# reconnexion.
# Ce rouge-ci s'adresse à David, le seul qui puisse décrocher son téléphone.
#
# LE TUYAU EST CELUI QUI EXISTE DÉJÀ : GitHub envoie un email au propriétaire du
# dépôt quand un workflow échoue. Construire un webhook ou une page de statut
# pour une poignée de comptes serait de l'outillage d'exploitation avant d'avoir
# la preuve qu'on en a besoin. Tranché avec `vision-produit` le 2026-09-20.
#
# `report_only` LE REMPLIT AUSSI, et c'est voulu : c'est le mode par lequel on
# republie un rapport à la main, donc celui par lequel on vérifie. Taire le
# signal exactement là où on vient le chercher serait le rendre invisible au
# seul moment où on le regarde.
#
# Rempli dans la boucle des profils, qui se suivent en SÉRIE — pas de verrou,
# contrairement à `_ECRITURES_SAUTEES`, que les fils Meta touchent.
_CANAUX_QUI_DURENT: list[tuple[str, dict]] = []


def note_canaux_qui_durent(uid: str, canaux_muets: list[dict]) -> None:
    """Retient les canaux muets depuis au moins `SEUIL_ESCALADE` rapports.

    ON NE FILTRE PAS SUR `chiffres_tus`, et c'est la seule asymétrie voulue
    entre les deux destinataires. Le client ne voit que les canaux qui lui
    cachent quelque chose — alarmer sur un canal qui ne tait rien userait
    l'alarme. David, lui, les voit tous : un Google Ads mort depuis cinq
    semaines sur un compte 100 % organique ne cache rien AUJOURD'HUI et cassera
    tout le jour où ce client lancera sa première campagne.
    """
    from saas.data.supabase.processed_data.weekly_report.builder import SEUIL_ESCALADE
    _CANAUX_QUI_DURENT.extend(
        (uid, c) for c in (canaux_muets or [])
        if (c.get("semaines_muettes") or 0) >= SEUIL_ESCALADE)


def vu_par_le_client(canal: dict) -> bool:
    """Ce canal a-t-il été dit au client dans son rapport ?

    C'EST LE REVERS DE L'ASYMÉTRIE CI-DESSUS, et il ne va pas de soi. Les deux
    Le composant `canal-muet.tsx` ne montre que les canaux à `chiffres_tus`
    vrai ; David, lui, les voit tous. Donc pour la moitié
    exacte des cas que cette escalade existe pour attraper — le canal qui ne tait
    rien aujourd'hui — le client n'a RIEN reçu.

    Sans cette distinction, la run imprimerait « le client a déjà été prévenu »
    sur un canal dont il n'a jamais entendu parler : David en conclurait qu'il
    sait, ne l'appellerait pas, et l'escalade aurait acheté l'inverse de ce
    qu'elle promet.
    """
    return bool(canal.get("chiffres_tus"))


def signaler() -> bool:
    """Imprime les causes de rouge, toutes ; rend True s'il y en a une."""
    # LE ROUGE TOMBE À LA FIN, APRÈS TOUT LE RESTE. Google, GA4, Instagram et le
    # rapport ont fini leur travail — on ne perd pas une récolte
    # entière parce qu'une colonne Meta manque. Mais la run ne ment pas sur ce
    # qu'elle a écrit.
    #
    # DEUX CAUSES DE ROUGE, ET AUCUNE NE DOIT MASQUER L'AUTRE. Elles s'impriment
    # toutes les deux, puis on sort une seule fois : un `sys.exit` posé sous la
    # première aurait rendu la seconde invisible le jour où les deux tombent
    # ensemble — et c'est exactement le jour où il faut les lire.
    _rouge = False

    # LA PANNE QUI DURE (ticket 47). La ligne nomme de quoi AGIR : le compte, le
    # canal, depuis combien de rapports, et jusqu'à quel jour on a lu. Un run
    # rouge qui oblige à ouvrir Supabase pour savoir qui appeler est un signal
    # qu'on finit par ignorer — c'est le papier peint déplacé d'un cran.
    #
    # `mot` est le mot de la fin du worker, déjà imprimé tel quel plus haut dans
    # ce même journal : il nomme l'exception, jamais la valeur d'un jeton
    # (`CLAUDE.md` §7).
    if _CANAUX_QUI_DURENT:
        print(f"!! ÉCHEC : {len(_CANAUX_QUI_DURENT)} canal/canaux muets depuis "
              f"au moins deux rapports — une note dans le rapport ne suffit "
              f"plus (ticket 47).")
        for _uid, _c in _CANAUX_QUI_DURENT:
            _depuis = (f"lu jusqu'au {_c.get('depuis')}" if _c.get("depuis")
                       else "aucune donnée jamais reçue")
            # CE QUE LE CLIENT SAIT, DIT LIGNE PAR LIGNE. Sur un canal qui ne
            # tait aucun chiffre, la surface client se tait : il n'a
            # rien reçu. L'écrire ici est ce qui décide si David a besoin de
            # l'appeler ou seulement de reconnecter.
            #
            _su = ("le client peut le lire dans son rapport"
                   if vu_par_le_client(_c)
                   else "INVISIBLE POUR LE CLIENT — ce canal ne lui tait aucun "
                        "chiffre, il n'en a jamais entendu parler")
            print(f"   {_uid} · {_c.get('nom') or _c.get('canal')} — muet depuis "
                  f"{_c.get('semaines_muettes')} rapports, {_depuis} — "
                  f"{_c.get('mot')}")
            print(f"        → {_su}")
        print("   Reconnecter le canal sur le compte, puis relancer "
              "weekly-fetch.yml (user_id) : le recouvrement réécrira "
              "les semaines trouées.")
        _rouge = True

    if _ECRITURES_SAUTEES:
        print(f"!! ÉCHEC : écriture Meta Ads sautée pour {len(_ECRITURES_SAUTEES)} "
              f"utilisateur(s) — colonne absente de meta_ads_insights "
              f"({COLONNES_META_ECRITES}). "
              f"Leur rapport a été publié SANS chiffre de dépense Meta, en "
              f"nommant le trou (ticket 20). Le reste de la récolte a bien "
              f"tourné. Jouer saas/data/supabase/migrations/000_run_me_all.sql, puis "
              f"relancer : le recouvrement de {_RECOUVREMENT_JOURS_META} jours "
              f"rattrapera la semaine.")
        _rouge = True

    return _rouge
