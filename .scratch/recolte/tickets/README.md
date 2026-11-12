# Construction — la récolte rangée par plateforme

Ces tickets construisent ce que la carte (`../map.md`) a décidé. Mêmes
conventions que partout (`docs/agents/issue-tracker.md`). Un ticket se prend
quand tous ceux de sa ligne `Blocked by` sont `resolved`.

Presque tous touchent la récolte au même endroit : ils passent **un par un**,
sauf 04 (web). La restructuration (02, 05, 06, 07, 08) passe d'abord
(David, 2026-10-07 : avancer sur une base propre) ; le jeton (03) se construit
ensuite directement dans `meta/auth/` et `google/auth/`.

## L'ordre

```
01 les trous se disent                  (vérifié hors ligne ; vraies API → Essai, 08)
                                        02, 05, 06, 07, 08 : construits et vérifiés hors ligne (2026-10-07)
01 → 02 le socle (HTTP, 429, fenêtres)
02 → 05 Meta : un fichier par API
05 → 06 Google : un fichier par API
06 → 07 le plan et les trois classes
07 → 08 l'essai (N éléments → JSON)
07 → 03 le jeton se vérifie             (migration à jouer par David)
03 → 04 la page Comptes demande la reconnexion
08 → 09 Instagram mesuré, puis accéléré
05 → 10 Instagram écrit zéro pour une métrique absente (trouvé en chemin, à trier)
```
