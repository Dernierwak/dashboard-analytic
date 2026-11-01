# L'inventaire de la page hebdo — 2026-10-28

Matière, pas décision. Sorti du ticket « La structure de la page » à sa
clôture.

Photo prise le 2026-10-28 sur `worktree-hebdo-carte` (d5bd3c0). Lecture du
code, pas de capture : rien n'a tourné contre une base, les rendus sont décrits
d'après les composants.

#### 1 · La page `/`, bloc par bloc, dans l'ordre

| # | Bloc | Lit | Ce qu'il rend |
|---|---|---|---|
| 1 | `SetupWizard` | `onboarded`, `jourDeTravail` (pas le payload) | Le fil de mise en place, en tête tant qu'une étape reste ouverte ; `null` ensuite. |
| 2 | `CanalMuetAlerte` | `canaux_muets` | Bandeau au-dessus du verdict quand Meta/Google n'a pas répondu (nom, mot d'erreur, depuis quand, nb de semaines muettes). Vide sinon. |
| 3 | Carte du hero : `TroisDates` | `since`, `until` + `publieLe`, `jourDeTravail` | « fenêtre mesurée · publié le · prochain le ». Repli : `week_label`. |
| 4 | Carte du hero : `Verdict` | `verdict_pct`, `verdict_metric`, `verdict_tone`, `verdict` | L'écart en très grand (52–68 px, vert/rouge/gris, ≈ sous ±0,5 %), la métrique à côté, la phrase dessous. Repli : la phrase seule. |
| 5 | « Ta semaine » : `KpiFocusCard` (la boussole) | `kpi_focus` | UN indicateur en grand, sa valeur vs `precedent`, sa courbe 10 semaines, zones en fond quand l'indicateur en a. **Pilotable** : une rangée de boutons (`useState`) bascule entre ~15 options, groupées Meta Ads / Google Ads / Tes deux régies. |
| 6 | « Ta semaine » : `FriseSemaine` | `frise` | Gantt de deux ans (jan. N-1 → déc. N) : une barre par campagne (plein = dépensé, estompé = récolte arrêtée, pointillé = déclaré/planifié), une bande de posts Instagram (badge format). Semaine du rapport marquée. **Réglage de zoom** (jour/semaine, `useState`), défilement horizontal. |
| 7 | « Ce qui a bougé sur les plateformes » : `Changements` | `changements` + `getChangementsApi(90 j)` (table, hors payload) | Chronologie de faits, défilante (`max-h-[320px]`). Déduits ∪ déclarés, le déclaré gagne (clé jour + canal + campagne). |
| — | États vides | `hasData`, `canauxMuets` | Sans données : `TrouDeRecolte` si un canal a échoué, sinon « Branche une source » → `/comptes`. Sans rapport : titre « Ta semaine en bref. » |

Deux blocs sur trois sont **interactifs** (boussole, frise) : c'est le premier
écart avec « la page est statique » (Notes de la carte).

#### 2 · Ce que `builder.py` publie

| Clé | Contenu | Par plateforme ? | Lue par la page ? |
|---|---|---|---|
| `verdict`, `verdict_pct`, `verdict_metric`, `verdict_tone` | Le **plus grand écart** (en valeur absolue) parmi 3 signaux : engagement IG de la semaine vs **moyenne de tous les posts de l'historique** ; portée moyenne/post vs moyenne historique ; clics Meta vs semaine précédente. Ton ±10 %. | Non — un seul gagnant. NB : le signal « clics publicitaires » est **Meta seul** (`total_clicks`), Google n'y entre pas. | Oui (bloc 4) |
| `metrics_read` | Semaine : `trafic` (sessions GA4), `vues` (IG), `clics` (Meta+Google), `ctr` (Meta+Google). | **Non** — clics/CTR additionnent les deux régies (contraire à ADR 0010). | **Non** |
| `metrics_prev` | Les mêmes 4 sur la semaine précédente. `clics: 0 → None`. Non protégé par le test canal muet sur la fenêtre précédente. | Non | **Non** |
| `metrics_series` | Les 4 sur 10 semaines (`labels` + séries). | Non | **Non** (trafic/vues sont recopiés dans `kpi_focus`) |
| `kpi_focus` | `labels` (10 fins de semaine), `defaut` (selon l'objectif du compte : ventes→ROAS, engagement→eng, notoriété→reach, sinon CTR), `options[]` : `key, titre, unite, direction, valeur, precedent, repere, points[10], bandes[]`. Options : `roas` (revenu GA4 tous canaux / dépense Meta+Google), `eng`, `reach`, `ctr/cpc/spend/clics` × `meta`/`google`, `trafic`, `vues`. Une option n'existe qu'avec ≥ 2 points. | **Oui** pour les 4 indicateurs de régie ; ROAS, trafic confondus par nature. | Oui (bloc 5) |
| `frise` | `debut, fin, semaine_debut, couverture{meta,google,instagram}`, `campagnes[]` (`nom, canal, debut, fin, jours, continu, depense, planifiee?, fin_prevue?`, triées par dépense), `posts[]` (`plateforme, date, type` — **aucune métrique**). | Oui (canal par ligne) | Oui (bloc 6) |
| `changements` | ≤ 40 faits déduits de la dépense quotidienne, 60 jours : `lancee`, `arretee`, `reprise` (+ `detail`), `depense` (saut ±60 %, `detail` « 30 → 75 CHF par jour »), `planifiee`, `jamais_lancee`. | Oui (`canal`, `campagne`) | Oui (bloc 7) — **toute la fenêtre de 60 j**, pas « cette semaine ». |
| `canaux_muets` | `canal, nom, mot, depuis, chiffres_tus, semaines_muettes`, toujours présente. | Oui | Oui (bloc 2) |
| `kpis` | `spend, clicks, ctr` (Meta+Google), `followers_delta, followers_total`. Écrite pour l'email. | Non | **Non** — et aucun code Python ne la lit non plus : clé morte depuis le départ de l'email. |
| `week_label` | « Semaine N · a → b mois · 7 jours pleins » | — | Repli seulement |
| `week_start`, `since`, `until`, `version` | Clé d'écriture, fenêtre. | — | `since`/`until` oui |

**Ce qui est calculé et que personne n'affiche** : `metrics_read/prev/series`,
`kpis`, et les abonnés (`followers_delta/total`, n'existent que dans `kpis` et
dans la phrase du verdict quand |Δ| ≥ 5). La dépense hebdo par plateforme n'est
publiée **nulle part par régie** dans le payload hors `kpi_focus.options`
(`spend:meta`, `spend:google`).

**Ce qui n'existe pas** dans le payload : aucune métrique par post (portée,
engagement — seulement date et format), aucune métrique par campagne hors
dépense et jours, aucun post « à venir » (seules les campagnes ont
`planifiee`/`fin_prevue`), aucune « moyenne du compte » exposée en tant que
telle.

#### 3 · « Face à la moyenne » ailleurs dans le produit

- **Le Croisement** (`/meta`, `lib/meta/lecture.ts` `referenceDe`, e4db505) :
  la moyenne **de la sélection courante** (niveau groupes ou annonces, période
  du Bandeau). Un **rapport** (CTR, CPC, coût/résultat) = celui des totaux,
  pondéré comme la ligne de total d'Ads Manager ; un **volume** (dépense,
  impressions, clics, résultats) = total / nb d'éléments mesurés. Moyenne
  absente → le Croisement le dit au lieu de dessiner. Calculé côté web, sur
  Meta seulement.
- **Le verdict** (§2) : une autre moyenne, **non pondérée** — l'engagement
  moyen de tous les posts de l'historique, posts de la semaine inclus, et les
  posts à portée nulle comptés à 0 %.
- **`/instagram` « Top 3 posts »** (`lib/channels.ts`, `topPosts`) : classé
  par une métrique au choix (`?m=`), sur la fenêtre affichée, repli sur
  l'historique.

Deux définitions de « moyenne » coexistent donc déjà, et elles ne se
ressemblent pas. Le ticket « Ce que veut dire « la moyenne du compte » » doit
en choisir une, pas en ajouter une troisième.

#### Ce que l'inventaire passe aux tickets suivants

- **Les métriques de la semaine face à la précédente** : `metrics_read/prev`
  font déjà ce bloc, mais à 4 métriques confondues Meta+Google et non lues ;
  `kpi_focus.options[].valeur/precedent` le fait par régie. Point de départ
  naturel : la seconde.
- **Le verdict et la boussole dans une page statique** : la boussole bascule
  et la frise zoome. Et les zones de la boussole portent du conseil (« tu peux
  scaler », repère « au-dessus de 3, tu peux augmenter les budgets ») — à
  trancher au regard de « Pulse ne conseille rien ».
- **La vue des campagnes et des posts** : la frise porte déjà campagnes
  passées / en cours / planifiées ; pour les posts, ni métrique ni « à venir ».
  Savoir si les plateformes exposent des posts programmés n'a pas été vérifié.
- **Les changements de la semaine** : la page montre 60 j (déduits) et 90 j
  (déclarés, 30 j réels chez Google), pas la semaine.
- **Le meilleur de la semaine** : un « top » existe pour les posts sur
  `/instagram` ; rien pour les campagnes dans le payload.
