# Ce qu'on ne saura jamais mesurer

Application directe de `CLAUDE.md` §7 (« aucun chiffre fabriqué »). Un écran qui
affiche une de ces valeurs ment, même si le nombre s'affiche proprement.

Chaque limite porte l'endroit du code qui la prouve. **Vérifiée le 2026-09-08
contre `main`** — une limite qu'on croit se re-vérifie avant d'être invoquée.

## Une conversion ou un revenu sur un thème purement organique

Le pont entre GA4 et un thème passe par `utm_campaign`. Un post Instagram n'a
pas de campagne : il ne franchit jamais le pont. Ce n'est pas un réglage
manquant, c'est une mesure qui n'existe pas — l'écran le dit, il n'affiche pas
un zéro (`build_report.py` l. 2536-2545).

## Le revenu d'un thème dont les UTM ne portent pas le nom de la campagne

Le rattachement se fait par correspondance de noms. Quand rien ne correspond, la
valeur est `None`, pas `0` — et on se tait (`build_report.py` l. 2529-2533).
**Un zéro mesuré et un zéro faute de données ne sont pas la même chose**, et ils
ne s'affichent pas pareil.

## Plus de 30 jours de changements côté Google Ads

`change_event` est plafonné à 30 jours par Google, et une fenêtre plus large
fait rejeter la requête **entière** au lieu de la tronquer
(`saas/collecte/google/fetch_google_ads.py`).

## Quelle page d'arrivée perd les gens

GA4 est récolté par date × source/medium × campagne, **sans aucune dimension de
page** (`saas/collecte/ga4/fetch_ga4.py`). `page_arrivee_muette` sait dire que
640 clics payés n'ont produit que 180 visites ; elle **ne peut pas dire sur
quelle page** ça se perd, et elle l'écrit dans son angle mort. Ce n'est pas une
impossibilité de principe — le ticket
[23](../.scratch/refonte/issues/23-recolte-des-quatre-manques.md) porte cette
récolte — c'est une impossibilité **tant que 23 n'est pas pris**, et David l'a
reporté (*« j'attendrais, on a déjà énormément »*).

## Si le client a LU son email hebdo

On sait ce que le fournisseur a remonté sur l'enveloppe — parti, arrivé, rebondi,
ouvert, cliqué (`email_envois`, relevé au passage suivant du worker par
`saas/emailing/evenements.py`). **On ne sait pas s'il a lu.**

Une ouverture est un **pixel chargé**. Il est bloqué par défaut chez Gmail (qui
passe les images par son proxy), chez Outlook et sur la plupart des clients
mobiles : l'email est lu, rien ne remonte. À l'inverse, un volet de
prévisualisation ou un préchargement remonte une ouverture que personne n'a
voulue. La mesure est donc fausse **dans les deux sens**, et elle l'est
d'autant plus que tant que Pulse envoie depuis `onboarding@resend.dev`, le suivi
d'ouverture de Resend — désactivé par défaut, et conditionné à un domaine
vérifié avec sous-domaine de suivi — **ne remonte rien du tout**. Ce
silence-là ressemble trait pour trait à celui d'un client qui n'ouvre pas.

**Ce qu'on a donc le droit d'en conclure**, et rien de plus :

| Ce qui remonte | Ce que ça prouve |
|---|---|
| `clicked` | un lien a été **suivi** — un geste, pas un pixel |
| `complained` | il l'a marqué **indésirable** : donc arrivé, et regardé par un humain. Le fait le plus fort du lot, et le plus contre-intuitif |
| `opened` | une image a été chargée dans ce message. Pas qu'il a été lu |
| `bounced` · `failed` · `suppressed` | l'email **n'est pas arrivé**. C'est l'adresse qu'il faut regarder, pas l'attention |
| `delivery_delayed` · `scheduled` | l'envoi est **encore en cours**. Ni arrivé, ni pas arrivé |
| `delivered` · `sent` | **rien** sur la lecture. Ni lu, ni pas lu |
| rien, ou un nom inconnu | **rien**, et pas même que le suivi fonctionne |

Une **non-ouverture ne prouve rien**, et le code n'a nulle part la valeur « pas
ouvert » : il dit `sans_reponse` (« le fournisseur n'a rien remonté »),
`en_route` (« l'envoi n'est pas terminé ») ou `inconnu` (« rien d'exploitable
n'est remonté »). Et un silence n'est pas une réponse **définitive** : il se
redemande au passage suivant, parce que la plupart des ouvertures arrivent
après le premier jour. Un taux d'ouverture affiché au client
serait un chiffre fabriqué doublé d'un reproche — décidé à
[`docs/adr/0007`](adr/0007-l-ouverture-d-un-email-se-mesure-pour-david-jamais-pour-le-client.md).

---

## Ce qui n'est PAS impossible, mais pas décidé

**Le revenu d'un thème, semaine par semaine.** Ce document a porté cette limite
jusqu'au 2026-09-11, et **elle était fausse**. Elle disait que GA4 rend le revenu
« par campagne, sans dates ». La table `ga4_insights` porte `date`, `source`,
`medium` **et** `campaign` (`000_run_me_all.sql` l. 341 et l. 381, contrainte
unique incluant la campagne), et `fetch_ga4_insights` fait `select("*")` : la
date est là, à chaque ligne. C'est `build_ga4_context`
(`saas/collecte/ga4/ga4.py` l. 291-306) qui l'écrase en agrégeant sur la
fenêtre. La ventilation par semaine n'est donc pas une mesure absente, c'est une
**agrégation à changer** — décidé au ticket
[24](../.scratch/refonte/issues/24-conseils-payants-manquants.md). Leçon : une
limite qui nomme le symptôme (`by_campaign` n'a pas de dates) au lieu de la
source (la table en a) se périme sans qu'on s'en aperçoive.

**Séparer le ROAS Meta du ROAS Google.** Le rapport calcule aujourd'hui un ROAS
payant unique (revenu GA4 ÷ dépense Meta + Google, `build_report.py` l. 1783).
`ga4_insights` porte pourtant `source`, `medium` et `campaign` : une séparation
serait techniquement possible. Elle exige de **choisir une règle
d'attribution** — ce qui est une décision produit, pas une donnée manquante.
Tant qu'elle n'est pas prise, un ROAS par canal **affiché à l'écran** — une
tuile, une courbe, un KPI posé comme une vérité — serait une invention.

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

**Et la décision d'attribution elle-même reste entière.** Elle n'est pas prise
ici et ne se tranche pas dans le code : c'est la question du ticket
[18](../.scratch/construction/issues/18-revenu-google-non-rattachable.md). Rien
ne change à la façon dont la dépense est comptée ailleurs — page Coûts,
`build_matrix`, ROAS affiché d'un thème.
