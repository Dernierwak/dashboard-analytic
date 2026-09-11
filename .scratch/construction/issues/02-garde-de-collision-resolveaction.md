# La garde de collision : le second verdict écrase le premier, et l'écran dit « enregistré »

Type: task
Status: resolved

## Question

**Défaut mesuré par [16](../../refonte/issues/16-compteur-partage.md)**, et c'est
le piège de `CLAUDE.md` §8 armé en vrai : *« un refus RLS sur un `update` ne
renvoie aucune erreur — il touche zéro ligne »*.

`resolveAction` (`saas/web/app/actions.ts` l. 135-156) **ne regarde pas le statut
de départ** et **ne compte pas les lignes touchées**. Sur un compte à deux
personnes, le second verdict écrase le premier et l'écran répond « enregistré »
sans que rien n'ait été vérifié.

La règle que David a posée en refusant les deux colonnes de 16 :
> *« on ne duplique pas ; si une reco change son statut, c'est pour tout le
> monde »*

D'où la décision de 16 : **le premier verdict tient.**

### Ce qu'il faut faire

- Rendre l'`update` conditionnel au statut de départ, et **compter les lignes
  touchées**. Zéro ligne = collision, pas succès.
- Le message de collision dit **« déjà marquée faite » sans nommer personne** —
  décision de 16, adossée à
  [ADR 0004](../../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md) :
  *une note a un auteur, un statut n'en a pas.* Le prix est accepté : on ne saura
  jamais qui a jugé quoi. **Ne pas nommer quelqu'un pour améliorer le message.**
- Chercher le même défaut sur les voisines : toute action qui fait un `update`
  sans lire son compte de lignes porte le même piège.
- **Une note ne s'efface que par son auteur** (aujourd'hui n'importe quel
  `editor` efface celle de n'importe qui) — mais **tout le monde les voit**, ce
  qui est déjà vrai sans un geste. Cette moitié-là dépend de la colonne
  `author_id` du ticket **05** : si elle n'est pas encore en base, le dire et
  laisser la garde de statut seule.

### Ce qui n'est PAS dans ce ticket

La colonne `author_id` et la colonne de campagne — ticket **05**, une seule
migration. Les deux rôles « Peut agir » / « Lecture seule » existent déjà, à deux
étages (écran *et* RLS) : **rien à construire** (16).

### Consigne de repli

Livrer la garde de statut seule, vérifiée, plutôt que la garde plus la
suppression par auteur à moitié.

## Answer

**La garde de statut est posée et vérifiée à la compilation ; la suppression
d'une note par son auteur ne l'est pas — `author_id` n'existe nulle part.**
Repli appliqué tel qu'écrit dans le ticket.

### Ce qui est fait — `resolveAction` (`saas/web/app/actions.ts`)

L'`update` est **conditionné au statut de départ** et **lit les lignes
touchées**. Deux morceaux qui ne valent que l'un par l'autre :

- `.in("status", DEPART_ADMIS[action])` — la garde ;
- `.select("id")` — ce qui la rend visible. Sans `returning=representation`,
  PostgREST ne dit **pas** combien de lignes il a touchées, et un `update` qui
  n'en touche aucune ressort sans erreur (`CLAUDE.md` §8). Ajouter le `.in(…)`
  sans le `.select(…)` aurait remplacé un écrasement silencieux par un **refus**
  silencieux — strictement pire.

Les départs admis sont **exactement** ceux depuis lesquels l'écran propose le
geste, pas un de plus :

| geste | départs admis | d'où ça vient |
|---|---|---|
| « ✓ Je l'ai fait » | `running`, `auto` | `rail-actions.tsx` : `vivantes` |
| « ✓ Vu — je range » | `done`, `auto` | `action-vivante.tsx` : `aJuger` |
| « × j'abandonne » | `running`, `done`, `auto` | bouton toujours offert |

**Le message ne nomme personne** (ADR 0004) : il nomme l'**état**. Et il ne
l'invente pas — sur zéro ligne, on **relit le statut réel** avant de parler, un
« déjà faite » affirmé sans lecture serait un fait fabriqué (§7). Trois sorties
possibles :

- la ligne existe → *« Rien enregistré : cette action est déjà marquée faite —
  le premier verdict l'emporte. Recharge la page pour voir où elle en est. »*
  (`déjà rangée` / `déjà abandonnée` selon le statut lu) ;
- la ligne n'existe plus — `startTracking` en toggle-off la supprime →
  *« Cette action n'est plus dans ton suivi — recharge la page. »* ;
- une vraie erreur PostgREST → le message d'échec d'avant, inchangé.

**`reco_feedback` n'est plus écrit sur un geste refusé.** Le `reaction = "done"`
était dans la branche `else`, donc après un `update` qu'on ne regardait pas :
une collision aurait quand même dit à l'IA que le conseil avait été appliqué. Il
est maintenant derrière le retour anticipé.

**Pourquoi pas de `revalidatePath` sur la collision.** `ActionVivante` est
montée avec `key={id:status}` (`rail-entree.tsx` l. 70) pour que son état local
ne survive pas à un rafraîchissement. Rafraîchir sur la collision la remonterait
à neuf et **effacerait le message qu'on vient d'écrire** : le client verrait la
ligne basculer sans savoir que son clic a été refusé — le « enregistré »
silencieux, remis en place par l'autre bout. Le message porte donc le
rechargement. Écrit en commentaire dans le code, parce que c'est exactement le
genre de ligne qu'on « nettoie » plus tard en croyant réparer un oubli.

### Ce qui n'est PAS fait, et pourquoi

**La suppression d'une note par son auteur.** `git grep author_id` ne renvoie
**rien** — ni dans `supabase/migrations/`, ni dans `saas/`. La colonne dépend de
[05](05-migration-deux-colonnes.md), qui est `open`. `deleteNote` reste donc
ouvert à tout `editor` du compte, comme avant. C'est le repli prévu par le
ticket, appliqué tel quel.

### Les voisines — cherchées, trouvées, pas corrigées ici

`app/actions.ts` porte **30 écritures dont le résultat n'est même pas capturé**
(`await supabase.from(…)` nu). Le défaut est plus large que la collision et
touche trois familles distinctes, dont une cascade de six tables qui peut
s'arrêter au milieu en répondant « ok ». Les corriger au passage aurait été un
détour silencieux : c'est le ticket
**[19](19-ecritures-qui-ne-se-relisent-pas.md)**, ouvert avec l'inventaire.

### Ce qui a été vérifié, et ce qui ne l'a pas été

**Vérifié** : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit`
(aucune sortie) et `npm run build` verts, **19 routes** — le compte attendu par
`CLAUDE.md` §9.

**Non vérifié : le comportement en base.** Aucune collision réelle n'a été
jouée, et elle ne pouvait pas l'être ici.

**Correction à un relevé repris de [16](../../refonte/issues/16-compteur-partage.md)
et [25](../../refonte/issues/25-identifiant-annonce-meta.md)** : les deux
disent que « le » projet Supabase ne répond plus. Mesuré aujourd'hui, il y en a
**deux, et ils ne sont pas dans le même état** — le projet du `.env` racine ne
répond pas (`curl` : code `000`), celui de `saas/web/.env.local` **répond**
(`401` sur `/rest/v1/`, donc joignable). Mais `.env.local` ne porte que la clé
**anon** : sans session, la RLS refuse toute lecture, et écrire un faux verdict
dans des données réelles pour observer la collision n'est pas un geste qui se
prend sans David (§7). **La vérification terrain reste donc à faire à deux
onglets connectés**, et c'est la seule façon de la faire.
