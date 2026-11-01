# 01: La structure de la page

Type: grilling
Status: open
Blocked by: —
Assignee: —

## Question

Quels blocs la page `/instagram` porte-t-elle, dans quel ordre, et sous quel
nom ? Le point de départ est la liste de David (carte, Notes : la page →
les moyennes façon hebdo → le carré → l'aperçu → format → abonnés → tous les
posts) posée face au squelette de Meta (Bandeau de commandes, Sélecteur de vue,
Tendance, Comparaison, Tableau détaillé, Panneau latéral).

À trancher pour chaque module Meta : garde-t-il son **nom, son rôle et sa
place** en organique (ADR 0011), change-t-il de rôle (la Comparaison devient
le carré ?), ou disparaît-il (un Sélecteur de vue a-t-il un sens sans
objectif de campagne) ? Et pour chaque bloc actuel de
`saas/web/app/instagram/page.tsx` — « Ta page », moyennes, posts un par un,
Top 3, posts de la période, vue globale — il reste, il fond dans un module, ou
il part.

Ne tranche pas le contenu des modules (la place d'un post, l'âge, les formats
ont leur ticket) : seulement leur existence, leur ordre et leur nom.
