# 05: Ce qui s'additionne dans la vue générale

Type: grilling
Status: resolved
Blocked by: 01
Assignee: Dernierwak

## Question

La vue générale montre le compte Google entier, tous types confondus.
**Quels chiffres ont le droit d'y être totalisés**, et lesquels ne veulent
pas dire la même chose d'un type à l'autre ?

- la **dépense** s'additionne sans débat ;
- une **impression** YouTube, Display et Search n'est pas la même chose ; un
  **clic** non plus (un clic YouTube est rare et vient après une vue) ;
- les **conversions** s'additionnent-elles quand PMax et Search se disputent
  les mêmes ? Que fait-on des conversions après affichage ?
- un **ratio** global (CPC, CTR, coût par conversion) mélange des mondes :
  l'afficher, l'afficher avec sa répartition par type, ou ne pas l'afficher ?

Règle de §7 : ce qu'on ne peut pas comparer, on écrit pourquoi. La réponse
fixe la Tendance de la vue générale et ses cartes.

## Answer

Grilling avec David, 2026-11-10. Le principe qui tranche tout : **« on prend
ce que Google Ads nous montre »** — tant que la page retrouve les nombres de
Google Ads, elle est juste ; c'est un chiffre différent de Google qui pose
problème.

**Tout ce qui se compte est totalisé, tous types confondus**, rangé dans les
vues Notoriété / Trafic / Conversion : impressions, clics, coût, conversions,
valeur de conversion. Une impression Search et une impression Vidéo ne sont
pas le même événement, mais Google les additionne dans sa Vue d'ensemble ; la
**moustache** (ticket 04) dit d'où vient le total et quel type fonctionne le
mieux, métrique par métrique. Une ⓘ le rappelle sur impressions et clics. Pas
de « — » sur un total parce que plusieurs types ont diffusé.

**La portée ne se totalise pas** (§7, ticket 01 : non additionnable, par
campagne, 92 j) — elle n'entre pas dans les totaux ; où elle vit, s'il y a
lieu, se tranche avec la Vidéo (07).

**Les taux (CTR, CPC, CPM, coût par conversion, ROAS) sont des taux calculés
sur les totaux** (`CONTEXT.md`) : somme ÷ somme sur la Fenêtre et le filtre
choisis, recalculés à chaque changement, depuis les comptes bruts récoltés par
jour. C'est la méthode de Google Ads, donc les chiffres coïncident. Jamais un
taux récolté tout fait chez Google puis remoyenné — il serait faux dès que le
filtre change (David : « sinon c'est impossible de à chaque fois prendre la
bonne »). Le mot « moyenne » ne s'écrit pas à l'écran pour ces taux.

**Les conversions = la colonne « Conversions » de Google (`metrics.conversions`)**,
additionnée entre types et entre campagnes telle que Google l'attribue :
aucune règle maison de dédoublonnage PMax / Search. Datée comme la colonne de
Google (au clic — _déduction_ du ticket 01, à confirmer au 10), donc pas
`conversions_by_conversion_date`.
- **Récoltées dès la première version** : `conversions`, `all_conversions`,
  `view_through_conversions`, dans la même requête.
- **Affichée en première version** : « Conversions » seule. Le choix de la
  conversion affichée est au `BACKLOG.md`, pour ne pas l'oublier.

**Valeur de conversion et ROAS** (valeur ÷ coût, calculé sur les totaux)
**entrent dans la vue Conversion** — déclarés par Google, sans GA4 (ADR 0010).
Un compte sans valeur configurée affiche « — » avec sa raison (« aucune valeur
de conversion déclarée dans Google Ads »), jamais « 0 € » ni un ROAS de 0.
Que Google rende 0 ou vide dans ce cas se vérifie au ticket 10.

**Ce que ça fixe pour la Tendance et les cartes** : les cartes portent les
totaux et taux ci-dessus ; la Tendance trace les mêmes séries, recalculées
jour par jour depuis les comptes bruts. La répartition exacte entre les trois
cartes se fixe à la spec, sur le modèle Meta (Notoriété : impressions, CPM ;
Trafic : clics, CTR, CPC ; Conversion : conversions, coût par conversion, taux
de conversion, plus valeur et ROAS).

Pas d'ADR : c'est l'ADR 0010 (ce que Google déclare) et §7 appliqués. Rien
d'ajouté à `CONTEXT.md` : « taux calculé sur les totaux » y est déjà défini.
