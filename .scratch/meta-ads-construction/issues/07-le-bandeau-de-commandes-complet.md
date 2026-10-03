# 07: Le Bandeau de commandes complet

Type: task
Status: ready-for-agent
Blocked by: 06

**What to build:** le client retrouve vite sa campagne, choisit n'importe quelle
durée, et ne perd jamais de vue ce qu'il regarde quand il descend dans la page.
Spec : § « Solution », module 1 ; user stories 6, 7, 8, 10, 11.

- [ ] Menu des campagnes avec recherche, pastille de couleur et dépense de la période
- [ ] Le choix d'une campagne resserre toute la page
- [ ] Période : raccourcis de 7 jours à 12 semaines, et calendrier sur deux mois ;
      toujours comparée à la période d'avant de même durée
- [ ] Au défilement, le bandeau se détache en pilule flottante, avec la vue active
      repliée dedans ; l'animation se coupe pour qui a réduit les animations
- [ ] `min-w-0` / `min-h-0` sur les enfants de grille et de flex, jamais une police
      plus petite
- [ ] Un lien partagé rouvre la page dans le même état
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
