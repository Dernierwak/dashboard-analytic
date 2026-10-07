"""La synchronisation Meta Ads : ordre des appels et écritures.

Les appels vivent un par fichier dans ce dossier (`comptes`, `budgets`,
`activites`, `creas`, `images`, `insights`, `campagnes`) et ne touchent jamais
Supabase ; les envois vivent dans `saas/data/supabase/source_data/`. Ce fichier enchaîne
les deux, dans l'ordre que les dépendances imposent.
"""
from __future__ import annotations

from datetime import date, timedelta

from saas.data.supabase.source_data.meta import (
    BUCKET_CREAS, remplacer_creas, televerser_image, upsert_campaign_statuses,
    upsert_meta_ads,
)
from saas.data.supabase.source_data.platform import journal_changements, photo_budget
from saas.data.fetch_data.sources.meta.ads.fetchers import accounts as comptes
from saas.data.fetch_data.sources.meta.ads.fetchers import activities as activites
from saas.data.fetch_data.sources.meta.ads.fetchers import budgets, creatives as creas, images, insights
from saas.data.fetch_data.sources.meta.ads.fetchers import campaigns as campagnes_api
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.shared.date_ranges import Fenetre, depart_recolte
from saas.data.fetch_data.shared.http_client import sans_jeton
from saas.data.supabase.fetch_state.state import (
    fetch_images_creas_stockees, fetch_meta_ads_latest_date, fetch_meta_hierarchie,
)

# ── LA FENÊTRE DES CHANGEMENTS ────────────────────────────────────────────────
#
# Google n'en garde que 30 jours (`google/ads/sync.py`, pavé « LES DEUX
# RÉGIES ») ; une seule constante pour les deux faisait perdre à Meta ce que
# Google ne peut pas donner.
#
# Meta — 180 jours, et c'est un PARI ASSUMÉ, pas une garantie lue quelque part.
# Ce que la doc dit vraiment de l'edge `activities` : `since` = « The start time
# to query account history. Default is 7 days prior », `until` = « Default is
# now » ; la page de l'edge au niveau COMPTE, elle, ne documente aucun paramètre
# et aucune rétention. Donc : aucune limite de fenêtre et aucun plafond de
# pagination ne sont écrits nulle part — mais un silence de la doc n'est pas une
# promesse, et personne n'a encore appelé l'edge avec un `since` à six mois (pas
# de token dans cet environnement). Ce qui EST certain, c'est que les 30 jours
# qu'on infligeait ici étaient une symétrie avec Google que Meta n'a jamais
# demandée. Si Meta refusait la fenêtre, la récolte le dirait sans rien casser :
# `journal_changements` est best-effort et imprime l'erreur.
# https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/activities/
# https://developers.facebook.com/docs/marketing-api/reference/ad-activity/
#
# Six mois plutôt qu'un an, parce que c'est le premier chiffre qui rend le
# worker RATTRAPABLE sans rendre la pagination folle : le fil n'affiche que
# 60 jours, une récolte arrêtée quatre mois se rattrape donc entièrement au
# redémarrage, et `activites.recuperer` borne son nombre de pages
# (`_ACTIVITES_PAGES_MAX`), ce qui plafonne le coût d'un compte très actif.
#
# La fenêtre est redemandée EN ENTIER à chaque passage, jamais depuis le dernier
# connu : c'est ce qui rattrape un worker à l'arrêt. L'écriture est idempotente
# — `platform_changes` est upserté sur `change_id`.
_CHANGES_JOURS_META = 180

# ── LE RECOUVREMENT — pourquoi on relit des jours déjà connus : pavé « LE
# RECOUVREMENT » de `socle/date_ranges.py`. Ce qui est propre à Meta :
#
# Meta — 28 jours, la borne que Meta documente : « Insights refresh every 15
# minutes and do not change after 28 days of being reported ». En deçà, un jour
# connu peut encore changer chez Meta ; au-delà, plus rien ne bouge, et le relire
# ne sert à rien. 7 laissait 21 jours où Meta corrigeait sans que personne
# relise — la soustraction de deux nombres de la doc, pas une hypothèse.
# Les actions — donc `results`, la colonne « Résultats » — ont une raison
# connue de bouger : depuis le 10 juin 2025 l'API suit le réglage
# d'attribution de chaque ad set et rapporte en `action_report_time=mixed` :
# une action sur Meta (un clic sur le lien) se
# pose au jour de l'IMPRESSION, donc jusqu'à la fenêtre de l'ad set en arrière ;
# une action hors Meta (un achat pixel) au jour de la CONVERSION. La doc ne dit
# pas quelle part des corrections survient après le 7e jour : 28 se justifie
# par la borne, pas par une mesure.
# https://developers.facebook.com/docs/marketing-api/insights/best-practices/
# Sources lues et citées : .scratch/meta-ads/recherche/champs-api-meta.md §3.
_RECOUVREMENT_JOURS_META = 28

# Meta : « the start date of the time range cannot be beyond 37 months from the
# current date ». 1 126 jours, et pas `37 * 30` : trente-sept mois de 30 jours
# font 1 110 jours, soit 36,5 mois — on refuserait des dates que l'API accepte,
# en affichant « dépasse les 37 mois ». Le chiffre est celui de la note
# PROFONDEUR D'HISTORIQUE de `socle/date_ranges.py`.
_PROFONDEUR_META_JOURS = 1126


def _rien(_etape: str) -> None:
    return None


class SchemaEnRetard(RuntimeError):
    """Le schéma en base est en retard sur le code — colonne absente (42703) ou
    contrainte d'unicité pas encore déplacée (42P10). Rattrapable en jouant la
    migration ; jamais silencieux, parce qu'un silence ici se lit comme une
    baisse de dépense."""


# Les colonnes que `lignes_meta_ads` écrit en plus du socle historique :
# `ad_id` (section ad_id du `000`), puis les quatre du ticket 02
# (`.scratch/meta-ads/tickets/02-le-schema-meta-s-elargit.md`). Une seule
# absente fait refuser l'upsert ENTIER par PostgREST (PGRST204), donc toute la
# dépense Meta de la semaine.
COLONNES_META_ECRITES = "ad_id,campaign_id,adset_id,attribution_setting,results"


def colonnes_meta_presentes(sb) -> bool:
    """Les colonnes que la récolte écrit existent-elles dans meta_ads_insights ?

    Un `select` d'une seule ligne suffit : PostgREST refuse la requête entière
    avec le code Postgres `42703` (« undefined_column ») quand UNE des
    colonnes demandées n'existe pas, et rend `data: []` sans erreur quand la
    table est simplement vide. Les deux cas ne se confondent donc pas.

    SEUL 42703 rend False. Un `except Exception` large lirait une coupure
    réseau comme une colonne manquante : on sauterait la récolte Meta d'une
    semaine sur un hoquet, et on la rendrait rouge pour rien. Tout autre échec
    remonte donc tel quel — le fil l'attrape déjà et marque le canal en échec,
    sans prétendre en connaître la cause.
    """
    try:
        sb.table("meta_ads_insights").select(COLONNES_META_ECRITES).limit(1).execute()
        return True
    except Exception as e:
        if getattr(e, "code", None) == "42703":
            return False
        raise


def _hierarchie(sb, uid) -> dict:
    """Ensemble ou annonce → campagne, lu dans meta_ads_insights.

    SEULE L'ABSENCE DES COLONNES (42703, 000 pas encore joué) rend un
    dictionnaire vide : aucune ligne n'a jamais porté de campagne parente,
    il n'y a rien à perdre. Tout autre échec LÈVE, et `journal_changements`
    saute le journal de ce passage : écrire avec une hiérarchie vide
    réécrirait par upsert à NULL la campagne de chaque changement déjà
    rattaché.
    """
    try:
        return activites.hierarchie_depuis_insights(fetch_meta_hierarchie(sb, uid))
    except Exception as e:
        if getattr(e, "code", None) == "42703":
            print("    changements meta : colonnes campaign_id/adset_id absentes, "
                  "rattachement à la campagne sauté — jouer le 000.")
            return {}
        raise


def _changements(sb, uid, acces: AccesMeta, today: date) -> tuple[list[dict], list[str]]:
    """Les activités des 180 derniers jours, traduites en lignes de platform_changes.

    La hiérarchie est lue AVANT l'appel : si elle lève, le journal de ce
    passage est sauté sans qu'aucun appel Meta n'ait été fait (voir `_hierarchie`).
    Une liste tronquée s'écrit — ce qui a été lu est bon — mais se dit.
    """
    parents = _hierarchie(sb, uid)
    actes, trous = activites.recuperer(
        acces, Fenetre(today - timedelta(days=_CHANGES_JOURS_META), today))
    if actes:
        for err in trous:
            print(f"    activités Meta : {err} — la suite est ignorée.")
    return activites.lignes_activites(actes, parents, acces.fuseau), ([] if actes else trous)


def _creas(sb, uid, acces: AccesMeta) -> None:
    """Le contenu de chaque annonce et ses visuels. Best-effort, JAMAIS
    bloquant — même raison que `photo_budget` : le Panneau se passe d'un
    texte, pas le rapport d'une semaine d'insights.

    Une image n'est téléchargée et envoyée que si son hash n'est pas déjà dans
    le bucket : c'est le poste cher de la récolte (`.scratch/meta-ads/map.md`,
    « Les quotas de l'API Meta »), et une image ne change pas sous son hash.
    """
    try:
        annonces, trous = creas.recuperer(acces)
        for err in trous:
            print(f"    créas meta : liste incomplète, {len(annonces)} annonce(s) "
                  f"relue(s) : {sans_jeton(err)}")
        stockees = fetch_images_creas_stockees(sb, uid, BUCKET_CREAS)
        manquants = sorted(creas.hashes_des_creas(annonces) - set(stockees))
        urls, trous_images = images.recuperer(acces, manquants)
        for err in trous_images:
            print(f"    créas meta : {sans_jeton(err)}")
        for image_hash, url in urls.items():
            public = televerser_image(sb, uid, image_hash, url)
            if public:
                stockees[image_hash] = public
        lignes, assets, sans_id = creas.lignes_creas(uid, annonces, stockees)
        remplacer_creas(sb, uid, lignes, assets)
        sans_visuel = sum(1 for h in manquants if h not in stockees)
        # Le décompte se dit à chaque passage : un visuel absent de l'écran se
        # lit ici comme « pas encore téléversé », pas comme un oubli.
        print(f"    créas meta : {len(lignes)} annonce(s), {len(assets)} asset(s), "
              f"{len(manquants) - sans_visuel} image(s) téléversée(s), "
              f"{sans_visuel} restée(s) sans visuel"
              + (f", {sans_id} annonce(s) sans id ignorée(s)" if sans_id else ""))
    except Exception as e:
        print(f"    créas meta KO : {sans_jeton(str(e))}")


def recolter(sb, uid, jeton: str, note=_rien, since_forcee: date | None = None) -> str:
    # `note` marque une étape FRANCHIE, pas un pourcentage : la séquence est
    # écrite ici, mais le nombre d'appels de chacune ne l'est pas.
    note("comptes")
    liste, _ = comptes.recuperer(AccesMeta(jeton=jeton))
    compte, fuseau = comptes.compte_et_fuseau(liste)
    if not compte:
        return "meta: aucun compte pub"
    acces = AccesMeta(jeton=jeton, compte=compte, fuseau=fuseau)
    today = date.today()
    note("budgets")
    # Avant tout test de fraîcheur : la photo du budget doit être prise même
    # quand les insights sont déjà à jour. Sinon un compte qui ne dépense plus
    # n'aurait plus aucun relevé, et la page Coûts le lirait « rien de prévu ».
    photo_budget(sb, uid, "meta", lambda: budgets.recuperer(acces), today)
    note("changements")
    # La hiérarchie se lit en base, AVANT les insights de ce passage : un
    # ensemble créé depuis le dernier passage reste sans campagne aujourd'hui,
    # et la gagne au suivant — la fenêtre de 180 jours relit le même changement
    # et l'upsert sur `change_id` réécrit sa campagne.
    journal_changements(sb, uid, "meta", lambda: _changements(sb, uid, acces, today))
    note("créas")
    # Avant le garde-fou des insights, comme les budgets : les créas ne
    # touchent pas meta_ads_insights et n'ont pas à attendre ses colonnes.
    _creas(sb, uid, acces)
    note("insights")
    # LE GARDE-FOU SE POSE AVANT LA PREMIÈRE REQUÊTE D'INSIGHTS, pas juste
    # avant l'écriture : sans ses colonnes, ces appels ne servent à rien et
    # `upsert_meta_ads` upserterait sur une clé de conflit inexistante. Les
    # budgets et le journal des changements, eux, sont déjà passés — ils ne
    # touchent pas cette table et n'ont pas à être punis.
    if not colonnes_meta_presentes(sb):
        raise SchemaEnRetard(
            f"une colonne de meta_ads_insights manque ({COLONNES_META_ECRITES}) — "
            "écriture Meta Ads sautée. "
            "Jouer saas/data/supabase/migrations/000_run_me_all.sql, puis relancer. "
            "La run finit ROUGE exprès : sans ça, cette semaine de dépense manquerait "
            "en silence et le rapport la lirait comme une baisse.")
    if since_forcee:
        # La date imposée REMPLACE le point de reprise, elle ne s'y ajoute pas :
        # inutile d'aller lire la dernière date connue, on repart d'où on a dit.
        since = since_forcee
        print(f"    meta: départ forcé au {since} (rejeu d'historique)")
    else:
        since = depart_recolte(fetch_meta_ads_latest_date(sb, uid),
                                today, _RECOUVREMENT_JOURS_META)
    # Le raccourci « meta: à jour » a disparu, et pas par distraction : avec un
    # recouvrement il ne pouvait plus se déclencher (`latest - 28` est toujours
    # antérieur à aujourd'hui), et surtout il n'a plus de sens. Il n'y a plus de
    # « à jour » — il y a une fenêtre qu'on relit à chaque passage.
    rows, trous = insights.recuperer(acces, Fenetre(since, today))
    if trous:
        # UN REJEU INCOMPLET NE S'ÉCRIT PAS. Sur un rejeu, chaque tranche
        # manquante est une période dont les lignes gardent leur `ad_id` à
        # NULL : écrire le reste donnerait une base à moitié réparée qu'aucune
        # trace ne distingue d'une base réparée. On préfère ne rien écrire et
        # redemander le même rejeu.
        # Sur une récolte de ROUTINE, au contraire, on écrit ce qu'on a : la
        # fenêtre de recouvrement de 28 jours redemandera les dates manquées
        # au prochain passage, et refuser d'écrire perdrait aussi les tranches
        # réussies.
        if since_forcee:
            raise RuntimeError(
                f"rejeu depuis {since_forcee} INCOMPLET, rien n'a été écrit — "
                f"{len(trous)} tranche(s) refusée(s) par Meta : {' | '.join(trous)}. "
                f"Relancer la même récolte complète (full_history.py).")
        print(f"    meta: {len(trous)} tranche(s) incomplète(s), "
              f"reprises au prochain recouvrement : {' | '.join(trous)}")
    # On demande aussi les dates DECLAREES. Elles ne se deduisent pas de la
    # depense : une campagne programmee jusqu'en decembre et une campagne
    # arretee hier laissent exactement la meme trace dans les insights.
    note("statuts")
    campagnes, trous_statuts = campagnes_api.recuperer(acces)
    trou_statuts = " | ".join(trous_statuts)

    lignes_config, sans_id_campagne = campagnes_api.lignes_config_meta(uid, campagnes)
    if sans_id_campagne:
        print(f"    meta: {sans_id_campagne} campagne(s) sans id, ignorées")
    # LE COMPTE SE DIT À CHAQUE PASSAGE, MÊME QUAND TOUT VA BIEN. C'est le seul
    # repère qui sépare « ce compte a 200 campagnes » de « on s'est arrêté à
    # 200 » dans une run verte — le défaut d'origine tenait entièrement dans ce
    # silence-là.
    if trou_statuts:
        # La run reste VERTE : ces statuts ne portent aucune dépense, et une
        # semaine d'insights vaut plus qu'une liste de campagnes complète. Les
        # campagnes non vues gardent le statut de la récolte précédente —
        # `upsert_campaign_statuses` ne touche que les lignes qu'on lui donne.
        print(f"    meta: liste des campagnes INCOMPLÈTE, "
              f"{len(lignes_config)} campagne(s) vue(s) : {trou_statuts}")
    else:
        print(f"    meta: {len(lignes_config)} campagne(s) déclarée(s)")
    # LES STATUTS S'ÉCRIVENT SEULS, ILS N'ATTENDENT PLUS UNE DÉPENSE. Cette
    # écriture vivait sous le `if rows:` des insights, alors qu'elle vient
    # d'une autre requête et remplit une autre table. Un compte qui ne dépense
    # plus — ou dont toutes les tranches d'insights ont échoué — n'écrivait
    # donc aucun statut, et `channels.ts` / `couverture.ts` montraient
    # l'`ACTIVE` de la dernière semaine dépensière comme s'il était courant,
    # sur une run verte qui venait d'imprimer le nombre de campagnes vues.
    # `upsert_campaign_statuses` rend la main sur une carte vide : rien à
    # garder ici.
    sautees = upsert_campaign_statuses(sb, uid, lignes_config)
    if sautees:
        print(f"    meta: {sautees} campagne(s) homonyme(s) sans statut ni ID — "
              "la base porte encore l'ancienne clé de campagne")
    # `effective_status` ne se pose plus sur la ligne d'insight : personne ne le
    # lisait. `upsert_meta_ads` ne l'envoie pas — le statut vit dans
    # `meta_campaign_config`, une table par CAMPAGNE, pas par date. Le poser ici
    # ne faisait qu'une chose : fabriquer un « UNKNOWN » pour toute campagne
    # absente d'une liste tronquée.
    records, sans_id = insights.lignes_meta_ads(uid, rows)
    if sans_id:
        print(f"    meta: {sans_id} ligne(s) sans ad_id, ignorées")
    if records:
        # LA MIGRATION A DEUX MOITIÉS, ET LA SECONDE NE SE VOIT QU'ICI. Le
        # garde-fou plus haut prouve que la COLONNE existe ; il ne prouve pas
        # que la CONTRAINTE d'unicité a été déplacée sur `ad_id`. Une base où
        # seul l'`ADD COLUMN` a été joué laisse passer le garde-fou, puis fait
        # échouer l'upsert sur `42P10` (« no unique constraint matching the ON
        # CONFLICT specification »). Sans ce rattrapage, cet échec-là ne serait
        # qu'un canal en erreur : run verte, rapport publié, email parti sur
        # une semaine sans dépense Meta.
        try:
            upsert_meta_ads(sb, uid, records)
        except Exception as e:
            if getattr(e, "code", None) == "42P10":
                raise SchemaEnRetard(
                    "la contrainte d'unicité de meta_ads_insights ne porte pas encore "
                    "sur ad_id (42P10) — migration jouée à moitié, écriture Meta Ads "
                    "sautée. Rejouer saas/data/supabase/migrations/000_run_me_all.sql en ENTIER "
                    "(section ad_id), puis relancer.") from e
            raise
    return f"meta: {len(rows)} lignes"
