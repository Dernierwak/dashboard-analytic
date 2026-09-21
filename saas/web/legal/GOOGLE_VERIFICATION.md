# Dossier de vérification Google OAuth

Ce que la console Google Cloud demande, champ par champ, avec la réponse déjà
rédigée. Rien ici n'est inventé : chaque affirmation pointe le fichier du dépôt
qui la prouve, et se re-vérifie avec la commande donnée.

Rédigé le 2026-09-11 pour le ticket
[18](../../../.scratch/refonte/issues/18-passer-en-production.md).

---

## 1 · Les scopes demandés, et pourquoi

Source unique de vérité dans le code :
`saas/web/app/api/oauth/google/start/route.ts` l. 11-14.
Un seul consentement couvre les deux — le même `refresh_token` sert aux deux API.

| Scope | Catégorie Google | Ce qu'on en fait |
|---|---|---|
| `https://www.googleapis.com/auth/adwords` | **Restricted** | Lire les campagnes Google Ads du client : nom, statut, impressions, clics, dépense, conversions, et le détail par annonce. Sans lui, la moitié payante du rapport n'existe pas. |
| `https://www.googleapis.com/auth/analytics.readonly` | **Sensitive** | Lire les rapports agrégés GA4 : sessions, conversions, revenu, par source / support / campagne UTM. C'est ce qui relie une dépense publicitaire à un revenu — sans lui, Pulse affiche un coût sans jamais dire ce qu'il a rapporté. |

**Justification à coller dans le formulaire (anglais, prête) :**

> Pulse is a weekly marketing reporting tool. It reads the customer's own Google
> Ads campaign performance (`adwords`) and their own aggregated GA4 reports
> (`analytics.readonly`), and combines them with the customer's Meta Ads and
> Instagram data to produce a single weekly report that tells the customer what
> changed and what to do next.
>
> Both scopes are read-only. Pulse never creates, edits, pauses or deletes any
> campaign, and never writes anything back to Google Ads or Google Analytics.
> The data is shown only to the account owner and to the people they explicitly
> invite to their own account. It is never sold, never shared with advertising
> platforms or data brokers, and never used to build audiences or serve ads.
>
> Read-only is enforced in code: the collection layer only ever issues
> `searchStream` / `runReport` queries — no mutate call exists anywhere in the
> repository.

**Comment le prouver à un reviewer**, si la question vient — aucun appel
d'écriture n'existe dans le dépôt :

```bash
git grep -nE ":mutate|mutateOperations|MutateGoogleAds" -- 'saas/collecte/**' || echo "aucun appel d'écriture"
```

### Ce qu'on ne demande PAS, et qu'il faut savoir dire

- **Aucun scope d'identité** — ni `openid`, ni `userinfo.email`, ni
  `userinfo.profile`. La connexion à Pulse se fait par email + mot de passe chez
  Supabase (`saas/web/app/login/page.tsx` l. 25), pas par « Se connecter avec
  Google ». C'est ce qui fait que Pulse ne peut pas se réfugier derrière
  l'exception des 7 jours (voir §4).
- **Aucune dimension d'utilisateur final dans GA4.** Les seules dimensions
  demandées sont `date`, `sessionSource`, `sessionMedium`, `sessionCampaignName`
  et `eventName` (`saas/collecte/ga4/fetch_ga4.py` l. 87-95 et 367-375), et la
  table qui les reçoit n'a pas d'autre colonne (`ga4_insights`,
  `supabase/migrations/000_run_me_all.sql` l. 341). **Aucun `userId`, aucun
  `clientId`, aucune donnée de géolocalisation ni d'appareil n'est demandé ni
  stocké.** Pulse ne voit jamais un visiteur, seulement des totaux.

---

## 2 · Où va la donnée, une fois lue

Le formulaire demande où la donnée est stockée et qui y touche. La liste est
courte et doit être exacte — un sous-traitant oublié ici est un motif de refus.

| Qui | Ce qui y transite | Preuve dans le dépôt |
|---|---|---|
| **Supabase** (PostgreSQL) | Toute la donnée récoltée, et les jetons OAuth (`connected_accounts`) | `saas/commun/insert_data.py` |
| **Vercel** | L'hébergement de l'application qui affiche la donnée | `saas/web/`, déployé depuis `main` |
| **GitHub Actions** | La récolte hebdomadaire s'y exécute — donc les jetons y transitent en variables de secret | `.github/workflows/weekly-fetch.yml` |
| **Google Gemini API** | Des extraits de la donnée récoltée, pour rédiger le texte du rapport | `gemini-2.5-flash`, 5 sites d'appel — voir §3 |

Chaque ligne de donnée est cloisonnée par utilisateur : toutes les tables portent
un `user_id` et une politique RLS `auth.uid() = user_id`
(`supabase/migrations/000_run_me_all.sql`). Une personne invitée sur un compte
voit les chiffres et **jamais les jetons** — règle dure du projet, `CLAUDE.md` §7.

---

## 3 · Le palier de l'API Gemini — corrigé le 2026-09-11

**Ce paragraphe affirmait « sur le palier gratuit, Pulse est en infraction ».
C'est faux pour une entreprise européenne, suisse ou britannique, et la clause
qui le dit est dans le même document.** Lue à la source le 2026-09-11 (version
en vigueur du 23 mars 2026), section *How Google Uses Your Data* :

> *« If you're in the European Economic Area, Switzerland, or the United Kingdom,
> the terms under "How Google uses Your Data" in "Paid Services" apply to all
> Services, including Google AI Studio and unpaid quota in the Gemini API, even
> though they are offered free of charge. »*

Autrement dit : pour un exploitant en Suisse ou dans l'UE, le régime de données
du palier **payant** s'applique déjà au palier gratuit — pas d'usage pour
améliorer les produits de Google, pas de relecture humaine pour les améliorer,
et le renvoi au *Data Processing Addendum*. Les deux citations du palier gratuit
(*« Google uses the content you submit […] to improve »*, *« human reviewers may
read, annotate, and process »*) restent exactes, mais **cette clause régionale
les désactive** pour nous. Il n'y a donc pas de conflit avec la Limited Use
requirement, et la vérification n'est pas bloquée par une infraction.

**Ce qui reste vrai, et pourquoi on passe quand même au palier payant :**

- **La clause dépend d'un fait qui n'existe pas encore.** « If you're in the
  EEA, Switzerland, or the UK » se juge sur l'exploitant — et l'entreprise est
  précisément la première case, encore à cocher, du ticket
  [18](../../../.scratch/refonte/issues/18-passer-en-production.md). Faire
  reposer la conformité d'un dossier sur une clause régionale, quand on peut la
  rendre sans objet, c'est se donner un point à défendre pour rien.
- **Une phrase du palier gratuit n'est PAS couverte par la clause.** La clause
  n'importe que la section *How Google uses Your Data*. Or la section *Unpaid
  Services* porte aussi, séparément : *« Do not submit sensitive, confidential,
  or personal information to the Unpaid Services. »* Un reviewer qui lit notre
  politique — où Gemini est déclaré comme sous-traitant, comme il le doit — a
  cette phrase à opposer.
- **Le palier gratuit a des quotas, et notre panne serait silencieuse.**
  `_call_gemini` retombe sur le chemin déterministe quand l'appel échoue : un
  quota atteint ne casse rien, il **appauvrit le rapport sans le dire**. Ce
  risque grandit à chaque client.
- **Ça coûte 5 $.** Passer au palier payant, c'est lier un compte de facturation
  et **prépayer un minimum de 5 $**
  ([docs Billing](https://ai.google.dev/gemini-api/docs/billing)). Le Tier 1 est
  plafonné à 250 $/mois, l'effet est immédiat, et **on peut délier le projet pour
  revenir au gratuit**. Le geste est réversible et minuscule.

**Ce qu'il faut faire, et que l'agent ne peut pas faire à ta place :** ouvrir la
page des clés d'API dans Google AI Studio et regarder la colonne **Billing
Tier** du projet qui porte `GEMINI_API_KEY`. « Set up billing » = palier gratuit.
**Aucune clé nouvelle n'est nécessaire** : les clés *« have no independent
billing settings; they inherit the tier limits and billing status of the
project »* — le secret GitHub Actions reste le même. Aucun jeton, aucune clé,
aucun identifiant de projet ne passe par la conversation (`CLAUDE.md` §7).

C'est le ticket
[26](../../../.scratch/refonte/issues/26-gemini-palier-payant.md).

---

## 4 · Le mur des 7 jours, et ce qu'on ne sait pas encore

La doc Google, source primaire
([developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)),
dit :

> *« A Google Cloud Platform project with an OAuth consent screen configured for
> an external user type and a publishing status of "Testing" is issued a refresh
> token expiring in 7 days, unless the only OAuth scopes requested are a subset
> of name, email address, and user profile. »*

Pulse demande `adwords` et `analytics.readonly` : l'exception ne joue pas. **En
statut Testing, le jeton meurt à 7 jours et le worker hebdomadaire casse par
construction.**

**Ce que la doc ne dit toujours pas — re-vérifié le 2026-09-11.** L'expiration
est rattachée au *publishing status « Testing »*, pas à l'absence de
vérification. L'état **« In production, non vérifiée »** n'est décrit avec
**aucune** durée de jeton, sur aucune page de Google. La question ne se tranche
donc pas en lisant : **elle se tranche en testant**, et c'est le seul point de ce
ticket qui change le calendrier du produit.

**Le test, en trois gestes :** basculer le statut en Production · connecter un
compte réel et noter la date · revenir au 8ᵉ jour et regarder si la récolte
tourne encore. Si elle tourne, on valide chez de vraies entreprises **pendant**
la vérification au lieu de l'attendre.

En attendant, le contournement existe déjà et ne demande aucun code : le bouton
**« Reconnecter »** de `/comptes` (`saas/web/app/comptes/page.tsx` l. 353 et 373).
Un clic avant chaque Jour de travail. Une semaine oubliée est une semaine de
données perdue.

---

## 5 · La vidéo de démonstration

Le script vit dans [`OAUTH_DEMO_VIDEO_SCRIPT.md`](OAUTH_DEMO_VIDEO_SCRIPT.md).
Ce que le reviewer Google veut y voir, et qu'il faut filmer sans coupure :

- [ ] L'URL publique de l'application, lisible dans la barre d'adresse.
- [ ] L'écran de consentement OAuth **entier**, avec les scopes affichés.
- [ ] Ce que l'application fait de la donnée juste après : la page où les
      chiffres Google Ads et GA4 apparaissent.
- [ ] Le chemin de déconnexion / révocation.

---

## 6 · L'ordre des opérations

Rien de tout ça n'est parallélisable au hasard : chaque ligne débloque la
suivante.

1. **Créer l'entreprise** — préalable aux deux vérifications, Google et Meta.
2. **Vérifier le palier Gemini** (§3) — c'est le seul point qui peut faire
   refuser le dossier pour une raison qu'on connaît déjà.
3. **Compléter les placeholders** de `PRIVACY_POLICY.md` et
   `TERMS_OF_SERVICE.md` — ils sont listés dans le [README](README.md).
4. **Publier les deux pages** à une URL publique HTTPS, et vérifier le domaine
   dans Google Search Console.
5. **Basculer en Production**, et **lancer le test des 7 jours** (§4) le jour
   même : c'est gratuit et ça répond à la seule question ouverte.
6. **Déposer la vérification**, CASA comprise pour `adwords`.
7. **Meta : passer l'app en Live** et faire l'App Review des cinq permissions
   listées dans `saas/web/app/api/oauth/meta/start/route.ts` l. 17-23. Son
   dossier est écrit à part : [`META_APP_REVIEW.md`](META_APP_REVIEW.md). Il
   dépend lui aussi de l'étape 1 — la vérification d'entreprise est exigée de
   toute app qui demande l'Advanced Access.
