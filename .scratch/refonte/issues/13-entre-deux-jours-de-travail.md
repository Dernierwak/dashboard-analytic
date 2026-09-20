# Entre deux jours de travail : ce qui bouge quand le client n'a plus la main

Type: grilling
Status: resolved

## Question

Gradué par [08](08-la-memoire-du-travail.md), qui a retiré au client les
**quatre** boutons de déclenchement (« ↻ Mes données », « ↻ Recharger mes
conseils », classement IA, catégorisation IA) pour que le **Jour de travail**
soit le seul moment où quelque chose change.

C'est ce qui rend le rapport crédible — aujourd'hui, cliquer « ↻ Recharger » un
samedi quand on a choisi jeudi décale la fenêtre de deux jours et change tous
les écarts sans qu'aucune donnée n'ait bougé. Mais ça ouvre un trou : **le
client qui agit un mardi n'a plus aucun moyen de voir l'effet de son geste.**

### Le fait qui coupe la question en deux

[01](01-etat-des-lieux.md) l'a établi : **le web ne calcule jamais** — les
dashboards de plateforme lisent Supabase directement, le rapport hebdo lit
`weekly_reports`. Ce ne sont donc pas deux fois le même problème :

- **Classer une campagne** change ce que les dashboards montrent
  **immédiatement** — la rétroactivité du classement est vraie par construction
  (jointure à la lecture, aucune date de pose ne filtre), rappel de la carte.
- **Le rapport hebdo**, lui, ne bouge qu'à la publication du worker.

### Ce qu'il faut trancher

- **Ce que le client voit après avoir classé des campagnes un mardi.** Les
  dashboards répondent tout de suite, le rapport non. Est-ce qu'on le dit ? Une
  page qui a changé et un rapport qui n'a pas changé, sans un mot, se lisent
  comme un bug.
- **Le canal qu'on branche en milieu de semaine.** Compte neuf : l'onboarding
  déclenche la première récolte (décidé en 08, atterrit dans
  [10](10-l-entree-premier-ecran.md)). Mais un compte qui existe déjà et
  branche Google Ads un mercredi — il attend son jour ? Il reçoit une récolte
  d'amorçage comme un compte neuf ?
- **Ce qui reste vrai d'un rapport publié il y a quatre jours.** Ses conseils
  portent sur une fenêtre figée ; le client a agi depuis. Est-ce que le rapport
  dit son âge, et à partir de quand il devient trompeur ?
- **Le mode test, côté David.** `PrototypeSwitcher` existe déjà et marche
  (`components/prototype-switcher.tsx`, 77 l., non commité, invisible en
  production via `NODE_ENV`, utilisé sur `/labels`). Est-ce qu'il devient le
  seul chemin pour rejouer un traitement, ou faut-il aussi un déclencheur
  manuel réservé au mode test ?

### Consigne de conduite

Ticket **HITL**. Skills : `ux` (les quatre états, et surtout « chargement » et
« vide »), puis `grilling` + `domain-modeling`. Le mot **Jour de travail** est
défini dans `CONTEXT.md` — ne pas en inventer un autre.

### Consigne de repli

Trancher ce que voit le client qui classe un mardi — c'est le cas le plus
fréquent et le seul qui touche les trois dashboards — plutôt que d'ouvrir le
mode test.

## Answer

**Deux mécaniques, une frontière : ce qui se REGROUPE se recalcule à la lecture,
tout de suite, partout. Ce qui se RÉCOLTE ou se RÉDIGE attend le Jour de
travail.** La question posée par le ticket (« que voit le client qui agit un
mardi ») avait une prémisse trop large : elle traitait toute action comme une
demande de recalcul. David a coupé la question en deux, et c'est cette coupe qui
est la réponse.

> *« Les labels sont ajoutés à la database, donc pas besoin de refetch les
> données. Supabase a l'information […]. Les changements qui se font sur Supabase
> doivent directement se mettre à jour sur l'app. […] Toutes données que nous
> devons récolter — IA reco ou relancer les fetch des données — attendre le jour
> défini. »*

### 1 · Une étiquette est une clé de regroupement, jamais un calcul neuf

Poser un thème ne produit aucune donnée : il change **par quoi on regroupe des
chiffres déjà en base**. Donc tout module qui regroupe par thème se remet à jour
**à la lecture** — nombre de campagnes du thème, dépense du thème, moyennes du
thème — sans worker, sans récolte, sans un seul appel IA.

**C'est déjà vrai sur les dashboards, et c'est du code, pas une intention** :
`lib/channels.ts` l. 653-659 additionne les campagnes par label en TypeScript à
chaque affichage (`lblAgg` → `byLabel: LabelAgg[]`). On classe, la page se
recharge, c'est à jour.

**Ça ne l'est pas sur le rapport**, et le code prétend le contraire :
`setCampaignLabel` (`app/actions.ts` l. 1136) appelle `revalidatePath("/")` avec
le commentaire *« le rapport regroupe les campagnes par thème »* — mais les
blocs par thème du rapport (`themes_focus`, `themes.rows`, `themes_tips`,
`top_recos`) sont du **JSON figé** écrit par le worker. Rafraîchir la page relit
le même JSON. **L'appel est un no-op documenté comme s'il marchait.** C'est le
seul vrai trou de ce ticket, et il est sur la page que David nomme comme la
seule où les thèmes apportent leur plus-value.

### 2 · Ce qui attend le Jour de travail

Tout ce qui exige d'aller chercher une donnée ou de faire écrire l'IA :
récoltes, conseils, pistes de thème, résumé. David : *« les recos IA ne se
referont qu'au prochain fetch, cela reste avec les anciennes recos. »* Les
anciens conseils restent affichés tels quels — ils ne sont pas faux, ils sont
datés (voir 4).

**Trois réglages tombent de ce côté-ci de la frontière**, et David les a traités
un par un : les **priorités** de thèmes, l'**objectif du compte**, les
**catégories de conversions**. Le geste s'enregistre tout de suite, mais son
effet est **daté** : un message dit qu'il sera pris en compte le <jour>. Le
**budget** ne déclenche rien — *« budget reste le même, dépense bouge »*.

### 3 · Rien à annoncer au client qui classe, et pas de mention par carte

Refusé par David, deux fois. Pas de bandeau « mise à jour en cours » : il n'y a
aucun traitement à attendre, juste une page qui relit. Et pas de mention d'âge
sur la carte d'un thème dont les chiffres sont frais et le texte IA plus vieux :
*« on ne dit rien. Le client voit les changements des modules labels, il doit
pouvoir comprendre seul, via l'hebdomadaire. »* La confiance est mise dans **une
seule mention, globale** — celle du point 4 — plutôt que dans une pastille par
bloc.

### 4 · Le rapport annonce TROIS dates, et c'est là que se joue la clarté

*« Le hebdomadaire doit être clair sur le fait que nos données sont de X à X et
seront mises à jour le X. »* Donc, en tête du rapport :

- **mesuré** du <date> au <date> (les 7 jours pleins) ;
- **publié** le <date> ;
- **mis à jour** le <prochain Jour de travail>.

La troisième est la nouveauté et c'est elle qui porte tout le reste : c'est elle
qui rend inutile la mention par carte du point 3, et elle qui répond au client
qui vient de classer. Écarté explicitement : **un rapport ne se déclare jamais
« périmé »** — un rapport de six jours est vieux, pas faux, et rien ne permet de
mesurer à partir de quand il tromperait (§7).

`weekly_reports.updated_at` existe déjà et **`report.ts` ne le lit pas** (l. 590
ne sélectionne que `week_start, payload`). Les trois dates sont donc disponibles
sans rien calculer.

### 5 · Une source branchée en milieu de semaine récolte tout de suite

*« Quand on branche une source, les données sont prises directement, et ensuite
mises à jour le jour que nous voulons avoir pour notre report. »* Un compte
installé qui branche Google Ads un mercredi est traité **comme un compte neuf**
(patron décidé en [10](10-l-entree-premier-ecran.md), « la récolte part à la
connexion ») : les dashboards Google se remplissent dans les minutes, le rapport
l'intègre au Jour de travail. Aucune infrastructure à ajouter — le cron tourne
**tous les matins** (`weekly-fetch.yml`, `cron: "0 7 * * *"`) et `_due_today`
écarte simplement les comptes dont ce n'est pas le jour.

### 6 · Le mode test de David : aucun bouton dans l'app

*« Pas besoin du bouton pour moi. Si on dit par exemple : on va travailler sur
les recos et je veux tester, tu crées un prototype où il y a le bouton de fetch
les données. Mais sinon, sur l'app, pas besoin. »* Deux chemins, zéro code
produit : l'onglet **GitHub Actions** (les cinq entrées `workflow_dispatch`
existent déjà — `force`, `user_id`, `label_only`, `categorize_only`,
`report_only`) et, quand on travaille un sujet, **le prototype porte son propre
bouton**. Écartée : la page de contrôle temporaire — §7 impose de la supprimer
avant le commit, en faire un outil permanent est un contresens.

### Ce que ce ticket CORRIGE au ticket 08

08 a retiré les quatre boutons au client en écrivant que cliquer « ↻ Recharger
mes conseils » un samedi *« change tous les écarts sans qu'aucune donnée n'ait
bougé »*. **C'est faux pour ce bouton-là.** La fenêtre du rapport est ancrée sur
la dernière donnée récoltée, pas sur le jour de fabrication :

```
build_report.py l. 1734 :  last_full_day = min(last_data_date, yesterday)
```

Republier sans récolter rend donc les **mêmes 7 jours et les mêmes chiffres**.
Le bouton qui déplaçait vraiment l'ancre était « ↻ Mes données », qui récolte.
La décision de 08 reste bonne — le client ne déclenche rien — mais **sa raison
était trop large**, et c'est ce qui avait fermé la porte que David vient de
rouvrir : mettre à jour un regroupement ne coûte ni récolte ni recalcul.

### Le piège à connaître si un rapport est republié à la main

`week_start` et le libellé « Semaine N » sont calculés sur **aujourd'hui**
(`build_report.py` l. 2164, `week_start_monday = today - timedelta(days=today.weekday())`),
pas sur la donnée. Republier un rapport dans une **semaine calendaire
différente** de celle de sa publication écrit donc une **nouvelle ligne** et le
renumérote, alors que les chiffres sont identiques. Ça ne concerne plus le
client (il ne déclenche rien) mais ça concerne David et son mode test : la
republication devrait réutiliser le `week_start` du rapport visé au lieu de le
redériver. Noté ici, pas corrigé.

### Trois défauts de rafraîchissement mesurés

Ils sont la conséquence directe du point 1 et se corrigent avec lui :

- `setCampaignLabel` ne rafraîchit **pas** `/couts` — la page des coûts **par
  thème**. Seul `saveBudget` la rafraîchit aujourd'hui (`app/actions.ts` l. 527).
- `setPostLabel` (l. 1141) rafraîchit `/instagram` et `/labels`, **pas** `/`,
  alors que le rapport regroupe aussi les posts par thème.
- `revalidatePath("/")` de `setCampaignLabel` ne peut rien changer tant que les
  blocs par thème du rapport sortent du payload figé (voir 1).

### Ce qui sort en ticket

[17](17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md) — **quels champs d'une carte
de thème se recalculent à la lecture, et lesquels sont des mesures figées.** La
règle est tranchée ; son inventaire champ par champ ne l'est pas, et il porte un
vrai piège : recalculer en TypeScript ce que `build_report.py` calcule en Python,
c'est le défaut à trois moteurs mesuré au ticket
[11](11-d-ou-viennent-les-conseils.md). La carte porte déjà la limite connue —
baselines, snapshots et verdicts de suivi **ne rétroagissent pas**.

### Vocabulaire (écrit dans `CONTEXT.md`)

**Regroupement** — la seule notion neuve de ce ticket, et la frontière que tout
le reste applique.
