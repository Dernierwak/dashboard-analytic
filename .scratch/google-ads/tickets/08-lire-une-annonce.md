# 08: Lire une annonce

**Status:** ready-for-agent

**Blocked by:** 06, 07

**What to build:** « Lire » sur une annonce de la Comparaison ouvre le Panneau
latéral avec tout ce qu'elle contient, tel que Google l'a reçu : les titres
(jusqu'à 15) et descriptions (jusqu'à 4) d'une annonce Search, numérotés, avec
l'épinglage et le chemin d'affichage ; les images, titres et textes d'une
annonce Display ; la vidéo YouTube d'une annonce Vidéo, lisible dans le panneau.
Le lien « l'annonce envoie vers… » vient de ses adresses finales.

Spec : § Les colonnes et tables nouvelles (contenu des annonces), § Panneau
latéral (l'annonce). Décision : ticket 12 de la carte.

- [ ] **D'abord un appel réel** (lecture seule, aucun secret en sortie) pour fixer la forme des champs : `responsive_search_ad`, `responsive_display_ad`, `video_ad` / `video_responsive_ad`, `final_urls`, ressource `asset`. Ce qui en sort est noté dans le ticket.
- [ ] Table additive du contenu des annonces, éléments rangés avec leur rang ; harnais récolte sur les trois montages ; adresse absente → vide ; montage inconnu → signalé.
- [ ] Jamais une annonce recomposée ; aucun chiffre à côté d'un élément, une phrase dit pourquoi ; un montage inconnu le dit.
- [ ] Images lisibles dans six mois : vérifier si l'URL d'un asset Google expire ; si oui, téléversement dans Supabase Storage sur le patron Meta, **bucket public ou privé selon la réponse de David** (à obtenir avant cette partie).
- [ ] Annonce dans l'URL ; ouvrir une annonce retire le jour ; une annonce inconnue ne s'ouvre pas ; un groupe n'ouvre rien.
- [ ] `py_compile`, `tsc`, `build` verts, 18 routes. Visible après un passage du worker (`force`) — le dire ; vérifié dans Chrome sur une annonce Search.
