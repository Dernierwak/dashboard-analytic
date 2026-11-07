# 05: Le relevé du compte

**What to build:** chaque passage léger écrit la journée d'hier du compte dans
`instagram_compte_jours` : portée, interactions, gagnés et perdus, total
d'abonnés (R5) et la part boostée (`AD`) de la portée et des interactions.
Plus la portée **dédoublonnée sur 7 jours** que rend Instagram, pour que la
Tendance (14) l'affiche sans jamais sommer des jours.

Spec : § La récolte — Ce qui se corrige R5 ; § Ce qui s'ajoute, « Le relevé
du compte, pour hier » ; § La page, Tendance (« la portée de la période …
`total_value` »).

**Blocked by:** 04

**Status:** resolved

- [x] `reach` (`period=day`), `total_interactions` (un appel par jour),
      `follows_and_unfollows` par `follow_type`, `followers_count` du passage,
      part `AD` via `breakdown=media_product_type`. Le jour en cours n'est
      jamais écrit.
- [x] Une métrique non rendue reste `NULL` ; un jour non lu n'a pas de ligne.
- [x] **Décision de construction** (la spec veut la portée `total_value` d'une
      période libre, que la base ne peut pas reconstituer à partir des jours) :
      chaque passage enregistre la portée `total_value` des 7 jours finissant
      hier, en ajout seul, dans une petite table `instagram_compte_periodes
      (user_id, debut, fin, reach)` (section 23, RLS comme le reste). La
      période par défaut de la page (7 jours finissant la veille du Jour de
      travail) s'y trouve donc ; une autre période écrit pourquoi elle n'a pas
      ce chiffre.
- [x] Harnais « réponse Graph → ligne du jour » : `AD` absent → `NULL`.

## Réponse

**Ce qui est fait**

- `sources/meta/instagram/fetchers/account_insights.py` (neuf) : `total(acces,
  métrique, début, fin_exclue, ventilation)` (`period=day`,
  `metric_type=total_value`, bornes à minuit UTC comme l'essai réel) et
  `abonnes(acces)` (`followers_count`, relu ici — R5 — sans toucher à `sync.py`).
  **Un appel par chiffre** : un appel multi-métriques est refusé en entier dès
  qu'une métrique l'est. 7 appels par compte et par jour : portée, portée par
  produit, interactions, interactions par produit, `follows_and_unfollows` par
  `follow_type`, `followers_count`, portée des 7 jours.
- `sources/meta/instagram/releve_compte.py` (neuf) : `ligne_du_jour` (pur) et
  `releve_du_compte(sb, uid, acces, maintenant)`. Seul **hier** (date UTC du
  passage − 1) s'écrit. Jeu vide ou `AD` absent → colonne à `NULL` ; un 0 rendu
  reste 0 ; **appel en erreur → colonne non envoyée** (l'upsert garde la valeur
  en base) ; tous les appels en erreur → aucune ligne. `abonnes` = le
  `followers_count` du passage, posé sur la ligne d'hier (dit dans le code).
  Ne lève pas sur une erreur Meta : le mot du journal la nomme.
- `source_data/instagram_compte.py` (neuf) : upsert `(user_id, jour)` ;
  `instagram_compte_periodes` en **ajout seul** (`ignore_duplicates`, une
  période déjà là garde sa valeur) ; table absente (section 23 pas jouée) → le
  dit et continue.
- `orchestration/account_sync.leger` : posts puis compte, **chacun dans son
  `try`** (une panne de l'inventaire n'empêche pas le relevé du compte), une
  seule ligne de journal et une seule durée : `instagram léger en … s — insta
  léger: … · compte: 2026-11-09 relevé`.
- `000_run_me_all.sql` § 23 (ajout seul) : `instagram_compte_periodes (user_id,
  debut, fin, reach NOT NULL, lu_a)`, clé `(user_id, debut, fin)`, RLS lecture
  par `a_acces(user_id)`, aucune politique d'écriture, hors 15.1 ; sommaire et
  CONTRÔLE mis à jour. `saas/data/fetch_data/CLAUDE.md` le dit.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/05-le-releve-du-compte/test_releve_compte.py
    → TOUT EST VERT (17 : ligne d'hier complète, jamais aujourd'hui ; période
      des 7 jours ; 7 appels ; AD absent → NULL ; jeu vide → NULL ; 0 reste 0 ;
      appel en erreur → colonne non envoyée ; tout en erreur → aucune ligne ;
      upsert / ajout seul ; table absente sans lever ; migration ; léger porte
      les deux mots et le compte survit à la panne des posts)
    harnais 01 et 04 → TOUT EST VERT
    python3.12 -m py_compile (4 fichiers touchés) → OK
    pglast.parse_sql(000_run_me_all.sql) → 254 instructions (251 + 3) — syntaxe seule

**Ne se vérifie qu'en vrai** — au **cron suivant de 07:00 UTC** (n'importe
quel jour), ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`, mode `mise_a_jour`), **après** que David a joué la
section 23 :
- une ligne par compte dans `instagram_compte_jours` pour la veille, et une
  dans `instagram_compte_periodes` ;
- **le jour auquel Meta rattache une borne à minuit UTC** : la doc ne dit pas
  le fuseau des jours (`issues/04`) ; si Meta compte en heure du Pacifique, la
  « journée d'hier » est décalée de 7–8 h. À comparer une fois à l'écran
  Instagram ;
- **le retard de 48 h** documenté (`issues/04`) : la ligne d'hier peut être
  partielle et rien ne la relit ensuite. Suite proposée (ticket 06 ou 14) :
  relire aussi avant-hier à chaque passage — l'upsert le permet ;
- un compte sous 100 abonnés n'a pas `follows_and_unfollows` (doc) : gagnés /
  perdus resteront `NULL`.

Pour le ticket 06 : le léger écrit désormais une ligne `instagram_compte_jours`
chaque jour ; « aucune ligne » ne suffit plus à détecter un premier passage
si le léger tourne avant lui.

Corrigé après revue : chaque passage lit aussi la période de 7 jours finissant avant-hier ; les périodes finissant hier ou avant-hier s'écrivent en upsert (`ecrire_periode_du_compte(sb, ligne, aujourdhui)`), les plus anciennes restent en ajout seul. 13 appels par passage au lieu de 12.

Vérifié : les 15 harnais verts (`python3.12 -I …/test_*.py`, `sh …/lancer.sh`). Ne se voit en vrai qu'après un passage du worker : le cron de 07:00 UTC.
