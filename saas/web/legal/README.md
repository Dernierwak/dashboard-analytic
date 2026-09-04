# Documents légaux & marketing

Documents requis pour la validation Google OAuth Consent Screen en mode **Production**.

## Contenu

| Fichier | But | Statut |
|---|---|---|
| `PRIVACY_POLICY.md` | Politique de confidentialité (RGPD/GDPR) | Template à compléter |
| `TERMS_OF_SERVICE.md` | Conditions générales d'utilisation | Template à compléter |
| `OAUTH_DEMO_VIDEO_SCRIPT.md` | Script de la vidéo demo Google Cloud | Guide |

---

## Étapes pour les déployer

### 1. Remplir les placeholders

Tous les fichiers contiennent des `<PLACEHOLDERS>` à remplacer :

| Placeholder | Exemple |
|---|---|
| `<APP_NAME>` | Pulse Analytics |
| `<COMPANY_NAME>` | Ton Agence SA |
| `<COMPANY_ADDRESS>` | Rue de Bern 42, 3011 Bern, Switzerland |
| `<COUNTRY>` | Switzerland |
| `<JURISDICTION>` | Bern, Switzerland |
| `<PRIVACY_EMAIL>` | privacy@ton-agence.ch |
| `<SUPPORT_EMAIL>` | support@ton-agence.ch |
| `<DATE>` | 2026-05-25 |
| `<PRO_PRICE>` | 35 |
| `<LIABILITY_CAP>` | 500 |
| `<DPO_NAME>` | Optionnel (Data Protection Officer) |
| `<PRIVACY_URL>` | https://ton-app.vercel.app/privacy |

### 2. Publier les pages sur une URL publique

Google requiert que la Privacy Policy + Terms soient accessibles à des URLs **publiques HTTPS**. Plusieurs options :

#### Option A — Pages Next.js (recommandé, `saas/web` est déjà déployé)
1. Convertis les `.md` en pages (`saas/web/app/privacy/page.tsx`, `saas/web/app/terms/page.tsx`)
2. Accessibles via ton URL Vercel (`saas/web`)

#### Option B — GitHub Pages (gratuit, rapide)
1. Crée un repo `<ton-agence>.github.io`
2. Pousse les `.md` dedans
3. Active GitHub Pages
4. URLs publiques : `https://<ton-agence>.github.io/privacy`

#### Option C — Site existant
Si tu as déjà un site WordPress / Webflow / autre :
1. Copie-colle les contenus dans une nouvelle page
2. Adapte le style à ton branding

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
   - Justification du scope `adwords`
4. Soumets → délai 4-6 semaines

---

## Important — Adapter le contenu juridique

Ces templates sont des **bases**. Pour une validation juridique stricte, fais relire par un avocat (ex. avocat en droit du numérique en Suisse, environ 500-1500 CHF). Surtout pour :

- Articles **8 (Disclaimers)** et **9 (Limitation of liability)** dans les Terms
- Section **5 (Sub-processors)** dans la Privacy — confirme que tes signatures DPA Supabase/Stripe sont OK
- Section **12 (Governing law)** dans les Terms — précise la juridiction de ta société

Si tu opères depuis la **Suisse**, le **nLPD** (nouvelle Loi sur la Protection des Données, 2023) est proche du RGPD mais a quelques spécificités à mentionner.
