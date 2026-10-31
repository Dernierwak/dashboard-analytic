# 05: Les changements de la semaine

Type: grilling
Status: resolved
Blocked by: —

## Question

David veut voir **les changements effectués cette semaine**. La page affiche
déjà « Ce qui a bougé sur les plateformes » : des faits déduits de la dépense
(`changements` du payload) et des faits déclarés par les plateformes
(`changementsApi`). **Lesquels gardent leur place sur la page hebdo, et
comment ?**

Du ticket 01 : David doute que ce bloc mérite sa place (« est-ce que c'est
intéressant ? »), et ne sait pas s'il irait en bloc ou en colonne sur le
côté. **Le garder ou non** est la première question de ce ticket. Une colonne
latérale passe sous les autres blocs sur téléphone.

À trancher :

- seulement la semaine mesurée, ou plus large ?
- les deux origines (déduit / déclaré) mélangées, ou distinguées ?
- combien au maximum avant que ça devienne un journal (le journal complet vit
  sur la page Meta) ;
- un changement se pose-t-il sur la frise ou la comparaison (« le budget a
  doublé mardi » à côté de la dépense qui monte), ou reste-t-il une liste ?

## Réponse

Grilling du 2026-10-30, validé par David.

1. **Le bloc reste, réduit** à ce que la frise ne montre pas.
2. **La semaine mesurée seule** — celle du module des canaux, calée sur le
   Jour de travail, jour en cours exclu.
3. **Seulement ce que la plateforme a écrit dans son journal** — aucun calcul
   de Pulse (David : « je prendrais juste ce qui est réellement écrit sur
   Meta »). Les faits déduits de la dépense (lancée, arrêtée, reprise,
   programmée, dépense changée) sortent ; les catégories déclarées `creation`
   et `statut` aussi, la frise les montre. Restent `budget`, `enchere`,
   `audience`, `creatif`, `objectif`, `motcle`, `diffusion`, `calendrier`,
   `autre`.
4. **Juste sous le module des canaux**, pleine largeur.
5. **Une ligne d'en-tête, une mention par plateforme** : « Meta · 7
   changements », « Google Ads · 0 ». Un compte par plateforme, jamais de
   total. Chaque mention est le lien vers le journal de cette plateforme,
   ouvert sur la même semaine.
6. **« 0 » seulement si la récolte du journal a couvert la semaine** ; une
   récolte en échec écrit « — » et sa raison.
7. **Puis par jour**, du plus récent au plus ancien : titres fixes avec leur
   compte (« Mardi 21 octobre · 5 »). Un jour vide n'apparaît pas ; tout à 0,
   l'en-tête reste seul.
8. **Sous chaque jour, une ligne par campagne, dépliable, fermée** :
   « Campagne Été — Meta · 3 changements ». Toutes les plateformes dans le
   même jour, la plateforme marquée par son seul nom après un tiret — ni
   couleur ni pastille pour l'instant. Ouverte : les cartes du journal Meta
   (`components/meta/journal-changements.tsx` : nature, contenu, avant /
   après), du plus récent au plus ancien. Pas de niveau groupe ni annonce.
9. **Meta seul aujourd'hui** ; Google puis les suivants entrent dans la même
   forme quand leur carte entre au module des canaux.

```
Les changements de la semaine
Meta · 7 changements →      Google Ads · 0 →
  Mardi 21 octobre · 5
    ▸ Campagne Été — Meta · 3 changements
    ▸ Campagne Noël — Google Ads · 2 changements
  Jeudi 23 octobre · 2
    ▸ Campagne Été — Meta · 2 changements
```

### Ce que ça demande à la spec

- **Un signal de couverture du journal** : aujourd'hui, un échec de la
  récolte des activités Meta est imprimé puis ignoré
  (`saas/data/fetch_data/sources/meta/ads/sync.py:161`), et rien ne garde
  jusqu'où le journal a été récolté. Sans lui, 0 et panne se confondent.
- **`changements` (les faits déduits) sort du payload** : la page hebdo en
  était le seul lecteur (`saas/web/app/page.tsx:90`).
- La lecture des changements déclarés (`lib/changements-api.ts`, 90 jours,
  toutes catégories) se resserre à la semaine mesurée et aux catégories
  retenues.
