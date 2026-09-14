# Harnais 21 — les campagnes Meta paginées

```
cd .scratch/construction/harnais/21-campagnes-paginees && python3.12 test_campagnes_paginees.py
```

Ni base, ni secret, ni réseau. Il fait tourner `_meta_campagnes` et `_fetch_meta`
(`saas/collecte/automatisation/fetch_all.py`) pour de vrai, devant un faux Graph
API qui pagine comme le vrai.

## Ce qu'il prouve

Qu'un compte de plus de 200 campagnes ne perd plus les suivantes, et surtout que
**ce qui manque se dit** : ou bien la liste est entière et le journal donne son
compte, ou bien il nomme combien de campagnes ont été vues et pourquoi il n'y en
a pas plus. Une liste courte a exactement la forme d'un petit compte — sans ce
chiffre, rien ne les sépare dans une run verte.

## Pourquoi un faux Graph et pas un faux Supabase

Le défaut du ticket 21 n'est pas une écriture mal formée, c'est une **lecture
qui s'arrête à la première page**. Ce qu'il faut pouvoir observer, c'est le
nombre de requêtes parties et ce qui revient quand la deuxième échoue — pas une
ligne en base. `FauxGraph.appels` garde toutes les URL vues, et c'est lui qui
tient `test_un_compte_qui_tient_sur_une_page_ne_demande_rien_de_plus`.

Le curseur du faux Graph est une **URL complète avec jeton**, comme celui du
vrai : c'est cette forme-là qui interdit de repasser `params` sur les pages
suivantes, et un curseur simplifié aurait laissé passer l'erreur.

## Les deux cas d'échec ne se confondent pas

`_meta_campagnes` rend `(campagnes, erreur)` — même contrat que `_meta_chunk`,
et pour la même raison. Une première requête refusée rend `([], message)` ; une
pagination coupée au milieu rend **ce qu'elle a** plus un message qui dit
`liste tronquée à N campagne(s)`. C'est le cas traître : la liste n'est pas
vide, elle est amputée, et rendre les 200 premières sans un mot serait le défaut
d'origine avec une excuse en plus.

## Ce que la revue a ajouté au harnais

**Le jeton sortait par chaque échec réseau.** `requests` fusionne les params
dans l'URL avant de se connecter et la **recopie dans son exception** ; le
curseur `paging.next` la porte par construction. Le faux Graph imite les deux :
il fusionne `params` comme `requests` et lève des exceptions dont le message
contient l'URL complète. Sans ça, la fuite serait restée invisible — et elle ne
s'arrête pas au journal public : `_fil` range ce message dans
`fetch_progress.mot_de_fin`, que l'app relit et montre à un membre invité.
C'est `test_le_mot_de_la_fin_d_un_canal_ne_porte_pas_le_jeton` qui tient ce
chemin-là, bout à bout.

**Trois autres propriétés, une par défaut trouvé** : un curseur qui tourne en
rond s'arrête **en le disant** (Meta sait rendre une page vide qui porte encore
un `next`) ; une réponse JSON qui n'est pas un objet **ne lève pas** ; et les
statuts s'écrivent **sans attendre une ligne de dépense** — ils vivaient sous le
`if rows:` des insights, donc un compte qui ne dépense plus montrait l'`ACTIVE`
de sa dernière semaine dépensière comme s'il était courant.

## Ce qu'il a fait tomber au passage

`row["effective_status"]` était posé sur chaque ligne d'insight et **n'était lu
par personne** : `upsert_meta_ads` ne l'envoie pas, le statut vit dans
`meta_campaign_config` (une table par campagne, pas par date). Son seul effet
était de fabriquer un `UNKNOWN` pour toute campagne absente d'une liste
tronquée. Retiré.

## Ce qu'il ne couvre pas

**Combien de comptes dépassaient réellement 200 campagnes** : non mesuré, aucun
accès à la base depuis cet environnement. La pagination rend la question sans
objet pour la suite, elle ne dit pas ce qui a manqué avant.

`_meta_chunk` n'a **pas** de plafond de pages, et n'en reçoit pas ici : une
tranche de 90 jours sur un gros compte pèse légitimement des centaines de pages,
et un chiffre choisi de mémoire tronquerait une récolte réelle. À chiffrer sur un
vrai compte avant de poser une borne.
