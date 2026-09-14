"""Un faux Graph API Meta, juste assez pour la liste des campagnes d'un compte.

POURQUOI UN FAUX GRAPH ET PAS UN FAUX CLIENT SUPABASE. Le défaut du ticket 21
n'est pas une écriture mal formée : c'est une LECTURE qui s'arrête à la
première page. Ce qu'on doit pouvoir observer, c'est le nombre de requêtes
parties et ce qui revient quand la deuxième échoue — pas une ligne en base.

Le faux Graph pagine comme le vrai : chaque réponse porte au plus `par_page`
campagnes et, tant qu'il en reste, un `paging.next` qui est une URL COMPLÈTE
(le vrai Graph y recopie le jeton — c'est pour ça que le code ne repasse aucun
`params` sur les pages suivantes).
"""
from urllib.parse import urlencode


class _Reponse:
    def __init__(self, charge):
        self._charge = charge

    def json(self):
        return self._charge


class FauxGraph:
    """Sert `/<compte>/campaigns` par pages. `appels` garde toutes les URL vues.

    `erreur_a_la_page` : numéro de page (1 = la première) qui lève une exception
    réseau au lieu de répondre. `erreur_meta` : objet `error` rendu en HTTP 200
    sur la première page, comme le vrai Graph le fait sur un jeton expiré.
    """

    def __init__(self, campagnes, par_page=200, erreur_a_la_page=None,
                 erreur_meta=None, comptes=("act_42",), curseur_sans_fin=False,
                 reponse_brute=None):
        self.campagnes = list(campagnes)
        self.par_page = par_page
        self.erreur_a_la_page = erreur_a_la_page
        self.erreur_meta = erreur_meta
        self.comptes = list(comptes)
        # `curseur_sans_fin` : chaque page est VIDE et porte quand même un
        # `paging.next`. Meta sait le faire, et la boucle tournait alors à
        # 30 s par requête sans jamais finir ni rien dire.
        self.curseur_sans_fin = curseur_sans_fin
        # `reponse_brute` : du JSON parfaitement valide qui n'est pas un objet
        # — ce que rend un proxy ou une page d'erreur intercalée.
        self.reponse_brute = reponse_brute
        self.appels = []

    def get(self, url, params=None, timeout=None):
        # `requests` FUSIONNE `params` dans l'URL avant de se connecter, et
        # c'est cette URL-là — jeton compris — qu'il recopie dans ses
        # exceptions. Le faux Graph fait pareil, sinon la fuite du premier
        # appel resterait invisible.
        complete = f"{url}?{urlencode(params)}" if params else url
        self.appels.append(complete)
        if url.endswith("/me/adaccounts"):
            return _Reponse({"data": [{"id": c} for c in self.comptes]})
        if "/campaigns" in url:
            return self._campaigns(complete)
        if "/insights" in url:
            return self._insights(complete)
        raise AssertionError(f"le harnais ne sert pas cette URL : {url}")

    def _insights(self, url):
        """Une tranche d'insights sur deux pages, la seconde en panne.

        `_meta_chunk` porte la même fuite de jeton que `_meta_campagnes`, par
        le même chemin : c'est le seul autre appel Meta qui imprime son
        exception. Le harnais le sert donc pour de vrai plutôt que de lire son
        code source.
        """
        if "after=" in url:
            raise ConnectionError(
                f"HTTPSConnectionPool(host='graph.example', port=443): "
                f"Max retries exceeded with url: {url}")
        return _Reponse({
            "data": [{"campaign_name": "camp-001", "ad_id": "1", "actions": []}],
            "paging": {"next": "https://graph.example/act_42/insights"
                               "?access_token=SECRET&after=2"},
        })

    # Les pages sont numérotées dans l'URL : la première n'a pas de curseur,
    # les suivantes portent `?after=<n>` — c'est le seul rôle du curseur ici.
    def _campaigns(self, url):
        page = int(url.split("after=")[1].split("&")[0]) if "after=" in url else 1
        if page == self.erreur_a_la_page:
            # LE MESSAGE RECOPIE L'URL, comme le fait `requests` pour de vrai
            # (`HTTPSConnectionPool(…): Max retries exceeded with url: …`). Une
            # exception au message propre laisserait passer la fuite de jeton
            # que ce harnais doit justement attraper.
            raise ConnectionError(
                f"HTTPSConnectionPool(host='graph.example', port=443): "
                f"Max retries exceeded with url: {url}")
        if self.reponse_brute is not None:
            return _Reponse(self.reponse_brute)
        if page == 1 and self.erreur_meta:
            return _Reponse({"error": {"message": self.erreur_meta}})
        if self.curseur_sans_fin:
            return _Reponse({"data": [], "paging": {
                "next": f"https://graph.example/act_42/campaigns"
                        f"?access_token=SECRET&after={page + 1}"}})
        debut = (page - 1) * self.par_page
        lot = self.campagnes[debut:debut + self.par_page]
        charge = {"data": lot}
        if debut + self.par_page < len(self.campagnes):
            charge["paging"] = {
                "next": f"https://graph.example/act_42/campaigns"
                        f"?access_token=SECRET&after={page + 1}"}
        return _Reponse(charge)


def campagne(nom, statut="ACTIVE", debut="2026-01-01T00:00:00+0000", fin=None):
    c = {"name": nom, "effective_status": statut, "start_time": debut}
    if fin:
        c["stop_time"] = fin
    return c


def lot(combien, statut="ACTIVE", prefixe="camp"):
    return [campagne(f"{prefixe}-{i:03d}", statut) for i in range(1, combien + 1)]
