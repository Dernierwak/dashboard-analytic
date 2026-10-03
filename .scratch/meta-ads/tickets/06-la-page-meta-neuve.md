# 06: La page Meta neuve — premier tracé de bout en bout

Type: task
Status: ready-for-human
Blocked by: 02

**What to build:** le client ouvre Meta Ads et lit, pour la période et la campagne
choisies, ce que ses campagnes ont **touché** (Notoriété) et fait **cliquer**
(Trafic) — un total jour par jour, comparé à la période d'avant, avec des chiffres
identiques à Ads Manager. La page `/meta` actuelle est **remplacée**, pas
complétée. Spec : § « La structure », § « Les vues et leurs métriques »,
§ « La lecture des données côté web », § « L'état de la page vit dans l'URL » ;
user stories 1 à 5, 9, 12 à 15, 17, 19 à 21, 28, 56.

Ce ticket pose la couche de lecture propre à Meta dont tous les modules suivants
tirent leur contenu. Le Bandeau y est **minimal** (le ticket 07 le complète) ; la
vue Conversion n'y est pas (ticket 10).

Seam de test : « lignes de base + commandes → contenu des modules », par des
fonctions pures sans directive `"use client"`. `saas/web` n'a pas de lanceur de
tests : le ticket **écrit son harnais** et le dit.

- [x] La lecture est **paginée au-delà de 1 000 lignes** (testé à plus de 1 000)
- [x] Le jour en cours est exclu (testé)
- [x] Ratios recalculés total ÷ total, jamais moyennés : CPM, CTR, CPC ; clic =
      **tous les clics**, et l'écran l'écrit (testé)
- [x] Diviseur nul ou absent → « — » ; aucun écart « +∞ % » ; base absente ou
      nulle → « — » (testé)
- [x] La campagne est choisie **par son ID** ; une ligne sans ID n'est jamais
      rattachée par son nom à une autre ; une campagne renommée reste une seule
      campagne, sous son nom le plus récent (testé)
- [x] Bandeau : titre, « Chiffres Meta au <Jour de travail>, 07:00 » lu dans le
      dernier passage réussi, choix de campagne, période — par défaut la semaine
      mesurée, comparée aux sept jours d'avant ; pas de période « Tout » ; pas de
      filtre par statut
- [x] Sélecteur de vue : les cartes Notoriété et Trafic, chacune avec icône,
      question, chiffre principal et écart ; on comprend qu'elles se cliquent et
      qu'elles changent toute la page ; elles ne filtrent aucune campagne
- [x] Tendance : un graphe par métrique de la vue, la principale en grand, la
      période d'avant en pointillé ; un jour sans donnée est un trou, pas un zéro
- [x] Vue, campagne et période vivent dans l'URL ; un lien énumère ce qu'il change,
      jamais ce qu'il garde
- [x] Grammaire de module respectée (chiffre en premier) ; skills `dataviz` et
      `frontend-design` appelées avant de dessiner ; palette validée ; animations
      coupées pour qui les a réduites ; intitulés en français (« groupe
      d'annonces », jamais « ad set »)
- [x] Un membre invité voit la même page, sans aucun accès aux jetons
- [x] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
      verts, **19 routes** (le prototype vit encore)

## Comments

**2026-10-03 — construit et vérifié hors ligne. Reste à le voir sur la vraie
base, ce qui attend le `000` du ticket 02.**

Ce qui a été fait :
- `saas/web/lib/meta/lecture.ts` — la couche de lecture, **pure**, sans
  directive ni import : lecture paginée, période (semaine mesurée par défaut,
  jour en cours exclu, arrêt au dernier jour lu si la récolte a échoué),
  campagnes par ID, métriques et ratios total ÷ total, écarts, séries avec
  trous, écriture des nombres (« — » pour l'absent). `lib/meta/liens.ts` —
  `lienMeta`, qui n'énumère que ce qu'il change. `lib/meta/donnees.ts` — la
  seule couche qui lit Supabase (`meta_ads_insights` paginé et trié
  `date_start, id` ; `fetch_progress` pour la date de lecture ; canal muet).
- `lib/jour-de-travail.ts` — `dernierJourDeTravail`, à côté de
  `prochainPassage` (le jour même, il ne compte qu'après 07:00 UTC).
- `components/courbe.tsx` — brique **neutre** (ADR 0011) : `line-chart.tsx`
  relie les points par-dessus un jour vide, celle-ci coupe le tracé. Les modules
  `components/meta/` : `bandeau.tsx`, `selecteur-vue.tsx` (de vrais liens),
  `tendance.tsx`, `elements.tsx`. `app/meta/page.tsx` remplacé ;
  `getMetaDash` retiré de `lib/channels.ts`.

**Harnais** : `.scratch/meta-ads/harnais/06-la-page-meta-neuve/lecture.test.ts`,
lancé par `node --test .scratch/meta-ads/harnais/06-la-page-meta-neuve/lecture.test.ts`
(`node:test`, rien d'ajouté au projet) — **26 tests verts**, dont : 2 345 lignes
lues en trois pages, une page en erreur qui lève, le CTR total ÷ total contre
la moyenne des CTR, diviseur nul → « — », base nulle → pas de « +∞ % », jour
en cours exclu, un jour vide = trou, campagne renommée = une seule ligne sous le
nom récent, ligne sans ID jamais rattachée à une campagne qui en a un, ID
inconnu en URL qui ne retombe pas sur « toutes », liens qui gardent ce qu'ils
ne connaissent pas. `tsc --noEmit` et `npm run build` verts, **19 routes**.

**Vu dans Chrome** sur une page de contrôle temporaire nourrie de lignes
fabriquées (supprimée, `git grep controle-` propre) : les deux cartes, la
Tendance, le trou, la bulle au survol, la campagne renommée. **Pas vu** : la
largeur téléphone (la fenêtre n'a pas voulu se redimensionner), ni la page sur
de vraies données.

Skills `dataviz` et `frontend-design` chargées avant de dessiner ; la direction
visuelle est celle du prototype validé. Validateur de palette lancé sur fond
blanc : `#1a56ff` passe tout ; le gris `#8b8e98` de la période d'avant échoue
au plancher de chroma — voulu, c'est un fond de comparaison et non une
identité, distingué par le pointillé et la légende (commenté dans
`courbe.tsx`).

Choix faits, à renverser si David le veut :
- **« Chiffres Meta au lundi 5 octobre, 07:02 UTC »** : l'heure est celle du
  départ réel du passage (`fetch_progress.run_id`), pas un « 07:00 » écrit en
  dur — une relance à la main s'écrirait 07:00 à tort. `fetch_progress` ne
  garde qu'une ligne par canal : quand le dernier passage a échoué, la date du
  précédent réussi est perdue, et la phrase le dit au lieu d'en inventer une.
- **Lignes sans ID** (d'avant le rejeu, ticket 03) : regroupées entre elles par
  leur nom, sous une clé à part (`sans-id:<nom>`), jamais avec une campagne
  identifiée. Deux campagnes homonymes d'avant le rejeu restent donc fusionnées
  jusqu'au rejeu — c'est ce que faisait l'ancienne page, et rien ne permet de
  les séparer avant.
- **Période choisie** : deux champs de date natifs et « Revenir à la semaine
  mesurée » ; le ticket 07 les remplace par ses raccourcis et son calendrier.
- **Devise** : CHF, comme les autres pages publicitaires ; la devise du compte
  Meta n'est pas récoltée.

Trouvé en chemin : le code Meta resté dans `channel-dash.tsx` → ticket 15.

**Pour David** : la page lit `campaign_id` et `adset_id` — **elle ne doit pas
partir en production avant que le `000` du ticket 02 soit joué**, sinon la
requête refuse et `/meta` tombe en erreur. Après le `000` : ouvrir `/meta`.
Aucun passage du worker n'est nécessaire pour voir la page ; les IDs, eux,
n'apparaissent dans les lignes qu'après le passage du ticket 03
(`weekly-fetch.yml` à la main, `force`), et les lignes anciennes après son
rejeu (`meta_since`). D'ici là, toutes les campagnes sont des lignes « sans ID »
regroupées par nom, comme avant.
