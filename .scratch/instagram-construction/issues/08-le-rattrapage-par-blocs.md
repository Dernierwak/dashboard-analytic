# 08: Le Rattrapage par blocs

**What to build:** pour un compte payant, tous les posts que Meta rend, du
plus récent au plus ancien, un bloc par passage quotidien ; la page se remplit
à mesure et sa ligne de référence dit ce qu'elle couvre.

Spec : § La récolte — Ce qui s'ajoute, « Le Rattrapage » ; § Notes, « Dans le
brouillard ».

**Blocked by:** 07

**Status:** needs-human — la taille du bloc (`sync._TAILLE_DU_BLOC = 25`) est
une valeur d'attente : elle se fixe sur la durée mesurée en production (ligne
`rattrapage: … en T s` du journal du léger).

- [x] Le curseur de pagination de l'inventaire est gardé entre deux passages ;
      un passage reprend où le précédent s'est arrêté ; fini = plus de page.
- [x] La taille du bloc est une constante nommée dont le commentaire dit
      qu'elle attend la durée mesurée du passage (journal de 04) — pas de
      seuil inventé présenté comme mesuré.
- [x] Harnais : reprise du curseur, arrêt en fin d'inventaire, gratuit exclu.
- [ ] Le ticket reste needs-human jusqu'à ce que la taille du bloc soit fixée
      sur une durée mesurée en production.

## Réponse

**Ce qui est fait**

- **Point bloquant hérité de 07, corrigé** : `sync.posts_a_relire` ne fait
  plus importer à un payant que ses absents **de moins de 30 jours** au
  passage complet. Choisi plutôt que « la première page de l'inventaire » :
  c'est la fenêtre que ce passage relit déjà en base (une seule règle, « le
  Jour de travail touche ce qui a moins de 30 jours »), et elle suit le rythme
  de publication au lieu d'une taille de page que Meta ne documente pas. Les
  plus vieux absents n'entrent plus que par le Rattrapage. Gratuit inchangé.
- `sync.rattrapage(sb, uid, acces, connexion_id)` : payant seulement
  (`is_paid`, lu par `_est_payant`, maintenant partagé avec `_a_relire`).
  Lit l'inventaire depuis le curseur gardé en base (`posts.page_du_rattrapage`,
  `/media?limit=25&after=…` avec les champs de la fiche et le repli de
  `boost_ads_list`), saute les pages entièrement en base (1 appel chacune,
  20 au plus par passage, position gardée), importe les absents de la
  première page qui en a (métriques, fiche, image, relevé), puis garde le
  curseur suivant. Plus de `next` → curseur vidé, `fini_le` daté, les passages
  suivants ne lisent plus rien.
  - Le curseur gardé est `paging.cursors.after`, jamais l'URL `next` (elle
    porte le jeton), et seulement si la page a un `next` (Meta rend
    `cursors.after` jusque sur la dernière page).
  - Curseur refusé (le post qu'il désigne a été supprimé) → reprise du haut,
    dit dans le mot ; refusé aussi du haut → lève, curseur intact.
  - Métriques refusées pour **tout** le bloc → rien d'écrit, curseur laissé
    avant la page (relue demain) ; pour une **partie** → la fiche s'écrit sans
    métriques (inconnues, pas zéro), le trimestriel la relira — sinon, curseur
    passé, ce post ne reviendrait jamais.
  - Colonnes absentes → rien n'est lu, le mot nomme la migration ; update à
    0 ligne → « curseur NON écrit » (`CLAUDE.md` §8).
- `account_sync.leger` : le bloc est la 3e étape, dans son propre `try`, avec
  **sa propre durée** dans la ligne (`rattrapage: 25 posts importés … en T s`)
  — c'est elle, rapportée aux posts importés, qui fixera le bloc.
- `source_data/account.py` : `etat_du_rattrapage`, `noter_rattrapage`,
  `ColonneRattrapageAbsente` (patron de la date du trimestriel, 07).
- Migration §23, **ajout seul** : `connected_accounts.rattrapage_instagram_curseur
  text` et `rattrapage_instagram_fini_le timestamptz`, `DEFAULT NULL`, lignes
  au CONTRÔLE et au sommaire. RLS de `connected_accounts` inchangée.
- `saas/data/fetch_data/CLAUDE.md` le dit. Rien sous `saas/web/` : la ligne de
  référence (`lib/instagram/annee.ts`) se calcule déjà sur les posts en base,
  elle suit le Rattrapage d'elle-même.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/08-le-rattrapage-par-blocs/test_rattrapage.py
    → TOUT EST VERT (24 : complet payant — absents < 30 j seulement, à
      l'arrivée 60 et pas 300 ; gratuit à l'arrivée 10 ; gratuit exclu sans
      appel ; passage 1 — page connue sautée, bloc importé, curseur « c2 »
      gardé ; passage 2 — reprise à « c2 », dernier post, curseur vidé et fin
      datée ; passage 3 — aucun appel ; curseur refusé → reprise du haut ;
      inventaire refusé → lève, curseur intact ; panne du bloc → rien
      d'écrit, curseur avant le bloc ; colonnes absentes ; 0 ligne touchée ;
      plafond de pages ; léger — bloc par connexion, sa durée, panne isolée ;
      migration)
    harnais 01 à 07 → TOUT EST VERT
    python3.12 -m py_compile (sync.py, posts.py, account_sync.py, account.py) → OK

Deux vérifications du harnais 07 ont changé, exprès : elles affirmaient que
le complet importe **tous** les absents d'un payant (le point bloquant).

**Ce qui ne se vérifie qu'en vrai**

1. David joue la section 23 (les deux colonnes), puis son CONTRÔLE.
2. **Au cron de 07:00 UTC qui suit** (n'importe quel jour : le bloc vit dans
   le léger), ou à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`,
   mode `mise_a_jour`, `user_id` du compte payant) : la ligne
   `instagram léger en … s — … · rattrapage: N posts importés … en T s`, puis
   `SELECT rattrapage_instagram_curseur, rattrapage_instagram_fini_le FROM
   connected_accounts WHERE instagram_business_id IS NOT NULL;` — un curseur
   non nul chez le payant, NULL chez le gratuit. Le lendemain, le nombre de
   posts en base du payant doit avoir grandi d'un bloc.
3. **Non essayé avec notre jeton** : que Meta accepte un `after` gardé
   24 h (la doc dit qu'un curseur reste valable tant que son post existe ;
   s'il est refusé, la reprise du haut est prévue et se lit dans le mot).
4. **Le réglage** (ce qui garde le ticket `needs-human`) : T / N donne le
   coût d'un post ; `_TAILLE_DU_BLOC` se fixe sur la durée acceptée par
   compte dans le job (plafond 6 h pour tous les comptes), au plus 100.

**Limites connues**
- Si une connexion change d'`instagram_business_id`, un `fini_le` déjà posé
  resterait : à vider à la main (le curseur, lui, serait refusé et repris du
  haut).
- Un post dont les métriques sont refusées dans un bloc partiellement lu
  attend le trimestriel (3 mois) pour ses chiffres ; il s'affiche « – »
  d'ici là.
