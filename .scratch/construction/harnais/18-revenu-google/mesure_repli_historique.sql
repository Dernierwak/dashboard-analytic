-- Ticket 18 — LECTURE SEULE. La quatrième option, chiffrée avant d'être discutée.
--
-- `google_ads_insights` garde, pour CHAQUE JOUR récolté, le nom que la campagne
-- portait ce jour-là (`fetch_google_ads.py` l. 191 : camp.get("name")). Après un
-- renommage dans Google Ads, l'historique contient donc encore l'ANCIEN nom —
-- celui-là même que GA4 a enregistré en `utm_campaign` à l'époque, et que la
-- config (qui ne garde que le nom COURANT) a perdu.
--
-- Cette requête compte combien de campagnes aujourd'hui « non rattachables »
-- redeviendraient rattachables si le pont revenu acceptait N'IMPORTE QUEL nom
-- porté par la campagne dans son historique, au lieu du seul nom courant.
-- Elle ne répare rien et ne tranche rien : elle dit ce que l'option vaudrait.

WITH noms_ga4 AS (
    SELECT DISTINCT user_id, trim(lower(campaign)) AS nom
    FROM public.ga4_insights
    WHERE trim(lower(campaign)) <> ''
),
noms_historiques AS (
    SELECT DISTINCT user_id, campaign_id, trim(lower(campaign_name)) AS nom
    FROM public.google_ads_insights
    WHERE trim(lower(campaign_name)) <> ''
),
depense AS (
    SELECT user_id, campaign_id, sum(cost_micros) / 1000000.0 AS chf
    FROM public.google_ads_insights
    GROUP BY user_id, campaign_id
),
etat AS (
    SELECT
        c.user_id,
        c.campaign_id,
        c.label,
        coalesce(d.chf, 0) AS depense_chf,
        -- rattachable aujourd'hui : le nom COURANT de la config est dans GA4
        EXISTS (SELECT 1 FROM noms_ga4 g
                 WHERE g.user_id = c.user_id
                   AND g.nom = trim(lower(c.campaign_name))) AS ok_aujourdhui,
        -- rattachable au repli : UN des noms portés dans l'historique est dans GA4
        EXISTS (SELECT 1 FROM noms_historiques h
                  JOIN noms_ga4 g ON g.user_id = h.user_id AND g.nom = h.nom
                 WHERE h.user_id = c.user_id
                   AND h.campaign_id = c.campaign_id) AS ok_au_repli
    FROM public.google_campaign_config c
    LEFT JOIN depense d
           ON d.user_id = c.user_id AND d.campaign_id = c.campaign_id
    WHERE c.label IS NOT NULL AND c.label <> ''
)
SELECT
    user_id,
    count(*) FILTER (WHERE ok_aujourdhui)                        AS rattachables_aujourdhui,
    count(*) FILTER (WHERE NOT ok_aujourdhui AND ok_au_repli)    AS recuperees_par_le_repli,
    count(*) FILTER (WHERE NOT ok_aujourdhui AND NOT ok_au_repli) AS muettes_quoi_qu_il_arrive,
    round(sum(depense_chf) FILTER (WHERE NOT ok_aujourdhui AND ok_au_repli), 2)
        AS depense_recuperee_chf,
    round(sum(depense_chf) FILTER (WHERE NOT ok_aujourdhui AND NOT ok_au_repli), 2)
        AS depense_muette_chf
FROM etat
GROUP BY user_id
ORDER BY user_id;
