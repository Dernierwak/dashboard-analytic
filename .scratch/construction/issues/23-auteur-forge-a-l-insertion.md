# L'auteur d'une note est figé après coup, mais rien ne l'empêche d'être FAUX dès l'écriture

Type: task
Status: open
Blocked by: 05

## Question

**Trouvé en construisant [05](05-migration-deux-colonnes.md), pas demandé par
lui — et pas corrigé en silence : ça change ce qu'un Membre a le droit
d'écrire, donc ça se propose (`CLAUDE.md` §5).**

La migration de 05 garantit qu'`author_id` **ne se réécrit jamais**. Elle ne
garantit rien sur sa valeur **à la création** :

- la politique d'insertion partagée est `partage_insert ... WITH CHECK
  (public.peut_editer(user_id))` — elle contrôle **le compte**, jamais la
  personne ;
- le déclencheur `trg_suivi_actions_auteur_fige` est un `BEFORE UPDATE`, il ne
  voit pas les insertions ;
- `auth.uid()` (la personne) n'apparaît dans aucune règle d'écriture de cette
  table.

**Donc un membre « Peut agir » qui écrit directement en PostgREST peut poser une
note signée de quelqu'un d'autre**, et le déclencheur la figera ensuite dans cet
état. Un fait déclaré attribué à qui ne l'a pas déclaré, c'est exactement ce que
§7 interdit — un fait fabriqué, pas une approximation.

L'attaque est étroite (il faut être déjà membre du compte avec droit d'écriture,
et sortir de l'interface), et elle ne donne aucun accès : **elle salit une
mémoire, elle n'ouvre aucune porte.** C'est pour ça que c'est un ticket et pas
une correction d'urgence.

### Ce qu'il faut décider

- **Une politique qui exige `author_id IS NULL OR author_id = auth.uid()` à
  l'insertion**, en plus de `peut_editer(user_id)`. Un `WITH CHECK` suffit : il
  voit la ligne d'arrivée, et ici c'est tout ce qu'on veut voir.
- **Le worker n'est pas concerné** : il passe par la clé de service, la RLS ne le
  filtre pas, et il n'écrit jamais `author_id`. À vérifier avant de poser la
  règle, pas à supposer.
- **Le `NULL` doit rester permis** : les lignes nées d'un conseil (`kind =
  'action'`) n'ont pas forcément d'auteur, et l'ADR 0004 tient à ce qu'une ligne
  sans auteur reste écrivable.

### Ce qui n'est PAS dans ce ticket

La règle « une note ne s'efface que par son auteur ou par le Propriétaire » —
elle est applicative, elle appartient à [12](12-le-carnet-et-la-mort-de-preuve.md)
et [19](19-ecritures-qui-ne-se-relisent-pas.md).

### Consigne de repli

Écrire la politique **sans la jouer** — la base n'est pas joignable depuis une
session d'agent, et le reste du schéma de 05 attend déjà d'être joué.
