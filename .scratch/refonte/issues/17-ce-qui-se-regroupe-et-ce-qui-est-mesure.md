# Ce qui se regroupe, et ce qui est une mesure figée

Type: grilling
Status: resolved
Blocked by: 13

## Question

[13](13-entre-deux-jours-de-travail.md) a tranché la règle : **ce qui se
REGROUPE se recalcule à la lecture, ce qui se RÉCOLTE ou se RÉDIGE attend le
Jour de travail.** Elle s'applique déjà sur les dashboards
(`lib/channels.ts` l. 653-659, `lblAgg` → `byLabel`).

Reste à l'appliquer là où le trou est : **les blocs par thème du rapport**
(`themes_focus`, `themes.rows`, `themes_tips`, `top_recos`), qui sortent du
payload figé. `revalidatePath("/")` y est déjà appelé et n'y peut rien.

**Quel champ d'une carte de thème est un regroupement, et lequel est une mesure
prise à une date ?**

### Le piège, nommé

Recalculer en TypeScript ce que `build_report.py` calcule en Python, c'est le
défaut à trois moteurs mesuré au ticket
[11](11-d-ou-viennent-les-conseils.md) — trois jeux de seuils qui se
contredisent. Une carte de thème ne porte pas que des sommes : elle porte du
revenu GA4 ventilé, des séries, des baselines, des verdicts. Tout recalculer à
la lecture serait un second moteur ; ne rien recalculer laisse le trou de 13.

### La limite déjà établie par la carte

**Baselines, snapshots et verdicts de suivi ne rétroagissent pas** — la
rétroactivité du classement est vraie pour les chiffres (jointure à la lecture,
aucune date de pose ne filtre) mais une mesure prise à une date reste ce qu'elle
était. C'est déjà écrit dans les Notes de `map.md` ; ce ticket en fait un
inventaire, champ par champ.

### Ce qu'il faut trancher

- **L'inventaire.** Pour chaque champ de `ThemeFocus` / `ThemeRow`
  (`lib/report.ts` l. 340-460) : regroupement recalculable, ou mesure figée ?
- **Où vit le calcul du regroupement.** Réutiliser l'agrégateur qui existe
  (`lib/channels.ts`) plutôt qu'en écrire un second, et si oui, où il se pose
  pour servir les deux pages sans se dupliquer — voir la skill
  `codebase-design` (module profond, une seule couture).
- **Ce qu'on fait d'une carte dont une partie est fraîche et l'autre figée.**
  13 a tranché **qu'on ne l'annonce pas par carte** (le rapport porte ses trois
  dates en tête). À vérifier une fois l'inventaire fait : si un champ figé et un
  champ frais se contredisent visiblement dans la même phrase, la décision de 13
  se rediscute — mais avec le cas précis sous les yeux, pas par principe.
- **Le revenu GA4 par thème.** `revenuTheme` (`lib/report.ts` l. 210) réconcilie
  déjà **deux** sources qui peuvent diverger (`themes.rows[].rev` et
  `themes_focus[].summary.revenue`). Un troisième chemin recalculé à la lecture
  ferait trois. À trancher avant d'y toucher.

### Trois défauts de rafraîchissement à corriger avec

- `setCampaignLabel` ne rafraîchit pas `/couts` (coûts **par thème**).
- `setPostLabel` ne rafraîchit pas `/` (le rapport regroupe aussi les posts).
- `revalidatePath("/")` de `setCampaignLabel` est un no-op tant que les blocs
  par thème viennent du payload.

### Consigne de conduite

Ticket **HITL**. Skills : `codebase-design` (où passe la couture), puis
`grilling`. **L'inventaire est un travail de lecture de code** : le faire avant
de poser une question à David, et ne lui soumettre que les champs où le
classement est ambigu.

### Consigne de repli

Livrer l'inventaire complet des champs sans trancher où vit le calcul.


## Answer — 2026-09-11

**La règle de 13 tenait ; c'est mon inventaire qui était trop timide.** J'avais
rangé la courbe du thème en « mesure figée ». David a corrigé : *« la courbe se
met à jour et les records sur l'ancienne semaine »* — une courbe n'est qu'une
suite de sommes, donc un Regroupement, donc elle rétroagit comme le reste.

### La règle, dans les mots de David

> *« Tout ce qui va être dashboard, tout ce qui va être information qu'on peut
> déjà remontrer, c'est mis à jour directement. Mais tout ce qui va être
> recommandations, cela attend le prochain fetch, qui est fixé par le jour de
> l'utilisateur, et ensuite ça sera tout mis à jour. »*

Ce n'est pas « la semaine du rapport se rafraîchit » : **tout l'historique du
thème se recompose**, semaines passées comprises. La rétroactivité du classement
était déjà vraie par construction (le thème vit sur la configuration de la
campagne, la jointure se fait à la lecture) — elle devient visible.

### L'inventaire, corrigé

**Regroupements** — se recalculent à la lecture, tout de suite, sur tout
l'historique : `themes.rows[].spend/.rev` · `summary.spend` · `.ctr` · `.posts` ·
`.reach_avg` · `.eng_avg` · `.spend_week` · `.best_campaign` · `.n_campaigns` ·
`campaigns[]` · **et `series` en entier**, points des dix semaines compris.

**Mesures prises** — enregistrées à une date, ne rétroagissent jamais :
`jugement` (en entier, voir plus bas) · les baselines et Verdicts de
`suivi_actions` · les repères d'action sur la courbe (`marqueurs` : des dates,
des faits).

**Écrits** — attendent le Jour de travail : `recos` · `themes_tips` ·
`top_recos` · `themes_intro` · `ia_redigee` · `series.note`.

**Réglages** — figés par décision de 13, pas par nature : `is_priority` ·
`objectif` · `objectif_propre`.

### Les quatre décisions

**1 · Le regroupement descend dans une vue SQL** (`security_invoker`, sans quoi
elle laisse voir les chiffres d'un autre compte). C'est le **seul endroit où
Python et TypeScript partagent une implémentation** au lieu d'en entretenir deux
qui dérivent — deux appelants réels pour une couture. Les deux autres options
étaient un module TS qui réimplémente `build_matrix` (le défaut à trois moteurs
de [11](11-d-ou-viennent-les-conseils.md), plus une pagination obligatoire
puisque PostgREST tronque à 1 000 lignes en silence, §8) et une republication du
payload (mais 08 a tué le déclencheur client, et ce n'est pas « à la lecture »).
La base agrège et rend quelques lignes au lieu de milliers.

**2 · La vue ne couvre QUE les thèmes.** `formats`, `slots`, `campaigns` et
`coverage` de `build_matrix` n'alimentent que les constats « Ce qui fonctionne
pour toi » (`insights.py` l. 389-444) — des **Écrits**, qui attendent le Jour de
travail de toute façon. Les descendre en SQL, c'est un gros refactor pour zéro
fraîcheur gagnée.

**3 · Le seuil des 100 CHF descend dans la vue.** `theme_spend_min` sert quatre
fois dans `insights.py` : une pour autoriser le ROAS, trois pour décider si un
thème mérite un constat. La vue expose `spend`, `revenue`, **un `roas` déjà
filtré** et un drapeau **`juge`** ; `C_SEUILS["theme_spend_min"]` **disparaît de
Python**, et les trois filtres lisent `juge`. Un seuil est une règle de jugement :
il appartient au même endroit que le chiffre qu'il autorise. C'est ce qui rend la
vue profonde plutôt qu'une somme que chaque appelant doit savoir interpréter.

**4 · La vue est la seule source du revenu, et `revenuTheme()` est supprimée.**
Elle prenait *le plus grand* de `themes.rows[].rev` et `themes_focus[].summary.revenue`
— un pansement sur deux chemins qui ne se parlaient pas. Un repli qui prend le max
est un chemin capable d'afficher un revenu que la vue ne confirme pas, donc un
chiffre qu'on ne saurait pas expliquer (§7). **Si la vue ne répond pas, on
n'affiche pas de revenu et on le dit.** Un seul appelant à corriger :
`theme-card.tsx` l. 199.

### Les deux limites, et pourquoi elles tiennent

**Le `jugement` attend le Jour de travail — en entier, le nombre compris.**
C'est le seul champ de la carte où le chiffre et le texte sont **le même objet** :
`variation_pct` est un regroupement, mais `explication` est une phrase écrite et
`levier_impactant` **réordonne les conseils** (`build_report.py` l. 3539-3540).
Rafraîchir le nombre seul afficherait « +18 % » sous une phrase qui explique un
−4 %, et désynchroniserait la carte de ses propres conseils, qui attendent.

**Un Verdict déjà rendu ne se recalcule pas.** Il jugeait une action sur le
périmètre qui existait quand elle a été prise ; le rejuger sur un périmètre
élargi attribuerait un mouvement de chiffres à un travail qui ne l'a pas produit
(§7, et le motif pour lequel [22](22-rebrancher-le-plan-de-theme.md) a supprimé
l'entrée automatique au carnet). La règle de David ne la contredit pas : un
Verdict n'est pas une donnée qu'on *remontre*, c'est une mesure qu'on a *prise*.

### Les faits établis en chemin

- **`ga4_insights` porte bien `campaign`** (migration l. 419, contrainte
  `ga4_insights_uq2`). Le revenu par thème est donc regroupable en base, jour par
  jour — rien à récolter de plus.
- **`/` ne lit pas aujourd'hui ce que la règle exige** : `report.ts` l. 561-610
  prend un mois de GA4, 300 posts, et **3 000 lignes d'annonces sans pagination**,
  sans les colonnes de campagne ni les étiquettes. La vue rend ce problème sans
  objet — elle agrège côté base.
- **Le précédent de 13 ne se transportait pas gratuitement.** `lblAgg` →
  `byLabel` (`channels.ts` l. 650-659) marche parce que les pages canal sont
  **fenêtrées** et ne portent que dépense/clics/impressions. Le bilan d'un thème
  est sur tout l'historique et porte revenu GA4, posts, portée et engagement.

### Ce que la construction devra porter

Trois défauts de rafraîchissement, à corriger avec — ce ne sont pas des
décisions :

- `setCampaignLabel` ne rafraîchit pas `/couts` (les coûts **par thème**) ;
- `setPostLabel` ne rafraîchit pas `/` (le rapport regroupe aussi les posts) ;
- le `revalidatePath("/")` de `setCampaignLabel` est un **no-op documenté comme
  s'il marchait** — il redevient utile le jour où les blocs par thème viennent de
  la vue et non du payload.

`CONTEXT.md` gagne **Mesure prise**, le contraire de **Regroupement** : ce qu'on
saurait recalculer et qu'on ne recalcule pas.
