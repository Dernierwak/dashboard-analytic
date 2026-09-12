# La Marche suivante écrite par Gemini — la moitié IA du plan de thème

Type: task
Status: open
Blocked by: 08, 10

## Question

**Né du repli du ticket [06](06-rebrancher-le-plan-de-theme.md)**, qui autorisait
mot pour mot à livrer *« les cinq colonnes et la fin de l'entrée automatique,
**sans** la Marche suivante écrite par Gemini, plutôt que les deux à moitié »*.
06 a livré la partie déterministe, vérifiée ; celle-ci reste à faire.

Tranché par [22](../../refonte/issues/22-rebrancher-le-plan-de-theme.md),
décision 6 — **il n'y a rien à re-décider ici, seulement à bâtir.**

### Ce qu'il faut bâtir

Gemini n'écrit plus de piste libre : il écrit **la Marche SUIVANTE d'une
Stratégie déjà ouverte par une règle**, sous trois barrières dures :

- **il n'ouvre jamais une Stratégie** — seule une règle le fait, en posant une
  Hypothèse (`role="hypothese"`) sur un thème ;
- **il déclare `nature`/`role`/`levier`/`metric` dans les listes fermées**, sous
  peine de rejet de la piste entière — la mécanique existe déjà dans
  `_theme_ai_recos` ;
- **il ne nomme qu'un objet présent dans les `facts` du thème.**

La coupe de [11](../../refonte/issues/11-d-ou-viennent-les-conseils.md) reste
intacte : elle visait l'idée *inventée à partir de chiffres*, pas le savoir-faire
— et elle a explicitement épargné les astuces, qui sont le même bois. Aucune
règle déterministe ne sait que « refaire la page d'arrivée » se descend en appel
à l'action → titre → structure.

### Pourquoi il est bloqué par 08 et 10, et pas seulement rangé après

Deux faits mesurés pendant 06, pas deux préférences :

- **08 coupe les pistes IA libres.** Bâtir la Marche suivante avant que 08 ait
  coupé ferait cohabiter deux façons d'écrire une piste dans la même fonction
  (`_theme_ai_recos`), et la seconde vivrait quelques jours pour rien.
- **Une Stratégie ne peut naître aujourd'hui que sur Instagram.** Après 06, les
  seules règles qui posent une Hypothèse sont `orga_essoufflement` et
  `page_endormie` — les deux seules dont la preuve est « à mesurer », les deux
  organiques. Un compte sans Instagram n'ouvre **aucune** Stratégie, donc Gemini
  n'aurait **aucune** Marche à écrire. Ce sont les règles payantes de 07 et 10
  qui lui donnent de la matière.

### Consigne de repli

Livrer la restriction du prompt et le rejet **sans** toucher à la composition des
cinq : le tri appartient à 08, et deux tickets qui réordonnent la même liste se
marchent dessus.
