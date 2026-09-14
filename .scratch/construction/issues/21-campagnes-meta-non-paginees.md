# Les statuts de campagne Meta s'arrêtent à 200, sans pagination

Type: task
Status: resolved

## Question

**Né de la revue de code de [03](03-identifiant-annonce-meta.md)** — pré-existant
au ticket, mais le rejeu d'historique le rend visible.

`_fetch_meta` (`saas/collecte/automatisation/fetch_all.py`) demande les campagnes
avec `"limit": 200` et **ne pagine pas** : `camp.get("data", [])` est lu tel
quel, `paging.next` est ignoré. Au-delà de 200 campagnes, `status_map` est
amputé sans un mot, et `upsert_campaign_statuses` n'écrit un statut que pour les
campagnes qu'il a vues.

C'est le même piège que la note de `CLAUDE.md` §8 sur PostgREST (« plafonne à
1 000 lignes : au-delà, il tronque en silence. Paginer »), sur une autre API.

### Ce que la revue a cru voir et qui est faux

La revue signalait que les lignes d'historique rejouées seraient estampillées
`effective_status = "UNKNOWN"`. **Vérifié : non.** `upsert_meta_ads`
(`saas/commun/insert_data.py`) n'écrit jamais `effective_status` dans
`meta_ads_insights` — le champ ne figure pas dans le dictionnaire envoyé. Il ne
sert qu'à `upsert_campaign_statuses`, qui est une table par campagne, pas par
date. **Le rejeu n'abîme donc aucune ligne historique.**

Ce qui reste vrai : au-delà de 200 campagnes, des statuts manquent, à chaque
récolte — rejeu ou pas.

### Ce qu'il faut faire

Paginer comme `_meta_chunk` le fait déjà (`paging.next`), ou dire explicitement
dans le journal combien de campagnes ont été vues quand la limite est atteinte.
Le silence est le vrai défaut : un statut manquant ne se distingue pas
aujourd'hui d'une campagne sans statut.

### Combien de comptes sont concernés

**Non mesuré** — aucun accès à la base depuis cet environnement (voir le relevé
d'environnement de [03](03-identifiant-annonce-meta.md)). À chiffrer avant de
décider si ça vaut la pagination ou juste un avertissement au journal.

## Answer

**Paginé.** `_meta_campagnes` (`saas/collecte/automatisation/fetch_all.py`) suit
`paging.next` jusqu'au bout et rend `(campagnes, erreur)` — le même contrat que
`_meta_chunk`, et pour la même raison : sans lui, « ce compte n'a que 200
campagnes » et « on s'est arrêté à 200 » se confondent.

**Et le silence est levé, ce qui était le vrai défaut.** `_fetch_meta` imprime
maintenant son compte à chaque passage — `meta: 440 campagne(s) déclarée(s)` —
et, quand la liste est amputée, `meta: liste des campagnes INCOMPLÈTE, 200
campagne(s) vue(s) : liste tronquée à 200 campagne(s) (…)`. La run reste
**verte** : ces statuts ne portent aucune dépense, et une semaine d'insights
vaut plus qu'une liste complète. Les campagnes non vues gardent le statut de la
récolte précédente — `upsert_campaign_statuses` ne touche que les lignes qu'on
lui donne.

**Retiré au passage : `row["effective_status"]`.** Il était posé sur chaque
ligne d'insight et n'était lu par personne (confirmé : `upsert_meta_ads` ne
l'envoie pas). Son seul effet était de fabriquer un `UNKNOWN` pour toute
campagne absente d'une liste tronquée — exactement la confusion que ce ticket
nomme.

## Ce que la revue a trouvé, et qui était plus grave que le ticket

**UN JETON CLIENT SORTAIT PAR CHAQUE ÉCHEC RÉSEAU, ET PAS SEULEMENT DANS LE
JOURNAL.** `requests` construit l'URL complète avant de se connecter et la
**recopie dans son exception** — vérifié sur pièce :

```
ConnectionError : HTTPSConnectionPool(host='graph.facebook.com', port=443):
Max retries exceeded with url: /v24.0/act_42/campaigns?access_token=EAA…
```

Et le curseur `paging.next` de Meta porte le jeton **par construction**. Ce
message ne s'arrête pas au journal de run — public, le dépôt l'est : `_fil` le
range dans `mot`, et `suivi.termine` l'écrit dans `fetch_progress.mot_de_fin`,
que `saas/web/app/actions.ts` et `saas/commun/fetch_data.py` relisent **dans
l'app**. Un membre invité y aurait lu un jeton de `connected_accounts` — ce que
`CLAUDE.md` §7 interdit deux fois (« un message d'erreur nomme la variable,
jamais sa valeur » ; « les jetons ne sont jamais partagés avec un membre
invité »).

`_sans_jeton` masque `access_token` / `refresh_token` / `appsecret_proof` et
laisse le reste du message intact. Posé sur **le goulot** (`_fil` — donc les
quatre canaux, Google compris), et sur les quatre autres endroits qui
impriment une exception réseau : `_meta_chunk` ×2, `_photo_budget`,
`_journal_changements`.

**Trois autres défauts corrigés dans le même geste**, tous trouvés par la revue :

- **Les statuts attendaient une dépense pour s'écrire.**
  `upsert_campaign_statuses` vivait sous le `if rows:` des insights, alors qu'il
  vient d'une autre requête et remplit une autre table. Un compte qui ne dépense
  plus — ou dont toutes les tranches d'insights ont échoué — gardait l'`ACTIVE`
  de sa dernière semaine dépensière, montré comme **courant** par
  `channels.ts` / `couverture.ts`, sur une run verte qui venait d'imprimer le
  nombre de campagnes vues. L'écriture est sortie de la garde.
- **Un curseur qui tourne en rond.** Meta sait rendre une page **vide** qui
  porte encore un `paging.next` : la boucle tournait à 30 s par requête sans
  jamais finir ni rien dire. Plafond de 50 pages — dix mille campagnes — et le
  plafond atteint **se dit** au lieu de tronquer.
- **Une réponse qui n'est pas un objet.** Un proxy peut rendre du JSON valide
  qui n'est pas un dictionnaire ; `data.get` levait alors un `AttributeError`
  **au travers d'une fonction qui a promis de ne pas lever**, emportant tout le
  canal Meta et sa semaine d'insights pour une liste de campagnes.

### Vérifié

Harnais `.scratch/construction/harnais/21-campagnes-paginees/` — **40/40**, ni
base, ni secret, ni réseau (faux Graph API qui pagine comme le vrai, curseur
`next` en URL complète avec jeton, et exceptions qui recopient l'URL comme
`requests` le fait). Il tient : les 440 campagnes remontent ; un compte de 12 ne
paie pas une seconde requête ; une pagination coupée rend ce qu'elle a **et** le
dit ; la 201e campagne reçoit son vrai `PAUSED` ; les insights s'écrivent même
quand la liste des campagnes échoue entièrement ; les statuts s'écrivent même
sans une seule ligne de dépense ; un curseur sans fin s'arrête en le disant ;
une réponse mal formée ne lève pas ; et **aucun message — ni journal, ni
`mot_de_fin` — ne porte le jeton**.

**Quatre propriétés mises à l'épreuve par mutation** : filtre neutralisé (4
vérifications tombent, avec le vrai jeton en clair dans la sortie du harnais),
garde-fou de forme retiré (la run casse), écriture des statuts remise sous
`if rows:` (1 tombe). Les seize autres harnais du dépôt rejoués, tous verts.
`python3.12 -m py_compile` sur `fetch_all.py` et `suivi.py`.

### Ce qui reste non mesuré

**Combien de comptes dépassaient 200 campagnes** — toujours aucun accès à la
base depuis cet environnement. La pagination rend la question sans objet pour la
suite ; elle ne dit pas ce qui a manqué avant.

### Comment on le verra

Rien ne se voit en cliquant : c'est de la récolte. Il faut un **passage du
worker** — le cron du Jour de travail (07:00 UTC) ou un lancement à la main
depuis l'onglet GitHub Actions (`weekly-fetch.yml`). La ligne `meta: N
campagne(s) déclarée(s)` du journal de run est la preuve.

### Ce qui reste ouvert

`_meta_chunk` n'a **pas** reçu de plafond de pages : une tranche de 90 jours sur
un gros compte pèse légitimement des centaines de pages, et un chiffre choisi de
mémoire tronquerait une récolte réelle — exactement le défaut qu'on vient de
corriger, par l'autre bout (`CLAUDE.md` §7 : « un seuil invoqué de mémoire se
vérifie avant d'être invoqué »). À chiffrer sur un vrai compte avant de poser
une borne.
