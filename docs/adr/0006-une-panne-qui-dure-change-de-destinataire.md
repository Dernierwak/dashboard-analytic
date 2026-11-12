# Une panne qui dure change de destinataire, pas de volume

Quand la récolte d'un canal échoue **deux rapports publiés d'affilée**, Pulse
n'élève pas le ton vers le client : il **fait finir la run en rouge**, et la
ligne d'échec nomme le compte, le canal, depuis combien de rapports, et jusqu'à
quel jour on a lu. Le destinataire change — c'est David, le seul qui puisse
décrocher son téléphone.

Vers le client, une seule chose change, et c'est le **registre** : la note cesse
de décrire la semaine (« Meta Ads n'a pas répondu cette semaine ») et nomme la
**durée** (« ne répond toujours pas depuis le 22 août »). La durée est le seul
fait **nouveau** qu'on ait ; tout le reste serait la même phrase dans une autre
enveloppe.

## Ce qui a été écarté, et pourquoi

**Un email dédié au client, hors du rapport.** Le client a déjà été prévenu
trois fois au même moment : bandeau ambre en tête du rapport, objet de l'email
réécrit, lien vers la reconnexion. Un quatrième message ne porte aucune
information nouvelle, donc ne change aucune décision — c'est exactement l'échec
que ce ticket vise, reproduit un cran plus haut. Il redeviendra légitime le jour
où on saura si le client **ouvre** l'email (voir « Ce qui manque » plus bas).

**Arrêter d'envoyer le rapport au bout de N semaines.** Refusé à tout N. Un
canal muet peut ne taire **aucun** chiffre : un compte organique dont le Google
Ads est mort reçoit un rapport entier et juste, et le retenir le punirait pour un
canal qu'il n'utilise pas. Même avec `chiffres_tus`, tout le reste du rapport est
vrai. Couper reviendrait à supprimer les parties justes pour protéger d'une
partie déjà honnêtement marquée « — ». L'ADR 0005 tient : retenir ne supprime pas
le silence, il le déplace.

**Construire un canal de notification** (Slack, webhook, page de statut). GitHub
envoie déjà un email d'échec de workflow au propriétaire du dépôt : le tuyau
existe et délivre. En bâtir un autre pour une poignée de comptes serait de
l'outillage d'exploitation avant d'avoir la preuve qu'il en faut un. Le jour où
la run reste rouge toutes les semaines sur un compte que David a décidé de ne
pas relancer, elle redevient du papier peint — **et c'est ce jour-là**, avec la
preuve en main, qu'on rouvrira la question.

**Déconnecter ou archiver la connexion au bout de N semaines.** Ça ressemble à
du ménage et c'est la pire sortie : le canal repasserait de l'état ② (« connecté,
échec ») à l'état ① (« jamais connecté ») de l'ADR 0005, `fetch_canaux_muets`
cesserait de le signaler, et la panne deviendrait invisible pour tout le monde.

## Les trois conditions sans lesquelles le rouge ne vaut rien

**Il est la dernière instruction de la run, jamais une interruption de boucle.**
Tous les comptes sont récoltés, tous les rapports publiés, tous les emails
envoyés — *puis* le code de sortie. Une escalade qui prive un autre compte de son
rapport est un bug déguisé en fonctionnalité.

**La ligne nomme de quoi agir.** Un run rouge qui oblige à ouvrir Supabase pour
savoir qui appeler est un signal qu'on finit par ignorer. Le `mot_de_fin` du
worker y est repris tel quel : il nomme l'exception, jamais la valeur d'un jeton
(`CLAUDE.md` §7).

**Jamais rouge à la première semaine.** Une panne d'une seule semaine se
rattrape toute seule : le prochain passage réussi réécrit la semaine trouée
(ADR 0005). Sonner à la première transférerait simplement le papier peint du
client à David.

## Le compteur, et pourquoi il se compte là et pas ailleurs

Il se compte sur les **rapports publiés**, jamais sur le calendrier.
`fetch_progress` n'a aucun historique — une ligne par (utilisateur, canal),
réécrite à chaque passage — donc il ne sait que le dernier ; en déduire des
semaines consécutives serait un chiffre fabriqué. `weekly_reports` garde une
ligne par semaine avec son `canaux_muets`, et `build_payload` la lit déjà. Le
compteur ne se stocke pas, il se **recalcule** : rien à maintenir, rien à
désynchroniser.

**Une semaine sans rapport publié ne casse pas la série et ne compte pas.** Ses
deux causes — un compte sans données, un worker tombé — ne disent ni l'une ni
l'autre que le canal est revenu. La traiter comme une guérison remettrait le
compteur à zéro précisément sur les comptes les plus cassés.

**Un payload d'avant l'ADR 0005 arrête le compte** au lieu de l'inventer : sans
la clé `canaux_muets`, il ne dit pas « aucun trou », il dit « je ne sais pas
répondre ». La série est alors sous-estimée, jamais surestimée.

## L'escalade est par canal, et les deux destinataires ne voient pas la même chose

La panne est par canal (un jeton par plateforme), le geste est par canal
(« reconnecter Meta », pas « reconnecter »). Agréger au compte lirait « Meta
tombé la semaine dernière, Google tombé cette semaine » comme deux semaines
consécutives — un fait qui n'a pas eu lieu, fabriqué par agrégation.

Le **client** ne voit que les canaux avec `chiffres_tus` : un canal qui ne lui
cache rien ne doit pas l'alarmer. **David** les voit tous — un Google Ads mort
depuis cinq semaines sur un compte organique ne cache rien aujourd'hui et
cassera tout le jour où ce client lancera sa première campagne.

Et le client lit **la date**, jamais le compteur : `depuis` est mesuré, le
compteur n'est qu'un seuil interne qui vaudrait faux dès qu'une semaine n'a pas
été publiée.

## Ce qui manque, et qui rouvrira la question

**~~On ne sait pas si le client ouvre l'email.~~ Répondu le 2026-09-20 par
l'[ADR 0007](0007-l-ouverture-d-un-email-se-mesure-pour-david-jamais-pour-le-client.md)**,
ticket [50](../../.scratch/construction/issues/50-on-ne-sait-pas-si-l-email-est-ouvert.md) :
Pulse relit l'API du fournisseur au passage suivant du worker et range le fait
dans `email_envois`, pour David seul.

Deux conséquences sur cet ADR-ci. **La ligne rouge ne dit plus « le client l'a
vu »** — personne ne l'avait mesuré — mais « l'a **reçu** », et une seconde
ligne porte l'ouverture quand elle a été relevée. Et l'email dédié écarté
ci-dessus **ne redevient pas légitime pour autant** : une non-ouverture ne
prouve rien (pixel bloqué, suivi désactivé par défaut chez Resend), donc elle
ne peut pas servir de condition d'envoi. Ce qui rouvrirait la question, c'est un
**clic** sans reconnexion — la friction du 49, démontrée — ou un **rebond** :
deux faits qui ne dépendent d'aucun pixel.

**Et le pari opposé n'a pas été tranché** : que le frein ne soit pas l'attention
mais la **friction** — reconnecter est un parcours OAuth de plusieurs gestes, et
le lien de l'email arrive sur `/comptes`, pas sur la reconnexion du bon canal.
Aucune escalade ne répare une friction. Suivi au ticket
[49](../../.scratch/construction/issues/49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md).

Tranché avec `vision-produit` le 2026-09-20, au ticket
[47](../../.scratch/construction/issues/47-un-canal-muet-deux-semaines-de-suite.md),
né de l'ADR 0005. Vérifié hors ligne par
`.scratch/construction/harnais/47-escalade-canal-muet/`.
