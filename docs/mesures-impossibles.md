# Ce qu'on ne saura jamais mesurer

Application directe de `CLAUDE.md` §7 (« aucun chiffre fabriqué »). Un écran qui
affiche une de ces valeurs ment, même si le nombre s'affiche proprement.

Chaque limite porte l'endroit du code qui la prouve. **Vérifiée le 2026-09-21
contre `main`** — une limite qu'on croit se re-vérifie avant d'être invoquée.

**Aucun numéro de ligne dans ce document, et c'est une règle.** La version
précédente citait `build_report.py` « l. 2536-2545 » sur un fichier qui en compte
2172 : la référence pointait dans le vide depuis le retrait des conseils, et le
document se disait vérifié. Un numéro de ligne se périme à chaque commit sans
prévenir personne ; un nom de fonction, de CTE ou de composant se périme
bruyamment, parce qu'un `git grep` le trouve ou ne le trouve pas.

## Une conversion ou un revenu sur un thème purement organique

Le pont entre Google Analytics et un thème passe par `utm_campaign`. Un post
Instagram n'a pas de campagne : il ne franchit jamais le pont. Ce n'est pas un
réglage manquant, c'est une mesure qui n'existe pas.

Le pont est construit trois fois, et les trois fois il ne part que des campagnes :

- **En base**, dans `theme_regroupement.sql` : la CTE `campagnes` ne lit que
  `meta_ads_insights` et `google_ads_insights`, et la CTE `noms` en dérive les
  seuls noms auxquels du revenu peut se rattacher. Un thème qui n'a que des posts
  n'a aucun nom, donc rien à rattacher.
- **Dans le rapport**, `build_report.py` : `_theme_series` n'accepte un événement
  Google Analytics que si `name2label[utm_campaign]` rend ce thème, et l'anneau
  des thèmes construit son `name_lbl` à partir de `meta_cfg` et `goog_cfg` — deux
  tables de configuration de **campagnes**.
- **À l'écran**, `theme-card.tsx` : les cases « Revenu » et « ROAS » ne sont
  poussées que sous `som.spend > 0`. Un thème sans dépense n'en affiche aucune.

### La garde qui existait, et qui est aujourd'hui du code mort

`build_report.py` porte encore `_theme_ga4`, qui ventilait les conversions et le
revenu Google Analytics campagne par campagne et posait `paid_conversions` et
`paid_revenue` à `None` quand rien ne se rattachait. **Cette fonction n'est plus
appelée nulle part** (`git grep _theme_ga4` ne rend que sa définition et un
commentaire de `conversions-themes.tsx`) : elle est restée sur place au retrait
des recommandations du 2026-09-21. C'est elle que la version précédente de ce
document citait comme preuve — citer du code mort comme garde vivante est
exactement le défaut que ce document existe pour empêcher.

**L'interdit tient quand même**, et pour les trois raisons ci-dessus, qui sont
toutes vivantes. Mais il tient par des chemins différents de celui qui était
écrit ici.

### Le zéro que la vue produit, et que personne n'affiche encore

À vérifier ce point, un fait neuf est sorti. Dans `theme_regroupement`, un thème
purement organique, **sur un compte où Google Analytics attribue par ailleurs du
revenu payant** (`ga4_present`), sort avec `revenue = 0.00` : `revenu_generique`
n'a pas de ligne pour lui, et le `coalesce(t.revenue_generique, 0)` du `SELECT`
final le transforme en zéro. Ce zéro traverse `matrice.py` intact et arrive dans
`summary.revenue` du payload.

Aujourd'hui **rien ne l'affiche** — `theme-card.tsx` ferme la porte sur
`spend > 0`, l'anneau sur `s > 0`. Mais ce zéro dit « ce thème n'a rien
rapporté » là où la vérité est « aucun pont n'existe pour le savoir », et la
carte `parcours-themes` a décidé que la page Thèmes lirait la vue **en direct**,
toutes colonnes comprises. Écrit plutôt que corrigé à la va-vite : le thème
est le ticket [18](../.scratch/parcours-themes/issues/18-le-zero-organique-de-la-vue.md).

## Le revenu d'un thème dont les UTM ne portent pas le nom de la campagne

Le rattachement se fait par correspondance de noms. Ce que le code en fait a
changé le 2026-09-13, et la règle actuelle a deux étages — les confondre est le
plus court chemin vers un chiffre fabriqué.

**Au compte, on se tait.** Quand Google Analytics n'attribue **aucune** campagne
payante à ce compte, `theme_regroupement` rend `revenue` à `NULL`, jamais `0` :
la CTE `ga4_present` commande le `CASE` du `SELECT` final, et aucun ROAS n'est
publié. **Un zéro mesuré et un zéro faute de données ne sont pas la même
chose**, et ils ne s'affichent pas pareil.

**Au thème, on publie et on écrit la limite.** Sur un compte qui attribue bien du
revenu, une campagne dont Google Analytics ignore le nom verse sa dépense au
dénominateur du ROAS sans jamais pouvoir verser son revenu au numérateur. Se
taire aurait vidé six thèmes sur dix de leur seul chiffre de rentabilité ; on
publie donc le ROAS, et la **part muette** l'accompagne — `spend_muette` et
`campagnes_muettes` dans la vue (CTE `noms_ga4_connus`, sans filtre `medium`),
`part_muette` calculée une seule fois dans `build_report.py`. Le ROAS n'est pas
faux, il est **incomplet**, et ça se lit à côté du chiffre.

## Plus de 30 jours de changements côté Google Ads

`change_event` est plafonné à 30 jours par Google, et une fenêtre plus large fait
rejeter la requête **entière** au lieu de la tronquer. `fetch_campaign_changes`
(`saas/collecte/google/fetch_google_ads.py`) ramène donc `since` à 30 jours en
arrière quoi qu'on lui demande.

## Quelle page d'arrivée perd les gens

Google Analytics est récolté par date × source/medium × campagne, **sans aucune
dimension de page** : ni `fetch_ga4_insights` ni `fetch_ga4_events`
(`saas/collecte/ga4/fetch_ga4.py`) ne demandent `landingPage` ou `pagePath`. On
peut donc constater qu'un écart existe entre les clics payés et les sessions
arrivées ; on **ne peut pas dire sur quelle page** il se creuse.

Ne pas confondre avec l'adresse vers laquelle une annonce Meta envoie, lue
dans sa créa (`object_story_spec.link_data.link`, carte `.scratch/meta-ads/`,
ticket 14 — elle remplace l'adresse qu'on saisissait à la main par campagne,
retirée le 2026-10-03). Elle dit où l'annonce envoie ; elle ne dit rien de ce
qui s'y passe.

Ce n'est pas une impossibilité de principe — une dimension de page à la récolte
la lèverait. **Aucun ticket ne la porte aujourd'hui** : celui qui le faisait
(`refonte/23`) est parti avec le moteur de conseils, encore ouvert, et il
demandait cette donnée pour des conseils qui n'existent plus. La rouvrir est une
décision produit à prendre, pas un travail en attente.

## Si le client a LU son email hebdo

On sait ce que le fournisseur a remonté sur l'enveloppe — parti, arrivé, rebondi,
ouvert, cliqué (`email_envois`, relevé au passage suivant du worker par
`saas/emailing/evenements.py`). **On ne sait pas s'il a lu.**

Une ouverture est un **pixel chargé**. Il est bloqué par défaut chez Gmail (qui
passe les images par son proxy), chez Outlook et sur la plupart des clients
mobiles : l'email est lu, rien ne remonte. À l'inverse, un volet de
prévisualisation ou un préchargement remonte une ouverture que personne n'a
voulue. La mesure est donc fausse **dans les deux sens**, et elle l'est
d'autant plus que tant que Pulse envoie depuis `onboarding@resend.dev`
(le repli de `send.py`, faute de domaine vérifié), le suivi d'ouverture de
Resend — désactivé par défaut, et conditionné à un domaine vérifié avec
sous-domaine de suivi — **ne remonte rien du tout**. Ce silence-là ressemble
trait pour trait à celui d'un client qui n'ouvre pas.

**Ce qu'on a donc le droit d'en conclure**, et rien de plus — la table ci-dessous
est le dictionnaire `_EVENEMENTS` de `evenements.py`, lu dans l'autre sens :

| Ce qui remonte | Ce que ça prouve |
|---|---|
| `clicked` | un lien a été **suivi** — un geste, pas un pixel |
| `complained` | il l'a marqué **indésirable** : donc arrivé, et regardé par un humain. Le fait le plus fort du lot, et le plus contre-intuitif |
| `opened` | une image a été chargée dans ce message. Pas qu'il a été lu |
| `bounced` · `failed` · `suppressed` | l'email **n'est pas arrivé**. C'est l'adresse qu'il faut regarder, pas l'attention |
| `delivery_delayed` · `scheduled` | l'envoi est **encore en cours**. Ni arrivé, ni pas arrivé |
| `delivered` · `sent` · `received` | **rien** sur la lecture. Ni lu, ni pas lu |
| rien, ou un nom inconnu | **rien**, et pas même que le suivi fonctionne |

Une **non-ouverture ne prouve rien**, et le code n'a nulle part la valeur « pas
ouvert » : il dit `sans_reponse` (« le fournisseur n'a rien remonté »),
`en_route` (« l'envoi n'est pas terminé ») ou `inconnu` (« rien d'exploitable
n'est remonté »). Et un silence n'est pas une réponse **définitive** : seuls
`clique`, `ouvert`, `signale_spam` et `pas_arrive` sont dans `ETATS_DEFINITIFS`,
tout le reste se redemande au passage suivant, parce que la plupart des
ouvertures arrivent après le premier jour. Un taux d'ouverture affiché au client
serait un chiffre fabriqué doublé d'un reproche — décidé à
[`docs/adr/0007`](adr/0007-l-ouverture-d-un-email-se-mesure-pour-david-jamais-pour-le-client.md).

---

## Ce qui n'est PAS impossible, mais pas décidé

**Le revenu, semaine par semaine — au compte, c'est fait.** Ce document a porté
cette limite jusqu'au 2026-09-11, et **elle était fausse**. Elle disait que
Google Analytics rend le revenu « par campagne, sans dates ». `ga4_insights`
porte `date`, `source`, `medium` **et** `campaign` (le `CREATE TABLE` de
`000_run_me_all.sql` §2, puis l'`ALTER TABLE` « GA4 v2 » qui ajoute `campaign` et
refait la contrainte unique en `ga4_insights_uq2`), et `fetch_ga4_insights` fait
`select("*")` : la date est là, à chaque ligne. Ce qui l'écrasait, c'était
`build_ga4_context` (`saas/collecte/ga4/ga4.py`), qui agrège sur la fenêtre.

Aujourd'hui `build_report.py` ne passe plus par lui pour ça : `_revenu_semaine`
lit `lecteur.ga4_insights()` jour par jour et rend le revenu payant d'une
semaine. C'est ce qui alimente la courbe ROAS de la boussole.

**Par thème, la ventilation hebdomadaire n'est toujours pas calculée** — la carte
de thème reçoit un revenu unique, sur tout l'historique, qui vient de la vue. Ce
n'est pas une mesure absente : `ga4_insights` a la date et le nom de campagne,
et `name2label` sait faire le reste. C'est une agrégation à écrire, et personne
ne l'a demandée. Leçon à garder : une limite qui nomme le symptôme
(`by_campaign` n'a pas de dates) au lieu de la source (la table en a) se périme
sans qu'on s'en aperçoive.

**Séparer le ROAS Meta du ROAS Google.** Le rapport calcule aujourd'hui un ROAS
payant unique : `_f_roas` (`build_report.py`) divise le revenu de
`_revenu_semaine` — tout le trafic payant, les deux régies confondues — par la
dépense de `_pub_semaine`, qui additionne Meta et Google. `ga4_insights` porte
pourtant `source`, `medium` et `campaign` : une séparation serait techniquement
possible. Elle exige de **choisir une règle d'attribution** — ce qui est une
décision produit, pas une donnée manquante. Tant qu'elle n'est pas prise, un
ROAS par canal **affiché à l'écran** — une tuile, une courbe, un KPI posé comme
une vérité — serait une invention.

**L'EXCEPTION QUI EXISTAIT ICI A DISPARU AVEC LES CONSEILS.** Jusqu'au
2026-09-21, un paragraphe autorisait une règle — `theme_deux_regies` — à dire
« ce thème rend mieux sur une régie que sur l'autre », sous des gardes dures et
en nommant le biais du dernier clic. Le raisonnement de David tenait en une
phrase : *un conseil a le droit de dire ce qu'un tableau de bord n'a pas le
droit d'afficher*, parce qu'un conseil porte son angle mort avec lui alors
qu'un KPI arrive nu.

Le moteur de conseils a été retiré du produit. **Il ne reste donc que des
écrans, et la règle ci-dessus vaut sans exception : le ROAS par canal ne
s'affiche pas.** Si un conseil revient un jour, c'est ce paragraphe qu'il
faudra rouvrir — le raisonnement reste valable, il n'a simplement plus d'objet.

**Et la décision d'attribution elle-même reste entière — sans ticket pour la
porter.** Le ticket `construction/18`, que ce document désignait, a été
**résolu** le 2026-09-13, mais sur une autre question : il a tranché qu'on
publie le ROAS d'un thème en écrivant la part muette à côté. Quelle régie a
généré un franc de revenu attribué à un nom d'UTM n'a été tranché nulle part.
Rien ne change à la façon dont la dépense est comptée ailleurs — page Coûts,
`build_matrix`, ROAS affiché d'un thème.
