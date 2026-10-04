# 20: Le repli par le nom part après l'étape B

Type: task
Status: needs-triage
Blocked by: 13

Le ticket 13 laisse dans `saas/commun/insert_data.py`
(`upsert_campaign_statuses`) un repli de transition : tant que la `997` n'est
pas jouée, l'upsert sur l'ID est refusé en `42P10` et l'écriture retombe sur
l'ancienne clé `(user_id, campaign_name)`, en posant l'ID au passage. Une fois
l'étape B jouée sur la base, ce repli ne peut plus se déclencher : c'est du code
mort, et un `42P10` futur devrait alors remonter tel quel.

- [ ] La `997` est jouée (contrôle recopié au ticket 13)
- [ ] Le bloc `except … 42P10` part, avec son test au harnais 13
- [ ] `python3.12 -m py_compile` et le harnais 13 verts

## Comments

**2026-10-04 — pas commencé : toujours bloqué par 13.** Lu sur la base en
lecture seule (`supabase db query --linked`) :
`meta_campaign_config_pkey` = `PRIMARY KEY (user_id, campaign_name)`, et
**394 lignes sur 394 sans `campaign_id`**. La `997` n'est pas jouée, et le
worker n'a pas encore tourné avec le code du ticket 13 — qui n'est d'ailleurs
pas dans `main`. Retirer le repli aujourd'hui ferait lever `42P10` à chaque
écriture de statut du worker.

À reprendre quand le ticket 13 est `resolved`, c'est-à-dire après ses étapes
« Pour David » : merger, un passage du worker par compte Meta, jouer la `997`,
recopier le contrôle. Le contrôle à refaire alors avant d'implémenter : la PK
doit dire `PRIMARY KEY (user_id, campaign_id)`.
