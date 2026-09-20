# Le compteur partagé entre les personnes d'un compte

Type: grilling
Status: resolved
Blocked by: 12

## Question

[12](12-module-de-commandes.md) a tranché que la pastille de rappel est
**partagée** : ce qu'une personne traite descend chez toutes. David : *« si une
action est faite, c'est mis en fait, c'est en parallèle, les données sont toutes
pareilles. »* C'est cohérent avec [03](03-le-but-de-pulse.md) — Pulse s'adresse
à une **entreprise**, plusieurs paires d'yeux sur un compte.

**Le stockage ne le permet pas aujourd'hui**, et c'est pour ça que la décision
sort en ticket au lieu d'être glissée dans 12 :

- `suivi_actions` : clé `UNIQUE (user_id, reco_key, decided_at)`, RLS
  `auth.uid() = user_id` sur les quatre opérations.
- `reco_feedback` : clé `UNIQUE (user_id, reco_key, week_start)`, même patron.

Deux personnes du même compte produisent donc deux lignes concurrentes sur un
seul chiffre — et chacune ne voit que les siennes.

### Ce qu'il faut trancher

- **La clé de partage.** Le compte (`owner_id` / le `uid` du dashboard) remplace
  `user_id`, ou on ajoute une colonne compte à côté et `user_id` devient
  l'**auteur** ? La seconde garde qui a fait quoi — et 08 a décidé que le carnet
  porte l'auteur.
- **Ce qu'on fait des lignes existantes.** Elles sont toutes rattachées à une
  personne ; les rattacher au compte est une **écriture sur du stockage
  existant**. `CLAUDE.md` §7 : rien de destructeur sans regarder d'abord, et une
  migration qui touche des lignes se signale.
- **Les politiques RLS.** Deux pièges déjà payés (`CLAUDE.md` §8) : un refus RLS
  sur un `update` ne renvoie **aucune erreur**, il touche zéro ligne — donc une
  action peut répondre « enregistré » sans rien écrire ; et une politique ne voit
  que la ligne d'arrivée, elle ne peut pas interdire de *changer* une colonne.
- **Ce qu'un membre invité a le droit de juger.** Un invité voit les chiffres ;
  peut-il clore une action suivie au nom de l'entreprise ? (`dashboard_members`,
  et la règle des jetons OAuth de §7 ne dit rien de ce cas.)
- **La collision.** Deux personnes jugent la même action à deux minutes
  d'intervalle : la première écrit, la seconde voit quoi ?

### Ce qui n'est PAS dans ce ticket

L'affichage de la pastille — [12](12-module-de-commandes.md), résolu. Ce que le
carnet relit — [08](08-la-memoire-du-travail.md), résolu.

### Consigne de conduite

Ticket **HITL**. Toucher au stockage se propose, ne se glisse pas. Skills :
`grilling` + `domain-modeling`.

### Consigne de repli

Écrire la clé de partage choisie et l'inventaire exact des lignes concernées,
sans écrire la migration.

## Answer

**La prémisse du ticket était fausse : le partage existe déjà et il fonctionne.**
Le ticket a été écrit sur les seules politiques de la section 9 du bundle ; la
section 15 en pose d'autres, et elles changent tout.

### Ce qui était faux, aux trois mesures

1. **`user_id` n'est pas la personne, c'est le compte.** `app/actions.ts` fait
   `const user = { id: compte.uid }` — **43 fois, sans une exception** ;
   `getCompteActif().uid` est le compte *regardé* (`lib/account.ts` l. 145).
   Aucun `auth.getUser()` n'alimente une écriture hors des quatre routes OAuth.
   Le nom `user` est trompeur : la valeur est un compte.
2. **La RLS partage déjà les deux tables.** `suivi_actions` et `reco_feedback`
   sont dans la liste de la section 15 (l. 1590) et reçoivent
   `partage_select USING a_acces(user_id)` +
   `partage_insert/update/delete USING peut_editer(user_id)`. Les anciennes
   politiques « chacun ses lignes » restent, **combinées en OU** — elles
   n'enlèvent rien.
3. **Le compteur de la pastille est déjà partagé** : `getInfosNav(uid)` compte
   sur le compte, pas sur la personne (`lib/account.ts` l. 170-180).

**Donc la clé de partage est déjà le compte, et il n'y a AUCUNE ligne à
ré-attribuer** — avant que le partage existe, personne ne pouvait écrire sur un
compte qui n'était pas le sien : tout l'historique est juste par construction.
La migration que [12](12-module-de-commandes.md) §11 annonçait *« sur du
stockage existant »* n'existe pas. **Les deux premières questions du ticket sont
closes sans geste.**

**Ce qui n'a pas pu être vérifié** : le `.env` racine pointe un projet Supabase
qui ne répond plus (`URLError` sur les trois tables), donc **aucun décompte de
lignes** — seulement l'inventaire par forme. Même relevé qu'en
[25](25-identifiant-annonce-meta.md) : la production tourne sur les secrets
GitHub Actions, pas sur ce `.env`.

### Ce qui restait vraiment ouvert — et qui est tranché

**1. Une note est personnelle, un statut est celui de l'entreprise.** C'est la
règle de fond que David a posée en refusant les deux colonnes : *« on ne
duplique pas ; si une reco change son statut, c'est pour tout le monde, le
nouveau statut. »* Elle se décline partout :

- **`suivi_actions` gagne UNE colonne, `author_id`** (`uuid NULL REFERENCES
  auth.users(id)`), posée à la création et **jamais réécrite**. Elle nomme qui a
  *écrit la ligne*, elle ne suit pas le statut. **Aucun backfill** : les lignes
  existantes n'ont pas d'auteur connu, et y inscrire le propriétaire serait un
  chiffre fabriqué (`CLAUDE.md` §7). Migration additive pure.
- **Le verdict n'a pas d'auteur**, et c'est délibéré. Le statut appartient au
  compte, pas à la personne — cohérent avec 12 (*« deux verdicts sur un seul
  chiffre seraient une contradiction »*). Conséquence assumée : le message de
  collision dit **« déjà marquée faite »** sans nommer personne, parce qu'il n'y
  a rien à nommer.
- **Pas de table neuve.** Une note reste une ligne de `suivi_actions`
  (`kind = 'note'`) : [20](20-a-faire-cette-semaine.md) a tranché *« aucun objet
  neuf »*, et une note et une tâche écrite soi-même sont le même objet dans le
  même rail.

**Cette règle a sa fiche** :
[ADR 0004 — Une note a un auteur, un statut n'en a pas](../../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md).
Elle porte le prix accepté : **on ne saura jamais qui a jugé quoi**, et
l'historique ne sera pas reconstituable si on change d'avis.

**2. Le premier verdict tient.** Défaut mesuré :
`resolveAction` (`app/actions.ts` l. 135-156) fait
`.update(…).eq("id", id).eq("user_id", …)` **sans regarder le statut de départ**
et sans compter les lignes touchées. Deux personnes qui jugent la même action :
la seconde écrase la première et l'interface répond « enregistré » — le piège
de `CLAUDE.md` §8 (un update qui touche zéro ligne ne lève rien) est armé ici.
**L'update se conditionne au statut attendu** (`.eq("status", "running")`) **et
lit le nombre de lignes touchées** : zéro ligne = quelqu'un est passé avant, et
on le dit. Un verdict est un fait daté ; le réécrire décalerait la baseline de
la mesure.

**3. Une note ne s'efface que par son auteur.** Aujourd'hui `deleteNote`
(l. 262-270) ne filtre que sur le compte : n'importe quel `editor` efface la
note de n'importe qui, sans trace. Désormais **l'auteur — ou le propriétaire du
compte — seulement**. C'est ce qui rend `author_id` utile au-delà de
l'affichage. Une **action suivie** reste ouverte à tout `editor` : c'est le
travail de l'entreprise. **Tout le monde sur le compte VOIT les notes de tout le
monde** — déjà vrai sans un geste, `partage_select` suffit.

**4. Les deux rôles restent tels quels — rien à construire.** L'accord
d'écriture existe déjà et il est complet : `/equipe` propose **« Peut agir »**
(*coche les actions, reclasse les campagnes, choisit les priorités*,
présélectionné) et **« Lecture seule »** (`components/equipe-manager.tsx`
l. 6-8), le rôle se change après coup (`changerRoleMembre`), et il est appliqué
à **deux étages** : `peutEditer` à l'écran et `peut_editer()` dans la RLS — un
« viewer » qui trafique son cookie est refusé par la base. Les « accords
d'écriture » que David veut plus tard sont donc **plus fins**, pas absents.
Passer tout invité en lecture seule aurait vidé les décisions 1 à 3 de leur
objet : avec un seul rédacteur possible, aucune collision ni aucun auteur à
nommer.

**5. Les conseils sont écrits pour le propriétaire, et on l'écrit.** Le retour
d'un invité **continue de nourrir le persona** — `reco_feedback` ne gagne aucune
colonne d'auteur. David : *« l'invité peut voir etc., mais les recos sont faites
pour le main user ; cela doit être clair quelque part. »* Une colonne d'auteur
ici n'aurait servi qu'à **jeter de l'information**, et l'information jetée
serait la meilleure qu'on ait : un invité « Peut agir » fait le travail de
l'entreprise, et son « ◇ Trop compliqué » est exactement le signal que
[14](14-le-conseil-facile-et-la-degradation.md) réclame. La phrase se dit à
**deux endroits** :

- **dans le rapport, au-dessus des conseils**, uniquement quand
  `compte.uid !== compte.moi` — là où les conseils sont (12 : *« l'hebdomadaire,
  c'est le cockpit »*). Rien sur son propre compte : du bruit permanent, même
  raison que 08 pour l'affichage de l'auteur ;
- **sur `/equipe`**, pour celui qui invite, puisque c'est là qu'il décide.

Écarté : le sélecteur de compte, qui porte déjà une pastille « invité » /
« lecture seule » (`components/compte-switch.tsx` l. 41) — elle dit de qui sont
les **données**, pas pour qui sont les **conseils**.

### Ce qu'il reste à porter en construction (aucune décision, du travail)

- **Migration** : `ALTER TABLE public.suivi_actions ADD COLUMN IF NOT EXISTS
  author_id uuid REFERENCES auth.users(id)`. Additive, aucun backfill, aucun
  `DROP`/`DELETE`/`UPDATE` sur l'existant. Elle va **avec** la colonne de
  campagne réclamée par [08](08-la-memoire-du-travail.md) §5 et
  [04](04-ce-qui-doit-etre-valide-en-premier.md) : une seule migration, deux
  colonnes.
- `saveNote` écrit `author_id: compte.moi` (**`moi`, pas `uid`** — c'est le seul
  endroit de tout `actions.ts` où la personne compte).
- `deleteNote` et l'édition d'une note filtrent sur
  `author_id = moi OR compte.uid = moi`.
- `resolveAction` se conditionne au statut et compte les lignes touchées ; son
  message nomme le nouveau statut, jamais une personne.
- L'auteur ne s'affiche que sur les comptes à plus d'un membre (08 §5).
- La ligne « ces conseils sont écrits pour X » dans le rapport et sur `/equipe`.

### Ce que gagne `CONTEXT.md`

**Propriétaire** et **Membre** — le compte a un propriétaire, à qui les conseils
s'adressent, et des membres qui voient tout et agissent selon leur rôle.
**Note** gagne son auteur ; **Action suivie** précise que son statut n'en a pas.
