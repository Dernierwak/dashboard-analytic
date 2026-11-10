# Peut-on comparer des types de campagne Google entre eux ?

Point d'analyse pour le ticket [Ce qu'on montre pour chaque type de campagne](../issues/15-ce-qu-on-montre-par-type.md),
écrit le 2026-11-10 à la demande de David, après le rejet des trois variantes
du prototype (`prototype/google-page`, `f0383ae`). Il s'appuie sur les
recherches du chantier (tickets 01, 02, 10) et sur quelques sources publiques,
citées en bas. Il ne tranche rien : il donne de quoi trancher.

---

## 1 · En une phrase

**Un type de campagne n'est pas une variante d'un même produit, c'est un
métier différent.** Mettre deux types sur un même chiffre compare des métiers,
pas des performances. Ce qui se compare honnêtement, c'est un type face à son
propre passé, des campagnes du même type entre elles, et la répartition de
l'argent et des résultats entre types.

David avait raison sur un point de départ : « les métriques ne s'appliquent
pas à tous, il y a plus de subtilité ». Cette intuition mène à **lire chaque
type avec ses propres chiffres**, pas à les aligner sur une échelle commune.

## 2 · Ce que fait chaque type

| Type | Où il s'affiche | Ce qu'on achète | Le chiffre qui dit s'il fait son travail |
|---|---|---|---|
| **Search** | Sur Google, quand quelqu'un **cherche déjà** | Une rencontre avec une intention | Conversions, coût par conversion, taux de conversion |
| **PMax** | **Partout à la fois** (Search, YouTube, Display, Gmail, Discover, Maps), réparti par Google | Un résultat, Google choisit le canal | Conversions et valeur ; le reste est un mélange de canaux |
| **Display** | Sur des sites et des applis, **pendant qu'on fait autre chose** | Des affichages, de la répétition | Impressions, portée, fréquence ; le clic est rare par nature |
| **Vidéo** | Sur YouTube, **avant ou pendant une vidéo** | De l'attention | Vues, taux de vue, CPV, quartiles |
| **Demand Gen** | Discover, Gmail, YouTube, en image ou en vidéo | De la découverte, souvent par audiences | Clics et conversions, mais aussi l'effet après affichage |

Les deux premiers **récoltent une demande qui existe**, les trois derniers
**en créent une**. C'est le découpage que Google applique à sa propre Vue
d'ensemble : Awareness, Consideration, Action, par stratégie d'enchère et non
par type (ticket 02).

## 3 · Pourquoi un même chiffre ne se compare pas d'un type à l'autre

**Le CTR.** Ordres de grandeur publiés (sources d'éditeurs, méthodes
variables, à lire comme des ordres de grandeur) : Search 3 à 6 %, Display
autour de 0,5 %, Vidéo in-stream 0,4 à 0,7 %. Un écart de 10 fois **est la
norme**, pas un signal. Et même **à l'intérieur de Search**, une campagne de
marque tourne à 15–30 % contre 2–3,5 % pour du générique : le « type » n'est
même pas homogène.

**Le CPM.** Cher sur Search, parce qu'une impression n'y existe que si
quelqu'un cherche ; bas sur Display ou Demand Gen, qui s'achètent en volume.
L'écart dit ce qu'on achète, pas si c'est bien acheté.

**Le CPC.** Un clic Search vient d'une intention, un clic Vidéo vient après
une vue et quitte la vidéo. Ce ne sont pas les mêmes clics.

**Les conversions et leur coût.** Trois raisons de ne pas les opposer entre
types :
- **PMax et Search se disputent les mêmes recherches.** Google donne la
  priorité au mot-clé Search exact identique, puis départage à l'Ad Rank. Il
  admet des exceptions (budget limité, marque), et des analyses tierces
  mesurent un recouvrement réel, y compris sur des mots-clés exacts. La
  conversion va à l'un ou à l'autre : le coût par conversion de l'un dépend
  de la présence de l'autre.
- **Les types du haut du parcours convertissent plus tard ou ailleurs.** Une
  Vidéo qui donne envie de chercher la marque voit sa conversion comptée…
  chez Search. Son coût par conversion est mécaniquement mauvais.
- **PMax est déjà un mélange** de tous les canaux : son CTR ou son CPM est une
  moyenne de Search et de Display, comparable à rien.

**Conclusion :** un tableau qui aligne les types sur un taux fait lire
« Search marche mieux que Vidéo ». C'est faux dans sa construction, et c'est
un conseil déguisé, ce que Pulse ne fait pas (`CLAUDE.md` §1 ; §7 : « ce
qu'on ne peut pas comparer, on écrit pourquoi »). Le ticket 08 l'avait déjà
relevé pour Search et PMax.

## 4 · Et les moustaches ?

Une boîte à moustaches résume **beaucoup d'unités de même nature**, pour
situer l'une d'elles. Sur Instagram ça marche : des dizaines de posts d'un même
format, et on veut savoir où se place le dernier.

Sur Google, il faudrait une unité à mettre dans la boîte :
- **les jours** : un jour n'est pas une chose qu'on juge ou qu'on décide. Sa
  dispersion reflète surtout le volume (un type à une conversion par jour a
  un coût par conversion qui s'envole certains jours, vu au prototype) ;
- **les campagnes d'un type** : presque toujours moins de 6 (comptes réels,
  ticket 03), donc pas de boîte ;
- **les annonces ou groupes** : PMax n'en a pas (ticket 01), et c'est déjà de
  l'analyse par campagne.

Aucune unité ne tient. **Les moustaches n'ont pas d'emploi naturel sur
Google**, ni entre types ni dans un type. C'est un outil d'Instagram.

## 5 · Ce qui se compare honnêtement

1. **Un type face à son propre passé.** « Search a-t-il fait mieux que les
   28 jours d'avant ? » Même métier, même mesure. C'est le principe
   d'Instagram (un format face à son année), et c'est ce que font déjà la
   Tendance et les écarts de Pulse.
2. **Des campagnes du même type entre elles**, avec une réserve : marque et
   générique, dans Search, ne font pas le même métier non plus. La
   Comparaison de Meta le fait déjà ; c'est le sujet du ticket 16.
3. **La répartition entre types** : la part de la dépense et la part des
   résultats (« Search : 54 % de la dépense, 80 % des conversions »). C'est
   un fait que Google montre lui-même, pas un classement — avec la réserve
   d'attribution de la section 3, qu'un « ⓘ » doit dire.
4. **Les chiffres propres à chaque type**, sans les aligner : vues et CPV
   pour Vidéo, réseaux pour PMax, portée pour Display… C'est la « subtilité »
   que cherchait David — mais c'est aussi l'**analyse par type**, mise au
   `BACKLOG.md` au ticket 08, « une par une ».

## 6 · Ce que ça veut dire pour la page

Trois façons de faire, de la plus légère à la plus riche :

**A · Le type comme filtre, rien d'autre** (le marché, ticket 02). Simple,
honnête, déjà décidé au ticket 04 puis suspendu. David l'a écarté au tour 1 :
un filtre ne montre pas les subtilités de chaque type.

**B · Un bloc « Types de campagne » factuel** — une ligne par type, ordre
fixe, **sans échelle commune** :
- sa dépense et sa part ;
- le compte de la vue (impressions, clics ou conversions) et sa part ;
- le taux de la vue **face à sa propre période d'avant** (écart signé), et
  une petite courbe **à sa propre échelle** ;
- un clic sur la ligne ouvre la Comparaison des campagnes de ce type.

C'est la lecture d'ensemble que voulait David (« voir les types avant de
comparer les campagnes »), sans faire dire à l'écran qu'un type gagne.

**C · B, plus les chiffres propres à chaque type** sur sa ligne (Vidéo : vues
et CPV ; PMax : part par réseau ; Display : portée). Plus riche, mais c'est
l'analyse par type qui revient dans le périmètre : il faut la récolter et la
spécifier type par type (tickets 01 et 10 disent ce qui est disponible).

**Ma recommandation : B maintenant, C un type à la fois ensuite.** B répond à
l'envie de voir les types, reste juste, et ne coûte à la récolte que le type
de campagne (déjà prévu). C est la suite naturelle, au `BACKLOG.md`.

## 7 · Les questions qui restent à trancher

1. Accepte-t-on que **les types ne se comparent jamais sur un même chiffre**,
   même un taux ?
2. Abandonne-t-on **les moustaches** sur Google ?
3. **A, B ou C** ? Et si B : où va le bloc — à la place de la Comparaison (qui
   s'ouvrirait sur un type), ou au-dessus d'elle ?
4. Si C un jour : **par quel type commencer** ? (Demand Gen est la 2ᵉ dépense
   de A sur 36 mois, ticket 10 ; Search est le type présent partout.)

---

## Sources

- Recherches du chantier : `issues/01-ce-que-l-api-donne-par-type.md`
  (branche `research/google-api-types`), `issues/02-comment-le-marche-presente-google-ads.md`
  (branche `research/google-marche`), `issues/10-l-essai-reel.md`.
- Google Ads Help, *About Performance Max campaigns* (priorité du mot-clé
  exact, exceptions de marque) : https://support.google.com/google-ads/answer/10724817
- Google Ads Help, *What to track based on your advertising goals* :
  https://support.google.com/google-ads/answer/1722036
- Recouvrement PMax / Search, analyses tierces :
  https://searchengineland.com/performance-max-vs-search-campaigns-overlap-data-448788 ,
  https://adalysis.com/blog/is-performance-max-cannibalizing-your-search-ads-a-deep-dive-into-search-term-overlap/
- Ordres de grandeur de CTR par type (sources d'éditeurs, méthodes non
  publiées, à lire comme des ordres de grandeur) :
  https://www.clickminded.com/google-ads-benchmarks/ ,
  https://foundrycro-marketing.pages.dev/blog/ctr-benchmarks-by-ad-type-2026/ ,
  https://agencyanalytics.com/blog/google-ads-benchmarks
