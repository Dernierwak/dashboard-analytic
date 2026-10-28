# 01: Ce qu'on inventorie avant de décider

Type: task (AFK)
Status: open
Blocked by: —

## Question

Qu'est-ce que la page `/` affiche aujourd'hui, et qu'est-ce que le payload
calcule déjà sans l'afficher ? Les grillings partent de l'existant : il faut
une photo exacte, pas un souvenir.

À rendre, dans la réponse de ce ticket :

- chaque bloc de `saas/web/app/page.tsx`, dans l'ordre, avec la clé du payload
  qu'il lit et une capture (ou description) de ce qu'il rend ;
- chaque clé que `builder.py` publie (`metrics_read`, `metrics_prev`,
  `metrics_series`, `kpi_focus`, `frise`, `changements`, `canaux_muets`, le
  verdict…) : ce qu'elle contient, par plateforme, et **si la page la lit** ;
- ce que les pages plateforme montrent déjà de « face à la moyenne » (le
  Croisement de la page Meta, e4db505) — pour ne pas inventer un deuxième
  calcul de la même moyenne.

Consigne de repli : rendre l'inventaire de la page d'abord, celui du payload
ensuite.
