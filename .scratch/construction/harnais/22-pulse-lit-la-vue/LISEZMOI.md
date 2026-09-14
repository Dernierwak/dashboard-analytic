# Harnais 22 — Pulse lit la vue

```
cd .scratch/construction/harnais/22-pulse-lit-la-vue && node verifie.mjs
```

Ni base, ni secret, ni réseau. Il transpile `saas/web/lib/regroupement.ts` tel
qu'il est sur le disque et le fait tourner devant un faux client PostgREST qui
pagine — et qui compte ce qu'on lui demande.

## Pourquoi un harnais dans `saas/web`, qui n'a pas de runner

Parce que `npx tsc --noEmit` et `npm run build` ne disent rien de ce que le code
**calcule**. C'était acceptable tant que le web ne faisait que réafficher un
JSON figé ; ce ticket lui donne une arithmétique de lecture, et ses deux erreurs
possibles s'affichent toutes les deux comme un chiffre plausible :

- une page oubliée → un thème disparaît du rapport, sans rien dire ;
- un `??` à la place d'un ternaire → le total d'hier réaffiché comme celui
  d'aujourd'hui.

Aucun runner n'est introduit pour autant : ce fichier est un script `node`
autonome, il ne touche ni `package.json` ni la chaîne de build. L'arbitrage de
David sur [16](../../issues/16-le-seam-du-payload.md) tient.

## Ce qu'il prouve — 35 vérifications

| | |
|---|---|
| **12** · la lecture | la vue lue est bien `theme_regroupement` · bornée au compte REGARDÉ · l'ordre posé **avant** la pagination · 1 500 thèmes rendent 1 500 lignes en deux requêtes · une panne rend « on ne sait pas », pas « rien » |
| **2** · la clé | casse et espaces normalisés comme `_nrm` côté worker · le label brut conservé tel quel |
| **21** · la fusion | les trois cas ci-dessous · aucun champ figé ne survit à une réponse de la vue · une pagination qui n'avance pas s'arrête au lieu de tourner sans fin · les bords (pas de rapport, aucun thème) |

## Les trois cas de la fusion, et pourquoi ils ne se confondent pas

1. **La vue répond pour ce thème** → ses chiffres remplacent les figés, et
   `spend_week`, `best_campaign`, `n_campaigns` et le `jugement` **ne bougent
   pas**. C'est la frontière du ticket 17 : ce qui se REGROUPE se recalcule, ce
   qui est MESURÉ ou RÉDIGÉ attend le Jour de travail.
2. **La vue répond, mais pas pour ce thème** → ses chiffres passent à `null`.
   Ni les anciens (la vue ne les confirme plus), ni zéro (qui affirmerait qu'il
   n'a rien dépensé — `CLAUDE.md` §7).
3. **La vue ne répond pas du tout** → on ne rafraîchit **rien**, et le harnais
   vérifie que c'est l'objet d'origine qui ressort, pas une copie. Effacer des
   chiffres parce qu'une migration manque punirait le lecteur.

## Le plafond PostgREST est vérifié, pas supposé

`CLAUDE.md` §8 dit que PostgREST tronque à 1 000 lignes **en silence**. Le faux
client le reproduit exactement — `range(a, b)` découpe, rien n'avertit — donc le
cas « 1 500 thèmes » échoue franchement si la boucle de pagination disparaît un
jour. Vérifié en injectant la panne : le harnais tombe sur trois contrôles.

## Ce qu'il ne couvre PAS

- **Le SQL de la vue.** Il est prouvé par le harnais
  [04-vue-sql](../04-vue-sql/), sur un vrai PostgreSQL. Ici on ne vérifie que ce
  que Pulse fait de ses lignes.
- **L'affichage.** Les deux phrases de `theme-card.tsx` (« revenu inconnu » et
  « pas encore assez de dépense ») n'ont pas de runner pour les rendre. Elles se
  lisent à l'œil, sur un compte dont la vue est en service.
- **Les types.** Ils sont contrôlés par `npx tsc --noEmit` sur le projet entier ;
  le harnais les remplace par des doublures pour pouvoir compiler le module seul,
  hors alias `@/`.
