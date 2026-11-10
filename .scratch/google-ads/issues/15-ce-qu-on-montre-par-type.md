# 15: Ce qu'on montre pour chaque type de campagne

Type: grilling
Status: open
Blocked by: 11
Assignee: Claude (session du 2026-11-10)

## Question

Pour chaque type de campagne (Search, PMax, Display, Vidéo, Demand Gen, Autres types — Demand Gen nommé au ticket 14),
**qu'est-ce que la page `/google` montre de propre à ce type, et où ?** La
moustache par type (ticket 04), le classement de campagnes de types différents
dans la Comparaison (08), ce qui change quand le filtre est sur un seul type.

Sorti de [La page Google en maquette](11-la-page-google-en-maquette.md) le
2026-11-10 : David ne veut pas entrer dans ce détail tant que la page
elle-même n'est pas posée (« on sait que ce sera plus tard pour voir les
campagnes en détail ou analyse de campagne »). Voisin de l'analyse propre à
chaque type, au `BACKLOG.md` et hors périmètre de la carte : ce ticket ne
couvre que ce que la page affiche, pas l'analyse.

Matière déjà là : la maquette rejetée, branche `prototype/google-page`.

## Grilling en cours (2026-11-10)

Tour 1, réponses de David :
- **Pas de filtre Type de campagne dans le Bandeau** : « il faut faire un
  module des types de campagnes. Car le bandeau on filtre des choses, mais
  nous n'avons pas les métriques qui s'appliquent pour tous, il y a plus de
  subtilité. »
- **Moustaches « comme pour insta »**, à préciser : sur Instagram, une
  moustache est une boîte à moustaches (la distribution des posts d'un
  format, 12 mois / 3 mois / 1 mois, spec au commit `9562713`), pas la barre
  de parts du ticket 04.
- **Repère de type** par ligne de campagne, dans le Tableau et la
  Comparaison : oui.

Tour 2, réponses de David :
- **La Comparaison devient ce module** : « on compare que les mêmes types de
  campagnes entre elles », et « avec les moustaches voir quel type fonctionne
  le mieux avant de les comparer, comme Instagram ». Entrer dans le détail
  d'une campagne par type : à détailler plus tard. Cela révise le ticket 08
  (« la Comparaison ne détaille pas les types ») et touche le ticket 16.
- **Ce n'est pas l'organique** : « différents types, budgets, timelines,
  produits » ; il faut montrer **l'évolution jour par jour** et ne comparer
  par les moustaches que **ce qui est comparable — CTR, CPM**, les taux.
- **Un mélange de courbes et de moustaches**, que David me demande de
  proposer.

Tour 3 : proposition (une rangée par type, la courbe jour par jour à gauche,
la boîte des jours à droite, même échelle ; dessous, la Comparaison de Meta
entre les campagnes d'un seul type ; des taux seulement, la dépense en repère ;
seuil de 6 jours). David : « il faut un prototype ».

## Prototype (2026-11-10)

Branche jetable `prototype/google-page`, commit `f0383ae`,
`saas/web/app/google/_prototype-page/` ; en dev, `/google?maquette=page`,
puis `&variant=A|B|C` (barre en bas, touches ← →), `&mt=` pour le taux,
`&type=` pour le type ouvert. Chiffres fictifs ; Demand Gen et Vidéo
ajoutés pour juger le module, Display « aucune diffusion sur la période ».

- **A · Rangées** : une rangée par type — tête (taux de la période, écart,
  dépense), courbe jour par jour avec la période d'avant en pointillé, boîte
  verticale ; dessous, des onglets de type et la Comparaison de Meta entre
  les campagnes du type choisi.
- **B · Superposé** : cinq têtes de type en ligne, un seul graphe où chaque
  type a sa courbe, les boîtes en marge droite sur la même échelle ; dessous,
  pareil que A.
- **C · Boîtes d'abord** : une boîte horizontale par type sur une échelle
  commune ; le type ouvert se déplie sous sa rangée (sa courbe, puis ses
  campagnes).
- Repère de type à côté de chaque campagne dans le Tableau (oui du tour 1).

Constaté en le construisant, à trancher : sur une échelle commune, une boîte
dit surtout le **niveau** du type, peu sa dispersion ; et le **coût par
conversion jour par jour** d'un type qui convertit peu (Demand Gen, moins
d'une conversion par jour) s'envole certains jours, étire l'échelle et écrase
Search.

**Rejeté par David, les trois variantes** : « on n'arrive pas forcément à
rentrer dans le détail type de campagne […] je sais vraiment pas quoi mettre ».
Il pose la question de fond — comparer des types, moustaches ou autre, est-ce
que ça a un sens ? — et demande un point d'analyse avant de répondre :
[Peut-on comparer des types de campagne Google entre eux ?](../analyses/15-comparer-les-types.md).
Sa thèse : un type est un métier, pas une variante ; aucun chiffre commun ne
les compare, même un taux ; les moustaches n'ont pas d'unité sur Google ; se
comparent un type face à son passé, des campagnes du même type, et la
répartition. Recommandation : un bloc « Types de campagne » factuel (B), puis
les chiffres propres à chaque type, un type à la fois (C).
