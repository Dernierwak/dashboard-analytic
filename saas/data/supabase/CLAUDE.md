# CLAUDE.md — saas/data/supabase/

Ce dossier sépare les trois trajets autour de Supabase :

- `source_data/` enregistre les données sources normalisées et les réglages ;
- `fetch_state/` déduit le point de reprise des tables sources et tient le
  journal d'exécution `fetch_progress` ;
- `processed_data/` contient les traitements construits depuis les données
  sources ; `weekly_report/` lit, construit et publie le rapport hebdomadaire.
- `_queries.py` est l'implémentation interne partagée par les deux lecteurs ;
  aucun appelant extérieur ne doit l'importer directement.

Il contient aussi toute l'infrastructure Supabase :

- `config.toml` et `.temp/` pour Supabase CLI ;
- `migrations/000_run_me_all.sql`, seul schéma conservé à installer/rejouer.

Depuis la racine, toute commande CLI utilise `supabase --workdir saas/data …`.
Les credentials ne vivent pas ici : seul `saas/config/secrets.py` les lit.
