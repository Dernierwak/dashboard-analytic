---
name: AI Recommendations System
description: Architecture et priorités pour le système de recommandations IA dans le dashboard
type: project
---

## Système de recommandations IA — Prio 1

### Ce que ça fait
- Section en haut du dashboard (avant les KPIs)
- Génère des recos **automatiquement** sans que l'user demande (au moment du fetch)
- **Flou pour les gratuits** → levier de vente Pro
- **Visible pour les Pro** → valeur principale du plan payant

### Boucle d'amélioration
1. L'IA génère une reco → stockée en DB (`ai_recommendations`)
2. L'user peut laisser un commentaire (👍 / texte libre) → stocké en DB (`ai_feedback`)
3. Ces feedbacks sont une **source d'amélioration du prompt** (consultation manuelle par David d'abord)
4. À terme : le contexte par user s'enrichit semaine après semaine (mémoire par user)

### Tables Supabase à créer
- `ai_recommendations` : user_id, content, generated_at, period (week/month)
- `ai_feedback` : recommendation_id, user_id, rating (👍/👎), comment, created_at

### Input du LLM (économique — ~100 tokens)
- Delta followers (gain/perte sur la période)
- Top 3 posts avec métriques (type, reach, likes, saved)
- Répartition IMAGE vs VIDEO vs REEL
- Jour/heure de publication des meilleurs posts

### Output attendu
- 2-3 recommandations concrètes et actionnables
- Ex: "Tes Reels génèrent 3x plus de reach — publie 2 Reels cette semaine"
- Ex: "Tes posts du jeudi performent 40% mieux — teste jeudi prochain"

### Règles importantes
- Ne pas appeler l'API Claude à chaque page load → générer 1x par semaine, stocker en DB
- Si pas de changement depuis dernière reco → afficher la dernière sans rappeler l'API
- Ne jamais envoyer les données brutes au LLM → toujours un delta agrégé (~100 tokens max)

### **Why:**
C'est le principal différenciateur Pro. Sans ça, le dash gratuit et Pro sont trop similaires.

### **How to apply:**
Coder la section UI d'abord (flou pour free, placeholder pour pro), puis brancher l'API Claude.
