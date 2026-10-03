# 09: Le Tableau détaillé, exporté en CSV

Type: task
Status: ready-for-agent
Blocked by: 06

**What to build:** le client retrouve tout le détail, Campagne › Groupe d'annonces
› Annonce, et l'emporte dans son tableur tel qu'il le voit. Export en **CSV**
(choix par défaut de la spec). Spec : § « Solution », module 5 ; user stories 47
à 51.

- [ ] Tableau dépliable sur trois niveaux ; colonnes de la vue active
- [ ] Les ratios de chaque ligne sont recalculés sur la ligne : une ligne parent
      n'est jamais la moyenne de ses enfants (testé)
- [ ] Une campagne renommée reste une seule ligne, sous son nom le plus récent (testé)
- [ ] L'export rend ce qui est affiché — vue, filtre, période — et « — » reste
      « — », pas un zéro
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
