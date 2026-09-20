# D'où viennent les conseils, combien, et où ils vivent

Type: grilling
Status: resolved

## Question

Gradué par [06](06-le-parcours-comment-les-pages-se-parlent.md) — le seul module
de sa liste qu'aucun fait de cette session n'a éclairé, et le plus lourd du code.

David en a fixé le **rôle** en [03](03-le-but-de-pulse.md) : *« on te propose
des choses à faire **si tu as plus d'idées** »*. Le conseil est le filet, pas le
produit — alors qu'il occupe l'essentiel du code.

### Les faits déjà mesurés

- `build_payload` fait **3 060 lignes** et l'essentiel travaille les conseils.
- **3 appels réels à Gemini** (l. 1470 pistes de thème, 1612 astuces, 3178
  résumé), plus un quatrième par injection dans `build_user_persona`.
- `reco_engine.py` (757 l.) et `insights.py` (459 l.) sont **déterministes** —
  pas une occurrence de « gemini ». Un conseil sans IA est techniquement
  possible aujourd'hui.
- Deux chemins coexistent : `rule_recos` (l. 2048, **compte entier, sans
  thème**) qui alimente `recos`/`todo`/`reglages`, et `t_recos` (l. 2969, **par
  thème**) qui alimente `themes_focus` puis `top_recos`.
- `top_recos` est plafonné à 3 et construit **exclusivement** en itérant sur
  `themes_focus`.
- Le profil d'onboarding nourrit déjà le ton via `user_persona.py`.

### Le fait de marché qui contraint la réponse

[02](02-sur-quoi-se-differencient-les-autres.md) : **Google Ads et Meta livrent
déjà gratuitement des recommandations priorisées, dans l'écran où le clic
s'applique.** Un conseil du type « augmente ce budget », « exclus ce mot clé »
est perdu d'avance. Ce qui reste libre : ce que la régie ne peut pas dire —
un arbitrage entre des choses qu'elle ne voit pas ensemble (canaux, organique et
payant, un thème qui traverse les deux).

Et la grammaire publique de GoodMorning, à copier sans hésiter : **jusqu'à 5
conseils, trois rangs d'urgence (« Act today / This week / Monitor »), trois
colonnes obligatoires (quoi faire, pourquoi, impact attendu)**.

### Ce qu'il faut trancher

- **À partir de quoi un conseil se fabrique maintenant** : les chiffres seuls,
  le profil, les notes du client (cf. [08](08-la-memoire-du-travail.md)) ?
- **Combien par semaine, et à quel rang d'urgence.** Le plafond actuel est 3
  (`top_recos`) plus ceux des cartes de thème — donc en pratique bien plus.
- **Où ils vivent** : le point général, la carte du thème, ou les deux ?
- **Ce qu'on arrête de conseiller** parce que la régie le fait mieux et gratis.
- **Ce que l'IA rédige encore**, sachant que le moteur déterministe existe.

### Ce qui n'est PAS dans ce ticket

Le sort des thèmes (encore dans la brume) et la refonte de `build_payload` —
cette carte produit un plan, pas du code.

### Consigne de conduite

Ticket **HITL**. Skills : `recos` (pertinence et variété), `hebdo` (la place du
bloc), puis `grilling`. Règle dure `CLAUDE.md` §7 : aucun chiffre fabriqué,
une reco est un guide jamais un ordre, et jamais de comparaison Meta ↔ Google
dans un conseil.

## Answer

### La découverte qui déborde le ticket : trois moteurs pour une seule question

*« Qu'est-ce qui marche chez toi ? »* est calculé **trois fois, dans deux
langages, avec trois jeux de seuils** :

| Moteur | Ce qu'il produit | État |
|---|---|---|
| **A** — `insights.py` (459 l., zéro IA) | *« Ce qui fonctionne pour toi »* : 3-5 constats chiffrés croisant **tout l'historique** par thème × format × campagne × créneau, à clés stables (un constat rejeté reste écarté) | **Jamais affiché** |
| **B** — `reco_engine.py` | deux types de conseils : `format_gagnant` (« reproduire un format gagnant ») et `creneau` (« publier au bon créneau »), sur une fenêtre courte | Affiché comme conseils |
| **C** — `app/instagram/page.tsx` | les blocs « Ce qui marche pour toi · par format » et « Quand publier ? », **recalculés en TypeScript** | Affiché, Instagram seulement |

**C'est la réponse à la question laissée ouverte par
[07](07-gabarit-de-plateforme.md)** : le bloc « ce qui marche » et le conseil ne
sont pas deux noms du même objet — ce sont trois moteurs qui disent la même
chose et qui peuvent se contredire.

**Et le plus complet est invisible.** `vision.constats` n'est rendu par aucun
composant : `app/page.tsx` ne lit que `report.vision.period_label` (l. 620).
Pendant ce temps `/labels` (l. 138) promet au client *« Étoile les thèmes sur
lesquels tu veux qu'on travaille — les constats… »*. **On promet un bloc qui
n'existe pas à l'écran.** Troisième tuyau mort après `preuve`
([06](06-le-parcours-comment-les-pages-se-parlent.md)).

### Les décisions de David

**A gagne, B et C meurent.** `insights.py` devient la source unique : il croise
tout l'historique quand les deux autres regardent une fenêtre, il est
déterministe, et ses clés stables portent déjà le feedback du client. Les deux
règles de B redeviennent des **constats**, pas des conseils. C **arrête de
calculer et affiche A**.

Bénéfice immédiat et non prévu : cela remplit le **rang 4 du gabarit de 07**
(« ce qui marche pour toi ») **sur Meta, Google et Instagram d'un coup**, sans
une ligne de calcul nouvelle — alors qu'aujourd'hui seul Instagram l'a.

**Cinq conseils par semaine, sur tout le compte, tous thèmes confondus.**
Aujourd'hui le plafond est de 3 **par thème** (`build_report.py` l. 2877,
`if len(t_recos) >= 3: break`) sur un **nombre de thèmes illimité** (plafond
retiré le 14 août 2026, `VisionBlock.priorities`) — donc ce n'est pas un
plafond : six thèmes étoilés donnent jusqu'à 18 conseils, plus les 3 de la
sélection. **Dix minutes le lundi matin ne tiennent pas dix-huit conseils.**
David : *« faire simple au début. »*

**Un conseil naît sur la carte du thème ; le haut de page n'en est que le
renvoi.** C'est déjà le comportement du code (`topRecos` pointe vers les ancres
des cartes) et [06](06-le-parcours-comment-les-pages-se-parlent.md) a établi que
le rail des actions est bon — on ne le défait pas. **Mais David a déplacé le
renvoi** : *« cela devrait être plus une notification "tu as encore X recos" ;
cette notification peut vivre sur l'app, elle ne doit pas être rattachée à la
page hebdomadaire. »* → rattaché au ticket [12](12-module-de-commandes.md),
même nature : quelque chose de visible partout qui n'appartient à aucune page.

**On arrête tout conseil qui porte sur une campagne précise dans une seule
régie.** [02](02-sur-quoi-se-differencient-les-autres.md) : Google Ads et Meta
livrent déjà ces recommandations gratuitement, **dans l'écran où le clic
s'applique**. Deux règles sont exactement là-dessus (`gaspillage`, `scaler`). On
garde ce qu'aucune régie ne peut voir : un thème qui traverse Meta et Google, un
thème qui vit en payant et en organique, un budget arbitré entre canaux — la
position que 07 a donnée au rang 4.

**Les pistes inventées par l'IA sont coupées.** Correction au ticket, qui
annonçait 3 appels Gemini : il y a **cinq sites d'appel** dans
`build_report.py` — l. 1470 (les pistes de thème), 1612 (les astuces), 2041 (le
ton, via `build_user_persona`), 3178 (le résumé de la semaine), 3931 (la mémoire
d'un thème, commit `cf84957`).

Seules les **pistes (l. 1470)** sont coupées : c'est le seul endroit où Pulse dit
quelque chose que **rien ne peut vérifier** — ni un chiffre du compte, ni une
règle — et elles occupaient la place des cinq conseils qu'on vient de plafonner.
Les quatre autres restent : les astuces et le ton ne touchent aucun chiffre du
compte, le résumé reformule ce qu'on lui donne (interdiction de calculer), et la
mémoire d'un thème vient d'être construite.

### Ce que ça laisse au moteur

`reco_engine.py` garde ses règles déterministes moins celles de B et moins celles
qui doublonnent la régie. **Un rapport hebdomadaire complet sans Gemini du tout
reste techniquement possible** — c'était vrai avant ce ticket, ça l'est encore.

## Comments

**2026-09-10, correction apportée par [21](21-le-document-de-refonte.md)** —
David : *« Les labels sont les recos pour les labels prio. Fin. »* Les conseils
ne portent **que** sur les thèmes prioritaires (trois maximum) : c'est un
**filtre dur**, pas le tri qui existe aujourd'hui (`build_report.py` l. 442 met
`is_priority` en tête mais laisse sortir les autres plus bas).

Conséquences sur ce qui est écrit ici : les cinq par semaine restent un
**plafond, jamais un quota** — on ne complète pas avec du non-prioritaire ; et un
compte à zéro priorité voit le module de conseils **verrouillé**, pas vide.
