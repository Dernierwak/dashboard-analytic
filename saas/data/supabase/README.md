# Supabase

Tout ce qui concerne Supabase vit ici.

| Dossier ou fichier | Rôle |
|---|---|
| `config.toml` | Configuration de Supabase CLI et de la base locale. |
| `.temp/` | Liaison locale avec le projet distant, gérée par Supabase CLI et ignorée par Git. |
| `migrations/000_run_me_all.sql` | Source unique et rejouable pour installer ou remettre le schéma à niveau. |
| `source_data/` | Valide et enregistre les données sources normalisées. |
| `fetch_state/` | Déduit le point de reprise et journalise l'exécution des collectes. |
| `processed_data/` | Contient les traitements construits depuis les données sources. |
| `processed_data/weekly_report/` | Lit, construit et publie le rapport hebdomadaire. |

Supabase CLI cherche un dossier nommé `supabase/` dans son répertoire de travail.
Depuis la racine du dépôt, utiliser donc :

```bash
supabase --workdir saas/data <commande>
```

Ou lancer la commande directement depuis `saas/data/`.
