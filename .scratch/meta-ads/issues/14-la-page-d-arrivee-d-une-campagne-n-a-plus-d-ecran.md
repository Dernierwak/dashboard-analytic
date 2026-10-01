# La page d'arrivée d'une campagne n'a plus d'écran

Type: grilling
Status: open
Blocked by: —

## Question

Trouvé en chemin par « Le thème et le label quittent l'écran et le code ».

`setCampaignLanding` (`saas/web/app/actions.ts`) écrit `landing_url` dans
`meta_campaign_config` / `google_campaign_config`. Son seul appelant vivait sur
`/labels`, parti avec le thème : l'action est gardée — ce n'est pas du thème —
mais **plus aucun écran ne permet de saisir l'URL d'arrivée d'une campagne.**

Son commentaire dit à quoi elle devait servir : « comprendre ce que la campagne
VEND », pour des conseils. Pulse ne conseille plus rien (2026-09-21).

À trancher avec David : la page d'arrivée a-t-elle encore un usage dans un
produit qui constate (par exemple, un lien sortant dans le tableau des
campagnes du dashboard Meta) ? Si oui, où se saisit-elle ; si non, l'action et
la colonne partent au `BACKLOG.md` avec le reste.
