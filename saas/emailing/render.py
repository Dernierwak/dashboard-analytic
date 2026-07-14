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

CHANNEL_COLOR = {"instagram": "#7b4fff", "meta": "#1a56ff", "google": "#1a7a4a", "ia": "#8b6f00"}
CHANNEL_LABEL = {"instagram": "Instagram", "meta": "Meta Ads", "google": "Google", "ia": "Piste"}


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


def build_email_html(
    account_name: str,
    week_label: str,
    kpis: dict,
    wins_text: str,
    todos: list[dict],
    app_url: str = "#",
) -> str:
    """Construit le HTML complet de l'email hebdo.

    kpis  : {"spend": "CHF 465", "clicks": "3 342", "ctr": "3.59%", "followers": "+119"}
    todos : [{"title": "...", "channel": "meta"|"instagram"|"google"|"ia"}, ...]
    """
    kpi_cells = (
        _kpi_cell("Dépensé", kpis.get("spend", "—"), "Meta Ads · 7j")
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
