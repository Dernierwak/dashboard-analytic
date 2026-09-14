# Le rapport se publie sur un canal muet, et l'email part avec

Type: task
Status: resolved

## Question

**Né de la revue de code de [03](03-identifiant-annonce-meta.md).** Le ticket 03
a posé une retenue étroite : si l'écriture Meta est sautée **parce que le schéma
est en retard** (colonne `ad_id` absente, ou contrainte pas encore déplacée), le
rapport de cet utilisateur n'est pas publié et son email ne part pas.

**La raison invoquée vaut bien plus largement que le cas traité.** Un rapport
publié sur une semaine sans dépense Meta présente un trou comme une **baisse** —
un faux verdict, livré au client. Or ce trou a bien d'autres causes que le
schéma, et **aucune** ne retient aujourd'hui la publication :

- jeton Meta expiré (le cas le plus courant — Google le fait déjà chaque semaine
  en statut *Testing*, cf. la note du `map.md`) ;
- Meta répond 500, ou refuse pour limite de débit ;
- n'importe quelle exception du canal, attrapée par `_fil`, qui marque le canal
  « echec » et **laisse la suite se dérouler normalement**.

Dans tous ces cas : `_ECRITURES_SAUTEES` reste vide, `publish_weekly_report`
tourne, `send_email` part, et la run finit **verte**.

### Ce qu'il faudrait décider

Le signal fiable n'est pas « le schéma est en retard », c'est **« le canal n'a
rien écrit alors qu'il aurait dû »**. `_fil` le sait déjà : il rend
`("meta", "meta KO: …")`. La même question se pose pour Google Ads, dont la
dépense compte tout autant dans le ROAS.

**Mais ce n'est pas une correction mécanique, c'est un arbitrage** : un compte
dont le jeton Meta est mort ne recevrait plus AUCUN rapport tant qu'il n'a pas
reconnecté. Est-ce mieux qu'un rapport qui ment sur la dépense ? Probablement
oui — §7 dit qu'une absence de donnée n'est pas un zéro — mais il faut alors que
le client comprenne pourquoi il ne reçoit rien, sinon on a juste déplacé le
silence. Un rapport qui DIT « la dépense Meta manque cette semaine, voici ce
qu'on sait quand même » est peut-être la vraie réponse.

À trancher avec `vision-produit` avant de coder.

### Ce qui est déjà vrai et ne change pas

La retenue étroite livrée par 03 reste : elle couvre le seul cas que 03 a
introduit (le déploiement à cheval sur la migration), et elle est bornée à
l'utilisateur concerné.

> **Cette dernière phrase a été renversée par la réponse ci-dessous**, et c'est
> la seule chose que le ticket avait posée d'avance qui n'a pas tenu. La retenue
> de 03 ne reste pas : elle bascule dans le même régime que les quatre autres
> causes. Garder deux doctrines pour le même fait — « la dépense de la semaine
> n'est pas là » — était le vrai défaut ; la cause du trou ne change rien pour
> le lecteur. `_ECRITURES_SAUTEES` survit, mais seulement pour faire finir la
> run en rouge, plus pour retenir quoi que ce soit.

---

## Réponse — tranché avec `vision-produit` le 2026-09-14, réalisé et vérifié

**On publie toujours, et chaque mesure dont la source est muette vaut `None`**
— jamais 0, jamais une baisse. La doctrine complète, avec ce qui a été écarté
et pourquoi, est dans
`docs/adr/0005-un-canal-muet-fait-taire-sa-mesure-pas-le-rapport.md`.

Le ticket posait le choix entre « retenir » et « publier en le disant » : c'est
**publier en le disant**. Retenir ne supprime pas le silence, il le déplace — et
le rapport est le seul canal par lequel on peut demander une reconnexion.

### Ce que la réalisation a trouvé et que le ticket n'avait pas vu

**Le ROAS ne baisse pas, il GONFLE.** GA4 tourne dans son propre fil et écrit
normalement pendant que Meta ou Google échoue : le revenu reste entier, le
dénominateur est amputé. Le rapport n'a alors pas l'air cassé — il a l'air
excellent, et `scaler` conseille d'augmenter un budget sur un chiffre fabriqué
par une panne. C'est ce cas, et non la baisse apparente, qui a décidé de faire
taire les **conseils payants entiers** et pas seulement les nombres.

**La fenêtre reculait, et le trou se refermait sur lui-même.** L'ancre prend la
dernière donnée toutes sources ; le canal muet y apportait sa date périmée. Sur
un compte **sans Instagram** — celui qui ne fait que de la pub, donc le plus
exposé — c'était la seule source : la fenêtre reculait jusqu'au jour du silence
et le rapport **republiait la semaine précédente** sous sa propre clé. Le client
ne recevait pas un rapport troué : il recevait l'ancien. Trouvé par le harnais,
pas par la relecture.

**`has_data` reconstituait le silence par une autre porte.** Un compte qui ne
fait que du Meta Ads et dont le jeton expire a une dépense de fenêtre à 0, donc
« pas de données », donc aucun rapport et aucun email — exactement ce que ce
ticket supprimait, par un autre chemin.

**Le trou se rattrape tout seul, contrairement à ce qu'on craignait.**
`_depart_recolte` déduit le point de reprise des lignes réellement écrites moins
le recouvrement (7 jours Meta, 30 Google) : le prochain passage réussi réécrit
la semaine trouée. La semaine suivante ne ment donc pas, et **aucune persistance
de schéma n'a été nécessaire**.

### Ce qui a changé

- `saas/commun/fetch_data.py` — `fetch_canaux_muets` lit `fetch_progress`
  (état `echec` du dernier `run_id`). C'est le seul signal fiable : « jamais
  connecté », « échec » et « zéro mesuré » rendent le même nombre de lignes.
- `saas/traitement/lecteur.py` — `canaux_muets()` entre au contrat. Il passe par
  la base et non par un paramètre, pour que `report_only` voie le même trou que
  la récolte complète : un seul chemin, un seul comportement à vérifier.
- `saas/traitement/build_report.py` — `_pub_fenetre` déclare les canaux
  aveugles ; `_kpis_window` tait `spend`/`cpc`/`roas` ; les KPI du compte, la
  dépense hebdo par thème, le verdict et les dix règles payantes se taisent ; le
  payload porte `canaux_muets` ; un canal muet n'ancre plus la fenêtre et ne
  fait plus retomber `has_data`.
- `saas/collecte/automatisation/fetch_all.py` — la retenue de publication est
  retirée. `_ECRITURES_SAUTEES` ne garde que ce qu'il sait vraiment : faire finir
  la run en rouge quand une migration attend.
- `saas/emailing/render.py` — l'objet de l'email change et un bandeau passe
  avant les KPI. Sans ça, l'email est ouvert comme d'habitude et l'absence reste
  invisible : on aurait déplacé le silence.
- `saas/web/components/canal-muet.tsx` + `lib/report.ts` + `app/page.tsx` — le
  bandeau au-dessus des chiffres qu'il explique. Il se vide de lui-même : pas de
  « toutes tes connexions vont bien ✓ » chaque lundi.

### Vérifié

`.scratch/construction/harnais/20-canal-muet/` — **31/31**, `build_payload`
exécuté hors ligne, chaque test avec son témoin sain. Les 51 fichiers de harnais
du dépôt passent. `npx tsc --noEmit` et `npm run build` verts, **19 routes**.

**Rien de tout ça ne se voit en cliquant** : la correction est dans le
traitement et dans la récolte. Il faut un passage du worker — le cron du Jour de
travail (07:00 UTC) ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`). Pour voir le rapport se reconstruire sans re-fetch :
`report_only` avec le `user_id`. Pour rejouer le cas complet, il faut un canal
réellement en échec — donc `force`, en sachant que le trou ne se fabrique pas à
la demande.

### Ce qui en est sorti comme tickets

- [47](47-un-canal-muet-deux-semaines-de-suite.md) — le désaccord de
  `vision-produit` : à la deuxième semaine muette, une note ne suffit plus.
- [48](48-les-tableaux-de-bord-lisent-le-trou-en-direct.md) — les pages `/`,
  `/couts`, `/meta` et `/google` calculent depuis les tables brutes et ont le
  même trou par un autre chemin.
- [41](41-la-fenetre-ne-s-ancre-pas-sur-google.md) — note ajoutée : la garde
  d'ancre ne nomme que Meta, il faudra l'étendre à Google en corrigeant 41.
