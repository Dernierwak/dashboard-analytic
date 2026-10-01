# Le brief d'origine — dashboard Social Ads

Texte de David, recopié tel quel le 2026-09-30 depuis la conversation de
charte du 2026-09-28. **C'est la source** : les tickets de cette carte le
résument, ils ne le remplacent pas. La moitié « Dashboard 2 : Organique » est
hors périmètre (voir `map.md`) et n'est pas recopiée ici.

Ce qui a été tranché depuis et qui le modifie : le tableau s'arrête au
**contenu** de l'asset, pas à ses métriques (ticket 03) ; les conversions
viennent de l'API Meta, jamais de GA4 (`docs/adr/0010`) ; les trois catégories
ne filtrent pas, toutes les campagnes sont dans chacune.

---

## Contexte et stack
- Projet refait de zéro. L'ancienne app Streamlit est abandonnée.
- Frontend : Next.js, déployé sur Vercel.
- Données : Supabase (base existante où les données sont stockées).
- Plusieurs dashboards prévus : social ads et organique (ce brief). Google Ads viendra plus tard, avec une structure différente.
- Priorité : Meta (Facebook / Instagram). L'architecture doit pouvoir s'étendre à TikTok et Pinterest sans refonte (prévoir une couche d'abstraction par plateforme).

---

## DASHBOARD 1 : SOCIAL ADS

### Système de catégories (bascule globale)
Trois boutons en haut. Chacun reconfigure TOUT le dashboard (graphes, tableau, métriques) pour son objectif :
1. **Notoriété** : impressions, CPM, reach, fréquence
2. **Trafic** : clics, CTR, CPC
3. **Conversion** (vue plus experte) : conversions, coût par conversion, taux de conversion

### Filtres
- Barre de filtres en haut de page (au minimum : campagne, période).
- Sticky : elle reste visible au scroll, avec une petite transition animée.

### Bloc 1 : vue d'ensemble
- Line plot des métriques de la catégorie active, au niveau campagne.
- Permet de voir d'un coup d'œil comment toutes les campagnes évoluent.
- Filtre campagne.

### Bloc 2 : comparaison
- Un ou deux line plots côte à côte.
- L'utilisateur choisit UNE métrique (ex. impressions), puis compare plusieurs ad sets ou plusieurs ads/assets sur cette métrique (une courbe par élément).
- Sous les graphes : aperçu visuel des créas comparées (image / vidéo de l'ad).

### Bloc 3 : tableau hiérarchique
- Drill-down : Campagne > Ad set > Ad > Asset.
- Au niveau asset : texte, description, titre, image, etc.
- Colonnes = métriques de la catégorie active (elles changent avec le bouton).

### Historique des changements (fonctionnalité clé)
- Récupérer via l'API Meta tous les changements faits sur les campagnes (budget, enchères, audience, créas, statut…).
- Les afficher comme des petits points discrets sur les line plots, aux dates concernées.
- Clic sur un point : sidebar qui s'ouvre à droite avec la liste de tous les changements de ce jour-là.
- Si un filtre campagne est actif, la sidebar ne montre que les changements de cette campagne.
- But : relier rapidement une variation de performance aux modifications faites.
