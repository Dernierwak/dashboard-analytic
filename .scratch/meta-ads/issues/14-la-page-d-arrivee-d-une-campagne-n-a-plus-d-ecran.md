# La page d'arrivée d'une campagne n'a plus d'écran

Type: grilling
Status: resolved
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

## Answer

**La saisie à la main part, entièrement ; l'adresse vient de l'API Meta,
annonce par annonce.** Tranché par David le 2026-10-03 : « on supprime ça et
puis on prend simplement la landing page qui est dans l'API », puis « on n'en a
plus du tout besoin […] on supprime pour vraiment avoir quelque chose de
clean ».

Pourquoi, mesuré avant de poser la question :
- `landing_url` n'était **lue nulle part** — ni traitement, ni email, ni page.
  Seule l'action orpheline l'écrivait.
- **Meta la donne déjà.** La récolte des créas décidée au ticket 04 lit
  `object_story_spec.link_data` ; l'adresse de destination y est. Aucune
  saisie, aucun appel de plus.
- **Le niveau campagne était faux.** Deux annonces d'une campagne peuvent
  envoyer vers deux pages : une adresse unique déclarée pour la campagne pouvait
  mentir sans que rien ne le signale.

**Pour la spec du dashboard :** le panneau latéral (ticket 06) montre, à côté
du texte d'une annonce, un lien sortant « l'annonce envoie vers… », lu dans sa
créa. Le champ exact dépend du montage, comme le texte : `link_data.link` pour
une annonce à lien simple, `call_to_action.value.link` (dont `video_data`), et
`asset_feed_spec.link_urls` pour le multi-assets. **Non vérifié sur un appel
réel** — même réserve que le reste des créas (ticket 04, « l'expansion de
champs sur `creative` n'est vérifiable qu'avec un jeton ») : le premier appel
réel le confirme. Pas d'adresse dans la créa → le lien n'apparaît pas ; on n'en
fabrique pas.

### Ce qui a été fait (David : « tu peux complètement supprimer »)

- `saas/web/app/actions.ts` : `setCampaignLanding` retirée. `urlPropre` reste
  — elle valide aussi `saveSiteClient` — et son commentaire ne parle plus de la
  page d'arrivée.
- `supabase/migrations/campagne_landing.sql` supprimé, comme les fichiers du
  thème au ticket 01.
- `000_run_me_all.sql` : la section 17 et ses deux lignes de contrôle partent ;
  l'en-tête dit pourquoi, pour qu'elle ne renaisse pas.
- **`998_supprimer_le_theme.sql` détruit aussi la colonne** (choix (a) : dans la
  `998`, pas une migration à part — elle n'est pas encore jouée, et c'est un
  reste de `/labels`). Ses deux CHECK nommés, ses deux lignes au contrôle. **Les
  adresses déjà tapées sont perdues**, sans archive, même règle que le thème.
- `site_client.sql`, `docs/mesures-impossibles.md` : les renvois à
  `campagne_landing.sql` réécrits.
- `BACKLOG.md` : l'idée et pourquoi elle part.

### Vérifié

- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et
  `npm run build` verts, **19 routes** (18 + `/meta/prototype-modules`).
- PostgreSQL 15 jetable (Postgres.app, stub de `auth` et des quatre tables
  posées à la main) : ancien `000` → une campagne Meta et une Google avec
  `landing_url`, budget et dates → `998` : **exit 0, 22 lignes ✓**, dont les deux
  `landing_url` ; les deux campagnes **intactes** ; aucune contrainte
  `*landing*` restante. Nouveau `000` deux fois sur cette base puis deux fois sur
  une base vierge : exit 0, `landing_url` ne renaît pas. Seul ✗ du contrôle :
  RLS éteinte sur `connected_accounts`, qui vient du stub (aucune politique
  posée, le `000` refuse alors d'activer la RLS — comportement voulu).
- `git grep` : plus aucune lecture ni écriture de `landing_url` ; il ne reste
  que la `998` qui la détruit et les commentaires qui disent pourquoi.

**Reste à faire par David :** rien de neuf — la `998` se joue toujours une fois,
à la main, sur Supabase, après déploiement de `main` et un passage du worker.
Elle emporte désormais `landing_url` avec le thème ; la relire avant.

### Trouvé en chemin

`profiles.site_url` (le site du client, saisi sur `/comptes`) est dans la même
situation : il n'est relu que pour être réaffiché sur `/comptes`, et sa seule
raison d'être écrite était les conseils. Pas tranché ici — il a encore un
écran et ce n'est pas la question posée. Rangé en
[`.scratch/corrections/issues/06-le-site-du-client-ne-sert-plus-a-rien.md`](../../corrections/issues/06-le-site-du-client-ne-sert-plus-a-rien.md).

**2026-10-03 — le code de ce ticket est perdu, la décision non.** Le dossier
de travail a été supprimé avant le commit. Tickets, réponse, `BACKLOG.md` et
`docs/mesures-impossibles.md` ont été rétablis depuis le journal de la
session ; les cinq changements de code ci-dessus (`actions.ts`,
`campagne_landing.sql`, `000`, `998`, `site_client.sql`) **ne le sont pas** et
sont à refaire, puis à revérifier. Le ticket repasse à `claimed` d'ici là.

**2026-10-03 — code refait, sur demande de David.** Les cinq changements sont
rejoués depuis le journal de la session d'origine, à l'identique. Revérifié :
`npx tsc --noEmit` et `npm run build` verts, 19 routes ; même scénario
PostgreSQL 15 jetable — `998` exit 0, 22 lignes ✓ dont les deux `landing_url`,
campagnes intactes, aucune contrainte `*landing*` restante, nouveau `000`
deux fois sur base ancienne et vierge sans que `landing_url` renaisse ; seul ✗
la RLS de `connected_accounts`, qui vient du stub.
