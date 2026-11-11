# 09: Instagram mesuré, puis accéléré

Type: task
Status: open
Blocked by: 08

**What to build:** une récolte Instagram plus courte, choisie sur mesure.
Instagram fait ~115 appels sur ~131 par récolte (pavé en tête de
`fetch_all.py`) : c'est le seul vrai levier de durée.

1. Mesurer d'abord (durée, appels, part des images), avec l'essai.
2. Comparer, sans en supposer le gain : quelques fils sur les posts dans le
   canal, ou l'expansion de champs Graph (`media?fields=…,insights.metric(…)`).
   À vérifier : une métrique invalide pour un type de média fait-elle rejeter
   la page entière ?
3. Garder celle qui gagne, mesure avant/après écrite ici.

- [ ] Aucune métrique perdue (mêmes colonnes remplies qu'avant)
- [ ] `python3.12 -m py_compile`
