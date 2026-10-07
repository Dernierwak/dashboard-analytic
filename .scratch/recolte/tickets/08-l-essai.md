# 08: L'essai — N éléments, un JSON, rien en base

Type: task
Status: resolved
Blocked by: 07

**What to build:** `class Essai` (`essai.py`). Il appelle **le vrai code** —
les mêmes fichiers d'API, dans l'ordre de `plan.py` — avec `limite=N` et une
fenêtre de 7 jours pour les séries datées. Il écrit un JSON local et
**n'écrit rien en base, ne publie aucun rapport, n'envoie aucun email.**

`python3.12 saas/collecte/essai.py --user <uid> -n 5 [--plateforme meta]`

Le JSON dit, par API : lu ou refusé, combien d'éléments, un échantillon, les
trous. Et un **contrôle de complétude** contre un total que la plateforme
donne elle-même :
- Meta Ads : dépense du compte (`level=account`) = somme des annonces lues
  (sans limite sur cette seule comparaison, sinon elle ne prouve rien) ;
- Instagram : `media_count` = posts inventoriés ;
- Google Ads : coût du `customer` = somme des campagnes ;
- GA4 : sessions sans dimension = somme des lignes source/medium.

Le JSON porte des données client : il s'écrit dans un dossier ignoré par git,
jamais dans l'arbre suivi. Aucun jeton dedans (`sans_jeton`).

- [x] Un essai ne fait aucune écriture Supabase (vérifié : client en lecture
      seule ou faux client qui lève sur toute écriture)
- [x] Le dossier de sortie est dans `.gitignore`
- [ ] Lancé sur un vrai compte, le JSON est collé (sans données client) dans
      ce ticket

## Comment

**2026-10-07 — construit et vérifié hors ligne. Reste à le lancer sur un vrai
compte (en local, avec le `.env` de David) et à coller ici le résumé imprimé
— sans données client.**

```
python3.12 saas/collecte/essai.py --user <uuid>            # 5 par API, toutes plateformes
python3.12 saas/collecte/essai.py --user <uuid> -n 3 --plateforme meta --plateforme instagram
```
Sortie : un résumé dans le terminal (une ligne par fichier d'API, une par
contrôle) et le JSON complet dans `.essais/essai-<uid8>-<horodatage>.json`
(ignoré par git — `.gitignore` racine). Code de sortie 1 dès qu'une API a un
trou ou qu'un contrôle n'est pas « complet ».

Ce qui a été construit :
- `saas/collecte/essai.py` : `class Essai` (lit les connexions, passe par
  `plan.planifier`, appelle chaque fichier d'API avec `limite=N` sur les 7
  jours qui finissent HIER), `LectureSeule` (enveloppe du client Supabase qui
  lève sur upsert/insert/update/delete et sur tout envoi au stockage),
  `resume()`, `main()`.
- Les totaux de contrôle, ajoutés aux fichiers d'API qu'ils vérifient (lecture
  seule) : `meta/ads/insights.py::total_compte` (`level=account`),
  `google/ads/insights_campagnes.py::total_client` (`FROM customer`),
  `google/analytics/insights.py::total_sessions` (aucune dimension) ;
  `instagram/compte.py` demande `media_count` en plus de `followers_count`
  (même requête — le seul changement visible par la récolte).
- `.gitignore` : `.essais/`.

Décisions prises en chemin :
- **La fenêtre s'arrête hier** (`CLAUDE.md` §7) : la journée en cours bougerait
  entre les deux lectures d'un même contrôle.
- **Un contrôle compare ce qui a été lu SANS limite à un total de la
  plateforme** — un échantillon de 5 ne prouve rien sur l'exhaustivité.
- **GA4 peut montrer un écart sans qu'il manque rien** : GA4 regroupe des
  lignes en « (other) » ou applique des seuils de confidentialité sur un
  rapport détaillé. L'essai écrit l'écart, il ne l'explique pas et ne le
  corrige pas. Même prudence pour Meta : un écart peut venir d'annonces
  supprimées ou archivées que `level=ad` ne rendrait pas — à lire sur un vrai
  compte avant d'en conclure quoi que ce soit.
- Un total que la plateforme refuse s'écrit « non vérifiable » avec sa raison,
  jamais un écart nul supposé.
- Pas de rapport, pas d'email : `essai.py` n'importe ni `build_report` ni
  `passage`.

Vérifié — `harnais/08_essai.py` → `TOUT VERT`, contre une fausse API Meta +
Google et une fausse base :
- zéro écriture Supabase sur un essai complet ; `LectureSeule` lève sur
  upsert, delete et téléversement ;
- les 18 fichiers d'API lus, chacun ≤ N éléments, échantillon de 2 ;
- contrôles : Meta complet, Instagram complet (6 = 6), Google complet, GA4
  « ÉCART -2 » ; une dépense de compte plus haute que la somme → « ÉCART -5 » ;
  un total refusé → « non vérifiable : limite » ; `--plateforme meta` ne lit
  que Meta ;
- aucun des trois jetons (Meta, refresh Google, accès Google) dans le JSON.
- `01`, `02`, `05`, `06`, `07` toujours `TOUT VERT` ; meta-ads 04/05/13 → 60
  passed ; `py_compile` et `pyflakes` propres.

Pas vérifié : un vrai compte. C'est la case qui reste.
