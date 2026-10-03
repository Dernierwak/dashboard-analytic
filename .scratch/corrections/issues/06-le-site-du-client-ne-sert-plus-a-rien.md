# Le site du client ne sert plus à rien

Type: grilling
Status: open
Blocked by: —
Venu de : la carte `.scratch/meta-ads/`, ticket 14 (« La page d'arrivée d'une
campagne n'a plus d'écran »), le 2026-10-03.

## Question

`profiles.site_url` se saisit sur `/comptes` (`components/site-client.tsx`,
action `saveSiteClient` dans `saas/web/app/actions.ts`, migration
`site_client.sql`, section 18 du `000`). Sa seule raison d'exister, écrite
dans ses commentaires, était les conseils : « c'est ce qui sépare un conseil
générique d'un conseil qui parle de ce que la personne vend ». Pulse ne
conseille plus rien depuis le 2026-09-21.

Mesuré le 2026-10-03 : `git grep site_url` ne trouve **aucune lecture** hors de
`/comptes`, qui la relit pour la réafficher. Ni le traitement, ni l'email, ni
un dashboard. On demande donc au client une information dont on ne fait rien.

Sa jumelle, la page d'arrivée saisie par campagne (`landing_url`), est partie
au ticket 14 pour la même raison (David : « on n'en a plus du tout besoin »).

À trancher avec David : le site du client part-il aussi (composant, action,
colonne — un `DROP COLUMN`, donc une migration à valider), ou a-t-il un usage
dans un produit qui constate ? S'il part, `urlPropre` n'a plus aucun
appelant : elle part avec.
