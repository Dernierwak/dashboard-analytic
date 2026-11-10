# 03: Les types de campagnes des comptes réels

Type: task
Status: resolved
Blocked by: —
Assignee: Dernierwak

## Question

**Quels types de campagnes les comptes Google Ads réellement connectés à Pulse
utilisent-ils, et quel poids ont-ils ?** Sans ce fait, « regrouper ou
reporter les types secondaires » se tranche à l'aveugle.

La base ne le sait pas : `google_ads_insights` ne porte aucun type. Il faut le
demander à Google.

## À faire

- **AFK si possible** : une requête GAQL en lecture seule, par compte
  connecté — `campaign.advertising_channel_type`,
  `campaign.advertising_channel_sub_type`, `campaign.status`, nombre de
  campagnes, `metrics.cost_micros` sur les 90 derniers jours pleins (jour en
  cours exclu). Les identifiants passent par `saas/config/secrets.py` ;
  **aucun secret dans la sortie** ni dans la conversation (§7).
- **Sinon HITL** : David relève dans l'interface Google Ads, par compte, le
  tableau Campagnes, colonnes Type de campagne et Coût sur 90 jours.
- Le script, s'il est écrit, est jetable : il reste dans `$CLAUDE_JOB_DIR/tmp`
  ou sur une branche `essai/`.

## Rendu attendu

Par compte (anonymisé) : type × nombre de campagnes × part de la dépense.
Aucun nom de client dans le dépôt public.

## Answer

Relevé le 2026-11-10 par une requête GAQL en lecture seule (API v25), lancée
par David depuis son poste ; script jetable hors dépôt. Période : 90 jours
pleins, du 2026-08-12 au 2026-11-09, jour en cours exclu.

**Périmètre** : 1 connexion Google dans `connected_accounts`, 5 comptes
accessibles avec son jeton, dont 1 refusé (`403 PERMISSION_DENIED`) et les
autres réduits à **2 comptes annonceurs distincts** (le reste : gestionnaires
ou doublons). Un seul est le compte choisi dans Pulse.

| Compte | Type | Campagnes (actives / diffusées 90 j) | Dépense 90 j | Part |
|---|---|---|---|---|
| A — choisi dans Pulse, 23 536 CHF | Search | 85 (27 / 18) | 16 192 CHF | 69 % |
| | Performance Max | 17 (15 / 3) | 7 344 CHF | 31 % |
| | Vidéo (sous-type `VIDEO_ACTION`) | 10 (0 / 0) | 0 | 0 % |
| | Display | 40 (0 / 0) | 0 | 0 % |
| | Demand Gen | 7 (2 / 0) | 0 | 0 % |
| B — non choisi, 2 815 CHF | Performance Max | 4 (2 / 2) | 2 406 CHF | 85 % |
| | Search | 8 (2 / 1) | 409 CHF | 15 % |
| | Display | 3 (0 / 0) | 0 | 0 % |
| | Demand Gen | 1 (0 / 0) | 0 | 0 % |

« Actives » = `campaign.status = ENABLED` aujourd'hui ; « diffusées » = au moins
une impression sur la période.

**Ce que ça dit, sans trancher** (les décisions restent aux tickets) :

- Sur ces comptes, **Search et PMax font 100 % de la dépense des 90 derniers
  jours**. Display, Vidéo et Demand Gen existent dans l'historique (Display :
  40 campagnes sur A), mais rien n'a été diffusé sur la période.
- **Aucun Shopping, App, Smart, Hotel ou Local** — ni actif ni archivé.
- **Demand Gen est le seul type « secondaire » présent** : 2 campagnes
  actives sur A, mais sans aucune impression en 90 jours.
- **Vidéo / YouTube** : uniquement du `VIDEO_ACTION` (campagnes vidéo
  orientées conversion), toutes en pause, rien de diffusé — un poids faible
  pour l'essai réel des métriques vidéo et pour la question d'une page à part.
- **Limite** : un échantillon d'un seul utilisateur Pulse, soit deux comptes.
  Ce n'est pas la diversité du marché ; le relevé se refait quand d'autres
  comptes se connectent.
- Le compte refusé en 403 n'est pas lisible avec ce jeton ; à revoir seulement
  s'il doit entrer dans Pulse.
