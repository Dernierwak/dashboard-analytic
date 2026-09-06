# Recos générales — point de situation (Graphe A)

## Destination

Un état des lieux **vérifié** (code réel, pas la photo du 26 août) du Graphe A —
les recos "générale", niveau compte, hors thème — avec ses décisions encore
ouvertes tranchées : méthode de correspondance du classificateur, usage du
score IA d'un lot, seuil d'adhésion mesurable, et le profil client vivant qui
doit alimenter (et être alimenté par) ces recos. Fin de carte = un plan de
construction prêt à exécuter, pas le code lui-même.

## Notes

- Domaine : `saas/recos_ia/` (`labeling.py`, `categorizing.py`,
  `user_persona.py`) + `saas/commun/` (`reco_feedback`, `suivi_actions`) +
  `saas/recos_ia/reco_engine.py` (10 règles déterministes).
- Skills à consulter : agent `recos` (grille Décision / Répétition /
  Vérifiabilité / Honnêteté sur tout lot de conseils) ; `CLAUDE.md` racine §7
  (aucun chiffre fabriqué, mesuré/estimé/inventé à distinguer).
- Référence de départ : artifact Claude **"La fabrique des recos"** (David,
  26 août 2026) —
  https://claude.ai/code/artifact/5e384b78-c34c-440b-baa4-ccc561804c2e — décrit
  déjà le Graphe A en détail. Il répond déjà à "qui valide une nouvelle
  catégorie" (ni auto ni validation ponctuelle — 5 étapes internes) et "une
  nouvelle catégorie a-t-elle droit à `PROOF_KPI` dès sa création" (non) : ne
  pas re-trancher sauf découverte contraire pendant un ticket.
- Carte sœur : **Recos par thème (Graphe B, cross-canal)** —
  `.scratch/recos-labels/map.md`. Objectif et structure différents (compte vs
  thème) — cartes délibérément séparées. Correction post-ticket 01 de la
  carte sœur : l'objectif par thème (`_obj_theme()`) est un champ indépendant
  du profil compte — le ticket 05 ci-dessous n'est **pas** un prérequis pour
  la carte sœur.
- **5 septembre 2026** : le ticket 01 a révélé que David avait construit le
  classificateur compte-entier le 29/08 puis l'avait retiré le 30/08
  ("on fait pas de recos générale"). Confirmé avec David le 5 septembre : il
  **revient sur ce retrait** — le classificateur redevient pertinent, le
  ticket 02 (méthode de correspondance) reste d'actualité tel quel.
- "Thème" et "label" sont le même concept dans le code (`labeling.py` pose un
  "thème", stocké en colonne technique `label`) — ne pas chercher deux
  systèmes différents.

## Decisions so far

- [Vérifier l'état réel du Graphe A](issues/01-verifier-etat-graphe-a.md) :
  10 règles / `_importance` / `_diversifier` / non-branchement de
  `user_persona.py` / pont onboarding absent — tout confirmé identique à
  l'artifact du 26 août ; `reco_feedback.theme` a bien été ajouté (29/08,
  pour le Graphe B) ; mais le classificateur et la file `reco_news` ont en
  réalité été **construits en entier le 29/08 puis explicitement retirés le
  30/08** sur décision de David ("on fait pas de recos générale") — pas un
  simple statu quo à ○, un aller-retour tranché qui mérite d'être reconfirmé
  avant de relancer ce chantier.

- [Méthode de correspondance](issues/02-methode-correspondance.md) : on
  reprend la méthode déjà éprouvée le 29 août (auto-déclaration de catégorie
  par Gemini dans le même appel + comparaison exacte de chaîne contre la
  liste fermée des clés `reco_engine`) plutôt que mots-clés/embedding/second
  appel IA — gratuite, précise, aucun problème technique signalé à son
  retrait (motivé uniquement par le scope produit). Sans objet côté Graphe B
  (carte sœur), qui n'a pas de classificateur.

- [Score IA du lot](issues/03-score-ia-du-lot.md) : on attend d'avoir du
  volume réel (une fois le classificateur reconstruit) avant de calibrer.
  Jamais visible côté client, signal interne seulement. Protocole de
  calibrage accepté (comparer N lots notés IA vs agent `recos`, seuil
  d'accord sur plusieurs semaines) — N et seuil exacts à fixer au moment du
  calibrage, pas maintenant.

- [Seuil d'adhésion](issues/04-seuil-adhesion.md) : indicateur interne
  agrégé seulement (jamais montré à un client), adhésion = `done` vérifié
  contre les sources de données (pas juste auto-déclaré), volume minimum 200
  réactions tous comptes confondus, fenêtre glissante de 8 semaines.

- [Profil client vivant](issues/05-profil-client-vivant.md) : tout regroupé
  (onboarding, objectif, historique reco_feedback/suivi_actions,
  commentaires, avis constats + avis thèmes en deux entrées séparées) ; base
  onboarding fixe, "niveau"/attentes recalculés chaque semaine avec le
  rapport ; branche enfin le pont onboarding → `user_persona.py` ; lu par le
  Graphe A en texte libre dans le prompt du brief IA, niveau de détail
  variable selon le "niveau" du client.

**Tous les tickets (01 à 05) de cette carte sont résolus — la destination
est atteinte. Les deux cartes de cette charte sont maintenant terminées.**

## Not yet specified

- D'autres questions du Graphe A pourraient apparaître une fois le
  classificateur tranché (ex. calibrage fin du seuil de répétition ≥N avant
  qu'une catégorie "news" soit promue) — pas assez net pour un ticket
  aujourd'hui.

## Out of scope

- **Graphe C ("Aller plus loin" / `apprentissage.tsx`)** — **correction
  (6 sept.)** : contrairement à ce qui était écrit ici, il n'est PAS
  "déjà construit" — retiré entièrement le 31 août (`d9c7504`, "cette
  section on a pas besoin"). Reste hors scope des deux cartes : David en
  fera plus tard un effort séparé pour repérer les manques des utilisateurs
  et produire des pages lisibles d'aide/actualités — pas un manque de la
  carte actuelle, une extension future à concevoir de zéro.
