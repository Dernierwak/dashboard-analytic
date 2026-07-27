---
name: ux
description: Revue UX de Pulse au niveau d'un produit pro (Notion, Linear, Stripe) — suit une action de bout en bout, compte ce qu'elle coûte à l'utilisateur, vérifie ses quatre états (vide, chargement, erreur, succès) et dit ce qui trahit l'amateurisme. Utilise cette skill dès que David parle d'UX, d'ergonomie, de « faire pro », de Notion/Linear/Stripe comme référence, de parcours, de flow, de boutons, d'états, de ce qui « fait cheap » ou « fait pas sérieux », ou demande « améliore l'UX », « est-ce que ça fait pro », « la personne va comprendre ? », « optimise le parcours » — même s'il ne nomme ni la page ni la skill. À distinguer de `hebdo`, qui revoit la STRUCTURE du rapport hebdo ; ici on revoit les ACTIONS et le ressenti de qualité sur n'importe quelle page.
---

# UX — le niveau d'un produit pro

Pulse doit donner à son utilisateur la sensation d'être sur un outil sérieux, pas sur un projet du week-end. Cette sensation ne vient pas des couleurs : elle vient du fait que **chaque action qu'on peut faire a été pensée jusqu'au bout** — ce qu'elle coûte, ce qu'elle répond, ce qui se passe quand elle échoue, et ce qu'on voit avant d'avoir des données.

C'est exactement ce que font Notion, Linear et Stripe. Rien d'extraordinaire à l'œil ; simplement aucun bord non fini. Ta mission ici : trouver les bords non finis, et dire lesquels valent la peine.

Tu ne juges pas la structure d'une page (c'est la skill `hebdo`) ni l'exactitude des chiffres. Tu suis **ce que la personne fait**.

## D'abord : va dans le code, page par page

Une revue UX faite de mémoire invente des problèmes et rate les vrais. Lis ce qui existe :

- `saas/web/app/page.tsx` — le rapport, et `app/labels|meta|google|instagram|couts/page.tsx`
- `saas/web/components/` — les composants interactifs, là où vivent les états
- `saas/web/app/actions.ts` — les server actions : ce que chaque bouton déclenche vraiment

Si David nomme une page ou un parcours, concentre-toi dessus. S'il ne dit rien, prends **le parcours le plus utilisé** — ouvrir le rapport, prendre un conseil, le marquer fait.

Souviens-toi de l'usage réel : **un téléphone, une main, dix minutes le lundi matin**. Un parcours confortable en 1440 px de large et pénible en 390 px est un parcours raté.

## L'unité d'analyse : l'action, pas l'écran

Prends une action concrète que l'utilisateur veut accomplir (« marquer un conseil comme fait », « changer le thème d'une campagne », « lancer une récolte », « choisir mes priorités ») et déroule-la de bout en bout. Pour chacune, cinq questions — dans cet ordre, parce que chacune coûte plus cher que la précédente à l'utilisateur :

**1. Est-ce qu'on la trouve ?** Le bouton est-il là où la personne le cherche, au moment où elle le veut ? Une action utile enterrée dans un `<details>` replié n'existe pas.

**2. Est-ce qu'on comprend ce qu'elle va faire, avant de cliquer ?** Le libellé décrit-il le résultat (« Marquer comme fait ») ou le mécanisme (« Valider ») ? Une action irréversible s'annonce-t-elle comme telle ?

**3. Combien coûte-t-elle ?** Compte les clics, les allers-retours entre pages, les scrolls et les saisies. Une action fréquente à trois clics est un défaut de conception ; la même action rare à trois clics ne l'est pas. **Toujours pondérer par la fréquence** — c'est ce qui sépare une vraie reco d'un caprice.

**4. Qu'est-ce qu'on voit pendant, et après ?** Un clic sans retour visible sous ~100 ms fait douter puis recliquer. Après coup, l'utilisateur doit voir que son geste a pris effet — sans avoir à chercher.

**5. Et si ça rate ?** Réseau coupé, table absente, droit manquant : est-ce que la personne comprend ce qui s'est passé et ce qu'elle peut faire ? Un échec silencieux est le plus sûr moyen de perdre sa confiance.

## Les quatre états, à vérifier systématiquement

C'est là que se joue l'écart entre un projet perso et un produit. Tout composant qui affiche des données doit tenir dans les quatre :

- **Vide** — première semaine, aucune donnée. Est-ce qu'on explique ce qui va arriver et ce qu'il faut faire pour l'obtenir, ou est-ce qu'on affiche une boîte vide ? Le vide est un moment d'accueil, pas une erreur.
- **Chargement** — action longue (récolte, classement IA, rapport). Est-ce qu'on sait que ça tourne, où ça en est, combien de temps il reste ? Et est-ce qu'on peut partir sans tout perdre ?
- **Erreur** — l'échec est-il visible, compréhensible sans jargon, et suivi d'une porte de sortie ?
- **Plein** — beaucoup de données. Est-ce que ça reste lisible à 23 thèmes et 41 campagnes, ou est-ce que ça déborde ?

Un composant qui ne gère que « plein » n'est pas fini, même s'il marche tous les jours.

## Ce qui trahit l'amateurisme (les vrais signaux)

Cherche ceux-là en priorité : ils coûtent peu à corriger et changent beaucoup la perception.

- **Le clic sans réponse** — pas de `disabled`, pas de « … », rien pendant l'attente.
- **Le texte système** — « Erreur 500 », « undefined », un nom de table Supabase à l'écran. Chaque phrase visible s'écrit dans la langue de l'utilisateur.
- **La cible trop petite** — sous 40 px de haut sur téléphone, on rate. Et le pouce atteint mal le haut de l'écran.
- **Le déplacement de contenu** — un bloc qui apparaît et pousse ce que la personne allait toucher.
- **La double affordance** — deux boutons pour le même résultat sur le même écran : la personne se demande lequel est le bon.
- **L'irréversible sans filet** — une suppression sans confirmation ni annulation.
- **L'incohérence de vocabulaire** — « thème » ici, « label » là, pour la même chose. Un produit pro n'a qu'un mot par concept.
- **Le libellé qui décrit le mécanisme** — « Rafraîchir les données » plutôt que « Mes données ».

## Les règles déjà tranchées

Elles font partie du produit ; une reco qui les ignore fait perdre du temps. Si tu veux revenir sur l'une d'elles, dis-le explicitement.

- **Le téléphone d'abord** : cibles généreuses, une seule colonne à 390 px, l'action importante atteignable au pouce.
- **Une liste longue scrolle dans sa boîte** (composant `ScrollList`), jamais la page.
- **3 chantiers en cours maximum** — au-delà, on invite à en finir un.
- **Une action décidée vit en haut** du rapport jusqu'à être faite (à faire → fait → verdict à 14 jours).
- **L'outil teste et propose** ; il ne fait pas remplir de questionnaire pour valider une intuition.
- **Aucun chiffre non mesuré présenté comme mesuré** — un « — » assumé, jamais une estimation déguisée.
- **Une reco est un guide, jamais un ordre.**

## Le format de sortie

```
### ✅ Ce qui est déjà au niveau
[2-4 lignes. Nomme le composant ET pourquoi c'est pro — un état vide soigné,
 un retour immédiat, une contrainte assumée. Mérité, pas décoratif.]

### 🔍 Le parcours au banc d'essai
[l'action suivie de bout en bout, étape par étape, avec le coût réel :
 « ouvrir le rapport → scroller 2 écrans → déplier → 2 clics ». Puis les
 quatre états du composant concerné : vide / chargement / erreur / plein,
 avec ✓ ou ✗ et une raison.]

### ⚠️ Ce qui fait amateur
[≤ 4 points, du plus visible au moins visible. Pour chacun : ce que la personne
 vit, et le fichier ou le composant en cause.]

### 🎯 Ce que je corrigerais
[≤ 3 corrections. Pour chacune : le geste précis (fichier, composant, libellé
 exact quand c'est du texte) · pourquoi ça relève le niveau · l'effort
 (10 min / 30 min / 1 h / 2 h+).]
```

Vise 500 à 700 mots. Une revue UX qu'on ne lit pas ne corrige rien.

## Ce qui fait rater cette revue

- **Parler couleurs et arrondis.** Le « pro » se joue sur les états et le coût des actions, pas sur la palette. Si tu n'as que de l'esthétique à dire, c'est que tu n'as pas suivi une action jusqu'au bout.
- **Traiter toutes les actions à égalité.** Un clic de trop sur une action quotidienne compte cent fois plus que sur une action annuelle. Pondère, toujours.
- **Copier Notion pour copier Notion.** La référence sert à viser un niveau de finition, pas à importer une interface. Cite-la pour un mécanisme précis (leur état vide, leur retour optimiste), jamais comme argument d'autorité.
- **Oublier le téléphone.** C'est l'usage principal. Un parcours doit être jugé à 390 px de large, une main occupée.
- **Lister vingt micro-défauts.** Trois corrections qui changent la perception valent mieux qu'un audit exhaustif que personne n'applique.
- **Proposer sans regarder le code.** Beaucoup d'états sont déjà gérés ; recommander ce qui existe déjà décrédibilise tout le reste.
