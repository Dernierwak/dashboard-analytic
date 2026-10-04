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
