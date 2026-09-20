# Un canal muet deux semaines de suite n'est plus une note, c'est une relance

Type: task
Status: resolved

## Question

**Né de la réalisation de [20](20-rapport-publie-sur-un-canal-muet.md)**, et
c'est le désaccord que `vision-produit` a posé en rendant son arbitrage.

Le ticket 20 a tranché : on publie le rapport, et chaque mesure dont la source
est muette se tait en nommant le canal tombé. **Ça suffit tant qu'on parle
d'une semaine. Ça ne suffit plus à la troisième.**

Un compte dont le jeton Meta est mort depuis un mois reçoit **quatre rapports
polis qui disent tous la même absence**. C'est du décor : le client s'habitue à
la note comme il s'habitue à un bandeau de cookies, la run reste verte, et
personne ne voit que le compte dérive. On aurait alors remplacé un chiffre faux
par un message que personne n'agit — le même échec, en plus poli.

Le fait est déjà disponible : `fetch_progress` porte l'état `echec` du dernier
passage, et les `weekly_reports` publiés portent `canaux_muets` semaine après
semaine. **Compter les semaines consécutives ne demande aucune récolte de plus.**

### Ce qu'il faudrait décider

À la **deuxième semaine muette consécutive**, autre chose qu'une note dans le
rapport — quelque chose qui sorte du cycle hebdomadaire et qui soit **adressé à
quelqu'un**. Reste à trancher quoi :

- un email dédié, hors du rapport, avec pour seul objet la reconnexion ?
- une alerte à David (run rouge, ou notification) plutôt qu'au client, au moins
  tant qu'il n'y a qu'une poignée de comptes ?
- les deux, à des seuils différents ?

Et la question qui commande les autres : **au bout de combien de temps arrête-t-on
d'envoyer le rapport hebdo**, si on l'arrête ? Le ticket 20 a refusé la retenue
parce qu'elle privait le client du seul message capable de lui demander de
reconnecter. Cet argument s'affaiblit à mesure que le message est ignoré.

À trancher avec `vision-produit` avant de coder.

### Ce qui est déjà vrai et ne change pas

La doctrine du ticket 20 (`docs/adr/0005-un-canal-muet-fait-taire-sa-mesure-pas-le-rapport.md`)
reste : on publie, et chaque mesure se tait si sa source est muette. Ce ticket
n'ajoute qu'une **escalade** au-dessus, il ne revient pas dessus.

---

## Réponse — tranché avec `vision-produit` le 2026-09-20, réalisé et vérifié

**L'escalade change de destinataire, pas de volume.** À la deuxième semaine
muette consécutive, la run finit en **rouge** et la ligne d'échec nomme le
compte, le canal, depuis combien de rapports et jusqu'à quel jour on a lu. Vers
le client, une seule chose change : le **registre** de la note, qui cesse de
décrire la semaine et nomme la **durée** — le seul fait nouveau qu'on ait.

La doctrine complète, avec ce qui a été écarté et pourquoi, vit à
`docs/adr/0006-une-panne-qui-dure-change-de-destinataire.md`. Les trois réponses
qui commandent tout le reste :

- **Le client ne reçoit pas d'email dédié.** Il a déjà été prévenu trois fois au
  même moment (bandeau, objet d'email, lien). Un quatrième message ne porte
  aucune information nouvelle, donc ne change aucune décision — l'échec que ce
  ticket vise, reproduit un cran plus haut.
- **On n'arrête jamais le rapport, à aucun N.** Un canal muet peut ne taire
  **aucun** chiffre : un compte organique dont le Google Ads est mort reçoit un
  rapport entier et juste. L'ADR 0005 tient sans retouche.
- **Le tuyau vers David est celui qui existe déjà** : GitHub envoie un email
  d'échec de workflow au propriétaire du dépôt. Aucun webhook, aucune page de
  statut — pas avant d'avoir la preuve qu'il en faut un.

### Le compteur, et pourquoi il ne coûte rien

Il se compte sur les **rapports publiés**, jamais sur le calendrier.
`fetch_progress` n'a aucun historique (une ligne par utilisateur et canal,
réécrite à chaque passage) : compter des semaines dedans reviendrait à les
inventer. `weekly_reports` garde `canaux_muets` semaine après semaine, et
`build_payload` lisait déjà cet historique — **aucune lecture nouvelle, aucune
migration, rien à stocker.** Le compteur se recalcule à chaque construction.

Une semaine **sans rapport publié** ne casse pas la série et ne compte pas : ses
deux causes — compte sans données, worker tombé — ne disent ni l'une ni l'autre
que le canal est revenu. Un payload d'avant le ticket 20, lui, **arrête** le
compte au lieu de l'inventer : la série est sous-estimée, jamais surestimée.

### Ce qui a changé

- `saas/traitement/build_report.py` — `semaines_muettes(canal, historique)` et
  `SEUIL_ESCALADE`. `_rapports_publies` garde maintenant ses lignes entières
  (`_historique_publie`, `week_start` compris) : déduire un ordre d'une liste
  dont on a jeté la date revenait à faire confiance à l'ordre d'une requête.
  Chaque objet de `canaux_muets` porte `semaines_muettes`.
  `publish_weekly_report` rend désormais `(mot de la fin, canaux muets)` —
  l'orchestrateur a besoin du second, et c'est ici seulement qu'on a le payload
  sous la main.
- `saas/collecte/automatisation/fetch_all.py` — `_CANAUX_QUI_DURENT` et
  `_note_canaux_qui_durent`, remplis par les trois chemins qui publient un
  rapport (`report_only` et `label_only` compris : taire le signal là où on
  vient le chercher le rendrait invisible). Le rouge tombe à la toute fin, et
  **les deux causes de rouge s'impriment toutes les deux avant de sortir** —
  un `sys.exit` sous la première aurait masqué la seconde le jour où les deux
  tombent ensemble.
- `saas/emailing/render.py` — objet et bandeau changent de registre à la
  deuxième semaine et nomment la date. `_jour_fr` découpe l'ISO au lieu de le
  passer par un fuseau, comme `fmtJour` côté web.
- `saas/web/components/canal-muet.tsx` + `lib/report.ts` — la note nomme la
  durée, la liste dit « sans réponse depuis le 5 septembre » au lieu de « lu
  jusqu'au 5 septembre ». **Ambre, toujours pas rouge** : c'est toujours une
  connexion à refaire, pas une catastrophe.

### Ce que le client ne voit jamais

**Le compteur de semaines.** C'est un seuil interne ; ce que le client lit est
`depuis`, qui est mesuré. « Muet depuis 4 semaines » se compte sur les rapports
publiés et vaudrait faux dès qu'une semaine n'a pas été publiée.

**Les canaux qui ne lui cachent rien.** Le client ne voit que `chiffres_tus` ;
David voit tous les canaux muets — un Google Ads mort sur un compte organique ne
cache rien aujourd'hui et cassera tout à sa première campagne.

### Vérifié

`.scratch/construction/harnais/47-escalade-canal-muet/` — **38/38**,
`build_payload` et `email_from_payload` exécutés hors ligne. Les 53 harnais
Python du dépôt passent, et le harnais TypeScript du ticket 46 aussi.
`npx tsc --noEmit` et `npm run build` verts, **19 routes**.

**Non vérifié, et il faut le dire** : la sortie en rouge elle-même. Le harnais
tient ce que `_note_canaux_qui_durent` retient ; le `sys.exit(1)` et le texte
imprimé vivent dans le `__main__` de `fetch_all.py`, qui ne se rejoue pas hors
ligne. Personne n'a encore vu cette ligne s'imprimer.

**Rien de tout ça ne se voit en cliquant** : la correction est dans le traitement
et dans la récolte. Il faut un passage du worker — le cron du Jour de travail
(07:00 UTC) ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`). Pour voir le rapport se reconstruire sans re-fetch :
`report_only` avec le `user_id`. Et il faut un compte **réellement muet depuis
deux rapports publiés** : le compteur se lit dans l'historique, il ne se fabrique
pas à la demande.

### Ce que la revue de code a trouvé, et qui n'était pas dans le ticket

**Une durée mesurée, affichée fausse.** Trois fois le même défaut, à trois
endroits : une phrase écrite pour UN canal, appliquée à la LISTE. Et
`canaux_muets` est trié par clé de canal (« google » avant « meta »), donc le
canal qui déclenche l'escalade n'est presque jamais le premier.

- **L'email datait la panne du mauvais canal.** Google tombé lundi, Meta mort
  depuis sept rapports : l'objet annonçait « ne répond plus depuis le
  18 septembre » — la date de Google, pour une panne de Meta, **raccourcie de
  six semaines**. Le seul fait mesuré de l'email escaladé était faux
  (`CLAUDE.md` §7). Corrigé par `_sans_reponse`, où chaque canal porte sa propre
  date, et par deux groupes de phrases au lieu d'un `any()`.
- **La run rouge disait « le client a déjà été prévenu » quand il ne l'était
  pas.** L'escalade ne filtre pas sur `chiffres_tus` — exprès — mais les deux
  surfaces client, si. Pour la moitié des cas que cette escalade existe pour
  attraper (le canal qui ne tait rien aujourd'hui), le client n'avait **rien**
  reçu, et David en aurait conclu qu'il savait. `vu_par_le_client` le dit
  maintenant ligne par ligne.
- **Le bandeau web se contredisait.** Le titre promouvait le `>= 2` d'un canal
  en phrase sur l'ensemble, pendant que sa propre liste, juste en dessous,
  disait le contraire canal par canal.

Aucun des trois ne se voyait sur un seul canal muet — le cas courant. Les trois
sont tenus par `deux_ages()` dans le harnais.

### Ce qui en est sorti comme tickets

- [49](49-le-lien-de-reconnexion-n-arrive-pas-sur-le-bon-canal.md) — le
  désaccord de `vision-produit` : le frein est peut-être la friction, pas
  l'attention, et le lien arrive sur `/comptes` au lieu du bon canal.
- [50](50-on-ne-sait-pas-si-l-email-est-ouvert.md) — on ne sait pas si le client
  ouvre l'email, et c'est ce qui départage les deux hypothèses.
