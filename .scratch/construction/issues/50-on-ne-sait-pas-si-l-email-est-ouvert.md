# On ne sait pas si l'email hebdo est ouvert

Type: task
Status: resolved

## Question

**Né de la réalisation de [47](47-un-canal-muet-deux-semaines-de-suite.md).**

Tout l'arbitrage du 47 — alerter David plutôt que réécrire au client — repose
sur une phrase qu'on ne peut pas vérifier : « le client a déjà été prévenu ». Il
a été prévenu dans un rapport et dans un email. **On ne sait pas s'il les a
ouverts.**

La différence commande la suite :

- si l'email est **ouvert et ignoré**, le problème est la friction du parcours
  de reconnexion (ticket [49](49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md)) ;
- si l'email n'est **pas ouvert**, un email dédié — celui que le 47 a écarté —
  redevient légitime, parce qu'il change alors vraiment quelque chose.

`saas/emailing/send.py` passe par Resend, qui remonte les événements de
délivrance et d'ouverture. C'est le fait le moins cher à acquérir de tout ce
dossier, et le seul qui départage les deux hypothèses.

### Ce qu'il faudrait décider

- Par webhook Resend, ou par lecture de leur API au passage suivant du worker ?
  Le worker ne tourne qu'une fois par semaine, ce qui suffit largement ici.
- Où ranger le fait — une table, ou une colonne sur le rapport de la semaine ?
- **Ce qu'on n'en fait PAS** : un taux d'ouverture affiché au client, ou un
  quelconque chiffre de « performance Pulse » dans son rapport. C'est une mesure
  d'exploitation, pas une information produit.
- Une ouverture d'email n'est pas une mesure fiable (pixel bloqué, prévisualisation
  qui compte comme une ouverture). **Une non-ouverture ne prouve donc rien**, et
  ce qu'on en déduit doit être écrit avant d'être invoqué — candidat pour
  `docs/mesures-impossibles.md`.

---

## Réponse — tranché, réalisé et vérifié le 2026-09-20

**On relit l'API du fournisseur au passage suivant du worker, et le fait sert à
David, jamais au client.** La doctrine complète, avec ce qui a été écarté et
pourquoi, vit à
`docs/adr/0007-l-ouverture-d-un-email-se-mesure-pour-david-jamais-pour-le-client.md`.

Les trois décisions que le ticket demandait :

- **Par l'API, pas par webhook.** Un webhook demanderait une route publique
  dans `saas/web/`, un secret de signature et sa vérification — de
  l'outillage d'exploitation pour un fait qu'on ne consulte qu'une fois par
  semaine, au moment où le worker tourne de toute façon. Même doctrine qu'au
  47 : le tuyau est celui qui existe déjà.
- **Une table, `email_envois`, pas une colonne sur `weekly_reports`.** Le fait
  s'écrit en deux temps à une semaine d'écart (l'identifiant à l'envoi,
  l'événement au passage suivant), et `weekly_reports` est **lisible par le
  client**. `email_envois` a la RLS activée et **aucune policy** : service_role
  seul. Elle est volontairement absente de la section 15 du bundle.
- **Ce qu'on n'en fait PAS** : aucun taux d'ouverture affiché, aucun chiffre de
  « performance Pulse », aucune relance automatique déclenchée par une
  non-ouverture. Écrit dans l'ADR pour que ça ne se re-litige pas.

### La mesure est fausse, et c'est écrit AVANT d'être invoqué

`docs/mesures-impossibles.md` porte maintenant « Si le client a LU son email
hebdo », avec le tableau de ce que chaque événement prouve — et surtout de ce
qu'il ne prouve pas. Une ouverture est un pixel chargé : bloqué par défaut chez
Gmail et Outlook, préchargé par un volet de prévisualisation. **Et chez Resend
le suivi d'ouverture est désactivé par défaut et exige un domaine vérifié :
tant que Pulse envoie depuis `onboarding@resend.dev`, aucune ouverture ne
remontera jamais** — un silence qui ressemble trait pour trait à celui d'un
client qui n'ouvre pas.

D'où un vocabulaire **sans aucune valeur « pas ouvert »** : `clique`, `ouvert`,
`signale_spam`, `pas_arrive`, `en_route`, `sans_reponse` (« le fournisseur n'a
rien remonté ») et `inconnu` (« rien d'exploitable n'est remonté »). Un événement
que le code ne connaît pas tombe dans `inconnu`, jamais dans `sans_reponse`. Et
**un silence n'est jamais définitif** : il se redemande au passage suivant,
parce que la plupart des ouvertures arrivent après le premier jour.

### Les deux faits qu'on aurait perdus en ne regardant que l'ouverture

**Le clic** est un geste, pas un pixel : le lien a été suivi et le canal n'est
toujours pas reconnecté — c'est la démonstration de la friction du
[49](49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md), pas une
intuition. **Le rebond** dit que l'email n'est jamais arrivé : aucune des deux
hypothèses du ticket ne tient alors, et la ligne rouge du 47 qui affirme « le
client a déjà été prévenu » est simplement fausse.

### Ce qui a changé

- `supabase/migrations/email_envois.sql` + section **26** du bundle
  `000_run_me_all.sql`, catalogue de contrôle compris. **Aucun `DROP`, aucun
  `DELETE`.**
- `saas/emailing/send.py` — `send_email` rend `id` à part de `detail` : lire un
  identifiant de base dans une chaîne d'affichage aurait fait dépendre l'un de
  l'autre.
- `saas/emailing/evenements.py` — **nouveau**, troisième fichier du dossier et
  toujours sans Supabase : `etat_email` (HTTP), `etat_ouverture` et
  `phrase_ouverture` (purs).
- `saas/commun/` — `fetch_dernier_envoi_email`, `upsert_envoi_email`,
  `maj_evenement_email`. Aucune ne lève : une mesure d'exploitation ne fait pas
  tomber une récolte.
- `saas/traitement/build_report.py` — `publish_weekly_report` range l'envoi.
  C'est la seule trace qui survit à la run ; le journal disparaît avec elle.
- `saas/collecte/automatisation/fetch_all.py` — `a_relever`, `mot_du_releve`,
  `_relever_ouverture`, appelés dans les **trois** chemins qui publient
  (`report_only` et `label_only` compris, même raison qu'au 47). Le relevé part
  **avant** la publication : sinon la ligne la plus récente serait celle qu'on
  vient d'écrire. Et la ligne rouge du 47 dit désormais « le client l'a **reçu** »
  — « vu » n'avait jamais été mesuré, et c'était la phrase que ce ticket vise.

### Ce que la revue de code a trouvé, et qui n'était pas dans le ticket

Cinq défauts, et **le premier est le plus cher** — il aurait perdu, en silence,
exactement le fait que ce ticket existe pour acquérir.

- **Un silence était traité comme une réponse définitive.** Le relevé s'arrêtait
  dès que `releve_a` était posé. Or la plupart des ouvertures arrivent **après**
  le premier jour : un `label_only` lancé à la main 25 h après l'envoi figeait la
  semaine sur « delivered », pour de bon, et la ligne rouge annonçait ensuite
  « aucune ouverture remontée » sur un email bel et bien ouvert. Seuls
  `ETATS_DEFINITIFS` arrêtent maintenant le relevé ; le reste se redemande, au
  plus une fois par 24 h.
- **Une plainte pour spam était rangée avec les rebonds.** Elle imprimait
  « l'email N'EST PAS ARRIVÉ », donc faisait chercher un problème d'adresse sur
  le **seul événement qui répondait déjà à la question du 47** : marquer un
  email comme indésirable prouve qu'il est arrivé et qu'un humain l'a regardé.
  État propre, `signale_spam`. Et `delivery_delayed`, qui disait « aucune
  ouverture remontée » sur un envoi encore en cours, a le sien : `en_route`.
- **Un dry-run était rangé comme un envoi réussi.** `send_email` rend `ok: True`
  en mode `dry` — « la fonction a fait son travail », pas « l'email est parti ».
  `envoi_ok` le recopiait tel quel, exactement la confusion que la colonne
  existait pour empêcher.
- **La phrase du silence inventait une panne.** `phrase_ouverture(None)` disait
  « rien n'a pu être relu chez le fournisseur » sur un appel qui avait **abouti**
  — elle faisait chercher une coupure réseau là où il n'y a qu'un suivi
  désactivé.
- **Le relevé appelait Resend quel que soit le fournisseur.** `send.py` est écrit
  pour en accepter un autre sans que le reste bouge ; le jour où
  `EMAIL_PROVIDER` change, on aurait redemandé à Resend un identifiant qui n'est
  pas le sien — un 404 par semaine, inexplicable. `FOURNISSEURS_RELISIBLES`
  garde le relevé.

Les cinq sont tenus par des tests (sections 1, 2 et 5 du harnais).

### Vérifié

`.scratch/construction/harnais/50-ouverture-email/` — **93/93**, hors ligne. Les
**18 harnais Python** du dépôt passent (dont les 38/38 du 47), et les **3
harnais TypeScript** aussi. `python3.12 -m py_compile` vert sur les six fichiers
touchés.

**Non vérifié, et il faut le dire :**

- **L'appel HTTP réel.** Que Resend rende `last_event` sur `GET /emails/{id}` a
  été **lu dans sa documentation le 2026-09-20**, pas observé sur un envoi.
- **L'écriture en base.** La migration n'a pas été jouée. Tant qu'elle ne l'est
  pas, les deux écritures échouent proprement (message dans le journal, aucune
  exception) et le relevé ne trouve rien à relire.
- **La ligne rouge imprimée**, comme au 47 : le `__main__` de `fetch_all.py` ne
  se rejoue pas hors ligne.

**Rien de tout ça ne se voit en cliquant** : c'est de la récolte et du
traitement. Il faut **jouer `supabase/migrations/000_run_me_all.sql`**, puis un
passage du worker — le cron du Jour de travail (07:00 UTC) ou un lancement à la
main depuis l'onglet GitHub Actions (`weekly-fetch.yml`). Et le premier relevé
ne peut rien rendre : il n'y aura de ligne à relire qu'au **deuxième** passage
après la migration, un email devant être parti puis avoir vieilli de 24 h.

**Pour que quoi que ce soit remonte un jour**, il faudra en plus **vérifier un
domaine chez Resend et y activer le suivi d'ouverture** — sans quoi la réponse
restera éternellement « aucune ouverture remontée », ce qui ne prouve rien.
