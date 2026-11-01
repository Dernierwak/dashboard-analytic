# 12: Suites relevées pendant la construction

**What to build:** rien encore — la liste de ce que la construction des tickets
01 à 10 a laissé de côté, à trier par David. Chaque ligne dit où elle a été
vue ; aucune n'empêche le contrôle du ticket 11.

**Blocked by:** None

**Status:** needs-triage

- **`CLAUDE.md` racine périmé** (non touché, il est à David) : §1 cite encore
  « le verdict de la semaine, la boussole » ; §9 cite l'input `meta_since`, qui
  n'existe pas dans `weekly-fetch.yml` (le vrai : `depuis`).
- **Code sans lecteur gardé par décision** : `saas/web/lib/changements-api.ts` et
  `saas/web/components/changements.tsx` (aucune page plateforme ne les lit,
  contrairement à ce que dit la spec) ; `phraseChangement` de `etat-action.tsx`
  ne vit que pour eux. Dans `_queries.py` : `fetch_post_metrics`,
  `fetch_daily_followers`, `fetch_objectif`, `fetch_ga4_insights`. `STORY` dans
  `lib/plateformes.ts` (le worker n'écrit jamais ce format).
- **« Compte publicitaire » ne se déclenche jamais** : le CHECK `niveau` de
  `platform_changes` n'admet que campagne, groupe, annonce ; Google n'écrit ni
  `niveau` ni `object_name`, un changement Google hors campagne s'affiche « — ».
- **Anciens posts Instagram** : la récolte n'en relit que 40 par passage (10 sans
  compte payant) ; les anciens resteront sans `permalink` ni « Reel » (l'écran
  dit « lien non récolté », « Vidéo »). Un rattrapage ponctuel serait à décider.
- **Journal illisible** : la carte écrit « Le journal de Meta n'a pas pu être lu
  pour cette semaine », un 3ᵉ état que la spec ne prévoit pas.
- **Hauteur de la liste des changements** : fixe (`max-h-[340px]`), approche la
  hauteur de la carte sans la suivre.
- **Rail à une carte** : avec Meta seul, la carte prend 100 % et ‹ › sont
  masqués ; le 90 % et le dépassement ne jouent qu'à partir de deux canaux.
- **Moustache et couverture** : une semaine passée récoltée en partie mais qui a
  un ratio entre dans les 12 semaines ; la spec n'exclut que les semaines sans
  ratio.
- **Appel Google en double** : la vérification du jeton (ticket 02) et
  `google/ads/sync.py` rafraîchissent chacun le jeton — un appel de plus par
  passage.
- **Avant 07:00 UTC le Jour de travail** : un `report_only` mesure la semaine qui
  finit la veille, le web recule de 7 jours ; seule la carte « compte neuf » est
  touchée (noté dans `blocs/semaine.py`).
- **Liste des canaux** écrite à la main en plusieurs endroits (web et Python) :
  ajouter Google au module des canaux touchera tous ces fichiers.
