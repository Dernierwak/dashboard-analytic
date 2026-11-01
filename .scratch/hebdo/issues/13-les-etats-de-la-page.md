# 13: Les états de la page

Type: grilling
Status: resolved
Blocked by: —

## Question

La page est validée sur un compte où tout répond
([La page entière, en maquette](08-la-page-entiere-en-maquette.md)). **Que
montre chaque bloc quand ce n'est pas le cas ?**

À trancher, bloc par bloc (bandeau des totaux, carte de canal, changements,
frise, panneau de la semaine) :

- une source **pas branchée** (pas de compte connecté) — la carte existe-t-elle ?
- une source **muette** cette semaine (la récolte n'a pas répondu) : « — »
  partout et jamais 0 (§7) ; le bandeau « n'a pas répondu » est parti
  (ticket 01), alors comment le dit-on ?
- un **historique trop court** pour la semaine type (moins de 6 semaines
  avec un ratio, ticket 03) : la moustache se tait, qu'écrit-on à sa place ?
- un **journal non couvert** : sans signal de couverture, « 0 changement »
  et une panne se confondent (ticket 05) ;
- une semaine **sans post** ou **sans campagne** dans le panneau ;
- le statut `WITH_ISSUES` de Meta, qui n'entre dans aucun des quatre statuts
  du ticket 04, et un statut non récolté ;
- le changement **hors campagne** (niveau compte ou ensemble) : son nom ;
- un compte **neuf**, sans aucune semaine complète.

## Answer

Grilling avec David, 2026-10-31 → 2026-11-01.

**La règle d'ensemble** : le client ne voit qu'une seule erreur, **son jeton
a expiré**, et il n'a qu'un seul geste, **se reconnecter** (la récolte
repart). Tout le reste, limites d'API, attentes, échecs ou semaine récoltée
en partie, c'est notre travail : on le relève, on le corrige, on relance.
David : « eux, la seule qu'ils doivent avoir, c'est token a expiré ».

1. **Source pas branchée** : elle n'apparaît nulle part (bandeau, rail,
   panneau). On la connecte, ses chiffres arrivent.
2. **Total avec une source muette** : le grand chiffre somme les sources qui
   ont répondu (Meta 400 · Google — → 400), avec une note sous le chiffre,
   dans sa colonne, qui nomme la source absente.
3. **Jeton mort** : seul cas qui demande au client d'agir. La carte porte
   une alerte et un lien vers Connexions, dont le bouton « Reconnecter »
   relance déjà la récolte. Remplace sur ce point le ticket 01 (« une panne
   se voit en interne »).
4. **Toute autre panne de récolte** (erreur de plateforme, semaine récoltée
   en partie) se gère **en interne** : on la fait remonter, on corrige, on
   relance nous-mêmes. Rien n'est demandé au client, et aucun bouton
   « relancer » ne revient.
5. **Semaine récoltée en partie** = panne interne, pas une semaine à 5 jours :
   jamais de totaux partiels affichés comme ceux de la semaine.
6. **Historique trop court** (< 6 semaines avec un ratio) : valeur de la
   semaine sans état ni couleur ; à la place de la moustache, « Semaine type
   dès 6 semaines d'historique — encore N ».
7. **Pendant une panne interne** : le bandeau garde le total des sources qui
   ont répondu ; la carte du canal montre « — » partout, sans moustache, et
   une phrase sans bouton, du genre « Une erreur est survenue pendant la
   récolte de Meta. Nous la relançons dès que possible. » Elle disparaît quand
   le rapport est republié après notre correction. Ce qui compte pour David :
   **que l'erreur soit relevée et corrigée chez nous**.
8. **Journal non couvert** : « Changements en cours de récupération », sans
   compte ; le vrai 0 s'écrit « Meta n'a écrit aucun changement cette
   semaine ». Le signal de couverture du journal devient une exigence ferme
   du ticket 14.
9. **Panneau, semaine vide** : l'onglet reste, compte à 0, et trois textes
   pour trois causes — « Aucun post publié / aucune campagne active cette
   semaine » ; « … en cours de récupération » ; « Meta n'était pas encore
   connecté » pour une semaine antérieure à la connexion.
10. **Statut de campagne** : une fin déclarée et passée donne « terminée »,
    quel que soit `effective_status` ; sinon `WITH_ISSUES` donne un cinquième
    statut, « problème signalé par Meta » ; un statut non récolté ne
    s'affiche pas, et le filtre le range sous « statut inconnu ».
    *Complété par [Le statut d'une campagne Google supprimée](17-le-statut-d-une-campagne-google-supprimee.md) :
    `REMOVED` donne « supprimée », avant la règle de la fin passée.*
11. **Changement hors campagne** : « Compte publicitaire » au niveau du
    compte ; sinon le nom de l'objet tel que Meta l'écrit. Jamais « Hors
    campagne ».
12. **Compte neuf** : le fil de mise en place s'il n'est pas fini, sinon une
    seule carte « Ton premier rapport arrive le <date>. Il portera sur la
    semaine du <début> au <fin>. », dates tirées du Jour de travail. Ni
    bandeau, ni rail, ni frise vides.
13. **La remontée des erreurs chez nous** sort de ce chantier : alerte par
    mail, et **une relance interne de la récolte pour tous les clients**
    (« si jamais il y a quelqu'un qui n'a pas les données, il les a plus
    tard »). Un chantier à part, noté dans Out of scope de la carte.

### Ce que ça demande au traitement (ticket 14)

- **Un état par canal, pour la semaine** : récolté · jeton mort · panne
  interne (y compris semaine récoltée en partie). `canaux_muets` ne peut
  donc pas sortir sans être remplacé : il est la source de cet état
  (`fetch_progress`, `saas/data/supabase/_queries.py:459`), et il faut y
  distinguer le jeton mort.
- **Le signal de couverture du journal** (déjà réclamé par 05) : exigence
  ferme, sans lui « aucun changement » et « en cours de récupération » se
  confondent.
- **La date de connexion de chaque source**, pour écrire « Meta n'était pas
  encore connecté » sur une semaine antérieure.
- Le nombre de semaines avec un ratio, pour « encore N ».
