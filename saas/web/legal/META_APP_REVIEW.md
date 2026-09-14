# Dossier d'App Review Meta

Le pendant de [`GOOGLE_VERIFICATION.md`](GOOGLE_VERIFICATION.md), côté Meta.
Écrit le 2026-09-11 ; il n'existait pas, et la case « Meta : passer l'app en
Live » de [18](../../../.scratch/refonte/issues/18-passer-en-production.md)
n'avait rien derrière elle.

Même méthode que le dossier Google : **chaque justification est vérifiée contre
le code**, avec le fichier et la ligne. Une justification qu'un reviewer peut
contredire en ouvrant le produit coûte un cycle entier.

Les cinq permissions demandées sont déclarées dans
`saas/web/app/api/oauth/meta/start/route.ts` l. 17-23.

---

## 1 · Ce que Pulse fait de chaque permission

### `ads_management`

**Ce que Pulse appelle** — quatre lectures, aucune écriture :

| Appel | Où |
|---|---|
| `/act_<id>/insights` (`level=ad`, `time_increment=1`) — dépense, impressions, clics, portée, actions, par jour et par annonce | `saas/collecte/automatisation/fetch_all.py` l. 296-305 |
| `/<ad_account_id>/campaigns` | `saas/collecte/meta/fetch_meta_ads.py` l. 91 |
| `/<campaign_id>/adsets` | `fetch_meta_ads.py` l. 63 |
| `/<ad_account_id>/activities` — l'historique des changements, pour légender une variation | `fetch_meta_ads.py` l. 280 |

**Justification, prête à coller :**

> Pulse reads the advertiser's own Meta Ads performance — daily spend,
> impressions, clicks, reach and conversion actions, at the ad level — and shows
> it back to them in a dashboard and a weekly report. We also read campaign and
> ad set names so the numbers can be grouped the way the advertiser organizes
> their own account, and the ad account's change history so a change in the
> numbers can be labeled with what happened. Pulse never creates, edits, pauses
> or deletes anything on a Meta Ads account: there is no write call to the Graph
> API anywhere in our codebase.

**⚠ Le point que le reviewer soulèvera, et il aura raison.** `ads_management`
autorise de **créer** des campagnes et de **gérer** des annonces par programme.
Pulse ne fait que lire. La permission de lecture existe et s'appelle
**`ads_read`** ; sa page de référence décrit son usage autorisé comme l'accès aux
données de performance publicitaire *« for use in personalized dashboards and
data analytics »* — mot pour mot ce que Pulse fait
([developers.facebook.com/docs/permissions/reference/ads_read](https://developers.facebook.com/docs/permissions/reference/ads_read),
consulté le 2026-09-11 ; **la page se sert en allemand depuis la Suisse**, les
formulations exactes sont à relire en anglais dans la console au moment du
dépôt). Demander plus que ce qu'on utilise est le motif de refus le plus courant
d'une App Review.

**Ce qu'on ne sait pas, et qu'on ne devinera pas** : la référence de `ads_read`
nomme l'Ads Insights API ; elle **ne dit pas** si `/campaigns`, `/adsets` et
`/activities` en relèvent aussi, et la page de référence de `/activities` ne
porte aucune section de permissions. La seule réponse fiable est un test — et il
est gratuit : sur **ses propres** comptes publicitaires, une app n'a pas besoin
d'App Review — celle-ci n'est exigée que pour accéder à des données qu'on ne
possède ni ne gère. Donc : basculer le scope sur
`ads_read` dans une app de test, rejouer les quatre appels, et voir lesquels
tombent. **C'est une décision à prendre avant de déposer, pas après.**

Son coût, dit franchement : changer les permissions oblige **tous les comptes
déjà connectés à re-consentir** (c'est ce que dit le commentaire de
`route.ts` l. 7-10), et Meta ne délivre les nouvelles qu'au terme de la revue.
Aujourd'hui ce coût est faible — un seul compte est branché. Il grandira à
chaque client.

### `pages_show_list`

**Ce que Pulse appelle** : `me/accounts?fields=id,name`
(`saas/web/lib/oauth-api.ts` l. 26) — la liste des Pages, pour que la personne
choisisse laquelle porte son compte Instagram.

> Pulse asks the user to pick which Facebook Page their Instagram Business
> account belongs to. We read only the id and the name of the Pages they
> administer, to display that choice. We do not read Page content, messages or
> followers through this permission.

### `business_management`

**Ce que Pulse appelle** : `me/businesses?fields=id,name`, puis `owned_pages` et
`client_pages` de chaque entreprise (`oauth-api.ts` l. 35-45). **Uniquement en
repli**, quand `me/accounts` revient vide.

> Pulse requests this permission for one narrow reason: when an advertiser's
> Pages are owned by a Business Manager rather than by the person, `me/accounts`
> returns an empty list, and the user is told they have no Page when they
> actually have several. We then list their businesses and the Pages those
> businesses own, by id and name only, so the same choice can be shown. This
> path runs only when the first one returns nothing.

### `instagram_basic`

**Ce que Pulse appelle** :
`?fields=instagram_business_account{id,username}` sur la Page choisie
(`oauth-api.ts` l. 79) ; `/<ig_id>/media?fields=id,timestamp`
(`saas/collecte/meta/fetch_instagram.py` l. 83) ;
`/<post_id>?fields=caption,media_type,media_url,thumbnail_url,timestamp`
(l. 237) ; `/<ig_id>?fields=followers_count` (l. 280).

> Pulse reads the user's own Instagram Business account: the list of their
> posts, each post's caption, type, image and date, and the account's follower
> count. This is what lets the weekly report say which of *their* posts worked
> and which format performs best for them. We read no other account's content.

### `instagram_manage_insights`

**Ce que Pulse appelle** : `/<post_id>/insights`
(`fetch_instagram.py` l. 246) — `reach`, `saved`, `comments`, `views`, `likes`
pour une image, `reach`, `saved`, `comments`, `views` pour une vidéo ou un Reel,
plus `follows`.

> Pulse reads the insights of the user's own posts — reach, views, likes,
> comments, saves, and follows gained — to show them which posts and which
> formats performed best, and to measure whether an action they took the
> previous week changed those numbers. These metrics are aggregate; we never
> request or store anything about the individual people who saw or engaged with
> a post.

---

## 2 · Ce qu'il faut avoir avant de déposer

- **L'entreprise, vérifiée.** La référence des permissions est explicite : la
  vérification d'entreprise est **requise pour toute app qui demande l'Advanced
  Access**. Pulse lit les comptes **de ses clients**, donc Advanced Access, donc
  **Business Verification obligatoire**. C'est la même dépendance que côté
  Google : rien ne part avant que l'entreprise existe.
- **La réponse à la question que Meta pose mot pour mot** à l'App Review :
  *pourquoi ton app doit-elle accéder aux publicités et à leurs statistiques
  **pour le compte d'autres entreprises*** — les justifications du §1 y
  répondent, à condition de garder cette formulation en tête : ce n'est pas
  « pourquoi tu lis des chiffres », c'est « pourquoi tu les lis chez quelqu'un
  d'autre ».
- **La politique de confidentialité publiée**, à une URL HTTPS — Meta la demande
  dans les réglages de l'app, comme Google.
- **L'URL de suppression des données** (*Data Deletion Instructions*). Pulse n'a
  aucun bouton de suppression : c'est une demande traitée à la main, et la
  politique le dit depuis le 2026-09-11. **Une page d'instructions suffit** si
  elle dit à qui écrire et sous quel délai — mais elle doit exister, et
  aujourd'hui elle n'existe pas.
- **Une capture vidéo par permission.** Meta veut voir le geste de
  l'utilisateur, pas une description. Le parcours à filmer est le même que celui
  du script Google ([`OAUTH_DEMO_VIDEO_SCRIPT.md`](OAUTH_DEMO_VIDEO_SCRIPT.md)) :
  `/comptes` → « Connecter Meta » → l'écran de consentement Facebook → le choix
  de la Page → `/meta` pour les campagnes, `/instagram` pour les publications.

## 3 · Ce que ce dossier ne tranche pas

Le passage de `ads_management` à `ads_read` — **c'est une décision, et elle
touche les permissions demandées à tous les utilisateurs**. Elle se propose, elle
ne se glisse pas (`CLAUDE.md` §5). Le test qui l'éclaire est décrit au §1.
