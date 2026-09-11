# Les statuts de campagne Meta s'arrêtent à 200, sans pagination

Type: task
Status: open

## Question

**Né de la revue de code de [03](03-identifiant-annonce-meta.md)** — pré-existant
au ticket, mais le rejeu d'historique le rend visible.

`_fetch_meta` (`saas/collecte/automatisation/fetch_all.py`) demande les campagnes
avec `"limit": 200` et **ne pagine pas** : `camp.get("data", [])` est lu tel
quel, `paging.next` est ignoré. Au-delà de 200 campagnes, `status_map` est
amputé sans un mot, et `upsert_campaign_statuses` n'écrit un statut que pour les
campagnes qu'il a vues.

C'est le même piège que la note de `CLAUDE.md` §8 sur PostgREST (« plafonne à
1 000 lignes : au-delà, il tronque en silence. Paginer »), sur une autre API.

### Ce que la revue a cru voir et qui est faux

La revue signalait que les lignes d'historique rejouées seraient estampillées
`effective_status = "UNKNOWN"`. **Vérifié : non.** `upsert_meta_ads`
(`saas/commun/insert_data.py`) n'écrit jamais `effective_status` dans
`meta_ads_insights` — le champ ne figure pas dans le dictionnaire envoyé. Il ne
sert qu'à `upsert_campaign_statuses`, qui est une table par campagne, pas par
date. **Le rejeu n'abîme donc aucune ligne historique.**

Ce qui reste vrai : au-delà de 200 campagnes, des statuts manquent, à chaque
récolte — rejeu ou pas.

### Ce qu'il faut faire

Paginer comme `_meta_chunk` le fait déjà (`paging.next`), ou dire explicitement
dans le journal combien de campagnes ont été vues quand la limite est atteinte.
Le silence est le vrai défaut : un statut manquant ne se distingue pas
aujourd'hui d'une campagne sans statut.

### Combien de comptes sont concernés

**Non mesuré** — aucun accès à la base depuis cet environnement (voir le relevé
d'environnement de [03](03-identifiant-annonce-meta.md)). À chiffrer avant de
décider si ça vaut la pagination ou juste un avertissement au journal.
