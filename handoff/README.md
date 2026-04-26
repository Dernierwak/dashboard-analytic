# Handoff — Dashboard Analytics (UX Redesign)

## Vue d'ensemble

Ce package contient les maquettes hi-fi d'un dashboard analytics Instagram & Meta Ads.
Le fichier HTML joint (`UX Variations.html`) est une **référence de design** — un prototype interactif montrant l'intention visuelle et les interactions. Il ne s'agit pas de code de production à copier directement.

**Objectif** : recréer ces designs dans l'environnement existant (Streamlit, React, ou autre) en s'appuyant sur les spécifications ci-dessous.

---

## Fidélité

**Hi-fi** — Les maquettes sont pixel-proches du résultat final. Couleurs, typographie, espacements et interactions doivent être reproduits fidèlement.

---

## Variations de design

3 directions sont proposées. La **Variation A (Clarity)** est la direction recommandée.

| Variation | Nom | Concept |
|-----------|-----|---------|
| A | Clarity | Topbar fine · IA en bloc texte · KPIs en ligne divisée · panel insights latéral |
| B | Spatial | Sidebar blanche légère · chiffre hero immense · contenu très aéré |
| C | Minimal Stack | Pas de sidebar · accordéon par section · tout en colonne |

---

## Tokens de design

### Couleurs

```
--white:      #ffffff
--ink:        #0a0a0a    /* texte principal */
--ink-2:      #333333    /* texte secondaire */
--ink-3:      #666666
--ink-4:      #999999    /* labels, métadonnées */
--ink-5:      #c8c8c8    /* éléments très discrets */

--bg:         #fafaf9    /* fond warm white */
--bg-2:       #f4f3f1
--bg-3:       #eeede9    /* fond éléments fantômes */

--line:       rgba(0,0,0,0.07)   /* séparateurs */
--line-str:   rgba(0,0,0,0.12)   /* séparateurs forts */

--accent:     #1a56ff    /* bleu — couleur d'accent unique */
--accent-l:   #eef2ff    /* fond chips accent */

--pos:        #1a7a4a    /* valeur positive / gain */
--pos-l:      #e8f5ee
--neg:        #c0392b    /* valeur négative / perte */
--neg-l:      #fdecea
```

### Typographie

```
Font principale : DM Sans (Google Fonts)
  Weights : 300, 400, 500, 600
  Usage   : labels, textes, UI

Font données    : DM Mono (Google Fonts)
  Weights : 400, 500
  Usage   : TOUS les chiffres et métriques

Import Google :
  https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap
```

#### Échelle typographique

| Rôle | Famille | Taille | Poids | Letter-spacing |
|------|---------|--------|-------|----------------|
| Titre page | DM Sans | 15–16px | 600 | -0.3px |
| KPI valeur | DM Mono | 22–26px | 400 | -0.5px |
| KPI hero | DM Mono | 44–56px | 300 | -2 à -3px |
| Label section | DM Sans | 9–10px | 500–600 | 1–1.4px (UPPERCASE) |
| Corps texte | DM Sans | 12–14px | 400 | -0.1px |
| Métadonnée | DM Sans | 9–10px | 400 | 0 |
| Chip / Tag | DM Sans | 10px | 500 | 0.2px |

### Espacements

```
Gap interne carte  : 12–16px
Padding section    : 28–36px horizontal, 20–28px vertical
Gap entre KPIs     : 0px (séparés par ligne verticale 1px)
Gap entre sections : 24px
Hauteur topbar     : 48px
Largeur sidebar    : 200px (Var. B) / 52px icon-only (Var. C)
Largeur panel droit: 192px
```

### Bordures & ombres

```
Bordure standard : 1px solid rgba(0,0,0,0.07)
Bordure forte    : 1px solid rgba(0,0,0,0.12)
Border-radius carte : 10–12px
Border-radius chip  : 99px (pill)
Border-radius bouton: 6–7px

Ombre frame    : 0 0 0 1px rgba(0,0,0,0.07), 0 20px 60px rgba(0,0,0,0.12)
Ombre nav pill : 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)
Ombre card hover (Var B) : 0 1px 4px rgba(0,0,0,0.06)
```

---

## Écrans / Vues

### 1. Topbar (commune)

- Hauteur : 48px, `border-bottom: 1px solid rgba(0,0,0,0.07)`
- Logo : carré 22×22px, `background: #0a0a0a`, `border-radius: 5px`
- Titre : DM Sans 13px / 600 / `#0a0a0a` / `letter-spacing: -0.3px`
- Tabs : padding `0 16px`, hauteur 48px, actif = `border-bottom: 1.5px solid #0a0a0a` / 600
- Inactif : couleur `#999`, weight 400
- Chip "Pro" : background `#e8f5ee`, color `#1a7a4a`
- Avatar : Ghost 28×28px, `border-radius: 14px`

---

### 2. Bloc IA (Variation A — recommandée)

**Position** : en haut du contenu principal, avant les KPIs

```
border-left: 2px solid #0a0a0a
padding-left: 20px
```

- Label : `COACH IA · AUJOURD'HUI` — DM Sans 10px / 500 / `#999` / letter-spacing 1.4px / UPPERCASE — margin-bottom 8px
- Texte : DM Sans 15px / 400 / `#333` / line-height 1.7 / max-width 560px
  - Mots clés en `font-weight: 600 / color: #0a0a0a`
- Boutons feedback : 3 boutons inline
  - Padding: `5px 12px`, border `1px solid rgba(0,0,0,0.07)`, border-radius 6px
  - Fond: `#fafaf9`, couleur texte `#666`, font-size 11px
  - Icône SVG 11px + label texte
  - Gap entre boutons: 8px

**État verrouillé (plan gratuit)** :
- Même layout mais texte flouté `filter: blur(4px)`
- Overlay centré : fond blanc, border `1px solid rgba(0,0,0,0.07)`, border-radius 8px, shadow légère
- Texte : "Coach IA — Plan Pro"

---

### 3. KPI Strip (Variation A)

4 métriques côte à côte, **séparées par des lignes verticales 1px**, pas de cartes.

```
display: flex
border-top: 1px solid rgba(0,0,0,0.07)
border-bottom: 1px solid rgba(0,0,0,0.07)
```

Chaque KPI :
```
flex: 1
padding: 20px 24px
border-right: 1px solid rgba(0,0,0,0.07)  /* sauf dernier */
```

- Label : DM Sans 10px / 500 / `#999` / UPPERCASE / letter-spacing 1px — margin-bottom 10px
- Valeur : DM Mono 26px / 400 / `#0a0a0a` / letter-spacing -1px — margin-bottom 6px
- Delta : icône flèche 11px + valeur DM Mono — vert `#1a7a4a` ou rouge `#c0392b`
- Sparkline : 56×28px, ligne 3px, couleur propre à chaque métrique
  - Followers: `#1a56ff`, Reach: `#7c5fe6`, Likes: `#14b87a`, Saves: `#e07b1a`

---

### 4. Graphique barres

- Container : pas de bordure, fond blanc
- Header : titre 12px / 500 + sélecteur métrique (pills)
- Pills métrique : padding `3px 10px`, border-radius 5px
  - Actif : `background: #0a0a0a / color: #fff`
  - Inactif : `border: 1px solid rgba(0,0,0,0.07) / color: #999`
- Barres : opacity 0.7, border-radius `2px 2px 0 0`
  - Image : `#0a0a0a`, Video : `#1a56ff`, Carrousel : `#6b7dd6`
- Légende : trait horizontal 8×2px + label 10px `#999`

---

### 5. Top 3 posts

- Titre : 12px / 500 / `#0a0a0a` — margin-bottom 18px
- Chaque rang : `display: flex / gap: 10px / align-items: center`
- Thumbnail : Ghost 36×36px, border-radius 5px
- Valeur : DM Mono 14px / 500 / `#0a0a0a` / letter-spacing -0.3px
- Métadonnée : DM Sans 10px / `#999`
- Rang : DM Sans 11px / `#c8c8c8` (ex: "01")
- Séparateur : `border-bottom: 1px solid rgba(0,0,0,0.07)` sauf dernier

---

### 6. Tableau posts

- Header colonnes : DM Sans 9px / 600 / `#999` / UPPERCASE / letter-spacing 1px
- Grid : `2fr 80px 72px 72px 72px 90px`
- Ligne : padding `10px 0`, `border-bottom: 1px solid rgba(0,0,0,0.07)`
- Valeurs numériques : DM Mono 11px / `#0a0a0a`
- Caption placeholder : `height: 6px / background: #eeede9 / border-radius: 3px / width: 65%`
- Labels : Chip pill (voir tokens)

---

### 7. Sidebar (Variation B)

```
width: 200px
background: #fafaf9
border-right: 1px solid rgba(0,0,0,0.07)
```

- Logo block : padding `20px 20px 16px`, `border-bottom: 1px solid rgba(0,0,0,0.07)`
- Avatar compte : Ghost 28×28px rond + nom 11px/500 + sous-titre 9px/`#999`
- Nav item actif :
  - `background: #ffffff`
  - `box-shadow: 0 1px 4px rgba(0,0,0,0.06)`
  - `border-radius: 7px`
  - font-weight 600, couleur `#0a0a0a`
- Nav item inactif : transparent, couleur `#999`, weight 400
- Item Coach IA : couleur accent `#1a56ff` + dot 5px `#1a56ff` à droite
- Footer : padding `16px 18px`, `border-top: 1px solid rgba(0,0,0,0.07)`, texte 10px / `#999`

---

### 8. Panel Insights (Variation A, optionnel)

```
width: 192px
border-left: 1px solid rgba(0,0,0,0.07)
padding: 28px 20px
```

- Titre : DM Sans 10px / 600 / `#999` / UPPERCASE / letter-spacing 1.2px
- Chaque insight : `border-bottom: 1px solid rgba(0,0,0,0.07)` + `padding-bottom: 16px`
- Icône SVG 13px couleur `#666`
- Titre insight : DM Sans 11px / 500 / `#0a0a0a`
- Sous-titre : DM Sans 10px / `#999` — margin-top 2px

---

## Interactions & comportements

| Interaction | Comportement |
|-------------|--------------|
| Hover bouton feedback IA | `border-color: rgba(0,0,0,0.15)`, léger background darken |
| Click pill métrique | Bascule le graphique sur la métrique sélectionnée |
| Hover nav item (B) | Background `rgba(0,0,0,0.03)` |
| Click section accordéon (C) | Toggle ouvert/fermé, chevron rotate 180° (`transition: 0.2s`) |
| Hover tab | Couleur `#333` |

**Transitions** : toutes à `0.15s ease` sauf chevron `0.2s ease`.

---

## Composants SVG Icons

Toutes les icônes sont des SVG stroke (pas de fill), `stroke-width: 1.6`, `stroke-linecap: round`, `stroke-linejoin: round`, viewBox `0 0 24 24`.

Icônes utilisées : `grid`, `users`, `photo`, `tag`, `target`, `star`, `refresh`, `download`, `up`, `chevron`, `sparkle`, `logout`, `plus`.

Les paths SVG exacts sont dans le fichier `UX Variations.html`, objet `Ic`.

---

## Sparklines / Charts

### Sparkline (ligne)
- SVG `width: 100%`, viewBox `0 0 100 100`, `preserveAspectRatio: none`
- Ligne : `stroke-width: 3`, `stroke-linecap: round`
- Fill area : gradient vertical, `stopOpacity: 0.1` → `0`
- Données normalisées entre 10 et 90% de la hauteur

### Barres
- `display: flex / align-items: flex-end / gap: 4px`
- Chaque barre : `flex: 1`, border-radius `2px 2px 0 0`, `opacity: 0.7`

### Gains/pertes (waterfall)
- Barres positives : `border-radius: 2px 2px 0 0`, couleur `#1a7a4a`, opacity 0.6
- Barres négatives : `border-radius: 0 0 2px 2px`, couleur `#c0392b`, opacity 0.6

---

## Fichiers joints

| Fichier | Description |
|---------|-------------|
| `UX Variations.html` | Prototype interactif hi-fi avec les 3 variations (A, B, C) |
| `README.md` | Ce document |

**Pour naviguer dans le prototype** : barre en haut pour switcher A / B / C. Le bouton "Tweaks" (toolbar) permet de toggle le panel insights.

---

## Notes pour l'implémentation Streamlit

Le projet existant utilise Streamlit. Quelques équivalences :

| Design | Streamlit |
|--------|-----------|
| KPI strip (4 colonnes) | `st.columns(4)` + HTML custom via `st.markdown(..., unsafe_allow_html=True)` |
| Sparklines | `plotly` avec `height` réduit, `margin` à 0, `template: plotly_white` |
| IA bloc texte | `st.markdown` avec CSS custom (border-left) |
| Accordéon (Var C) | `st.expander` avec CSS override |
| Sidebar | `st.sidebar` avec CSS custom via `DASHBOARD_CSS` |
| Chips / Tags | `st.markdown` HTML inline |

Injecter les fonts DM Sans et DM Mono via le CSS existant (`DASHBOARD_CSS` dans `components/styles.py`) :

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

.stApp, .stApp > * {
  font-family: 'DM Sans', sans-serif !important;
}

/* Appliquer DM Mono sur les métriques */
[data-testid="stMetricValue"] {
  font-family: 'DM Mono', monospace !important;
  font-weight: 400 !important;
  letter-spacing: -0.5px !important;
}
```
