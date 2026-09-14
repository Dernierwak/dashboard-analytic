# Script vidéo de démonstration — vérification Google OAuth

Ce que le reviewer Google doit voir, et la narration à lire par-dessus. Le
script est **écrit contre le code**, pas contre une idée du produit : chaque
écran cité existe, chaque phrase anglaise est vraie aujourd'hui.

> **Réécrit le 2026-09-11.** La version précédente faisait dire à l'écran
> *« We only ask for the `adwords` scope. We do not request any other
> permissions »* — c'est **faux** : `app/api/oauth/google/start/route.ts`
> l. 11-14 demande `adwords` **et** `analytics.readonly` sur un seul écran de
> consentement. Un reviewer compare la vidéo à la liste des scopes déposés ;
> l'écart se voit en dix secondes et fait refuser le dossier. Elle parlait aussi
> de `st.status` (vocabulaire Streamlit — l'app est en Next.js depuis), d'un
> « Settings → Google Ads » et d'un « Google Ads tab » qui n'existent pas, et
> promettait la suppression des données en un clic alors qu'aucun bouton ne la
> fait.

## Le cadre

- **3 minutes au maximum**, en **anglais**, sans musique, sans coupure pendant
  le passage sur l'écran de consentement.
- L'interface de Pulse est **en français**. Le dire à la première phrase évite
  que le reviewer croie avoir mal lu un écran.
- Enregistrement d'écran : Loom (upload YouTube direct) ou OBS.
- YouTube en **Non répertoriée** — jamais en Privée, le reviewer ne l'ouvrirait
  pas.

## Ce que Google veut voir — les quatre cases de `GOOGLE_VERIFICATION.md` §5

- [ ] L'URL publique de l'application, lisible dans la barre d'adresse.
- [ ] L'écran de consentement OAuth **entier**, scopes affichés.
- [ ] Ce que l'application fait de la donnée juste après — un écran par scope.
- [ ] Le chemin de déconnexion.

---

## Le script

### [0:00–0:20] Qui parle, et de quoi

> "Hi. This is a demo of **Pulse**, a weekly marketing reporting tool for small
> businesses. The interface is in French — I'll translate as I go. In the next
> three minutes I'll show which Google scopes we request, the consent screen
> itself, exactly where that data appears in the product, and how a user
> disconnects."

**À l'écran** : `/login`, l'URL de production lisible dans la barre d'adresse.

### [0:20–0:45] Les deux scopes, annoncés avant de les demander

> "Pulse requests two Google scopes, on a single consent screen. The first is
> `adwords`, read-only access to the user's Google Ads campaigns. The second is
> `analytics.readonly`, read-only access to their Google Analytics 4 property.
> We need both together, because the product's core promise is telling a
> business whether its ad spend produced revenue on its website — spend comes
> from Google Ads, revenue comes from Analytics. Neither scope answers that
> alone."

**À l'écran** : `/comptes`, ses quatre cartes de connexion — Meta, Instagram,
**Google Ads**, **Google Analytics** (`lib/connexions.ts` l. 67-113). Les deux
cartes Google portent déjà, en français, ce que chacune apporte.

### [0:45–1:20] L'écran de consentement — le moment clé, sans coupure

**À l'écran** : clic sur « Connecter Google », puis l'écran Google **entier**,
scopes dépliés.

> "Here is Google's own consent screen. You can see both scopes listed: Google
> Ads, and Google Analytics — both read-only. Pulse never writes to a Google
> account. There is no mutate call anywhere in our codebase."

Puis « Allow ».

### [1:20–1:45] Choisir le compte Ads et la propriété Analytics

**À l'écran** : retour sur `/comptes`, sélection du compte Google Ads, puis de
la propriété GA4.

> "After authorizing, the user picks which Google Ads account and which
> Analytics property Pulse should read. One authorization, two choices — and
> nothing is read until they're made."

### [1:45–2:20] Où la donnée apparaît — un écran par scope

**À l'écran** : `/google`, puis `/conversions`.

> "This is where the Google Ads data appears: campaigns, spend, impressions,
> clicks, conversions, for the account the user just connected."
>
> "And this is the Analytics data — the page is titled 'what Google Analytics
> counts for you'. The user tells Pulse which GA4 events count as conversions
> for their business. From Analytics we read only five dimensions: date,
> session source, session medium, session campaign name, and event name. We
> never request user identifiers, no client ID, no location, no device."

> **Vrai, et vérifié** : `saas/collecte/ga4/fetch_ga4.py` l. 87-95 et 367-375,
> et la table `ga4_insights` n'a pas d'autre colonne (migration l. 341).

### [2:20–2:45] Ce qu'on en fait, et ce qu'on n'en fait pas

**À l'écran** : `/`, le rapport hebdomadaire.

> "All of it serves one feature, visible to the user who authorized it: a weekly
> report saying what changed, what to do next, and whether last week's action
> worked. Each user sees only their own data — enforced by row-level security in
> our database. We don't sell this data, and we don't use it for advertising."

> **À n'ajouter qu'une fois [26](../../../.scratch/refonte/issues/26-gemini-palier-payant.md)
> vérifié**, et pas avant : *"The wording of the weekly advice is generated by
> Google's Gemini API on the paid tier, which does not use submitted content to
> improve Google products."* Tant que le palier n'est pas confirmé dans la
> console, cette phrase serait une affirmation invérifiée — on la dit, ou on ne
> tourne pas encore la vidéo.

### [2:45–3:00] Déconnexion et politique de confidentialité

**À l'écran** : `/comptes`, le lien « Déconnecter » sous la carte Google
(`components/deconnecter-bouton.tsx`), puis l'URL de la politique.

> "A user disconnects Google at any time from this screen; the refresh token we
> store is deleted and collection stops. They can also revoke our access from
> their Google Account permissions page. Data already collected is kept unless
> they ask us to delete it — our Privacy Policy, published at `<PRIVACY_URL>`,
> and our data deletion instructions at `<DELETION_URL>` explain how to ask.
> Thank you."

> **Ne pas dire « the refresh token is revoked »** : `deconnecter()`
> (`app/comptes/actions.ts` l. 129-147) met les colonnes de jeton à `NULL` dans
> `connected_accounts`. **Aucun appel de révocation n'existe dans le dépôt** —
> `git grep -n revoke` ne renvoie que ce fichier. Le jeton reste donc valide
> chez Google tant que l'utilisateur ne le révoque pas de son côté ; ce qui
> disparaît, c'est notre copie. La différence est exactement celle qu'un
> reviewer vérifie.

> **Ne pas dire « delete all their data at any time »** : aucun bouton ne le
> fait. La suppression est une demande traitée à la main, et la politique le dit
> comme ça depuis le 2026-09-11. Promettre un bouton qui n'existe pas dans une
> vidéo que le reviewer confronte au produit est le genre d'écart qui coûte un
> cycle entier.

---

## Avant d'enregistrer

- [ ] `<PRIVACY_URL>` remplie — donc les pages légales **publiées** (voir
      [README](README.md) §2). Sans elles, la dernière phrase ne peut pas se
      dire.
- [ ] Le palier Gemini tranché
      ([26](../../../.scratch/refonte/issues/26-gemini-palier-payant.md)) — il
      décide d'une phrase du script et du dossier entier.
- [ ] L'URI de redirection de la Cloud Console **identique** à celle de
      production, en HTTPS.
- [ ] Un compte Google Ads branché avec de vraies campagnes, et une propriété
      GA4 qui a des événements — un écran vide ne démontre rien.
- [ ] Le parcours joué une fois en entier avant d'enregistrer.

## Après

1. YouTube, **Non répertoriée**.
2. Cloud Console → OAuth Consent Screen → *Prepare for verification* → **App
   demo video** : coller l'URL.
3. Les justifications de scopes se copient depuis
   [`GOOGLE_VERIFICATION.md`](GOOGLE_VERIFICATION.md) §1 — elles sont déjà
   rédigées en anglais.

Si la vidéo est refusée, Google dit quelle case manque : on refilme ce
passage-là, pas la vidéo entière.
