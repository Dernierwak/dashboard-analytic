# Plan de retrait de Streamlit

Ce document est l'inventaire de sécurité du nettoyage. Une case n'est cochée
qu'après vérification dans la branche de référence.

## Zone protégée — ne pas supprimer

- [x] `.claude/`
- [x] `CLAUDE.md`
- [x] `memory/`
- [x] `docs/`
- [x] `handoff/`
- [x] `BACKLOG.md`
- [x] règles métier et commentaires porteurs d'un arbitrage

## À extraire avant suppression

- [ ] Déplacer `components/ga4.py` vers une couche headless de `saas`.
- [ ] Déplacer le moteur partagé de `components/reco_engine.py` vers `saas/core`.
- [ ] Déplacer les accès aux données utiles de `scripts/` vers `saas`.
- [ ] Séparer la collecte de l'interface dans `meta_script/fetch_meta_ads.py`.
- [ ] Séparer la collecte de l'interface dans `meta_script/fetch_instagram.py`.
- [ ] Rediriger tous les imports de `saas/worker` vers les nouveaux modules.
- [ ] Vérifier qu'aucun import de `saas/` ne charge `streamlit`.

## Suppressions après extraction et validation

- [ ] `landing.py`
- [ ] `pages/`
- [ ] `pages.toml`
- [ ] `.streamlit/config.toml`
- [ ] composants d'interface restants dans `components/`
- [ ] `scripts/stripe.py`
- [ ] `scripts/ai_reco.py`
- [ ] anciens callbacks OAuth exclusivement Streamlit
- [ ] dépendances Streamlit, Plotly et Flask devenues inutiles

## Documentation à actualiser, pas à jeter

- [ ] Réécrire `CLAUDE.md` autour de Pulse et de l'architecture Next.js.
- [ ] Actualiser les agents et skills dont les chemins pointent vers l'ancien
      emplacement du moteur.
- [ ] Actualiser `GOOGLE_ADS_SETUP.md` et les documents légaux.
- [ ] Actualiser les README de `saas/` et `saas/web/`.
- [ ] Extraire des anciens fichiers toute règle métier encore unique.

## Validation avant suppression définitive

- [ ] Compilation de tous les modules Python headless.
- [ ] Exécution contrôlée des tests ou contrôles du worker.
- [ ] Build Next.js réussi.
- [ ] Recherche globale sans import `streamlit` dans le code conservé.
- [ ] Vérification du diff de suppression avant commit.
