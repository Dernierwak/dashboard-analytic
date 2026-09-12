# Une migration, deux colonnes : l'auteur d'une note et la campagne d'une action

Type: task
Status: resolved
Blocked by: 04

## Question

**Deux colonnes réclamées par trois tickets, à jouer d'un seul coup** —
[16](../../refonte/issues/16-compteur-partage.md) pour l'auteur,
[08](../../refonte/issues/08-la-memoire-du-travail.md) et
[04](../../refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md) pour la
campagne. Une seule migration, deux colonnes : la carte de refonte le dit
explicitement.

### Ce que 16 a tranché, et le prix qu'il a accepté

**UNE colonne `author_id` sur `suivi_actions`**, posée à la création, **jamais
réécrite**, et **aucun backfill** — inscrire le propriétaire sur les lignes
existantes serait un chiffre fabriqué (§7).

**Pas de table neuve** : une note reste `kind = 'note'`
([20](../../refonte/issues/20-a-faire-cette-semaine.md) : *« aucun objet
neuf »*). La règle de fond, posée par David :
> *« on ne duplique pas ; si une reco change son statut, c'est pour tout le
> monde »*

D'où [ADR 0004](../../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md) :
**une note est personnelle, elle a un auteur ; un statut est celui de
l'entreprise, il n'en a pas.** Le prix est écrit et accepté : on ne saura jamais
qui a jugé quoi. **Ne pas ajouter une colonne d'auteur au verdict pour
« améliorer » ça.**

### La colonne de campagne

`suivi_actions` n'a **aucune colonne de campagne** aujourd'hui — défaut mesuré en
04, et 14 a tranché que **le périmètre du conseil est le thème mais qu'on descend
à la campagne** (correction à 11). Sans cette colonne, le carnet ne peut pas
répondre à *« montre-moi tout ce que j'ai fait pour cette campagne »*, qui est la
demande de David en 08.

### Ce que 16 a établi et qui évite du travail inutile

- **Le partage existe déjà et il marche.** La section **15** du bundle (l. 1590)
  pose `partage_select USING a_acces(user_id)` sur `suivi_actions` et
  `reco_feedback`, combinée **en OU** avec les anciennes règles. Le ticket 12 §11
  annonçait une migration pour le compteur partagé : **elle n'existe pas**.
- **`user_id` n'est pas la personne, c'est le COMPTE** : `app/actions.ts` fait
  `const user = { id: compte.uid }` **43 fois sans une exception**. Donc **aucune
  ligne à ré-attribuer** — avant le partage, personne ne pouvait écrire ailleurs
  que chez soi, l'historique est juste par construction.

### Les pièges

- **Une politique RLS ne voit que la ligne d'arrivée** (§8) : elle ne peut pas
  interdire de *changer* `author_id`. Si on veut qu'il ne soit jamais réécrit,
  **il faut un déclencheur qui compare `OLD` et `NEW`** — pas une politique.
- **Aucune vérification en base n'est possible en local** : le `.env` racine
  pointe un projet Supabase qui ne répond plus (relevé en 25 **et** en 16).
  Aucun décompte de lignes ne pourra être donné. Le dire.
- **Aucun `DROP` / `DELETE` / `TRUNCATE`** sans le signaler et le faire valider.

### Consigne de repli

Livrer la migration **écrite et non jouée**, avec le déclencheur, plutôt que de
la jouer sans pouvoir vérifier qu'elle a pris. `000_run_me_all.sql` doit rester
**rejouable sans risque** — c'est sa raison d'être.


## Avancement — session du 2026-09-12 (construction)

**La migration est écrite, vérifiée sur un PostgreSQL 16 réel, et NON JOUÉE :
je n'ai aucun accès à la base. Repli appliqué, tel que ce ticket le prévoyait.**

Elle n'attend aucune validation de ta part au sens du §7 : **elle ne porte aucun
`DROP` destructeur, aucun `DELETE`, aucun `TRUNCATE`, aucun `UPDATE` sur
l'existant** — un contrôle du harnais lit le verbe de chaque instruction pour que
ça reste vrai demain. Elle attend seulement d'être jouée.

### 1 · Ce qui a été construit

**`supabase/migrations/suivi_actions_auteur_campagne.sql`** (source de vérité),
recopié en **section 25** de `000_run_me_all.sql`, avant le bloc de contrôle —
qui annonce désormais les trois colonnes et la fonction du déclencheur.

- **`author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`**, nullable,
  **aucun backfill**. `ON DELETE SET NULL` et pas autre chose : le défaut
  (`NO ACTION`) ferait **échouer la suppression du compte d'un membre**, donc la
  page `/suppression` et toute demande RGPD ; un `CASCADE` effacerait le travail
  de l'entreprise avec le départ d'un membre.
- **Le déclencheur `trg_suivi_actions_auteur_fige`**, pas une politique : une
  politique ne voit que la ligne d'arrivée (§8), un CHECK non plus. Il refuse
  toute écriture qui **donne** un auteur — réattribuer une note, ou combler
  après coup l'auteur d'une vieille ligne (le backfill de l'ADR 0004, fait à la
  main). Il laisse passer le retour à NULL, **parce que c'est exactement ce que
  fait le `ON DELETE SET NULL`** : un garde-fou qui refuserait tout changement
  rendrait la suppression d'un membre impossible. Oublier un auteur ne fabrique
  aucun fait ; en inventer un, si.
- **`campaign_channel` + `campaign_key`**, la paire (régie, clé) — voir §2.
- **Deux index partiels** : celui de la question du carnet (« tout ce que j'ai
  fait pour cette campagne »), et celui que le `ON DELETE SET NULL` doit suivre
  pour ne pas balayer la table à chaque suppression de compte.
- **Le verdict ne gagne aucune colonne d'auteur**, comme l'ADR 0004 l'exige.
  Rien non plus sur `reco_feedback`.

### 2 · L'écart avec la lettre du ticket : la campagne prend deux colonnes

Le ticket annonce « deux colonnes » en comptant l'auteur et la campagne comme un
objet chacun. **La campagne en demande deux à elle seule, et je ne l'ai pas
élargi de mon propre chef : dans ce code, l'identité d'une campagne EST une
paire.** `ThemeCampaign` (`lib/report.ts` l. 292) porte `channel` **et** `key`,
parce que Meta identifie une campagne par son **nom**
(`meta_campaign_config`, clé primaire `(user_id, campaign_name)`) et Google par
son **identifiant** (`google_campaign_config`, `(user_id, campaign_id)`).
`platform_changes` stocke déjà la même paire, pour la même raison.

Avec une seule colonne, il faudrait **deviner** de quelle régie vient la clé —
or rien n'interdit d'appeler une campagne Meta « 22334455 », et la note
basculerait sur la campagne Google homonyme. C'est exactement le bug que le
ticket **03** vient de payer : identifier par un nom réutilisable.

**Si tu préfères la lettre du ticket, `campaign_channel` se retire seule** — mais
le carnet devra chercher la clé dans les deux tables de configuration et
trancher au hasard quand les deux répondent. C'est un arbitrage, il est écrit
dans l'en-tête du fichier de migration, et il est à toi.

**Aucune clé étrangère sur la campagne**, volontairement : deux tables de
configuration ne peuvent pas être référencées par une colonne, et une note est
un récit — elle doit survivre à la campagne qu'elle raconte. **Limite connue,
écrite et non corrigée en silence** : côté Meta, **renommer une campagne change
sa clé**, donc les notes écrites avant ne la suivent pas (déjà relevé au ticket
[18](18-revenu-google-non-rattachable.md)).

### 3 · Ce qui est vérifié — 42 contrôles sur un PostgreSQL 16 réel

Harnais rejouable dans `.scratch/construction/harnais/05-deux-colonnes/`
(`pgserver` embarque un PostgreSQL complet — aucune connexion à Supabase, aucun
secret). `schema.sql` est la table **telle que les sections 9→11, 19 et 23 la
laissent**, c'est-à-dire son état avant cette migration.

| Ce qui est prouvé | |
|---|---|
| **13** · l'auteur, posé une fois et figé | réattribution refusée · backfill à la main refusé · le message nomme la règle · marquer une action « faite » ne réveille rien · **supprimer le membre qui a écrit la note reste possible, et la note reste sur le compte sans auteur** · un auteur oublié ne se réinvente pas |
| **10** · la campagne, une paire ou rien | les deux régies passent · clé sans régie, régie sans clé, clé vide et régie inconnue refusées · l'index partiel existe et ne porte que les lignes concernées |
| **15** · rejouable, et sans rien détruire | second passage sans erreur, rien de dupliqué, **la ligne déjà en base intacte** · aucune instruction ne commence par DELETE/UPDATE/TRUNCATE · les seuls `DROP` sont les `DROP TRIGGER IF EXISTS` de la rejouabilité · le contrôle de fin du fichier unique retrouve bien la fonction par sa signature |
| **4** · la copie de `000_run_me_all.sql` n'a pas dérivé | et le contrôle de fin de fichier annonce bien les trois colonnes |

Les deux fichiers SQL passent le parseur PostgreSQL réel (`pglast`,
libpg_query) : 11 instructions pour la migration, 340 pour le fichier unique.

**Un défaut trouvé par le harnais, pas par la relecture** : écrite sans les
`IS NOT NULL` explicites, la contrainte de paire **laissait passer une clé sans
régie**. Un CHECK n'échoue que sur FAUX — `campaign_channel IN ('meta','google')`
rend NULL quand la colonne est nulle, donc `FAUX OR NULL` = NULL, donc la ligne
entrait. Corrigé, et la raison est écrite dans le fichier.

**`saas/web` et `saas/` ne sont pas touchés** — aucun fichier. Il n'y a donc rien
à dire de `tsc`, de `npm run build` ni des 19 routes.

**Rien n'est vérifié sur la vraie base, et ce n'est pas contournable** : le
`.env` racine nomme une variable que le worker ne cherche pas, et son projet
Supabase n'existe plus (relevé en 25 et en 16). **Aucun décompte de lignes
existantes ne peut être donné.**

### 4 · Ce qui reste, dans cet ordre

- [ ] **Jouer `000_run_me_all.sql`** (ou `suivi_actions_auteur_campagne.sql`
      seul). ⚠ Le fichier unique porte toujours le `DROP CONSTRAINT` du ticket
      **03**, qui attend ton feu vert — jouer le fichier entier le joue aussi.
- [ ] **Les écritures TypeScript suivent**, et elles ne sont PAS dans ce ticket :
      `saveNote` écrit `author_id: compte.moi` (**`moi`, pas `uid`** — le seul
      endroit de tout `actions.ts` où la personne compte), `deleteNote` et
      l'édition filtrent sur l'auteur ou le Propriétaire, et le carnet désigne
      une campagne. C'est [12](12-le-carnet-et-la-mort-de-preuve.md), avec
      [19](19-ecritures-qui-ne-se-relisent-pas.md) pour la relecture des
      écritures.
- [ ] **La règle « une note ne s'efface que par son auteur » reste applicative.**
      Ce fichier n'ajoute aucune politique RLS : ça changerait ce qu'un membre a
      le droit de faire, et ça se propose au lieu de se glisser.
