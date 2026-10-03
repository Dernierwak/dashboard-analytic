# La fenêtre de recouvrement, et les 21 jours de conversions qu'on ne verra jamais

Type: grilling
Status: resolved
Blocked by: —

## Question

Découvert par le ticket 04, documentation Meta à l'appui — ce n'est pas une
hypothèse.

**Les faits.** Une conversion peut être attribuée à une date **déjà récoltée**, et
Meta continue de réviser ses chiffres **jusqu'à 28 jours** (« Insights refresh every
15 minutes and do not change after 28 days of being reported »). Or la récolte Pulse
ne réécrit que les **7 derniers jours** (`_RECOUVREMENT_JOURS_META = 7`).

**La conséquence.** Il reste un **trou de 21 jours**. Toute conversion qui remonte
entre J+8 et J+28 n'entrera jamais dans la base. Le dashboard afficherait donc des
conversions systématiquement sous-comptées, sans jamais le dire — ce qui est un
chiffre faux au sens de `CLAUDE.md` §7, pas une approximation acceptable.

**Ce qu'il faut décider**
1. **Passer le recouvrement à 28 jours ?** Coût mesuré par le ticket 04 : **un appel
   Graph de plus par passage** (560 lignes dépassent la limite de 500 par page).
   C'est presque rien. Pourquoi ne pas le faire — y a-t-il une raison que je ne vois
   pas ?
2. **Que dit l'écran pendant ce temps ?** Même à 28 jours, les 28 derniers jours de
   conversions sont **provisoires par construction**. Un dashboard qui les affiche
   comme définitifs mentirait à sa façon. Faut-il marquer la période encore
   révisable, et comment sans alourdir l'écran ?
3. **La règle « toute comparaison exclut le jour en cours »** (`CLAUDE.md` §7) a été
   écrite pour la journée incomplète du fetch. Les conversions rendent la règle
   insuffisante : ce n'est plus un jour qui est incomplet, c'est un mois. La règle
   doit-elle être élargie pour les conversions, et dans quels termes ?
4. **La fenêtre d'attribution est désormais réglée sur l'ad set**, pas globalement,
   et depuis le 10 juin 2025 `action_report_time` est ignoré (tout est en `mixed`).
   Pulse doit-il lire `attribution_setting` et l'afficher ? Deux ad sets du même
   compte peuvent compter différemment.

**Ce qui n'est pas établi et qu'il ne faut pas deviner** : la doc ne dit pas quelle
**part** des conversions arrive après J+7. Le trou est certain, son ampleur ne l'est
pas. Si la décision en dépend, il faut une mesure réelle, pas une estimation.

## Answer

Résolu le 2026-10-03, avec David.

**La prémisse était à moitié fausse, et ça change le diagnostic.** Depuis le
10 juin 2025 (`action_report_time=mixed`, recherche 04) : une action **on-Meta**
(clic, engagement, prospect Meta) se pose sur la date de l'**impression**, donc
au plus la fenêtre d'attribution de l'ensemble en arrière (7 j par défaut) ; une
action **off-Meta** (achat pixel) se pose sur la date de la **conversion**, donc
sur une date récente. Ce qui reste entre J+8 et J+28, ce ne sont pas des
conversions « en retard » : ce sont les **corrections que Meta fait après
coup**, d'ampleur non documentée. Le commentaire de `fetch_all.py:160-166`
(« rattachent une conversion au jour du CLIC ») est périmé.

**David : « je veux vraiment que ce soit un truc comme Meta ».** Pulse ne
calcule rien sur les conversions : il recopie. Le seul écart possible avec
Ads Manager est d'avoir **arrêté de recopier trop tôt** — avec un passage
hebdomadaire et 7 jours de recouvrement, un jour est relu pour la dernière fois
à 8-14 jours, puis figé alors que Meta peut encore le corriger.

1. **Le recouvrement Meta passe à 28 jours** (`_RECOUVREMENT_JOURS_META = 28`).
   Chaque passage retélécharge ~35 jours et remplace (upsert, déjà en place).
   Un jour de plus de 28 jours est alors **identique à Ads Manager pour
   toujours** ; un jour plus jeune est identique à **ce que Meta affichait au
   dernier passage**. Coût : un appel Graph de plus par passage (560 lignes,
   2 pages de 500). Le commentaire « LE RECOUVREMENT » est réécrit avec la
   raison réelle : les corrections jusqu'à 28 j (« do not change after 28 days
   of being reported »), plus `mixed`.
2. **Le dashboard écrit de quand datent ses chiffres** : « Chiffres Meta au
   <Jour de travail>, 07:00 » (formulation exacte à la construction). C'est la
   règle de la Fenêtre appliquée au moment de la lecture : un écart avec Ads
   Manager consulté plus tard s'explique tout seul.
3. **Aucune zone « provisoire » marquée**, et **la règle « on exclut le jour en
   cours » n'est pas élargie.** Les deux deviennent inutiles : le chiffre affiché
   est celui de Meta à la date écrite, pas une estimation de Pulse. Marquer les
   28 derniers jours aurait marqué presque tout ce qu'on regarde.
4. **`attribution_setting` est stocké** (colonne déjà proposée au ticket 07) et
   **dit dans l'info-bulle « ⓘ »** des conversions (« Comptées selon : 7 j après
   clic, 1 j après vue »). Quand la sélection mélange des réglages différents,
   on l'écrit à l'endroit du chiffre — Ads Manager prévient lui-même que la
   comparaison « will lead to inaccurate conclusions ». *Recommandation non
   discutée en détail : David a validé l'ensemble (« ça me semble parfait,
   suis ça »).*

**Écartées.** Interroger Meta en direct à chaque filtre (écart nul, mais une
autre architecture — l'app ne déclenche rien aujourd'hui —, latence, dashboard
vide si Meta tombe, appels faits avec les accès du propriétaire pour un invité,
deux sources pour un même chiffre). Retirer les conversions (inutile : le
problème a une solution simple).

**À la construction** : le changement ne se voit qu'après un passage du worker —
le cron du Jour de travail, ou un lancement à la main de `weekly-fetch.yml`
(`force`) pour réécrire tout de suite les 28 derniers jours.
