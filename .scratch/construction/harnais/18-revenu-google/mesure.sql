-- Ticket 18 — LECTURE SEULE. Aucun UPDATE, aucun DELETE : cette requête compte,
-- elle ne répare rien. À coller dans l'éditeur SQL Supabase (aucun secret ne
-- transite, la session du dashboard suffit).
--
-- Ce qu'elle mesure : combien de campagnes Google ÉTIQUETÉES ne peuvent pas
-- recevoir leur revenu GA4, parce que le pont revenu passe par le NOM
-- (`name2label`, build_report.py ; `rev_by_name`, insights.py) alors que le
-- pont dépense passe par l'IDENTIFIANT (`goog_cfg[campaign_id]["label"]`).
-- Une campagne dans « nom vide » ou « nom introuvable » verse sa dépense au
-- dénominateur du ROAS sans jamais pouvoir verser son revenu au numérateur.
--
-- La normalisation `trim(lower(...))` reproduit `_norm` / `_nrm` du code Python
-- à l'identique — les deux font `str(s or "").strip().lower()`.

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
        c.campaign_id,
        c.label,
        c.campaign_name,
        coalesce(d.chf, 0) AS depense_chf,
        CASE
            WHEN trim(lower(c.campaign_name)) = ''        THEN 'nom vide'
            WHEN g.nom IS NULL                            THEN 'nom introuvable dans GA4'
            ELSE 'rattachable'
        END AS etat
    FROM public.google_campaign_config c
    LEFT JOIN noms_ga4 g
           ON g.user_id = c.user_id
          AND g.nom = trim(lower(c.campaign_name))
    LEFT JOIN depense d
           ON d.user_id = c.user_id
          AND d.campaign_id = c.campaign_id
    WHERE c.label IS NOT NULL AND c.label <> ''
)

-- 1) Le compte global, par utilisateur et par état
SELECT
    user_id,
    etat,
    count(*)                    AS campagnes,
    round(sum(depense_chf), 2)  AS depense_chf
FROM etiquetees
GROUP BY user_id, etat
ORDER BY user_id, etat;
