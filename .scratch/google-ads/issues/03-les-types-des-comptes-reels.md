# 03: Les types de campagnes des comptes réels

Type: task
Status: open
Blocked by: —
Assignee: —

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
