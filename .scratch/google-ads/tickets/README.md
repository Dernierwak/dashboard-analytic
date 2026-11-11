# Tickets de construction — La page Google Ads

Découpage de la [spec](../spec.md), approuvé par David le 2026-11-11. Ces
tickets construisent ; les tickets de décision de la carte vivent dans
`../issues/` (numérotation distincte).

**Stratégie** : tranches verticales, aucune expand–contract. Le 01 remplace la
page `/google` sur les colonnes déjà en base ; chaque ticket suivant ajoute une
couche complète (récolte → lecture → écran). **Les branches partent de
`main`**, pas de `google-ads-carte` (189 commits de retard au 2026-11-11).
Deux seams, ceux de la spec : récolte « réponse Google → lignes à écrire »,
page « lignes de base + commandes → contenu des modules ». Chaque ticket écrit
son harnais sous `.scratch/google-ads/harnais/<NN>-<slug>/` (`CLAUDE.md` §9).

## Ordre de construction

| # | Ticket | Bloqué par | Couches |
|---|---|---|---|
| 01 | [La page Google neuve : Bandeau, Sélecteur, Tendance](01-la-page-google-neuve.md) | — | lecture, page |
| 02 | [Le type de campagne, en API v26](02-le-type-de-campagne-en-v26.md) | 01 | schéma, récolte, page |
| 03 | [La valeur de conversion et le ROAS](03-la-valeur-de-conversion-et-le-roas.md) | 02 | schéma, récolte, lecture, page |
| 04 | [Le Tableau détaillé](04-le-tableau-detaille.md) | 02 | lecture, page |
| 05 | [Les Groupes d'éléments PMax](05-les-groupes-d-elements-pmax.md) | 04 | schéma, récolte, lecture, page |
| 06 | [Les points de changement et le Panneau du jour](06-les-points-de-changement-et-le-panneau-du-jour.md) | 01 | récolte (catégories), lecture, page |
| 07 | [La Comparaison, variante A](07-la-comparaison-variante-a.md) | 04, 05 | lecture, page |
| 08 | [Lire une annonce](08-lire-une-annonce.md) | 06, 07 | schéma, récolte, lecture, page |
| 09 | [Les Groupes de termes, mode Mots-clés](09-les-groupes-de-termes-mots-cles.md) | 02 | schéma, récolte, lecture, page |
| 10 | [Les Groupes de termes, mode Clusters Google](10-les-groupes-de-termes-clusters.md) | 09 | schéma, récolte, lecture, page |
| 11 | [Reprise de l'historique et contrôle bout à bout](11-reprise-et-controle-bout-a-bout.md) | tous | vérification |

**Frontier de départ** : 01. Puis 02 et 06 en parallèle. Après 02 : 03, 04 et
09 peuvent avancer de front, **mais 03, 05, 08, 09 et 10 touchent tous le
parcours de la récolte Google** (l'ordre des appels et ce qui s'écrit) — jamais
deux de ceux-là en même temps, ou un seul agent pour les enchaîner. Trois
agents au plus (`CLAUDE.md` §5).

**Décision attendue de David** : bucket public ou privé pour les images
d'annonces (bloque la partie images du 08 ; même question que Meta).
