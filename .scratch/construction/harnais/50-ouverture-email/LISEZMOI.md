# Harnais 50 — le relevé d'ouverture de l'email hebdo

```
cd .scratch/construction/harnais/50-ouverture-email && python3.12 test_ouverture.py
```

Ni base, ni secret, ni réseau. **93 vérifications.**

## Ce qu'il prouve

Que ce relevé **ne fabrique jamais le seul chiffre qu'il serait tentant de
fabriquer : « il n'a pas ouvert »**. Aucune entrée ne produit cette conclusion —
ni le silence du fournisseur, ni un événement inconnu, ni un appel raté, ni un
dry-run. Et que les deux faits qui, eux, sont vrais et tranchent vraiment, ne
se rabattent sur rien : un **clic** (un geste, pas un pixel) et un **rebond**
(l'email n'est jamais arrivé).

## Pourquoi une non-ouverture ne prouve rien

Une ouverture est un pixel chargé : bloqué par défaut chez Gmail et Outlook,
préchargé par un volet de prévisualisation, et chez Resend **désactivé par
défaut** tant qu'aucun domaine n'est vérifié. Tant que Pulse envoie depuis
`onboarding@resend.dev`, **aucune ouverture ne remontera jamais** — et ce
silence-là ressemble trait pour trait à celui d'un client qui n'ouvre pas.

D'où un vocabulaire sans valeur « fermée » : `sans_reponse` (« le fournisseur
n'a rien remonté »), `en_route` (« l'envoi n'est pas terminé ») et `inconnu`
(« rien d'exploitable »). Voir `docs/mesures-impossibles.md` et
`docs/adr/0007-…`.

## Les quatre pièges que le harnais tient

**① Un événement inconnu ne tombe pas dans « sans réponse ».** Le jour où Resend
ajoute un nom, le ranger par défaut dans « rien n'est remonté » ferait lire un
fait qu'on vient de RECEVOIR comme une ABSENCE de fait — précisément l'absence
qu'on est en train d'interpréter.

**② Un email parti il y a dix minutes ne se relève pas.** `--force` relancé le
jour même repasse sur le compte quelques minutes après l'envoi. Relever là
écrirait « aucune ouverture remontée » sur un email que personne n'a eu le temps
d'ouvrir — et `releve_a` étant posé, **cette ligne ne se redemande plus jamais**.
Le seuil est à 24 h, testé des deux côtés.

**③ Un horodatage avec fuseau se compare quand même.** Postgres rend
`timestamptz` avec un décalage (`+00:00`) ou un `Z` ; comparer ça à un
`utcnow()` naïf lève `TypeError`, que le `try` de `_relever_ouverture` avalerait
— le relevé ne partirait alors jamais, **en silence**.

**④ Un dry-run n'est pas une non-ouverture.** Sans `message_id`, il n'y a rien à
relire et rien à conclure : un dry-run lu comme un envoi ferait conclure
« jamais ouvert » sur un email qui n'a pas quitté la machine.

**⑤ Un appel raté ne fige pas la ligne.** Écrire sur un `ok: False` poserait
`releve_a` sur une coupure réseau : la ligne serait « demandée » pour toujours,
et une panne de vingt secondes se lirait ensuite comme un client qui n'ouvre
pas.

**⑥ Un fait déjà rangé se relit, il ne se redemande pas.** Un `report_only`
lancé à la main le matin relève et pose `releve_a` ; la récolte qui suit ne
redemande rien, et la ligne rouge garde quand même l'ouverture, relue en base.

**⑦ Mais un SILENCE, lui, se redemande.** C'est le piège que la revue de code a
trouvé, et le plus coûteux : la plupart des ouvertures arrivent **après** le
premier jour. La première version s'arrêtait dès que `releve_a` était posé — un
`label_only` lancé à la main 25 h après l'envoi figeait la semaine sur
« delivered », pour de bon, et la ligne rouge annonçait ensuite « aucune
ouverture remontée » sur un email qui avait bel et bien été ouvert. Seuls
`clique`, `ouvert`, `signale_spam` et `pas_arrive` arrêtent le relevé
(`ETATS_DEFINITIFS`) ; le reste se redemande, au plus une fois par 24 h.

**⑧ Une plainte pour spam n'est pas un rebond.** Marquer un email comme
indésirable prouve qu'il est **arrivé** et qu'un **humain l'a regardé** — la
réponse la plus forte à la question du 47. Le ranger avec `bounced` faisait
imprimer « l'email N'EST PAS ARRIVÉ », donc chercher un problème d'adresse sur
le seul événement qui répondait déjà.

**⑨ Un dry-run n'est pas un envoi réussi.** `send_email` rend `ok: True` en mode
`dry` — « la fonction a fait son travail », pas « l'email est parti ». Recopié
tel quel dans `envoi_ok`, il faisait compter une semaine où rien n'avait quitté
la machine.

**⑩ Un fournisseur qu'on ne sait pas relire ne se relit pas.** `send.py` accepte
un autre fournisseur sans que le reste bouge ; `evenements.py` ne parle qu'à
Resend. Sans garde, le jour où `EMAIL_PROVIDER` change, on redemanderait à
Resend un identifiant qui n'est pas le sien — un 404 par semaine, inexplicable.

Les pièges ⑦ à ⑩ ont été trouvés par `/code-review high` après coup, pas par
le harnais — ils sont tenus par des tests depuis.

## Ce qu'il ne couvre pas

**L'appel HTTP lui-même.** `etat_email` parle à Resend ; le harnais le remplace.
Que Resend rende bien `last_event` sur `GET /emails/{id}` a été lu dans sa
documentation le 2026-09-20, pas observé sur un vrai envoi.

**La ligne rouge imprimée.** Comme au harnais 47, le `__main__` de `fetch_all.py`
ne se rejoue pas hors ligne : le harnais vérifie que `_OUVERTURES` est rempli,
pas que la ligne s'affiche.

**L'écriture en base.** La table `email_envois` n'existe que dans la migration,
personne ne l'a encore jouée. Le harnais vérifie la LIGNE qu'`upsert_envoi_email`
compose (section 5, contre une fausse base), pas que Postgres l'accepte.
