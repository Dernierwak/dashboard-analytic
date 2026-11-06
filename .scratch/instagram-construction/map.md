# Chantier — Construire la page Instagram organique

Destination : la spec [`../instagram/spec.md`](../instagram/spec.md) construite
sur la branche d'intégration `instagram-construction`, chaque ticket résolu.

Les tickets citent la spec par ses sections (« spec § La récolte — Ce qui
s'ajoute ») ; la spec cite ses tickets d'origine dans `../instagram/issues/`.

## Le graphe

```
01 ─┬─ 04 ─┬─ 02 ── 03 ── 07 ── 08
    │      └─ 05 ── 06
    └─ 09 ── 10 ─┬─ 11
                 ├─ 12 (+02)
                 └─ 13
    09 + 05 ──── 14
    11–14 ────── 15
```

Deux couloirs : la récolte (01–08, mêmes fichiers Python, donc en série) et la
page (09–15). 14 vit dans ses propres fichiers et peut courir à côté de 11–13.

## Les harnais

`saas/web` et la récolte n'ont pas de lanceur de tests (CLAUDE.md §9). Chaque
ticket écrit son harnais sous `harnais/<NN>-*` de ce dossier et dit comment le
lancer.

## Ce qui ne se vérifie qu'en vrai

Aucun PostgreSQL ni Docker sur la machine de construction : la migration se
relit, elle ne s'essaie pas. Elle est donnée à David pour Supabase. Les relevés,
le passage léger et la relecture unique ne se voient qu'après un passage du
worker (cron de 07:00 UTC ou lancement à la main depuis l'onglet GitHub
Actions).
