# 11: Le schéma de `platform_changes`

Type: grilling
Status: claimed

## Question

Quelles colonnes ajouter à `platform_changes` pour ranger un changement sous
son groupe d'annonces et son annonce, et pour afficher avant → après ?

Candidats (ajout seul, rien de supprimé) :
- `object_id`, `object_name`, `niveau` (campagne / groupe / annonce) ;
- `adset_id` (le groupe d'une annonce : le `campaign_id` de son `extra_data`) ;
- `extra_data jsonb` brut — permet de réécrire une phrase sans redemander à
  Meta, y compris pour les lignes de plus de 180 jours ;
- ou des colonnes `avant` / `apres` déjà extraites.

Et : quelles catégories ajouter à la contrainte CHECK (objectif, calendrier),
sans toucher une ligne.
