# Documents légaux & marketing

Documents requis pour passer en **Production** chez Google (OAuth Consent
Screen) et en **Live** chez Meta (App Review).

## Contenu

| Fichier | But | Statut |
|---|---|---|
| `GOOGLE_VERIFICATION.md` | **Le dossier Google** : les scopes, leur justification rédigée, où va la donnée, et l'ordre des opérations | Écrit le 2026-09-11, sourcé sur le code |
| `META_APP_REVIEW.md` | **Le dossier Meta** : les cinq permissions, ce que chacune appelle vraiment, et leur justification en anglais | Écrit le 2026-09-11, sourcé sur le code |
| `PRIVACY_POLICY.md` | Politique de confidentialité (RGPD/GDPR) | Aligné sur le vrai produit le 2026-09-11 — reste les placeholders d'entreprise |
| `TERMS_OF_SERVICE.md` | Conditions générales d'utilisation | Idem |
| `DATA_DELETION.md` | **Instructions de suppression des données** — exigées par Meta, et Pulse n'a aucun bouton de suppression : la page dit comment arrêter la récolte soi-même, à qui écrire, et sous quel délai | Écrit le 2026-09-11, publié en `/suppression` |
| `OAUTH_DEMO_VIDEO_SCRIPT.md` | Script de la vidéo de démonstration | **Réécrit le 2026-09-11** — l'ancien faisait dire à l'écran qu'on ne demande que `adwords`, ce qui est faux |

> **Ce qui a été corrigé le 2026-09-11.** Les deux documents décrivaient un
> produit qui n'existe pas et taisaient celui qui existe : ils annonçaient une
> offre Free/Pro facturée par **Stripe** (aucune trace de Stripe dans le code),
> et ne mentionnaient **ni Google Analytics 4** — alors que le scope
> `analytics.readonly` est demandé — **ni l'API Gemini**, à qui de la donnée
> Google est envoyée. Un dossier déposé dans cet état se fait refuser.
> Détail et sources : `GOOGLE_VERIFICATION.md`.

---

## Étapes pour les déployer

### 1. Remplir les placeholders

Tous les fichiers contiennent des `<PLACEHOLDERS>` à remplacer :

`<APP_NAME>` **est déjà rempli** — c'est **Pulse**, le nom que porte l'app
partout (`app/layout.tsx` l. 13, `app/login/page.tsx` l. 67). Il doit rester
identique à l'« App name » de l'écran de consentement Google : si tu le changes
là-bas, change-le ici le même jour.

Les autres attendent des faits que toi seul connais :

| Placeholder | Exemple |
|---|---|
| `<COMPANY_NAME>` | Ton Agence SA |
| `<COMPANY_ADDRESS>` | Rue de Bern 42, 3011 Bern, Switzerland |
| `<COUNTRY>` | Switzerland |
| `<JURISDICTION>` | Bern, Switzerland |
| `<PRIVACY_EMAIL>` | privacy@ton-agence.ch |
| `<SUPPORT_EMAIL>` | support@ton-agence.ch |
| `<DATE>` | 2026-05-25 |
| `<LIABILITY_CAP>` | 500 |
| `<DPO_NAME>` | Optionnel (Data Protection Officer) |
| `<PRIVACY_URL>` | `https://<ton-domaine>/privacy` — la page existe, il manque le domaine |
| `<DELETION_URL>` | `https://<ton-domaine>/suppression` — idem |

### 2. Publier les pages sur une URL publique — **fait, option A**

Google requiert que la Privacy Policy + Terms soient accessibles à des URLs
**publiques HTTPS**. Meta demande en plus une **URL d'instructions de
suppression des données** (*Data Deletion Instructions*). Trois pages, pas deux.

**Les trois existent** depuis le 2026-09-11, et l'arbitrage A / B a été tranché
en faveur de **A (pages Next.js)** : B posait la politique sur un `github.io`,
qui ne se vérifie qu'en propriété « préfixe d'URL » et pas en propriété de
domaine — l'étape 3 aurait coûté deux fois.

| URL | Document servi |
|---|---|
| `/privacy` | `PRIVACY_POLICY.md` |
| `/terms` | `TERMS_OF_SERVICE.md` |
| `/suppression` | `DATA_DELETION.md` |

Les pages **lisent** le `.md` (`saas/web/lib/legal.ts`) : il n'y a jamais deux
exemplaires d'un document juridique, donc rien à re-synchroniser après une
relecture d'avocat. Tu édites le `.md`, la page suit.

Les deux effets de bord sont traités : `middleware.ts` porte `CHEMINS_PUBLICS`
(sans quoi le reviewer atterrissait sur l'écran de connexion), et le compte de
routes de `CLAUDE.md` §9 est passé de 16 à **19**.

> **Tant qu'un `<PLACEHOLDER>` reste, la page ne publie rien.** Elle répond 200,
> affiche « ce document n'est pas encore publié », et la raison exacte part dans
> les journaux du serveur — pas à l'écran : « nos DPA ne sont pas encore signés »
> est vrai, et ce n'est pas une phrase qu'on affiche sur son propre site. Même
> règle pour tout commentaire `À VÉRIFIER AVANT PUBLICATION` : c'est ce qui
> empêche la politique d'affirmer le palier payant de Gemini avant que le
> ticket 26 soit tranché (`CLAUDE.md` §7).
>
> **Donc l'étape 1 ci-dessus est le seul geste qui reste avant que les trois URL
> servent les vrais documents.**

### 3. Vérifier ton domaine dans Google Search Console

Google Cloud demande que tu prouves que tu possèdes le domaine où sont hébergés la Privacy Policy + Terms. C'est rapide :
1. https://search.google.com/search-console
2. Ajoute ta propriété
3. Vérifie via DNS ou meta tag

### 4. Filmer la vidéo demo

Suis le script dans `OAUTH_DEMO_VIDEO_SCRIPT.md` :
- 3 min max, en anglais
- Upload YouTube en "Non répertoriée"

### 5. Soumettre la verification dans Google Cloud Console

1. Va dans **OAuth Consent Screen**
2. Status passe de "Testing" → "In production"
3. Remplis :
   - URL Privacy Policy
   - URL Terms of Service
   - URL vidéo YouTube demo
   - Justification des scopes `adwords` et `analytics.readonly` — **déjà rédigée**, à copier depuis `GOOGLE_VERIFICATION.md` §1
4. Soumets → délai 4-6 semaines

⚠ **Avant de soumettre**, règle le point Gemini de `GOOGLE_VERIFICATION.md` §3 :
la politique de confidentialité affirme qu'on utilise le **palier payant** de
l'API Gemini, et tant que ce n'est pas vérifié dans la console, la page
`/privacy` refuse de publier le document. Le geste est petit — lier un compte de
facturation et prépayer 5 $, sans changer de clé. Ce n'est **pas** une infraction
en attendant : pour un exploitant suisse ou européen, les termes appliquent déjà
le régime de données du palier payant au quota gratuit (citation en §3).

### 6. Meta : passer l'app en Live et déposer l'App Review

Le dossier est écrit : [`META_APP_REVIEW.md`](META_APP_REVIEW.md) — les cinq
permissions, ce que chacune appelle réellement dans le code, et la justification
en anglais prête à coller.

Deux points à connaître avant d'ouvrir le formulaire :

- **La vérification d'entreprise est obligatoire** dès qu'on demande l'Advanced
  Access, et Pulse lit les comptes de ses clients. Même dépendance que côté
  Google : l'entreprise d'abord.
- **Une décision t'attend** : Pulse demande `ads_management`, qui autorise à
  créer et modifier des campagnes, alors qu'il ne fait que **lire**. La
  permission de lecture s'appelle `ads_read`. Demander plus que ce qu'on utilise
  est un motif de refus classique — le §1 du dossier explique comment trancher
  sans deviner.

---

## Important — Adapter le contenu juridique

Ces templates sont des **bases**. Pour une validation juridique stricte, fais relire par un avocat (ex. avocat en droit du numérique en Suisse, environ 500-1500 CHF). Surtout pour :

- Articles **8 (Disclaimers)** et **9 (Limitation of liability)** dans les Terms
- Section **5 (Sub-processors)** dans la Privacy — confirme que tes DPA Supabase, Vercel et GitHub sont signés depuis le compte de l'entreprise
- Section **12 (Governing law)** dans les Terms — précise la juridiction de ta société

Si tu opères depuis la **Suisse**, le **nLPD** (nouvelle Loi sur la Protection des Données, 2023) est proche du RGPD mais a quelques spécificités à mentionner.
