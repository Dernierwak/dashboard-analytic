# Script vidéo demo OAuth — Google Cloud Verification

## Objectif
Démontrer à Google que ton app demande l'accès à Google Ads API de manière légitime, transparente, et que les données récupérées sont utilisées uniquement pour les afficher à l'utilisateur dans son dashboard.

## Durée cible
**3 minutes max** — Google demande explicitement une vidéo courte. Pas de musique, voix claire, à filmer en screen recording.

## Outils recommandés
- **Loom** (gratuit, simple) — upload direct YouTube
- **OBS Studio** + upload manuel YouTube
- Vidéo doit être **publique ou non répertoriée** (pas "privée")

---

## Script à dire (à filmer en screen recording de ton app)

### [0:00–0:15] Introduction (15 sec)
> "Hi, this is a demo of **<APP_NAME>**, an analytics dashboard for marketing teams and agencies. In this video I will show how we request access to Google Ads data via OAuth, and how we use that data within our app. Let's get started."

### [0:15–0:40] Présentation de l'app (25 sec)
- Montre la **landing page** ou la page d'accueil de ton dashboard
- Liste rapidement les sources de données supportées :
  > "Our app connects to social media and advertising platforms — Instagram, Meta Ads, and Google Ads — to provide a unified analytics view for our users."
- Montre une page de présentation des fonctionnalités

### [0:40–1:10] Login + Settings (30 sec)
- Login via Supabase (juste pour montrer qu'il y a une authentification utilisateur)
- Navigue vers **Settings → Google Ads**
- Pointer la carte "Connect with Google" :
  > "To connect their Google Ads account, the user clicks the 'Connect with Google' button. This will redirect them to Google's official OAuth consent screen."

### [1:10–1:40] Consent screen (30 sec) — LE MOMENT CLÉ
- Clique sur le bouton "Connect with Google"
- Tu arrives sur **la consent screen Google officielle**
- LIS À HAUTE VOIX les scopes demandés :
  > "On Google's consent screen, you can see exactly what permissions our app is requesting. We only ask for the `adwords` scope — which is read access to Google Ads data. We do **not** request any other permissions."
- Montre les détails (clic sur "What this means")
- Clique "Allow"

### [1:40–2:15] Sélection du compte + auto-fetch (35 sec)
- Tu reviens dans ton app
- Si tu as plusieurs comptes Google Ads → montre le selectbox de sélection :
  > "After authorizing, the user selects which Google Ads account they want to connect. Multiple accounts under the same Google login can be chosen."
- Confirme la connexion
- Le `st.status` se lance :
  > "Our app then fetches the user's Google Ads campaign data — impressions, clicks, spend, conversions — and stores it securely in our database."

### [2:15–2:45] Utilisation des données (30 sec)
- Navigue dans **Google Ads tab** du dashboard
- Montre le tableau de campagnes, les KPIs, les graphiques
- Verbalise :
  > "The data is used solely to display analytics to the user who authorized it. We do not share, sell, or use this data for any other purpose. Each user only sees their own data — enforced by row-level security in our database."

### [2:45–3:00] Conclusion + privacy (15 sec)
- Naviguer vers le footer / lien Privacy Policy
- Montre rapidement la Privacy Policy publiée
  > "Our Privacy Policy, available at <PRIVACY_URL>, explains in detail how we handle user data. Users can disconnect their Google Ads account or delete all their data at any time. Thank you."

---

## Checklist avant d'enregistrer

- [ ] Privacy Policy publiée publiquement sur ton site (URL en ligne)
- [ ] Terms of Service publiés publiquement
- [ ] L'URL de redirect OAuth dans Google Cloud Console correspond EXACTEMENT à celle de ton app prod (HTTPS)
- [ ] Tu testes le flow complet avant filmer (pas de bug à l'enregistrement)
- [ ] Tu prépares un compte Google Ads (avec quelques campagnes pour avoir du contenu à montrer)
- [ ] Tu vérifies le micro et que ta voix est claire (pas de bruit de fond)
- [ ] Tu utilises l'**anglais** (Google review est anglophone, accélère le process)

## Après upload

1. Upload la vidéo sur YouTube en **"Non répertoriée"** (Unlisted)
2. Copie l'URL YouTube
3. Va dans Google Cloud Console → OAuth Consent Screen
4. Clique "Prepare for verification"
5. Dans la section **"App demo video"**, colle l'URL YouTube
6. Soumets la demande

## Délai de validation Google

- **Mode Testing → Production** : 4-6 semaines en moyenne
- Google peut te demander des **clarifications par email** — réponds vite (sous 48h)
- Si ta vidéo est rejetée, ils te disent pourquoi → tu refais cette section uniquement

## Astuce

Avant de soumettre, vérifie que ta vidéo coche bien :
- ✅ Montre **clairement** que c'est TON app (logo, nom visible)
- ✅ Montre la **consent screen complète** avec les scopes lisibles
- ✅ Montre **où** et **comment** les données sont utilisées
- ✅ Mentionne ta **Privacy Policy** et l'URL
- ✅ Pas de scope demandé qui n'est PAS justifié dans la vidéo
