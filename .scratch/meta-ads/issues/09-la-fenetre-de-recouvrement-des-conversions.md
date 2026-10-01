# La fenêtre de recouvrement, et les 21 jours de conversions qu'on ne verra jamais

Type: grilling
Status: open
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
