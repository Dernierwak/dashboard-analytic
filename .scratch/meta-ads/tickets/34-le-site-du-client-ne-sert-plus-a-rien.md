# Le site du client ne sert plus à rien

Type: grilling
Status: resolved
Blocked by: —
Venu de : la carte `.scratch/meta-ads/`, ticket 14 (« La page d'arrivée d'une
campagne n'a plus d'écran »), le 2026-10-03.
Rangé dans `meta-ads/tickets/` le 2026-10-05 (depuis `.scratch/corrections/`, supprimé).

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

## Answer

Tranché par David le 2026-10-05 (« on fait et on close ») : le site du client
part.

Retirés : `components/site-client.tsx` ; sa section et sa lecture dans
`app/comptes/page.tsx` ; `saveSiteClient`, `supabaseUpdateSite` et
`urlPropre` (plus aucun appelant) dans `app/actions.ts` ; **l'étape « Ton
site » de l'onboarding** (`components/onboarding-card.tsx`) — ce que le
ticket n'avait pas vu : l'onboarding est le second écrivain de `site_url`.
L'onboarding passe à 5 étapes et la dernière réponse enregistre le profil.

`git grep` hors `.scratch/` : plus aucune mention de `site_url` dans
`saas/web/`. Vérifié : `npx tsc --noEmit` et `npm run build` verts, 18
routes. La recette de l'onboarding se fait en cliquant, sur un compte neuf.

**La colonne** : `DROP COLUMN` validé par David le 2026-10-05 (« oui écris la
migration »). `supabase/migrations/996_supprimer_le_site_du_client.sql` la
détruit, avec son CHECK, en transaction et sans `CASCADE` ; il porte sa
requête de contrôle. La section 18 du `000` est retirée (sinon il la ferait
renaître), sa ligne dans la liste de contrôle finale aussi, et
`site_client.sql` est supprimé.

**Reste à faire par David** (`ready-for-human`) : jouer la `996` une fois,
dans le SQL editor de Supabase, **après** le déploiement de `main` sur Vercel
— avant, la page `/comptes` en ligne lit encore la colonne. Puis la requête de
contrôle en bas du fichier : deux « ✓ ».
