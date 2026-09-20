# Harnais du ticket 48 — les tableaux de bord lisent le trou en direct

```bash
cd .scratch/construction/harnais/48-trou-en-direct
node --test --experimental-strip-types test_canaux_muets.ts test_fenetre_canal.ts
```

Ni base, ni secret, ni réseau. `faux-supabase.ts` rejoue la seule forme de
requête que `fetchCanauxMuets` écrit — il n'imite pas PostgREST, il imite ce
qu'on lui demande.

## Pourquoi ces tests-là

**Le client ne déclenche rien, donc rien ne se vérifie en cliquant.** Il
faudrait une vraie panne de récolte — un jeton mort, un 500 — pour voir ces
règles s'appliquer à l'écran. Ces tests sont le seul filet qu'on ait dessus.

Ce qu'ils figent :

- **Les trois états qui se ressemblent** (ADR 0005). `meta_ads_insights` rend le
  même nombre de lignes pour « jamais connecté », « la récolte a échoué » et
  « aucune campagne active ». Deux tests séparent le trou du zéro mesuré, et un
  troisième vérifie qu'un canal `saute` ne creuse rien.
- **Le filtre sur le dernier passage.** Sans lui, un échec d'il y a trois
  semaines tairait éternellement la dépense d'un canal réparé depuis.
- **La borne de fenêtre.** Une mesure ne se tait qu'APRÈS le dernier jour écrit ;
  les fenêtres d'avant restent des chiffres.
- **Le rognage d'une plage sur mesure**, et le fait qu'il soit ÉCRIT dans le
  libellé — une fenêtre qu'on raccourcit sans le dire est pire qu'une fenêtre
  fausse.
- **Une plage entièrement postérieure au trou se rabat, elle n'est pas jetée.**
  La jeter renvoyait l'appelant sur la présélection de 7 jours en silence,
  pendant que les champs de date annonçaient la plage tapée. Une plage
  INVERSÉE, elle, reste refusée : ce n'est pas une fenêtre à rabattre, c'est
  une saisie qui n'a pas de sens.

## La couture qui a rendu ça testable

`lib/channels.ts` importe le client Supabase, donc `next/headers`, donc React :
il ne se charge pas hors de Next, et tout ce qu'il contenait était invérifiable
autrement qu'en production. Les règles de fenêtre sont de l'arithmétique pure
sur des dates — elles vivent désormais dans `lib/fenetre-canal.ts`, sans aucun
import, et `channels.ts` les importe. Aucune logique n'a changé en chemin.

C'est la même leçon que `build_payload` / `Lecteur` côté traitement : la partie
qu'on veut vérifier doit pouvoir se charger sans le monde autour.
