# 11: Le schéma de `platform_changes`

Type: grilling
Status: resolved

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

## Answer

David, 2026-10-11 :

1. **L'élément touché** : « prends les éléments dont tu as besoin ». On ajoute
   `object_id`, `object_name`, `niveau` (`campagne` / `groupe` / `annonce`,
   déduit du préfixe de `event_type`) et `adset_id` (pour une annonce, le
   `campaign_id` de son `extra_data`, ticket 02).
2. **On garde ce que Meta envoie, tel quel** : « on ne s'amuse pas à rechanger
   les choses ». Une colonne `extra_data jsonb`, copie exacte. **Pas** de
   colonnes `avant` / `apres` extraites : l'avant / après et « Actuel » se
   lisent dans `extra_data` à l'affichage (ticket 13). `resume` reste écrit
   (le fil du rapport le lit).
3. **Le statut** : une ligne par événement Meta en base (c'est « ce que Meta
   envoie ») ; l'écran les regroupe par élément et par jour, avec les heures,
   comme le prototype le fait déjà. David voulait le regroupement « si ce
   n'est pas trop compliqué » : il ne demande rien de plus.
4. **Deux catégories en plus** dans la CHECK : `objectif` et `calendrier`.
   Comme en meta-ads 04 : `DROP CONSTRAINT IF EXISTS` puis `ADD`, **aucune
   ligne touchée** — à signaler à David au moment de jouer le `000`
   (`CLAUDE.md` §7).

Toutes les colonnes acceptent `NULL` (lignes d'avant, Google). Et comme pour
`fuseau` (meta-ads 17) : une valeur inconnue n'est **pas envoyée** à l'upsert,
pour ne pas effacer ce qu'un passage précédent a écrit.
