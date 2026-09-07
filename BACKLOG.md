# Backlog — Pulse

Idées et pistes notées en chemin, à reprendre. On y ajoute, on n'y efface pas
sans raison. Une fois lancée, une piste devient une tâche dans
`PROJECT_STATUS.html` — elle reste ici en trace de pourquoi elle existe.

## Thèmes (issu du grill du 2026-09-07, voir dem-19)

- **Export par thème** — écarté du chantier "vrai bénéfice des thèmes" pour
  ne pas en diluer le périmètre (UX + workflow, pas de nouvelle fonctionnalité).
  Rien n'existe aujourd'hui côté produit. À cadrer avant de construire : qui
  l'utilise (client ou agence), quel format (CSV/PDF), quel contenu (liste
  brute des campagnes/posts du thème, ou aussi les chiffres agrégés — dépense,
  ROAS, conversions).
- **Conversions par thème : élargir au-delà de l'événement GA4 principal** —
  `insights.py::build_matrix` ne calcule le revenu que pour l'événement de
  conversion principal choisi sur `/conversions`. L'élargir à plusieurs
  événements par thème touche le backend, donc écarté du même chantier.
