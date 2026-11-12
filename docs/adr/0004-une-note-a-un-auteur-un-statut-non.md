# Une note a un auteur, un statut n'en a pas

> **⚠️ CADUQUE — 2026-09-21.** Les Notes et les Actions suivies ont été retirées
> du produit avec les recommandations, et la table `suivi_actions` avec elles.
> Cette fiche reste au dépôt parce qu'une décision et sa raison ne s'effacent
> pas — elle dit pourquoi un récit porte son auteur et un fait n'en porte pas,
> et la distinction resservira si le Carnet revient un jour.

Un compte Pulse appartient à une entreprise, pas à une personne : plusieurs
paires d'yeux travaillent dessus. Deux objets y coexistent et **on les traite à
l'inverse l'un de l'autre**.

Une **Note** est le récit d'une personne — *« refait les visuels »*, *« changé le
ciblage à la main »*. Elle **porte son auteur** (`suivi_actions.author_id`, posé
à la création et jamais réécrit), et **elle seule — ou le Propriétaire du
compte — la corrige et l'efface**. Tout le monde sur le compte la voit.

Le **statut d'une Action suivie** — en cours, fait, jugé, rangé — est un fait de
l'entreprise. Il **n'a pas d'auteur** et n'en aura pas : n'importe quel membre
qui peut agir le fait avancer, **le premier qui juge l'emporte**, et l'écran ne
nomme personne. Le message rendu à la seconde personne est *« déjà marquée
faite »*, sans nom, **parce qu'il n'y a rien à nommer**.

L'alternative évidente était deux colonnes : `author_id` pour qui a ouvert la
ligne, `juge_par` pour qui l'a close. C'est ce que la session recommandait, et
**David l'a refusée** : *« non, on ne duplique pas ; si une reco change son
statut, c'est pour tout le monde, le nouveau statut. »* Le refus n'est pas une
économie de colonne, c'est une position sur ce qu'est le travail : deux verdicts
sur un seul chiffre seraient **une contradiction, pas une nuance** (déjà tranché
au ticket [12](../../.scratch/refonte/issues/12-module-de-commandes.md) §11).
Attacher un nom à un statut inviterait à en discuter — *« c'est toi qui as dit
que c'était fait »* — là où la mesure, elle, ne dépend d'aucune personne : la
baseline est prise à `decided_at` et l'effet est celui du compte.

Ce que ça coûte, les yeux ouverts : **on ne saura jamais qui a jugé quoi.** Si on
change d'avis dans un an, la colonne s'ajoutera facilement mais **l'historique
sera perdu** — il n'y aura rien à reconstituer, et l'inventer serait un chiffre
fabriqué (`CLAUDE.md` §7). C'est le vrai prix de cette fiche, et il est accepté.

Trois conséquences à ne pas « corriger » plus tard en croyant réparer un oubli.

**Aucun backfill sur `author_id`.** Les lignes antérieures n'ont pas d'auteur
connu ; y inscrire le propriétaire du compte serait inventer un fait. Une note
sans auteur est une note ancienne, pas une note cassée.

**L'auteur ne s'affiche que sur un compte à plus d'un membre.** *« David »* à
côté de chaque ligne sur un compte solo est du bruit permanent (ticket
[08](../../.scratch/refonte/issues/08-la-memoire-du-travail.md) §5).

**Le garde-fou de la collision n'est pas optionnel.** `resolveAction` doit
conditionner son `update` au statut de départ **et lire le nombre de lignes
touchées** : sans ça, la seconde personne écrase la première et l'interface
répond *« enregistré »* sans avoir rien écrit — le piège de `CLAUDE.md` §8, un
refus RLS ou un filtre qui ne matche rien ne levant aucune erreur. La règle « le
premier qui juge l'emporte » **n'existe que par ce contrôle** : retirer le
`.eq("status", …)` rétablit silencieusement le dernier-arrivé-gagne.

Cette fiche ne dit rien de ce qu'un membre a le droit de faire : les deux rôles
(*Peut agir*, *Lecture seule*) existent déjà, appliqués à l'écran **et** dans la
RLS, et ils ne changent pas ici.

Tranché par David le 2026-09-11 au ticket
[16](../../.scratch/refonte/issues/16-compteur-partage.md), qui porte le détail —
dont le fait qui a rendu la question beaucoup plus petite qu'annoncé : le
partage des deux tables existait **déjà**, `user_id` portant le compte et non la
personne. Le vocabulaire est dans `CONTEXT.md` (**Note**, **Action suivie**,
**Propriétaire**, **Membre**).
