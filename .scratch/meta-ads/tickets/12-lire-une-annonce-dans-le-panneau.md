# 12: Lire une annonce dans le Panneau latéral

Type: task
Status: ready-for-agent
Blocked by: 05, 08, 11

**What to build:** depuis la Comparaison, le client lit le contenu d'une annonce
tel qu'il s'affiche dans le fil, et vérifie la page vers laquelle elle envoie, sans
retourner sur Meta. Spec : § « Les créas », § « Comparaison — la mécanique » ;
user stories 34, 37 à 45. Décision d'origine : ticket 06 de la carte.

- [ ] Chaque annonce de la Comparaison porte une cible « Lire », visible au repos
      et distincte de la case qui coche ; les groupes d'annonces n'en ont pas
- [ ] Le panneau montre texte, titre, description, bouton et visuel ; chaque
      variante numérotée et en entier ; chaque carte d'un carrousel
- [ ] Un lien sortant « l'annonce envoie vers… », lu dans la créa ; aucun lien
      quand la créa n'a pas d'adresse (testé)
- [ ] Aucun chiffre à côté d'un texte, d'un visuel ou d'une variante, et une phrase
      qui dit pourquoi
- [ ] Les visuels viennent de Storage, pas des URL de Meta qui expirent
- [ ] L'annonce lue vit dans l'URL (`annonce`, par ID) : l'ouvrir retire `jour`, et
      inversement ; une annonce inconnue ne s'ouvre pas
- [ ] `tsc --noEmit` et `npm run build` verts, 19 routes
