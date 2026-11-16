# 21: L'objectif déclaré de la campagne s'écrit

Type: task
Status: ready-for-human

`/campaigns` rend `objective` et la récolte le jetait (`BACKLOG.md`, « Trier
les campagnes par leur objectif déclaré » : « la donnée est à un `ADD COLUMN`
de distance »). David a demandé le 2026-11-15 une section d'analyse qui tienne
compte du type de campagne : elle ne peut pas exister sans cette colonne.

**Ce ticket ÉCRIT la donnée, il ne la montre nulle part.** La décision de la
carte (`../map.md`, « on ne filtre PAS sur l'objectif déclaré ») tient : aucun
écran ne lit `objective`. Le tri ou le classement par objectif reste une
décision à prendre, avec David, avant tout écran.

- [x] `campaigns.py` demande `objective` (même requête, zéro appel de plus) et
      `lignes_config_meta` le recopie brut ; absent ou vide → NULL
- [x] Section 26 du `000` : `meta_campaign_config.objective text`, ajout seul,
      et sa ligne dans le contrôle de fin de fichier
- [x] Garde-fou : sur une base sans la colonne, les statuts s'écrivent sans
      l'objectif et le journal le dit (`sync.py`, `meta_objectif_present`)
- [x] Harnais `../harnais/21-22-objectif-et-compte/test_recolte.py` vert
- [x] `python3.12 -m py_compile` sur les fichiers touchés
- [ ] **Pour David** : jouer la section 26 de `000_run_me_all.sql`
- [ ] **Pour David** : un passage du worker (`weekly-fetch.yml`, `user_id`),
      puis lire `SELECT objective, count(*) FROM meta_campaign_config GROUP BY 1`
      — la colonne doit être remplie pour les campagnes que Meta rend encore

## Ce qui n'a pas pu être vérifié

Rien n'a tourné contre Meta ni contre la base. Les valeurs réelles d'`objective`
(`OUTCOME_…` ou les anciens noms sur de vieilles campagnes) se liront après le
premier passage. `budgets.py` demande toujours `objective` sans s'en servir :
laissé tel quel, hors du ticket.

## Comments
