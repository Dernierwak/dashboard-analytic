# L'auteur d'une note est figé après coup, mais rien ne l'empêche d'être FAUX dès l'écriture

Type: task
Status: resolved
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

---

## La réponse

### 1 · Ce qui a été écrit

`supabase/migrations/suivi_actions_auteur_sincere.sql`, copié en **section 26**
de `000_run_me_all.sql` (après la 15 qui pose `partage_insert`, et après la 25
qui crée la colonne) :

```sql
CREATE POLICY "auteur_sincere" ON public.suivi_actions
    AS RESTRICTIVE
    FOR INSERT
    WITH CHECK (author_id IS NULL OR author_id = (SELECT auth.uid()));
```

Plus un garde qui s'arrête en nommant `suivi_actions_auteur_campagne.sql` si la
colonne manque, et une ligne **sécurité** dans le contrôle de fin de fichier.

### 2 · Ce que le ticket n'avait pas vu, et qui change tout

Le ticket demandait « une politique en plus de `peut_editer(user_id)` ». **Posée
en permissive, elle n'aurait rien interdit** : PostgreSQL combine les politiques
permissives d'une même commande **en OU**, et `suivi_actions` en a déjà *deux*
sur l'insertion — `partage_insert` (section 15) et `suivi_actions_insert_own`
(`suivi_actions.sql`). La règle se serait lue comme une protection sans en être
une, à un mot près dans le SQL, et rien ne l'aurait signalé.

`AS RESTRICTIVE` est le seul mécanisme de PostgreSQL qui **retranche**. C'est
pour ça que le contrôle de fin de fichier vérifie
`permissive = 'RESTRICTIVE'` et pas seulement le nom de la politique : une ligne
de contrôle qui se contenterait du nom dirait « ✓ » sur une base ouverte.

Le `WITH CHECK` suffit, comme le ticket le pensait : à l'insertion il n'y a pas
de ligne d'avant, donc la limite de §8 (« une politique ne voit que la ligne
d'arrivée ») ne mord pas ici — c'est ce qui distingue ce ticket du 05, qui a dû
prendre un déclencheur.

### 3 · Les deux vérifications que le ticket exigeait

- **Le worker n'est pas concerné — vérifié, pas supposé.**
  `build_report.py::_service_client` ouvre Supabase avec `SUPABASE_SERVICE_KEY` ;
  ce rôle porte BYPASSRLS. Et il n'en a de toute façon pas besoin : sur tout
  `saas/`, `suivi_actions` n'est **jamais** l'objet d'un INSERT côté Python — la
  seule écriture est `lecteur.py`, qui met à jour `verdict`. La règle ne portant
  que sur l'INSERT, un UPDATE de verdict ne la croise pas.
- **Le `NULL` reste permis** (ADR 0004), et trois écritures légitimes en
  dépendent : les lignes `kind = 'action'`, le repli de `poserNote`, et toutes
  les lignes d'avant 05.
- **L'app écrit déjà juste** : `actions.ts` l. 587 est la seule écriture
  d'`author_id` du dépôt, et elle vaut `compte.moi`, c'est-à-dire
  `supabase.auth.getUser().id` — donc `auth.uid()`. Rien à changer côté web.

### 4 · Ce qui a été mesuré

Harnais `.scratch/construction/harnais/23-auteur-sincere/`, sur un PostgreSQL 16
réel et jetable (`pgserver`), qui rejoue **toutes** les migrations posant une
politique d'insertion sur la table — sans quoi il aurait conclu l'inverse de la
vérité. **39 vérifications, toutes vertes.**

| Fichier | Ce qu'il prouve |
|---|---|
| **4** · `test_le_trou.py` | **Le ticket dit vrai** : sur le schéma d'aujourd'hui, un membre « Peut agir » pose une note signée de son collègue, elle entre en base à ce nom, et le déclencheur de 05 l'y **fige** — même la personne à qui elle est attribuée ne peut plus la rendre. |
| **17** · `test_auteur_sincere.py` | Refus de signer du nom d'un autre (membre **et** propriétaire), refus sans jeton, et le message nomme bien *cette* politique. **Et rien de cassé** : le viewer reste refusé par le partage et non par elle, l'upsert sans auteur de `resoudreAction` passe encore sans toucher l'auteur en place, la clé de service n'est pas filtrée, cocher une action marche, le départ d'un membre reste possible et sa note lui survit sans auteur. |
| **12** · `test_rejouable.py` | Second passage sans erreur, une seule politique, ligne témoin intacte, aucune instruction destructrice — et, jouée trop tôt, elle **s'arrête en nommant le fichier à jouer d'abord**. |
| **6** · `test_copie_non_derivee.py` | La section 26 n'a pas dérivé de sa source, elle est placée après la 25, elle est bien `AS RESTRICTIVE`, et le contrôle de fin de fichier exige ce caractère restrictif. |

Les deux fichiers SQL passent le parseur PostgreSQL réel (`pglast`,
libpg_query) : **4 instructions** pour la migration, **344** pour le fichier
unique (340 avant). Le parseur confirme lui-même `cmd = insert` et
`permissive = False`, dans les deux fichiers.

Le harnais du **ticket 05 a été rejoué** après la modification du bundle :
42/42, aucune régression.

**Un piège trouvé en construisant le harnais, pas par la relecture** : le
répertoire de données de `pgserver` survit d'une exécution à l'autre, donc
`ADD COLUMN IF NOT EXISTS author_id … REFERENCES` retrouvait la colonne du run
précédent et **ne reposait pas sa clé étrangère**. Le test du départ d'un membre
échouait alors sur un défaut inventé par le harnais. Corrigé par un
`DROP SCHEMA public CASCADE` en tête du décor, et la raison est écrite dedans.

**`saas/web` et `saas/` ne sont pas touchés** — aucun fichier. Il n'y a donc rien
à dire de `tsc`, de `npm run build` ni des 19 routes.

### 5 · Ce qui reste, et qui n'est pas fait

- [ ] **Jouer le SQL.** Tant que `suivi_actions_auteur_sincere.sql` (ou le
      fichier unique) n'est pas passé dans le SQL editor de Supabase, **le trou
      est toujours ouvert en vrai**. Rien n'a été joué sur la vraie base : le
      `.env` racine pointe un projet Supabase qui ne répond plus. ⚠ Le fichier
      unique porte toujours le `DROP CONSTRAINT` du ticket **03**, qui attend un
      feu vert — jouer le fichier entier le joue aussi.
- [ ] **Ça ne se verra pas en cliquant, et ça ne demande aucun passage du
      worker.** L'écran ne change pas : l'interface écrivait déjà la bonne
      valeur. Ce qui change est ce qu'une écriture directe en PostgREST a le
      droit de faire. La ligne « sécurité » du contrôle de fin de
      `000_run_me_all.sql` est le seul endroit où ça se lit.
