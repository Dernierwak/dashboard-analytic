"""Rend l'email hebdomadaire — version mail de « L'essentiel » du rapport.

Email-safe : tables + styles inline + 600px (compatible Gmail / Outlook / mobile).
Ne dépend QUE de données déjà calculées (pas de Supabase ici) → testable seul.

Reprend la même hiérarchie que le rapport Streamlit :
  Vue d'ensemble (KPI) · Ce qui a marché · À faire cette semaine · lien vers le détail
"""

# Palette (identique au dashboard) + couleur d'accent par canal
INK = "#0e0f12"
MUTED = "#5a5d66"
FAINT = "#8b8e98"
BG = "#faf9f6"
LINE = "rgba(14,15,18,0.08)"
POS = "#1a7a4a"
BRAND = "#1a56ff"
WARN = "#8b6f00"   # ambre — « à reconnecter », pas « au feu »

CHANNEL_COLOR = {"instagram": "#7b4fff", "meta": "#1a56ff", "google": "#1a7a4a",
                 "pub": "#1a56ff", "ia": "#8b6f00"}
CHANNEL_LABEL = {"instagram": "Instagram", "meta": "Meta Ads", "google": "Google",
                 "pub": "Pub (Meta + Google)", "ia": "Piste"}


def _kpi_cell(label: str, value: str, sub: str = "") -> str:
    sub_html = f'<div style="font-size:11px;color:{FAINT};margin-top:3px;">{sub}</div>' if sub else ""
    return (
        f'<td style="padding:14px 16px;border:1px solid {LINE};border-radius:10px;'
        f'background:#ffffff;" valign="top">'
        f'<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;'
        f'color:{FAINT};font-weight:600;margin-bottom:6px;">{label}</div>'
        f'<div style="font-size:20px;font-weight:600;color:{INK};font-family:Menlo,Consolas,monospace;">{value}</div>'
        f'{sub_html}</td>'
    )


def _todo_row(n: int, title: str, channel: str) -> str:
    color = CHANNEL_COLOR.get(channel, FAINT)
    chan = CHANNEL_LABEL.get(channel, "")
    return (
        f'<tr><td style="padding:9px 0;border-bottom:1px solid {LINE};" valign="top">'
        f'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'<td valign="top" style="padding-right:10px;font-family:Menlo,Consolas,monospace;'
        f'font-size:13px;color:{FAINT};">{n}</td>'
        f'<td valign="top" style="padding-right:8px;">'
        f'<span style="display:inline-block;width:8px;height:8px;border-radius:2px;'
        f'background:{color};margin-top:5px;"></span></td>'
        f'<td valign="top">'
        f'<div style="font-size:14px;color:{INK};font-weight:500;line-height:1.4;">{title}</div>'
        f'<div style="font-size:11px;color:{FAINT};margin-top:1px;">{chan}</div>'
        f'</td></tr></table></td></tr>'
    )


def _fmt(n: float) -> str:
    """1234.5 → '1 235' (format suisse, sans décimales)."""
    return f"{n:,.0f}".replace(",", " ")


_MOIS = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet",
         "août", "septembre", "octobre", "novembre", "décembre")


def _jour_fr(iso: str) -> str:
    """« 2026-09-05 » → « 5 septembre ». Rend l'ISO tel quel s'il ne se lit pas.

    Les dates du payload sont des JOURS PLEINS, pas des instants : on découpe la
    chaîne au lieu de la passer par un fuseau, qui la reculerait d'un jour à
    l'ouest de Greenwich. Même arbitrage que `fmtJour` dans `canal-muet.tsx`.
    """
    try:
        annee, mois, jour = (int(x) for x in str(iso).split("-")[:3])
        return f"{jour} {_MOIS[mois - 1]}"
    except (ValueError, IndexError):
        return str(iso)


def _nom(canal: dict) -> str:
    """Le nom porté devant le client — « Meta Ads », jamais « meta »."""
    return canal.get("nom") or canal.get("canal") or "Un canal"


def _sans_reponse(canaux: list[dict]) -> str:
    """« Meta Ads ne répond plus depuis le 1 août », et sa version à plusieurs.

    CHAQUE CANAL PORTE SA PROPRE DATE. Une seule date pour plusieurs canaux
    daterait les uns du jour où l'autre est tombé — et `depuis` est une valeur
    MESURÉE (le dernier jour que ce canal a réellement écrit), pas une
    approximation qu'on aurait le droit d'étendre au voisin (`CLAUDE.md` §7).
    À plusieurs, chaque date passe donc entre parenthèses derrière son canal.

    Un canal qui n'a JAMAIS rien écrit n'a pas de date : il est nommé sans, et
    on ne lui en fabrique pas une.
    """
    if len(canaux) == 1:
        seul = canaux[0]
        quand = f" depuis le {_jour_fr(seul['depuis'])}" if seul.get("depuis") else ""
        return f"{_nom(seul)} ne répond plus{quand}"
    noms = " et ".join(
        f"{_nom(c)} (depuis le {_jour_fr(c['depuis'])})" if c.get("depuis")
        else _nom(c)
        for c in canaux)
    return f"{noms} ne répondent plus"


def email_from_payload(account_name: str, payload: dict, app_url: str) -> tuple[str, str]:
    """Adapte le payload weekly_reports (celui que Pulse lit) → (sujet, html email).

    Une seule source de vérité : le rapport publié. L'email en est la version boîte mail.
    """
    kpis_raw = payload.get("kpis") or {}
    spend = kpis_raw.get("spend")
    clicks = kpis_raw.get("clicks")
    ctr = kpis_raw.get("ctr")
    fdelta = kpis_raw.get("followers_delta")
    kpis = {
        "spend": f"{_fmt(spend)} CHF" if spend is not None else "—",
        "clicks": _fmt(clicks) if clicks is not None else "—",
        "ctr_sub": f"CTR {ctr:.2f} %" if ctr is not None else "",
        "followers": (f"{fdelta:+d}" if fdelta is not None else "—"),
    }

    # « Ce qui a marché » = brief (IA ou fallback), précédé du verdict pour le contexte.
    verdict = payload.get("verdict") or ""
    brief = payload.get("brief") or ""
    wins = f"{verdict} {brief}".strip()

    todos = [{"title": t["title"], "channel": t.get("platform", "ia")}
             for t in (payload.get("todo") or []) if not t.get("done")]

    # ── LE CANAL MUET CHANGE L'OBJET DE L'EMAIL (ticket 20) ──────────────────
    # Un email au sujet habituel est ouvert comme d'habitude, et les « — » à la
    # place des chiffres se lisent comme un bug de Pulse, pas comme une
    # connexion à refaire. Sans ce changement d'objet on aurait juste DÉPLACÉ le
    # silence : le rapport dirait la vérité à quelqu'un qui ne l'ouvre pas.
    #
    # On ne nomme que les canaux qui TAISENT vraiment des chiffres cette
    # semaine : un canal tombé après avoir tout écrit n'a rien creusé, et
    # alarmer sur lui userait l'alarme.
    muets = [c for c in (payload.get("canaux_muets") or [])
             if c.get("chiffres_tus")]
    # LA DEUXIÈME SEMAINE CHANGE LE REGISTRE, PAS LE VOLUME (ticket 47). Le même
    # objet et la même phrase, quatre lundis de suite, s'apprennent par cœur : le
    # seul fait NOUVEAU qu'on ait est la durée, et c'est donc lui qu'on dit.
    #
    # LE REGISTRE SE DÉCIDE CANAL PAR CANAL, ET C'EST TOUT L'ENJEU. Deux canaux
    # peuvent avoir deux âges — Google tombé lundi, Meta mort depuis deux mois —
    # et une phrase écrite pour l'un vaut FAUX sur l'autre. Pire : `canaux_muets`
    # est trié par clé de canal (« google » avant « meta »), donc celui qui a
    # déclenché l'escalade n'est presque jamais le premier de la liste ; prendre
    # « la » date de la liste raccourcirait une panne de deux mois à une semaine.
    # Une durée mesurée affichée fausse est exactement ce que `CLAUDE.md` §7
    # interdit — d'où deux groupes, chacun avec sa phrase et ses propres dates.
    #
    # `or 1` : un payload d'avant ce ticket n'a pas le compteur ; le lire comme
    # une première semaine sous-estime la panne au lieu de l'inventer.
    durent = [c for c in muets if (c.get("semaines_muettes") or 1) >= 2]
    recents = [c for c in muets if (c.get("semaines_muettes") or 1) < 2]
    alerte = ""
    if muets:
        phrases = []
        if durent:
            phrases.append(
                f"{_sans_reponse(durent)}, et ce n'est plus la première semaine. "
                f"Tant que ça dure, Pulse ne peut rien dire de ta publicité — ni "
                f"dépense, ni coût par clic, ni ROAS, et aucun conseil qui en "
                f"dépendrait.")
        if recents:
            _noms = " et ".join(_nom(c) for c in recents)
            phrases.append(
                f"{_noms} n'a pas répondu cette semaine : les chiffres de "
                f"publicité manquent, et rien ne les remplace.")
        phrases.append("Reconnecte depuis Comptes → Connexions.")
        alerte = " ".join(phrases)

    html = build_email_html(
        account_name=account_name,
        week_label=payload.get("week_label", ""),
        kpis=kpis,
        wins_text=wins,
        todos=todos,
        app_url=app_url,
        alerte=alerte,
    )
    # L'OBJET NOMME LA PIRE DES DEUX PANNES, PAS LEUR SOMME. Quand un canal dure,
    # c'est lui qui commande l'objet — avec SA date ; les canaux tombés cette
    # semaine sont dits dans le corps. Mélanger les deux dans une seule phrase
    # d'objet daterait l'une de la date de l'autre.
    if muets:
        if durent:
            subject = f"Pulse — {_sans_reponse(durent)}"
        else:
            _noms = " et ".join(_nom(c) for c in muets)
            subject = f"Pulse — {_noms} à reconnecter, ta semaine est incomplète"
    else:
        subject = f"Pulse — {payload.get('week_label', 'ta semaine en bref')}"
    return subject, html


def build_email_html(
    account_name: str,
    week_label: str,
    kpis: dict,
    wins_text: str,
    todos: list[dict],
    app_url: str = "#",
    alerte: str = "",
) -> str:
    """Construit le HTML complet de l'email hebdo.

    kpis   : {"spend": "CHF 465", "clicks": "3 342", "ctr": "3.59%", "followers": "+119"}
    todos  : [{"title": "...", "channel": "meta"|"instagram"|"google"|"ia"}, ...]
    alerte : la phrase du canal muet, vide quand la récolte a tout lu. Elle
             passe AVANT les KPI — c'est elle qui explique leurs « — »
             (ticket 20). Défaut vide : les appelants d'avant ce ticket, et
             leurs tests, gardent exactement l'email qu'ils rendaient.
    """
    kpi_cells = (
        _kpi_cell("Dépensé", kpis.get("spend", "—"), "Meta + Google · 7j pleins")
        + '<td style="width:10px;"></td>'
        + _kpi_cell("Clics", kpis.get("clicks", "—"), kpis.get("ctr_sub", ""))
        + '<td style="width:10px;"></td>'
        + _kpi_cell("Abonnés", kpis.get("followers", "—"))
    )

    todo_rows = "".join(_todo_row(i + 1, t["title"], t.get("channel", "ia"))
                        for i, t in enumerate(todos)) or (
        f'<tr><td style="padding:9px 0;font-size:13px;color:{FAINT};">'
        "Rien d'urgent — tes comptes tournent dans tes normes.</td></tr>"
    )

    wins_block = wins_text or "Pas de signal positif marquant cette semaine."

    # Ambre et pas rouge : ce n'est pas une catastrophe, c'est une connexion à
    # refaire. Le rouge est réservé à ce qui coûte de l'argent maintenant.
    alerte_block = (
        f'<tr><td style="padding:0 28px 16px;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        f'<tr><td style="padding:14px 16px;background:#fdf6e3;'
        f'border-left:3px solid {WARN};border-radius:8px;">'
        f'<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;'
        f'color:{WARN};font-weight:700;margin-bottom:6px;">'
        f'Ce qu\'on n\'a pas pu lire</div>'
        f'<div style="font-size:13px;color:{INK};line-height:1.55;">{alerte}</div>'
        f'</td></tr></table></td></tr>'
    ) if alerte else ""

    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Ta semaine en bref</title></head>
<body style="margin:0;padding:0;background:{BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:#ffffff;border:1px solid {LINE};
                border-radius:16px;overflow:hidden;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

    <!-- Header -->
    <tr><td style="padding:24px 28px 8px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-size:13px;font-weight:700;color:{INK};letter-spacing:-0.2px;">Pulse</td>
        <td align="right" style="font-size:11px;color:{FAINT};">{week_label}</td>
      </tr></table>
    </td></tr>

    <!-- Titre -->
    <tr><td style="padding:6px 28px 18px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;
                  color:{INK};line-height:1.2;">Ta semaine en bref</div>
      <div style="font-size:13px;color:{MUTED};margin-top:4px;">Bonjour {account_name}, voici l'essentiel.</div>
    </td></tr>

    <!-- Ce qu'on n'a pas pu lire (ticket 20) — avant les KPI, parce qu'il
         explique leurs tirets. Absent quand la récolte a tout lu. -->
    {alerte_block}

    <!-- KPI -->
    <tr><td style="padding:0 28px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{kpi_cells}</tr></table>
    </td></tr>

    <!-- Ce qui a marché -->
    <tr><td style="padding:0 28px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:16px 18px;background:#f2faf5;border-left:3px solid {POS};
                       border-radius:8px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;
                      color:{POS};font-weight:700;margin-bottom:8px;">Ce qui a marché</div>
          <div style="font-size:14px;color:{INK};line-height:1.55;">{wins_block}</div>
        </td></tr>
      </table>
    </td></tr>

    <!-- À faire -->
    <tr><td style="padding:14px 28px 4px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;
                  color:{BRAND};font-weight:700;margin-bottom:6px;">À faire cette semaine</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{todo_rows}</table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:22px 28px 8px;">
      <a href="{app_url}" style="display:inline-block;background:{BRAND};color:#ffffff;
         text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">
         Voir le détail &rarr;</a>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:18px 28px 26px;">
      <div style="border-top:1px solid {LINE};padding-top:14px;font-size:11px;color:{FAINT};line-height:1.6;">
        Tu reçois ce rapport chaque semaine pour {account_name}.<br>
        <a href="{app_url}" style="color:{FAINT};">Gérer mes préférences</a>
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>"""
