# Harnais du ticket 19 — les écritures qui ne se relisaient jamais

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune dans
`saas/web`, et le ticket [16](../../issues/16-le-seam-du-payload.md) a tranché
que le seul seam de test de la v1 serait le payload du rapport. Ce dossier est ce
qui a servi à vérifier le ticket 19, gardé pour qu'il soit **rejouable** plutôt
que raconté.

Il ne demande **ni base de données, ni secret, ni réseau, ni installation**.

```bash
cd .scratch/construction/harnais/19-ecritures
python3.12 test_ecritures.py     # lance aussi verifier_cascade.js
```

Le vérificateur JavaScript se joue aussi seul :

```bash
node verifier_cascade.js
```

## Ce qui est EXÉCUTÉ, et pas seulement lu

| Vérificateur | Ce qu'il exécute | |
|---|---|---|
| `verifier_cascade.js` | `saas/web/lib/cascade.ts` **tel quel** — node 22+ retire les types lui-même, donc aucune copie du code à vérifier | **23 cas** |

C'est la raison d'être de ce module : la cascade de thèmes a été **sortie**
d'`actions.ts` au lieu d'être corrigée sur place, parce qu'`actions.ts` porte
`"use server"` et ouvre une connexion Supabase au chargement — rien de ce
fichier ne peut tourner hors ligne. `lib/cascade.ts`, lui, n'importe rien et ne
connaît pas Supabase : la seule propriété qui compte vraiment — **une séquence
d'écritures s'ARRÊTE à la première panne, et elle DIT laquelle** — se prouve au
lieu de se lire.

Ce que `verifier_cascade.js` joue pour de bon :

- six étapes vertes s'exécutent **dans l'ordre** ;
- **la troisième échoue** (le scénario écrit dans le ticket) : les deux
  premières sont passées, **les trois suivantes ne partent pas**, et le nom
  rendu est celui de l'étape fautive ;
- la première échoue → rien d'autre ne part ;
- la dernière échoue → les six précédentes sont bien passées ;
- les formes de panne que PostgREST rend : `null` et `undefined` ne sont pas des
  pannes, un objet d'erreur en est une **même sans `message`** ;
- **en série, jamais en parallèle** — preuve temporelle : une étape lente n'est
  pas doublée par la suivante. `Promise.all` lancerait les six d'un coup, donc
  écrirait les cinq autres malgré la panne de la première : exactement l'état
  incohérent qu'on corrige ;
- le message d'arrêt dit les trois choses qu'il doit dire (pas fini, **où**,
  relancer ne double rien) et **ne promet aucune réparation automatique**.

## Ce que `test_ecritures.py` prouve — 117 vérifications

Il lit du **texte** (pas de runner dans `saas/web`), commentaires retirés : les
commentaires d'`actions.ts` **citent** les écritures nues qu'ils viennent de
supprimer, et les chercher au grep sur le fichier entier ferait échouer le
harnais sur la prose qui explique la correction — le piège déjà payé aux harnais
12 et 13.

| § | Ce qui est tenu |
|---|---|
| 1 | **L'inventaire est épuisé** : il ne reste que **2** écritures nues sur les 30 du ticket, et ce sont exactement les deux dont le fichier ÉCRIT la raison. C'est la vérification qui empêche une trente et unième d'arriver en silence. |
| 2 | **Famille 1** — `changerRoleMembre` et `revoquerMembre` demandent à PostgREST ce qu'ils ont touché (`.select("id")`) ET traitent le zéro ligne. Les deux vont ensemble : `.select` sans compte ne dit rien, un compte sans `.select` n'existe pas. Aucun message ne nomme une personne (ADR 0004). |
| 3 | **Famille 2** — `saveObjectif` et `createLabel` comptent leurs lignes sur `profiles`, et `profilMuet` **relit** avant de parler : il distingue « compte illisible » de « écriture refusée » au lieu de deviner (§7). |
| 4 | **Famille 3** — les **quatre** cascades passent par `enchainer`, n'ont plus **une seule** écriture nue, rendent un message d'arrêt, et écrivent la **liste maîtresse en dernier** — une seule fois, pour qu'une étape ajoutée en tête sous le même nom ne puisse pas masquer l'ordre. Les lectures qui servent de base à une écriture sont vérifiées (`_labels` replie un SELECT raté sur `[]` : écrire `labels: []` effacerait TOUS les thèmes du compte). Aucun nom de table ne part à l'écran. |
| 4 bis | **L'étape maîtresse compte ses lignes comme les autres** — le trou que la relecture avait manqué et que la revue a trouvé : elle ne rendait que son `.error`, donc un refus RLS y passait pour un succès et l'écran disait « renommé partout ». Le refus s'y dit **autrement qu'un arrêt technique**, ce que seul l'ordre permet (la maîtresse étant la dernière, tout le reste EST écrit), et `categorieMuette` **relit** pour distinguer « disparue » de « refusée » au lieu de deviner. |
| 5 | `lib/cascade.ts` est **pur** — aucune directive, aucun import, aucun mot « supabase » — et il écrit pourquoi ce n'est **pas** une fonction SQL `SECURITY DEFINER`. |
| 6 | **L'autre moitié du défaut** : les quatre écrans jetaient la réponse (`await action(…)` sans rien en faire). Corriger l'action sans lire sa réponse n'aurait **rien** changé pour le client. « ✓ enregistré » ne s'écrit plus sans avoir regardé, et la date de prise en compte de l'objectif non plus. |
| 7 | **Les replis ne mentent plus** : une seconde chance qui rate est un échec. |
| 8 | Aucun des messages neufs ne promet une réparation qui n'existe pas (§7). |

**Trois vérifications ont été mises à l'épreuve par mutation**, et pas seulement
lues : remettre la liste maîtresse en tête de `deleteLabel`, retirer le
`.select("id")` de `revoquerMembre`, retirer le compte de lignes de l'étape
maîtresse de `renameConversionCategory` — chacune fait **rougir** le harnais.

**Rejoués, tous verts** : 12 (178), 13 (77), 16 (301), 17 (47), 18 (18), 43 (18).

## Ce qu'il ne prouve pas

- **Rien n'a été vu à l'écran, et rien n'a été joué en base.** Aucune collision
  réelle, aucun refus RLS réel, aucune cascade réellement interrompue : le
  projet Supabase de `saas/web/.env.local` répond mais ne porte que la clé
  **anon**, et écrire dans des données réelles pour observer un refus n'est pas
  un geste qui se prend sans David (`CLAUDE.md` §7).
- **Le risque propre au `RETURNING`, et pourquoi il ne se réalise pas ici.**
  Ajouter `.select(…)` à un `update`/`delete` fait appliquer la politique de
  **SELECT** aux lignes visées : si elle était plus étroite que celle d'UPDATE,
  le `.select` **empêcherait** une écriture qui passait avant. C'est lu dans le
  SQL, pas supposé — `peut_editer(cible)` est **exactement** `a_acces(cible)`
  plus `AND m.role = 'editor'` (§12 de `000_run_me_all.sql`), donc sur
  `profiles` tout ce qui passe `partage_update` passe `partage_select` ; et sur
  `dashboard_members`, `dm_delete`/`dm_update` visent `owner_id = auth.uid()`,
  que `dm_select` couvre. **Mais aucune de ces deux requêtes n'a été jouée
  contre la vraie base.**
- **Le rendu des messages** — `EquipeManager`, `ObjectifSelect`, `BudgetEditor`,
  `LabelRow` : ce qu'on leur donne est vérifié, ce qu'ils en dessinent ne l'est
  pas (aucun runner dans `saas/web`, décision de David au ticket 16).
