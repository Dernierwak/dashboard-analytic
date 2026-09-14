# La fenêtre ne s'ancre pas sur Google : un compte Google seul mesure des jours vides

Type: task
Status: open

## Question

**Trouvé en faisant tourner `build_payload` pour la première fois**, au
ticket [16](16-le-seam-du-payload.md). `CLAUDE.md` §4 : ça devient un ticket.

### Le fait, mesuré

`build_payload` promet dans son en-tête : *« Mêmes fenêtres (7 jours pleins
ancrés sur la dernière donnée, jamais aujourd'hui) »*. L'ancre se calcule comme
ceci :

```python
_data_dates = []
if df_meta_raw is not None and "date_start" in df_meta_raw.columns:   # Meta
    ...
if not df_insta.empty and "date" in df_insta.columns:                 # Instagram
    ...
if not df_follows.empty and "fetched_at" in df_follows.columns:       # abonnés
    ...
last_data_date = max(_data_dates) if _data_dates else yesterday
```

**Trois sources sur cinq.** Ni `df_google` (`google_ads_insights`) ni `df_gads`
(`google_ads_ad_insights`) n'entrent dans `_data_dates`. Un compte qui ne fait
que du Google Ads a donc `_data_dates == []`, et son ancre retombe sur **hier**,
quelle que soit la date de sa dernière ligne réelle.

Reproduit hors ligne, mêmes lignes des deux côtés — 30 CHF par jour, dernière
ligne le 12 septembre, rapport fabriqué le 17 :

| Régie | Fenêtre rendue | Dépense de la semaine |
|---|---|---|
| Meta | 6 → 12 septembre | **210 CHF** (7 jours × 30) |
| Google | 10 → 16 septembre | **90 CHF** (3 jours × 30) |

Même compte, même dépense, **57 % de moins à l'écran** — et quatre jours sans une
seule ligne comptés comme quatre jours à zéro. (`harnais/16-le-seam-du-payload/` ;
`test_chiffres_du_payload.py` grée exprès du Meta pour que la propriété de la
fenêtre ne bute pas sur ce défaut-ci.)

### Pourquoi ça mord

C'est le défaut que le ticket [03](03-identifiant-annonce-meta.md) nomme sur un
autre chemin : **un trou lu comme une baisse est un faux verdict.** Les jours
sans donnée entrent au dénominateur des moyennes et au numérateur d'aucune
somme : la dépense de la semaine s'effondre, le point de vue annonce un recul qui
n'a pas eu lieu, et le Verdict d'une action décidée cette semaine-là est rendu
sur une fenêtre trouée.

Deux situations le déclenchent, et aucune n'est exotique :

- un compte **sans Meta et sans Instagram** — c'est le cas que la v1 sert
  explicitement (« un compte sans Instagram reçoit autant de conseils ») ;
- une récolte Google qui **échoue ou prend du retard** : le jeton de
  rafraîchissement Google meurt à sept jours tant que l'app est en statut
  *Testing* ([spec](../spec.md), « ce qui tourne en parallèle »), donc une
  semaine oubliée est exactement ce scénario.

Le compte de David porte du Meta, donc il ne le voit pas. C'est ce qui explique
que le défaut ait vécu jusqu'ici.

### Ce qu'il faudrait faire

- Faire entrer `df_google["date_start"]` et `df_gads["date_start"]` dans
  `_data_dates`, au même titre que les trois autres.
- **Vérifier d'abord ce que ça déplace** : l'ancre est la fenêtre, donc aussi
  `week_start`, donc la ligne sous laquelle le rapport s'écrit
  ([13](13-premier-ecran-et-trois-dates.md)). Pour un compte dont Google traîne
  d'un jour par rapport à Meta, le `max()` ne bouge pas ; pour un compte Google
  seul, la première publication après le correctif change de ligne, comme l'a
  fait le ticket 13 pour les comptes servis le lundi. **À dire d'avance, pas à
  découvrir.**
- La propriété se vérifie maintenant par exécution : le harnais 16 sait gréer un
  compte d'une seule régie et lire la fenêtre qui en sort.

### Ce qui n'est PAS demandé

- Aucun changement de la règle « jamais aujourd'hui » : `min(last_data_date,
  yesterday)` reste.
- Aucun rejeu d'historique, aucun recalcul d'un Verdict déjà rendu.

---

## À LIRE AVANT DE CORRIGER — ajouté par le ticket [20](20-rapport-publie-sur-un-canal-muet.md), 2026-09-14

Le ticket 20 a touché ces mêmes lignes, pour une autre raison : **un canal muet
ne doit pas ancrer la fenêtre.** Sa dernière date est périmée par définition
(c'est le jour où il a cessé d'écrire), et s'ancrer dessus fait republier la
semaine précédente sous sa propre clé — le client reçoit l'ancien rapport au
lieu d'un rapport troué, et la panne devient invisible. Le test est
`test_la_semaine_declaree_ne_bouge_pas_parce_qu_un_canal_est_tombe`
(`.scratch/construction/harnais/20-canal-muet/`).

L'ancre porte donc maintenant une garde :

```python
if ("meta" not in pub_muette
        and df_meta_raw is not None and "date_start" in df_meta_raw.columns):
```

**Elle ne nomme que Meta, et uniquement parce que Google n'est pas dans l'ancre.**
Le jour où ce ticket ajoute `df_google` à `_data_dates`, il faut lui poser la
**même garde** (`"google" not in pub_muette`), sinon le défaut du ticket 20
rouvre côté Google : un Google Ads tombé ferait reculer la fenêtre, et le compte
recevrait sa semaine précédente en silence.

Le harnais 20 ne l'attrapera pas tout seul — il n'a pas de cas « Google muet et
seule source ». En ajouter un en même temps que la correction.
