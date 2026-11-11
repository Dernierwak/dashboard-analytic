# Carte — La récolte rangée par plateforme

Label: `wayfinder:map`
Chartée le 2026-10-07 sur la demande de David : « revoir la structure du code,
améliorer le fetch », puis trois tours de réponses (par plateforme ; un code
par API ; récolte complète, mise à jour et essai séparés ; jeton vérifié
avant tout).

## Destination

- `saas/collecte/` rangé **par plateforme, puis par canal, puis un fichier par
  API**. Chaque fichier d'API **lit** et ne fait que ça ; l'écriture en base
  vit à part.
- **Trois points d'entrée, trois classes** — `RecolteComplete`, `MiseAJour`,
  `Essai` — qui importent les mêmes fichiers d'API et ne diffèrent que par leur
  fenêtre et ce qu'elles font du résultat.
- **Un jeton mort arrête sa plateforme** jusqu'à la reconnexion, demandée sur
  la page Comptes. La reconnexion relance la récolte, et le trou se rattrape.
- **Aucune tranche refusée ne se perd sans un mot**, et un 429 se réessaie au
  lieu de perdre la tranche.

La carte est finie quand les tickets 01 à 10 sont `resolved`.

## La forme cible

```
saas/collecte/
  socle/
    http.py                 Session, timeout obligatoire, 429/5xx réessayés, sans_jeton()
    fenetre.py              tranches de 90 j, depart_recolte, date_forcee
  meta/
    auth/jeton.py           debug_token : valide ? expire quand ?
    graph.py                pagination Graph unique
    ads/                    comptes · insights · campagnes · budgets · activites · creas · images
    organique/instagram/    compte (abonnés, media_count) · posts (inventaire) · metriques
    organique/facebook/     PAS ENCORE — voir « Décisions »
  google/
    auth/jeton.py           refresh token → jeton d'accès ; mort → à reconnecter
    ads/                    insights_campagnes · insights_annonces · statuts · budgets · changements
    analytics/              insights · evenements · catalogue
  ecriture/                 les upserts, un fichier par plateforme
  plan.py                   quels canaux, dans quel fil (l'ordre des appels est dans chaque recolte.py)
  recolte_complete.py       class RecolteComplete — historique entier, un compte
  mise_a_jour.py            class MiseAJour — le cron : recouvrement seulement
  essai.py                  class Essai — N éléments par API → JSON local, rien en base
  automatisation/           passage.py · fils.py · alarmes.py · suivi.py (ce que les classes partagent)
```

**Le contrat d'un fichier d'API :** `recuperer(jeton, fenetre, limite=None)
-> (lignes, trous)`. Il ne touche pas Supabase. `limite` sert l'essai.

## Notes

**Vérifier.** `python3.12 -m py_compile` sur ce qui a été touché, le harnais
hors ligne du ticket (`.scratch/recolte/harnais/`). La vérification sur les
vraies API se fait avec **l'Essai (ticket 08)**, qui n'écrit rien et n'envoie
rien — **jamais avec `weekly-fetch.yml`**, qui est la vraie récolte de
production : il écrit en base, publie le rapport et ENVOIE l'email au client.
David (2026-10-07) : on teste avant de tout récolter.

**Un déménagement ne change aucun comportement.** Une erreur trouvée en
déplaçant du code devient un ticket, elle ne se corrige pas en chemin.

**Un chemin déplacé laisse des références** : ~40 fichiers citent
`saas/collecte/...`, dont `saas/web/legal/` avec des numéros de ligne. Chaque
déménagement finit avec `git grep` des anciens chemins propre.

## Décisions déjà prises

- **Par plateforme d'abord** : le jeton se partage par plateforme (Meta : Ads +
  Instagram ; Google : Ads + GA4).
- **GA4 se range en `google/analytics/`** : il mesure le site, publicité
  comprise, ce n'est pas de l'organique.
- **Un fichier par API**, lecture seule. L'écriture est séparée : c'est ce qui
  permet l'essai sans un second code.
- **Trois classes distinctes, aucune ne recopie un appel.** David : « des class
  différentes et les fonctions similaires les importent ». Ce qui distingue
  les classes (fenêtre, reprise, écriture ou JSON) vit dans la classe ; ce qui
  appelle une API vit dans le fichier d'API, jamais dans une classe.
- **Le jeton se vérifie avant toute récolte.** Mort → la plateforme est sautée,
  la connexion passe « à reconnecter », rien n'est récolté tant que le client
  ne s'est pas reconnecté. La demande s'affiche **sur la page Comptes**, au
  propriétaire seulement (§7 : un invité ne voit jamais de quoi aller chercher
  les chiffres).
- **Le worker ne refait pas l'auth lui-même** : Meta et Google exigent un clic
  humain. Il ne peut que détecter et demander.
- **La reconnexion relance la récolte, et le trou se rattrape tout seul** : la
  mise à jour part de la dernière date en base moins le recouvrement, donc d'avant
  la panne. Seule exception : `change_event` de Google ne remonte que 30 jours
  — une panne plus longue perd définitivement les changements Google d'avant.
  Ça se dit au client, ça ne se maquille pas.
- **L'essai prend N éléments par API** (5 posts, 5 campagnes…) sur les 7
  derniers jours pour les séries datées, écrit un JSON local, **n'écrit rien en
  base, n'envoie aucun email**. Il compare ce qu'il a lu au total que la
  plateforme donne elle-même (dépense du compte, `media_count`, sessions
  totales) pour dire si tout est pris.
- **Le 429 se gère dans `socle/http.py`** : `Retry-After` respecté, sinon
  attente croissante, nombre d'essais plafonné, puis la tranche est un trou
  nommé. Chez Meta, la limite arrive aussi en HTTP 400 avec un code d'erreur
  (4, 17, 32, 613, 80000–80014 — lus dans la doc au ticket 02) — traitée
  pareil.
- **Pas de Facebook organique pour l'instant.** Rien ne le récolte aujourd'hui,
  et les permissions demandées à Meta (`ads_management`, `pages_show_list`,
  `instagram_basic`, `instagram_manage_insights`, `business_management`) ne
  suffisent pas : il faudrait vraisemblablement `pages_read_engagement` et `read_insights`
  (à vérifier dans la doc Meta avant de le promettre), donc
  une nouvelle revue d'app Meta. Le dossier `meta/organique/facebook/` est
  prévu dans la forme, pas créé. Idée au `BACKLOG.md`.
- **Les noms de canaux en base ne changent pas** (`suivi.CANAUX`).
- **Le socle existe** (ticket 02) : `socle/http.py` réessaie 429, 5xx et les
  limites Meta lues dans la doc (4, 17, 32, 613, 80000–80014), une Session par
  fil ; `socle/fenetre.py` porte les tranches et la reprise.
- **Meta est rangé** (ticket 05) : `meta/graph.py` porte LA pagination ; un
  fichier par API sous `meta/ads/` et `meta/organique/instagram/`, lecture
  seule ; tout ce qui écrit vit dans `collecte/ecriture/` (`meta.py`,
  `plateformes.py`). Le canal (`recolte.py`) enchaîne les deux.
- **Google est rangé** (ticket 06) : `google/auth/oauth.py`, un fichier par
  API sous `google/ads/` et `google/analytics/`, écritures dans
  `ecriture/google.py` ; `build_ga4_context` est dans `saas/traitement/`. Quatre
  fonctions mortes (dont une qui écrivait un fragment de jeton) n'ont pas
  déménagé.
- **`fetch_all.py` n'existe plus** (ticket 07) : `plan.py`, `mise_a_jour.py`
  (`MiseAJour`), `recolte_complete.py` (`RecolteComplete`) ; ce qu'elles
  partagent est dans `automatisation/` (`passage`, `fils`, `alarmes`). La
  récolte complète ne reprend pas en cours de route : tout est upsert, on
  relance. L'essai n'est pas un mode du workflow (dépôt public).
- **L'essai existe** (ticket 08) : `python3.12 saas/collecte/essai.py --user
  UID -n 5`, le vrai code, 7 jours jusqu'à hier, un JSON dans `.essais/`
  (ignoré), aucune écriture (`LectureSeule`), et un contrôle de complétude
  par plateforme contre un total qu'elle donne elle-même.

## Brouillard

- Ce qu'on fait des données d'un compte déconnecté (gardées, masquées,
  supprimées) n'est décidé nulle part.
- Google reste en mode Testing tant que `saas/web/legal/` n'est pas publié :
  chaque refresh token meurt à 7 jours, donc le client devra se reconnecter
  chaque semaine. Le ticket 03 le rend visible ; seul le passage en Production
  le supprime.
