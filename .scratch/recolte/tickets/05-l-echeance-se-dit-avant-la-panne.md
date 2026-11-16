# 05: L'échéance d'une connexion se dit avant la panne

Type: task
Status: ready-for-human

Demande de David (2026-11-16) : « si une connexion arrive gentiment à
échéance, cela se montre sur l'hebdomadaire ».

`sources/meta/auth/token.py` lisait déjà l'échéance du jeton Meta à chaque
passage (`/debug_token`), et `expire_bientot` existait avec un préavis de 14
jours — mais rien ne l'appelait et la date n'allait nulle part. Le client
n'apprenait la fin de son autorisation qu'une fois la récolte arrêtée.

## Ce qui change

**La base** (section 27 du `000`) : `connected_accounts.jeton_expire_le`.

**La récolte** (`account_sync.noter_echeances`) : à chaque passage, complet ou
léger (donc chaque jour), l'échéance de chaque jeton VALIDE est écrite. Un
jeton mort ou non vérifié n'écrit rien. Une échéance non communiquée s'écrit
NULL, jamais une date supposée.

**La page Connexions** :
- un encart de préavis, sous les connexions mortes, dès que l'autorisation Meta
  prend fin dans moins de 14 jours, avec le bouton « Reconnecter Meta » ;
- chaque source branchée dit son échéance sur sa ligne : « Autorisation valable
  jusqu'au … », ou « Google ne donne pas de date d'échéance ».

**Le rapport hebdo** : une ligne en tête de page, dans la même fenêtre de 14
jours, avec un lien vers Connexions. Elle se lit dans `connected_accounts` à
chaque affichage, pas dans le payload (publié une fois par semaine, il
resterait faux six jours après une reconnexion). Le propriétaire seul la voit.

**La reconnexion** efface l'échéance de l'ancien jeton (`lib/reconnexion.ts`).

- [x] Harnais `../harnais/05-l-echeance/` : `test_recolte.py` (10 constats) et
      `lancer.sh` (5 tests de `lib/echeance.ts`)
- [x] `python3.12 -m py_compile`, `npx tsc --noEmit`, `npm run build` verts,
      18 routes
- [ ] **Pour David** : jouer la section 27 de `000_run_me_all.sql`
- [ ] **Pour David** : un passage du worker, puis lire
      `SELECT provider, jeton_expire_le FROM connected_accounts` — la ligne
      Meta doit porter une date, la ligne Google rester NULL
- [ ] **Pour David** : recette à l'écran. Pour voir le préavis sans attendre
      46 jours, poser à la main `jeton_expire_le` à J+5 sur sa ligne Meta,
      ouvrir `/` et `/comptes`, puis laisser le worker réécrire la vraie date

## Ce qui n'a pas pu être vérifié

Aucun écran n'a été ouvert : la colonne n'existe pas encore en base, il n'y a
donc rien à afficher. Les types, le build et les harnais passent ; le rendu
réel du préavis reste à regarder.

## Ce que ce ticket ne règle pas

- **Google n'a pas de préavis.** Un refresh token ne porte aucune échéance :
  il tient jusqu'à sa révocation. La page le dit, elle n'invente pas de date.
  Sa mort reste annoncée après coup, par la section 4bis.
- **Le préavis ne part pas par e-mail.** Un client qui n'ouvre ni le rapport ni
  Connexions pendant 14 jours ne le verra pas. Les e-mails ont quitté le
  pipeline (`1b05a92`).
- **`expire_bientot`** (`meta/auth/token.py`) reste sans appelant côté worker :
  le préavis se calcule à l'affichage, sur la date. À retirer ou à brancher sur
  le journal.
- **La page Connexions n'est pas réécrite de fond en comble** : sa structure
  (connexion morte, étape en cours, les quatre sources, les deux gestes, le
  Jour de travail) est gardée, l'échéance s'y ajoute.

## Comments
