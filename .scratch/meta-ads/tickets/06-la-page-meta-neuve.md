# 06: La page Meta neuve — premier tracé de bout en bout

Type: task
Status: ready-for-agent
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

- [ ] La lecture est **paginée au-delà de 1 000 lignes** (testé à plus de 1 000)
- [ ] Le jour en cours est exclu (testé)
- [ ] Ratios recalculés total ÷ total, jamais moyennés : CPM, CTR, CPC ; clic =
      **tous les clics**, et l'écran l'écrit (testé)
- [ ] Diviseur nul ou absent → « — » ; aucun écart « +∞ % » ; base absente ou
      nulle → « — » (testé)
- [ ] La campagne est choisie **par son ID** ; une ligne sans ID n'est jamais
      rattachée par son nom à une autre ; une campagne renommée reste une seule
      campagne, sous son nom le plus récent (testé)
- [ ] Bandeau : titre, « Chiffres Meta au <Jour de travail>, 07:00 » lu dans le
      dernier passage réussi, choix de campagne, période — par défaut la semaine
      mesurée, comparée aux sept jours d'avant ; pas de période « Tout » ; pas de
      filtre par statut
- [ ] Sélecteur de vue : les cartes Notoriété et Trafic, chacune avec icône,
      question, chiffre principal et écart ; on comprend qu'elles se cliquent et
      qu'elles changent toute la page ; elles ne filtrent aucune campagne
- [ ] Tendance : un graphe par métrique de la vue, la principale en grand, la
      période d'avant en pointillé ; un jour sans donnée est un trou, pas un zéro
- [ ] Vue, campagne et période vivent dans l'URL ; un lien énumère ce qu'il change,
      jamais ce qu'il garde
- [ ] Grammaire de module respectée (chiffre en premier) ; skills `dataviz` et
      `frontend-design` appelées avant de dessiner ; palette validée ; animations
      coupées pour qui les a réduites ; intitulés en français (« groupe
      d'annonces », jamais « ad set »)
- [ ] Un membre invité voit la même page, sans aucun accès aux jetons
- [ ] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
      verts, **19 routes** (le prototype vit encore)
