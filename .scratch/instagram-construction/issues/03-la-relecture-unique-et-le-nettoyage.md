# 03: La relecture unique et le nettoyage

**What to build:** un drapeau dédié de `weekly-fetch.yml` relit tous les posts
en base (sans image), ce qui remplit `media_product_type`, `permalink`,
`shares`, `profile_visits`, `booste_vu_le`, les j'aime des vidéos et vide
`follows` des Reels. Le même drapeau servira au trimestriel (07). Puis le
nettoyage des faux zéros restants, **validé par David**.

Spec : § La récolte — Ce qui s'ajoute, « La relecture unique » ; § La base,
« Le nettoyage » ; § Testing Decisions, « Ce qui ne se vérifie qu'en vrai ».

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Le drapeau s'ajoute au workflow sans interpolation shell d'une entrée
      libre (même garde que les entrées existantes).
- [ ] La relecture passe par le même chemin que le relevé (01, 02), 2 à 3
      appels par post, sans image.
- [ ] Le `SELECT count(*)` et l'`UPDATE … SET follows = NULL, likes = NULL`
      sont écrits dans ce ticket, **pas dans la migration**, et pas exécutés :
      David lance le workflow, fait le comptage, valide, puis exécute.
- [ ] Harnais : le mode relit tous les posts en base et seulement eux.
- [ ] Le ticket reste ouvert (Status: needs-human) tant que David n'a pas
      lancé la relecture et rejoué la sonde.
