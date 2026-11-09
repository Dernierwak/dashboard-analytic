# 02: Comment le marché présente un compte Google Ads à plusieurs types

Type: research
Status: resolved
Blocked by: —
Assignee: Claude

## Question

Quand un compte Google Ads mêle Search, PMax, Display et YouTube, **comment
les outils de référence structurent-ils la lecture** ?

- **Google Ads lui-même** : la page « Vue d'ensemble », le regroupement par
  type de campagne, les colonnes qui changent selon le type, la place de
  YouTube (rapports vidéo à part ?) ;
- **les gabarits d'agence** : Looker Studio (gabarits Google officiels),
  AgencyAnalytics, Whatagraph, Swydo, DashThis, Supermetrics — vue générale
  puis vue par type ? Un onglet YouTube séparé ? Que font-ils des métriques
  qui n'existent pas pour un type ?
- **ce qui revient partout** et **ce que personne ne fait** — en particulier,
  quelqu'un additionne-t-il les impressions YouTube et Search sans le dire ?

Rester sur la **structure** (quels blocs, dans quel ordre, quel axe de
découpage), pas sur le style graphique. N'en tirer aucun conseil au client :
Pulse ne conseille rien.

## Rendu attendu

Une page de constats sourcés (lien par outil) et un tableau « axe de
découpage » × outil. Findings sur la branche jetable `research/google-marche`,
fichier `.scratch/google-ads/research/marche.md`, poussée sans PR ; pointeur
de contexte ici.

## Answer

Constats sourcés (lus le 2026-11-08 et le 2026-11-09, pages publiques) :
branche `research/google-marche` (`ee52874`),
`git show origin/research/google-marche:.scratch/google-ads/research/marche.md`.

- **Tout le marché commence par une vue générale tous types confondus et
  finit par un tableau par campagne.** Le type de campagne y est un
  **filtre** (Google, AgencyAnalytics, Swydo, DashThis), presque jamais une
  structure ; personne ne pose les quatre types côte à côte par défaut.
- **Google ne découpe pas sa Vue d'ensemble par type mais par étape du
  parcours** — Awareness / Consideration / Action, selon la stratégie
  d'enchère, avec des métriques propres à chaque étape. C'est presque mot pour
  mot le Sélecteur de vue de Meta (Notoriété / Trafic / Conversion) : un
  argument direct pour le ticket 04. Aucun gabarit tiers ne le reprend.
- **PMax, quand il est isolé, se découpe par canal** (Search, Display,
  YouTube, Gmail…) : rapport « canaux » de Google, section conditionnelle de
  Whatagraph.
- **YouTube payant n'a d'onglet nulle part** dans les tableaux Google Ads ;
  seul Swydo en fait un gabarit séparé (découpé par format d'annonce). Les
  gabarits « YouTube » d'AgencyAnalytics et de Supermetrics mêlent la chaîne
  organique et les annonces. **Campagne Vidéo ≠ canal YouTube de PMax**
  (DashThis l'écrit) : si YouTube a sa page, Pulse trace seul cette frontière.
- **Métrique inapplicable à un type : personne ne documente l'affichage.** Le
  seul précédent est Google, qui affiche un **tiret** pour des conversions non
  additionnables et « -- » pour un total qui compterait deux fois.
- **Les chiffres clés du marché additionnent les impressions de tous les
  types sans le dire.** Google additionne clics et vues sous « Interactions »
  mais l'annonce (« l'action principale de chaque format »).
- Non vu : les gabarits Looker Studio officiels (galerie en JavaScript), la
  structure interne des gabarits Supermetrics et DashThis.
