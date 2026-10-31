# 14: Ce que le traitement doit calculer

Type: task
Status: open
Blocked by: —

## Question

La page est validée ([La page entière, en maquette](08-la-page-entiere-en-maquette.md)).
**Dresser la liste « clé du payload → d'où elle vient »** pour chaque chose
qu'elle montre, et ce qui **sort** du payload. Pas de construction : une
table qui dit, pour chaque valeur, la table source, le calcul et la fenêtre.

Le point de départ exécutable est `.scratch/hebdo/prototype-08/extraire.py` :
il calcule déjà, sur un vrai compte, les totaux, la semaine type et ses
quartiles par canal, les changements retenus, les campagnes de l'année
(identité par ID, statut, dates déclarées, visuels, dépense par semaine) et
les posts. À confronter à `saas/data/supabase/processed_data/weekly_report/builder.py`
et à ce qu'il produit aujourd'hui.

Ce que la carte sait déjà :

- **sortent** : `metrics_read`, `metrics_prev`, `metrics_series`, `kpis`,
  `canaux_muets` ([l'inventaire](../inventaire-2026-10-28.md)) et les
  `changements` déduits de la dépense (ticket 05) ;
- **entrent** : un **signal de couverture du journal** par plateforme
  (ticket 05) ; `permalink` et `media_product_type` des posts (ticket 04) ;
- **la semaine** s'ancre sur le Jour de travail, pas sur la veille du jour
  de fabrication (ticket 02, `builder.py`, `last_full_day`) ;
- la frise navigue sur **toute l'année** : le payload hebdo la porte-t-il,
  ou la page la lit-elle à part (comme `lib/changements-api.ts`) ?

Le harnais qui exécute `build_payload` hors ligne est à écrire pour ce
ticket (`CLAUDE.md` §9) : aucun ne subsiste dans l'arbre.
