Type: grilling
Status: resolved
Blocked by: 01

## Question

L'artifact note un taux d'adhésion cible de 80-90%, mais précise : "se mesure
honnêtement seulement une fois `reco_feedback` rempli en volume suffisant ;
avant ça, l'afficher serait un chiffre non mesuré présenté comme mesuré"
(cf. `CLAUDE.md` racine §7 — aucun chiffre fabriqué).

À trancher avec David :
- Quel volume de `reco_feedback` (nombre de réactions, nombre de semaines,
  nombre de comptes) compte comme "suffisant" pour publier ce chiffre ?
- Comment le calculer précisément une fois le volume atteint — quelles
  réactions comptent comme "adhésion" (Utile ? Fait ? les deux ?), sur quelle
  fenêtre glissante ?
- Que montrer à la place tant que le volume n'est pas atteint — rien, ou une
  mention explicite du volume actuel ("12 retours sur 50 nécessaires") ?

## Answer

Décisions de David :
1. **Indicateur interne uniquement**, agrégé sur toute la base de comptes —
   jamais affiché à un client individuel. "Que montrer tant que le volume
   n'est pas atteint" devient sans objet côté client puisque rien n'y est
   jamais montré ; en interne, on attend simplement d'avoir le volume avant
   de publier le chiffre où que ce soit (dashboard interne, `PROJECT_STATUS.html`
   ou équivalent).
2. **Adhésion = `done` (le bouton "▶ Je le teste") ET vérifié** — pas
   seulement le clic auto-déclaré du client. Il faut recouper avec les
   sources de données (Meta Ads / Google Ads / Instagram) pour confirmer que
   le changement recommandé a réellement eu lieu (ex. budget modifié, format
   de post différent) — un signal comportemental vérifié, pas une
   déclaration seule. Point de construction à préciser plus tard : quelle
   correspondance exacte entre une clé de reco et le changement attendu côté
   plateforme (proche de ce que `_attach_metric()` fait déjà pour le
   verdict, mais ici pour vérifier l'action elle-même, pas son effet).
3. **Volume minimum : 200 réactions `reco_feedback`**, tous comptes
   confondus, avant de considérer le taux comme autre chose que du bruit.
4. **Fenêtre glissante** (8 semaines) plutôt que cumulé depuis le début —
   le chiffre doit refléter l'état actuel du produit, pas être dilué dans
   tout l'historique.

