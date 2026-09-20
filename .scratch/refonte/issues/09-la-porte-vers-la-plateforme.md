# La porte vers la plateforme : d'où on part, ce qu'on en ramène

Type: grilling
Status: resolved

## Question

Gradué par [06](06-le-parcours-comment-les-pages-se-parlent.md). Dernière étape
du parcours décrit par David : *« il peut aussi analyser rapidement seul la
plateforme sur laquelle il travaille »*. **Elle n'a pas de porte.**

### Le fait

`app/page.tsx` ne contient **aucun lien vers `/meta`, `/google` ou
`/instagram`**. Ses seuls liens sortants vont vers `/labels` (l. 499, 507, 673) ;
tout le reste sont des ancres internes (`#theme`, `#conseils`). On atteint les
trois pages canal uniquement par la barre de gauche — donc en quittant le fil,
sans emporter le contexte de ce qu'on était en train de lire.

C'est un **lien manquant**, pas un bloc manquant : les deux côtés existent et
sont bons, rien ne dit comment on passe de l'un à l'autre.

Ce ticket corrige aussi une erreur du ticket [01](01-etat-des-lieux.md), qui
avait qualifié ces trois pages d'« explorateurs qui ne concluent rien ». David
leur a donné un rôle : elles sont la **sortie** du fil hebdomadaire.

### Ce qu'il faut trancher

- **D'où on part.** D'un thème (« ce thème tourne sur Meta, va voir »), d'un
  chiffre du point général, d'un conseil ? Ou de plusieurs endroits ?
- **Ce que le lien emporte.** La fenêtre de dates ? Le thème en filtre ? Rien ?
  Rappel `CLAUDE.md` §8, piège déjà payé cher : **un lien énumère ce qu'il
  CHANGE, jamais ce qu'il garde** — sinon il perd tout paramètre ajouté après
  lui, en produisant une URL valide. `lib/liens.ts` (`lienDash`) existe déjà et
  est le bon endroit.
- **Ce qu'on en ramène.** Rien (on y va, on revient à la main), une note écrite
  sur place, une action lancée depuis la page canal ? C'est la question qui
  décide si la porte est une sortie ou une boucle.
- **Ce qui manque à ces pages pour tenir ce rôle** — sans redessiner leur
  structure, qui est le sujet du
  [gabarit de plateforme](07-gabarit-de-plateforme.md).

### Ce qui n'est PAS dans ce ticket

La forme d'une page plateforme et le gabarit pour brancher TikTok — c'est
[07](07-gabarit-de-plateforme.md). Ici on décide de la **place de ces pages dans
le fil**, pas de leur contenu.

### Consigne de conduite

Ticket **HITL**. Skills : `ux` (suivre l'action de bout en bout, compter les
clics et les allers-retours), `vision-ux` (hiérarchie), puis `grilling`.

## Answer

### La porte part de la carte du thème, et d'elle seule

**Décision de David (Q1 : a).** Pas depuis un chiffre du point général — il ne
désigne aucune plateforme en particulier, le lien serait vague et un lien vague
ne se clique pas. Depuis un conseil, plus tard.

C'est cohérent avec [07](07-gabarit-de-plateforme.md) : le thème est le rang qui
parle la même langue sur les trois pages, donc c'est par lui qu'on circule.

**La matière existe déjà, rien à calculer.** `ThemeCampaign` (`lib/report.ts`
l. 292-302) porte `channel: "meta" | "google"`, le nom et la clé de chaque
campagne du thème. Une carte de thème peut donc écrire « ce thème tourne sur
Meta — 3 campagnes » sans un chiffre de plus dans le payload.

**Et la destination accepte déjà le contexte** : `label` est un paramètre reconnu
des pages canal (`DashParams`, `lib/channels.ts` l. 31), affiché comme filtre
actif par `FilterBar`. `camp` permet même de pointer une campagne précise.
**La porte est un lien à poser, pas un mécanisme à construire.**

### Le lien emporte le thème ET la fenêtre du rapport

**Décision de David (Q2 : oui, mais…).** Sans la fenêtre, le rapport dit
« 4 520 CHF sur ce thème », la page Meta s'ouvre sur ses 7 jours et affiche
« 103 CHF » — la personne croit à un bug. Le piège classique (une plage libre
qui rend les pastilles de période inertes) est **déjà couvert** : `exclusifs()`
dans `lib/liens.ts` fait que poser une période efface la plage libre et
réciproquement. Les pastilles continuent de marcher après un lien daté.

**Mais David a élargi la réponse au-delà du ticket**, et c'est la vraie
décision : *« le module devrait être visible sur toutes les pages, mais pas
intégré par page. On devrait avoir 1 module et pas ajouter les filtres partout.
Ce module serait pour les filtres qui sont partout, la date par exemple et
labels aussi. »* → ticket [12](12-module-de-commandes.md).

### On ne ramène rien, mais on n'abandonne personne

**Décision de David (Q3 : a).** Écrire depuis une page canal est le sujet du
carnet ([08](08-la-memoire-du-travail.md)) et ne se tranche pas deux fois.

**En revanche, une page canal atteinte depuis un thème dit d'où on vient et
propose d'y retourner.** Sans ça on lâche la personne dans un tableau de
campagnes — le défaut exact que David a nommé au départ de cette carte.

### Instagram devient filtrable par thème

**Décision de David (Q4 : oui), via le module du ticket 12.** Aujourd'hui
`/instagram` ne lit que `m`, `s`, `from`, `to` — pas de thème. Or `ByLabelInsta`
(le bloc « par thème » de la page) existe déjà : **les données sont là**, il
manque le paramètre.

Sans ça le rang 3 de [07](07-gabarit-de-plateforme.md) ne tient pas : le thème
est censé être la langue commune des trois pages et l'une des trois refuse qu'on
lui parle. C'est aussi ce qui débloque la seule chose qu'aucun concurrent lu en
[02](02-sur-quoi-se-differencient-les-autres.md) ne sait faire — **suivre un
thème du payant à l'organique dans un seul geste.**

### Le fait qui a fait naître le ticket 12

`app/page.tsx` n'a aucun lien sortant vers une plateforme (seulement `/labels` et
des ancres internes) — mais surtout, **les deux mêmes filtres existent sur quatre
pages sous trois vocabulaires** :

| Page | Période | Thème |
|---|---|---|
| `/meta`, `/google` | `d` | `label` — un seul |
| `/instagram` | `d` | **aucun** |
| `/couts` | `p` | `l` — plusieurs |

Et les pastilles de période sont écrites deux fois : `PeriodPills`
(`components/channel-dash.tsx` l. 33) et `PeriodPillsInsta`
(`app/instagram/page.tsx` l. 38) — mêmes options, même balisage, deux fichiers.
