from __future__ import annotations

import io
from datetime import datetime

import pandas as pd
import streamlit as st


def _fmt(n) -> str:
    try:
        return f"{int(n):,}".replace(",", " ")
    except Exception:
        return str(n)


def _top3_rows(df: pd.DataFrame, metric: str) -> list[dict]:
    if metric not in df.columns:
        return []
    top = df.nlargest(3, metric)
    rows = []
    for _, r in top.iterrows():
        rows.append({
            "caption": str(r.get("caption", ""))[:80],
            "type": r.get("type", ""),
            "date": r.get("date", ""),
            "value": _fmt(r.get(metric, 0)),
        })
    return rows


def generate_html_report(
    df: pd.DataFrame,
    account_name: str = "Instagram",
    followers_current: int = 0,
    followers_delta: int = 0,
    reco_content: str | None = None,
) -> bytes:
    """Génère un rapport HTML prêt à imprimer / sauvegarder en PDF."""
    now = datetime.now().strftime("%d %B %Y")

    reach_total = _fmt(df["reach"].sum()) if "reach" in df.columns else "—"
    likes_total = _fmt(df["likes"].sum()) if "likes" in df.columns else "—"
    saves_total = _fmt(df["saved"].sum()) if "saved" in df.columns else "—"
    n_posts = len(df)

    delta_html = ""
    if followers_delta != 0:
        sign = "+" if followers_delta > 0 else ""
        color = "#1a7a4a" if followers_delta > 0 else "#c0392b"
        delta_html = f'<span style="font-size:13px;color:{color};margin-left:8px;">{sign}{_fmt(followers_delta)} cette semaine</span>'

    # Top 3 posts (par likes)
    top3 = _top3_rows(df, "likes")
    top3_html = ""
    for i, row in enumerate(top3):
        top3_html += f"""
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eaeaea;color:#6b6b6b;font-size:12px;">#{i+1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaeaea;font-size:12px;">{row['caption'] or '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaeaea;font-size:12px;color:#6b6b6b;">{row['type']}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaeaea;font-size:12px;color:#6b6b6b;">{row['date']}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eaeaea;font-size:13px;font-weight:600;">{row['value']}</td>
        </tr>"""

    # Reco IA
    reco_html = ""
    if reco_content:
        import re
        content = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', reco_content)
        content = content.replace("\n", "<br>")
        reco_html = f"""
        <div style="margin-top:32px;">
            <h2 style="font-size:15px;font-weight:600;color:#0a0a0a;margin-bottom:12px;">Recommandations IA</h2>
            <div style="background:#f8faff;border-left:3px solid #1a56ff;border-radius:6px;padding:14px 18px;font-size:13px;line-height:1.7;color:#1a1a2e;">
                {content}
            </div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport Instagram — {account_name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * {{ margin:0;padding:0;box-sizing:border-box; }}
  body {{ font-family:'Inter',sans-serif;background:#ffffff;color:#0a0a0a;padding:40px 60px; }}
  @media print {{
    body {{ padding:20px 30px; }}
    .no-print {{ display:none; }}
  }}
</style>
</head>
<body>
  <!-- En-tête -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0a0a0a;">
    <div>
      <div style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Rapport mensuel</div>
      <h1 style="font-size:22px;font-weight:700;color:#0a0a0a;">{account_name}</h1>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#999;">Généré le {now}</div>
      <div style="font-size:11px;color:#ccc;margin-top:4px;">Dashboard Analytics</div>
    </div>
  </div>

  <!-- KPIs -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
    <div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Followers</div>
      <div style="font-size:22px;font-weight:700;">{_fmt(followers_current)}</div>
      {delta_html}
    </div>
    <div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Portée totale</div>
      <div style="font-size:22px;font-weight:700;">{reach_total}</div>
    </div>
    <div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Likes</div>
      <div style="font-size:22px;font-weight:700;">{likes_total}</div>
    </div>
    <div style="background:#fafaf9;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:16px 18px;">
      <div style="font-size:10px;font-weight:500;color:#999;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Sauvegardes</div>
      <div style="font-size:22px;font-weight:700;">{saves_total}</div>
    </div>
  </div>

  <!-- Top 3 -->
  <div style="margin-bottom:32px;">
    <h2 style="font-size:15px;font-weight:600;color:#0a0a0a;margin-bottom:12px;">Top 3 posts (par likes)</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f4f3f1;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b6b6b;border-bottom:1px solid #eaeaea;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b6b6b;border-bottom:1px solid #eaeaea;">Caption</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b6b6b;border-bottom:1px solid #eaeaea;">Type</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b6b6b;border-bottom:1px solid #eaeaea;">Date</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b6b6b;border-bottom:1px solid #eaeaea;">Likes</th>
        </tr>
      </thead>
      <tbody>{top3_html}</tbody>
    </table>
  </div>

  <!-- Posts total -->
  <div style="margin-bottom:32px;font-size:13px;color:#6b6b6b;">
    {n_posts} posts analysés au total.
  </div>

  {reco_html}

  <!-- Footer -->
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #eaeaea;font-size:11px;color:#ccc;">
    Dashboard Analytics · dashboard-analytics.ch · Rapport généré automatiquement
  </div>
</body>
</html>"""

    return html.encode("utf-8")


def show_export_button(
    df: pd.DataFrame,
    account_name: str = "Instagram",
    followers_current: int = 0,
    followers_delta: int = 0,
    supabase=None,
    user_id: str | None = None,
):
    """Bouton de téléchargement du rapport HTML (imprimable en PDF)."""
    reco_content = None
    if supabase and user_id:
        try:
            from scripts.ai_reco import get_or_generate_reco
            reco = get_or_generate_reco(supabase, user_id, df, followers_delta, force=False)
            if reco:
                reco_content = reco.get("content")
        except Exception:
            pass

    html_bytes = generate_html_report(
        df=df,
        account_name=account_name,
        followers_current=followers_current,
        followers_delta=followers_delta,
        reco_content=reco_content,
    )
    filename = f"rapport_{account_name.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m')}.html"
    st.download_button(
        label="⬇ Exporter le rapport",
        data=html_bytes,
        file_name=filename,
        mime="text/html",
        use_container_width=True,
        type="tertiary",
    )
