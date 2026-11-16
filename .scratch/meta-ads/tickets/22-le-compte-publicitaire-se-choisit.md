# 22: Le compte publicitaire Meta se choisit

Type: task
Status: ready-for-human

La récolte lisait `comptes[0]` de `/me/adaccounts` (`accounts.py`,
`compte_et_fuseau`) : le premier compte publicitaire que Meta rend, sans que le
client l'ait désigné ni que rien à l'écran ne dise lequel. Google a son étape
« Quel compte Google Ads ? » ; Meta n'en avait pas.

## Ce qui change

**La base** (section 26 du `000`) : `connected_accounts.meta_ad_account_id`
(`act_…`) et `meta_ad_account_name`.

**La récolte** (`sync.py`, `_compte_a_lire`) :
- un compte choisi se lit directement (`/{act_…}`), il ne se cherche pas dans
  la liste, lue sur une seule page ;
- choisi mais illisible → le canal finit en échec. Il ne se rabat jamais sur un
  autre compte : ses lignes se mêleraient à celles du compte choisi ;
- rien de choisi, ou section 26 pas jouée → le premier de la liste, comme
  avant, et le journal le dit dès que le jeton en voit plusieurs (un nombre,
  jamais un identifiant : le journal est public).

**Le web** :
- `connecterMeta` : un seul compte visible → il est écrit, la récolte part ;
  plusieurs → la récolte attend le choix ; un choix devenu invisible après une
  reconnexion sous un autre accès Facebook est effacé ;
- page Connexions : l'étape « Quel compte publicitaire Meta ? » s'affiche tant
  que le jeton en voit plusieurs et qu'aucun n'est choisi — y compris pour un
  compte déjà branché avant ce ticket ;
- la ligne « Meta » dit le compte publicitaire choisi ;
- déconnecter Meta efface le choix.

- [x] Harnais `../harnais/21-22-objectif-et-compte/test_recolte.py` vert
- [x] `python3.12 -m py_compile`, `npx tsc --noEmit`, `npm run build` verts,
      18 routes
- [ ] **Pour David** : jouer la section 26 de `000_run_me_all.sql`
- [ ] **Pour David** : recette sur un accès Facebook qui voit plusieurs comptes
      publicitaires — l'étape s'affiche, le choix s'enregistre, la récolte
      part, la ligne « Meta » nomme le compte
- [ ] **Pour David** : un passage du worker, et vérifier dans le journal que la
      ligne « compte publicitaire NON choisi » a disparu

## Ce qui n'a pas pu être vérifié

Le parcours n'a pas été cliqué et aucun appel n'est parti chez Meta :
`comptesPubMeta` (web) et `compte_choisi` (récolte) sont vérifiés par les types
et par le harnais hors ligne, pas contre l'API.

## Ce que ce ticket ne règle pas

- **Changer de compte publicitaire mélange les historiques.** Les lignes déjà
  écrites sous l'ancien compte restent sous le même `user_id`. Vrai aussi pour
  Google aujourd'hui. À décider : effacer, ou porter le compte sur chaque ligne.
- **Changer d'avis sans se déconnecter** : pas de bouton, comme pour Google.
- **`check_data_collection.py` lit toujours le premier compte** : l'essai local
  peut donc regarder un autre compte que la récolte.
- **Un compte à un seul compte publicitaire** branché avant ce ticket garde
  `meta_ad_account_id` NULL : la récolte lit le même compte qu'avant, la page
  ne le nomme pas.

## Comments
