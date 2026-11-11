# L'ouverture d'un email se mesure pour David, jamais pour le client

Pulse demande au fournisseur d'emails, **au passage suivant du worker**, ce
qu'est devenu l'email hebdo envoyé la semaine d'avant, et range la réponse dans
`email_envois`. Ce fait sert **à David**, pour décider s'il décroche son
téléphone quand un canal reste muet. Il n'apparaît **sur aucun écran client**,
sous aucune forme.

## Ce qu'on cherchait à savoir, et pourquoi

L'ADR 0006 alerte David plutôt que le client au motif que **« le client a déjà
été prévenu »**. Cette phrase n'était pas mesurée. Elle départage pourtant deux
suites opposées :

- email **ouvert et ignoré** → le frein est la friction du parcours de
  reconnexion, et c'est le ticket
  [49](../../.scratch/construction/issues/49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md)
  qu'il faut prendre ;
- email **jamais arrivé** → ce n'est ni l'attention ni la friction, c'est
  l'adresse ;
- **rien remonté** → on ne sait toujours pas, et c'est la réponse la plus
  probable (voir plus bas).

## Par l'API au passage suivant, pas par webhook

Un webhook demanderait une route publique dans `saas/web/`, un secret de
signature et sa vérification — de l'outillage d'exploitation pour un fait qu'on
ne consulte **qu'une fois par semaine**, au moment où le worker tourne de toute
façon. Même doctrine qu'à l'ADR 0006 : le tuyau est celui qui existe déjà, et on
ne construit le suivant qu'avec la preuve qu'il manque.

Un appel HTTP par compte et par passage, et **un seul** : le relevé fige
`releve_a`, donc il ne se redemande pas. Il ne part pas avant **24 h** après
l'envoi — un `--force` relancé le jour même relèverait sinon un email que
personne n'a eu le temps d'ouvrir, et cette ligne-là ne se redemande plus jamais.

Et il se relève **avant** la publication du rapport du jour, jamais après : on
lit toujours la ligne la plus récente, et publier d'abord en écrirait une neuve.

**On ne relit que ce qu'on sait relire.** `send.py` est écrit pour accepter un
autre fournisseur sans que le reste bouge ; `evenements.py` ne parle qu'à
Resend. Le relevé vérifie donc le `fournisseur` de la ligne avant d'appeler —
sans quoi le jour où `EMAIL_PROVIDER` change, on redemanderait à Resend un
identifiant qui n'est pas le sien, pour un 404 par semaine que personne ne
saurait expliquer.

**Un appel raté ne fige rien.** Écrire sur un échec poserait `releve_a` sur une
coupure réseau : la ligne serait marquée « demandée » pour toujours, et une
panne de vingt secondes se lirait ensuite comme un client qui n'ouvre pas. La
run le dit et n'en conclut rien.

**Un fait déjà rangé se relit, il ne se redemande pas.** Un `report_only` lancé
à la main le matin relève et fige `releve_a` ; la récolte qui suit relit la
colonne au lieu de payer un appel — sans quoi la ligne rouge perdrait
l'ouverture alors qu'elle est en base depuis une heure.

## Une table, pas une colonne sur `weekly_reports`

Le fait s'écrit en **deux temps à une semaine d'écart** : l'identifiant au
moment de l'envoi, l'événement au passage suivant. Une colonne sur le rapport
mélangerait ce que le rapport **dit** avec ce qu'on a appris de son enveloppe.

Et surtout, `weekly_reports` est **lisible par le client** (policy
`select_own`). `email_envois` a donc la RLS activée et **aucune policy** — RLS
active sans policy échoue fermé, seule la clé `service_role` du worker y touche.
Elle est **volontairement absente** de la section 15 du bundle (le partage
d'équipe) : y ajouter une policy de lecture serait revenir sur cette décision,
pas corriger un oubli.

## Ce qu'on n'en fait pas

**Aucun taux d'ouverture affiché au client.** Ni dans le rapport, ni dans un
email, ni sur un écran. C'est une mesure d'exploitation, pas une information
produit : elle ne change aucune décision du client, seulement une décision de
David.

**Aucun chiffre de « performance Pulse ».** Un client qui lit « tu as ouvert 3
de tes 8 derniers rapports » lit un reproche, et un reproche fondé sur une
mesure fausse (voir ci-dessous).

**Aucune relance automatique déclenchée par une non-ouverture.** Une
non-ouverture ne prouve rien : en faire une condition d'envoi enverrait des
relances sur du vide.

## La mesure est fausse, et c'est écrit avant d'être invoqué

Une ouverture est un **pixel chargé**. Un pixel bloqué (le défaut chez Gmail via
son proxy, chez Outlook, sur la plupart des clients mobiles) ne remonte rien
alors que l'email a été lu ; un volet de prévisualisation ou un préchargement
remonte une ouverture que personne n'a voulue. **Une non-ouverture ne prouve
donc rien**, et une ouverture prouve seulement qu'une image a été chargée.

S'y ajoute une condition de configuration : chez Resend, le suivi d'ouverture
est **désactivé par défaut** et exige un **domaine vérifié** avec un
sous-domaine de suivi. Tant que Pulse envoie depuis `onboarding@resend.dev`,
aucune ouverture ne remontera jamais — et ce silence-là ressemble trait pour
trait à celui d'un client qui n'ouvre pas.

D'où le vocabulaire de `saas/emailing/evenements.py`, qui n'a **aucune valeur
« pas ouvert »** : `clique`, `ouvert`, `signale_spam`, `pas_arrive`, `en_route`,
`sans_reponse` (« le fournisseur n'a rien remonté ») et `inconnu` (« rien
d'exploitable n'est remonté »). Un événement que le code ne connaît pas tombe
dans `inconnu`, jamais dans `sans_reponse` : le jour où le fournisseur ajoute un
nom, un fait qu'on vient de recevoir ne doit pas se lire comme une absence de
fait.

**Et un silence n'est jamais définitif.** Seuls `clique`, `ouvert`,
`signale_spam` et `pas_arrive` arrêtent le relevé ; tout le reste se redemande
au passage suivant, parce que la plupart des ouvertures arrivent après le
premier jour. Figer la réponse au premier relevé perdrait systématiquement le
fait cherché — il suffisait d'un `label_only` lancé à la main 25 h après
l'envoi.

La limite complète vit dans
[`docs/mesures-impossibles.md`](../mesures-impossibles.md), écrite **avant**
d'être invoquée (`CLAUDE.md` §7).

## Deux faits qui valent plus que l'ouverture, et qu'on aurait perdus

**Le clic** est un geste, pas un pixel : le lien a été suivi, et pourtant le
canal n'est toujours pas reconnecté. C'est la démonstration de la friction du
ticket 49, pas une intuition.

**La plainte pour spam** (`complained`) est la plus forte des trois, et la plus
contre-intuitive : marquer un email comme indésirable prouve qu'il est **arrivé**
et qu'un **humain l'a regardé**. La ranger avec les rebonds ferait chercher un
problème d'adresse sur le seul événement qui répond déjà à la question.

**Le rebond** (`bounced`, `failed`, `suppressed`) dit que l'email n'est jamais
arrivé. Aucune des deux hypothèses ci-dessus ne tient alors, et la ligne rouge
qui affirme « le client a déjà été prévenu » est simplement fausse.

Ces deux-là ne dépendent d'aucun pixel. Les rabattre sur « ouvert » / « rien
remonté » aurait perdu exactement ce pour quoi ce relevé existe.

## Ce que la run dit maintenant, et ce qu'elle ne dit plus

La ligne d'escalade de l'ADR 0006 disait « le client **l'a vu** dans son rapport
et son email ». Personne ne l'avait mesuré. Elle dit « l'a **reçu** » — ce qui
est vrai, et vérifiable — et une seconde ligne porte l'ouverture **quand elle a
été relevée ce passage-ci**, jamais sinon : imprimer « ouverture inconnue » à
chaque escalade apprendrait à ne plus lire la ligne le jour où elle dit quelque
chose.

Tranché et réalisé le 2026-09-20, au ticket
[50](../../.scratch/construction/issues/50-on-ne-sait-pas-si-l-email-est-ouvert.md),
né de l'ADR 0006. Vérifié hors ligne par
`.scratch/construction/harnais/50-ouverture-email/`.
