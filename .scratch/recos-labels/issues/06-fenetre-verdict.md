Type: grilling
Status: resolved
Blocked by: 03

## Question

Diagnostic de l'agent `recos` (7 septembre 2026, à la demande de David — des
recos qui semblent inchangées d'une semaine à l'autre) : `FENETRE_LEVIER`
(la date où le verdict est calculé et écrit — 7 jours pour contenu/tempo,
14 jours pour argent/audience) et `ATTENTE_MIN_NOUVELLE_HYPOTHESE` (la date
où le blocage du ticket 03 se lève — 14 jours pour contenu/tempo, 21 jours
pour argent/audience) sont deux compteurs différents, et le second est
toujours plus long que le premier.

Concrètement, pour un levier "contenu" : le verdict tombe à J+7, mais la
carte reste épinglée jusqu'à J+14 quand même. Il y a donc systématiquement
une semaine — parfois deux (argent/audience : verdict à J+14, déblocage à
J+21) — où le système **sait déjà** si l'hypothèse a marché ou pas, et
continue pourtant d'afficher exactement la même carte sans le dire. C'est
une semaine d'attente vide, pas de la patience : le produit a l'information
et ne s'en sert pas.

Faut-il débloquer sur le verdict plutôt que sur (ou en plus de) le
calendrier ? Et si oui, un verdict négatif doit-il redémarrer immédiatement
une nouvelle hypothèse, ou observer un délai de « digestion » avant d'en
proposer une autre ?

## Answer

Décision de David (grill du 7 septembre 2026) :

1. **Le blocage se lève dès qu'un verdict est tombé**, quel que soit le
   nombre de jours écoulés — le verdict prime sur le calendrier, pas
   l'inverse. Vérification : `suivi_actions.verdict` non nul pour ce
   `(theme, reco_key)`, déjà exposé par `fetch_reco_verdicts` (dict
   `verdicts`, déjà chargé dans `build_payload`).
2. **`ATTENTE_MIN_NOUVELLE_HYPOTHESE` devient un plafond de secours**, pas
   un plancher : il ne s'applique plus que tant qu'AUCUN verdict n'est
   encore arrivé (retard de mesure, ligne `suivi_actions` pas encore
   traitée). Les durées elles-mêmes (14/14/21/21 jours) ne changent pas —
   seul leur rôle change.
3. **Pas de délai de digestion** après un verdict négatif : aucun signal
   réel ne justifie une deuxième règle aujourd'hui. Une nouvelle hypothèse
   peut être proposée dès le rapport suivant.

Codé le 7 septembre 2026 dans `build_report.py` (constante
`ATTENTE_MIN_NOUVELLE_HYPOTHESE`, bloc « BLOCAGE : PAS DE NOUVELLE HYPOTHÈSE
AVANT SON VERDICT ») : `py_compile` vert. Pas de nouvelle table, pas de
nouvel appel réseau — `verdicts` était déjà chargé.
