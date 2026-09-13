-- Ticket 18 — LECTURE SEULE, suite de `mesure.sql`.
-- Le détail qui décide : pour chaque THÈME, quelle part de la dépense Google
-- entre au dénominateur du ROAS sans pouvoir apporter son revenu. C'est ce
-- ratio, pas le nombre de campagnes, qui dit si un ROAS de thème est écrasé.

WITH noms_ga4 AS (
    SELECT DISTINCT user_id, trim(lower(campaign)) AS nom
    FROM public.ga4_insights
    WHERE trim(lower(campaign)) <> ''
),
depense AS (
    SELECT user_id, campaign_id, sum(cost_micros) / 1000000.0 AS chf
    FROM public.google_ads_insights
    GROUP BY user_id, campaign_id
),
etiquetees AS (
    SELECT
        c.user_id,
        c.label,
        coalesce(d.chf, 0) AS depense_chf,
        (trim(lower(c.campaign_name)) = '' OR g.nom IS NULL) AS non_rattachable
    FROM public.google_campaign_config c
    LEFT JOIN noms_ga4 g
           ON g.user_id = c.user_id
          AND g.nom = trim(lower(c.campaign_name))
    LEFT JOIN depense d
           ON d.user_id = c.user_id
          AND d.campaign_id = c.campaign_id
    WHERE c.label IS NOT NULL AND c.label <> ''
)
SELECT
    user_id,
    label                                                             AS theme,
    count(*)                                                          AS campagnes_google,
    count(*) FILTER (WHERE non_rattachable)                           AS non_rattachables,
    round(sum(depense_chf), 2)                                        AS depense_google_chf,
    round(sum(depense_chf) FILTER (WHERE non_rattachable), 2)         AS depense_muette_chf,
    round(100 * coalesce(sum(depense_chf) FILTER (WHERE non_rattachable), 0)
              / nullif(sum(depense_chf), 0), 1)                       AS part_muette_pct
FROM etiquetees
GROUP BY user_id, label
HAVING count(*) FILTER (WHERE non_rattachable) > 0
ORDER BY part_muette_pct DESC NULLS LAST;
