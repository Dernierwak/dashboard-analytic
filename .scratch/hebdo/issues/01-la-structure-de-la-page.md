# 01: La structure de la page

Type: grilling
Status: resolved
Blocked by: —

## Question

Repartir des cinq points de David (Notes de la carte) et fixer la
**structure** de la page hebdo : quels blocs existent, dans quel ordre, ce qui
part de l'existant et ce qui le remplace. Le détail de chaque bloc reste à son
ticket.

L'état du code au moment de trancher : [l'inventaire](../inventaire-2026-10-28.md).

## Answer

Tranché avec David le 2026-10-28.

**La charpente, ce sont des blocs.** Chaque bloc dit une chose ; à l'intérieur,
il se lit par plateforme. On ne découpe pas la page par plateforme.

**Les blocs, dans l'ordre :**

1. **Le titre et les totaux.** Le titre nomme la semaine, rien d'autre — ni
   chiffre, ni ton. Dessous, les totaux de la semaine, chacun avec sa
   répartition par plateforme (« 1 240 CHF, dont Meta 800 · Google 440 ») :
   - **dépense** et **impressions** : un total — elles se comptent, donc
     s'additionnent ;
   - **portée organique** : côte à côte (Insta · Facebook · TikTok), **sans
     total** — la portée compte des personnes uniques, une même personne
     touchée sur deux plateformes y est comptée deux fois ; la somme serait
     plus grande que la réalité (§7). Si un total organique est voulu, ce sont
     les vues qui s'additionnent.
   David : « voir le total que la semaine nous a apporté, ça nous donne une
   vision ».
2. **Le module des canaux** — tel que tranché au ticket 02. Un clic sur une
   carte mène à la page de la plateforme ; la page hebdo ne déplie rien.
   David l'appelle aussi **la boussole** : les deux mots désignent ce bloc.
   Sa forme se cherche en maquette — « pour l'instant je ne vois pas à quoi
   il ressemble » (ticket 10).
3. **Les campagnes et les posts sur l'année** — la frise actuelle. David :
   « toutes les campagnes en cours et les prochaines qui vont arriver, c'est un
   module qui vaut beaucoup ». Son zoom et sa vue de l'année restent.
4. **Le meilleur du compte** — la meilleure campagne Meta et les meilleurs
   posts Instagram, comme repère : « voilà ce qu'on a fait de mieux ». David
   le juge « très pertinent », mais l'existant ne le montre pas : il faut le
   construire pour savoir s'il est faisable (ticket 07). Sa place exacte
   (avant ou après la frise) se décide en maquette.
5. **Les changements** — en suspens : David ne sait pas encore s'ils méritent
   leur place, ni où (bloc ou colonne). Ticket 05, puis la maquette.

**Ce qui part :**

- **Le verdict.** David : « tout ce qui va être verdict, j'aimerais enlever ;
  pas de conseils pour l'instant ». La page compare à la moyenne, point.
- **La boussole comme bloc à part.** Pour David, elle était déjà « la
  comparaison avec les moyennes » : elle devient le module des canaux. Ses
  zones (« tu peux scaler ») et sa rangée de boutons partent.
- **Le bandeau « Meta n'a pas répondu »** (`CanalMuetAlerte`). David : une
  récolte en panne se voit en interne, pas sur la page client. Mais §7 tient :
  quand une plateforme n'a pas répondu, sa case affiche « — », jamais 0, et le
  total ne la compte pas comme zéro. Une semaine sans campagne, elle, vaut un
  vrai 0.
- **Les clés que personne ne lit** : `metrics_read`, `metrics_prev`,
  `metrics_series`, `kpis` (abonnés compris). Plomberie, réglée dans la spec.

**Ce que « statique » veut dire** — corrigé : la comparaison se voit **sans
que le client règle un filtre**. Bouger, zoomer, défiler, voir l'année :
permis. Les Notes de la carte disaient « pas de filtre, pas de bascule » ;
c'était trop large.

**Ce qui reste du fil de mise en place et des états vides** : en tête, hors
charpente ; leur forme suit la maquette.

**Hors chantier** : un connecteur LLM pour poser des questions à ses données
(David : « on verra dans une autre issue »). `CLAUDE.md` §1 dit aujourd'hui
qu'aucun appel à un modèle de langage ne subsiste : le rouvrir sera une
décision explicite.

David veut passer par **un ou deux prototypes** : le haut de page (titre,
totaux, module des canaux) d'abord, la page entière ensuite.
