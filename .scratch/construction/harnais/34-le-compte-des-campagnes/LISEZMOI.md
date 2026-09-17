# Harnais 34 — le compte des campagnes d'un thème

```
cd .scratch/construction/harnais/34-le-compte-des-campagnes
python3.12 test_compte_des_campagnes.py   # le worker — 15 vérifications
node verifie.mjs                          # le web    — 25 vérifications
```

Ni base, ni secret, ni réseau. Le premier exécute `build_payload` devant le faux
lecteur du harnais 16 ; le second transpile `saas/web/lib/campagnes-theme.ts` tel
qu'il est sur le disque et le fait tourner sur des payloads en mémoire.

**Le faux lecteur n'est pas recopié** : `pulse.py` met
`16-le-seam-du-payload/` sur le chemin. Une deuxième copie dériverait de la
première en silence — exactement ce que `lecteur_fige.py` s'interdit à lui-même.

## Le défaut, en une phrase

`themes_focus[].campaigns` est un **extrait** — les huit plus grosses dépenses du
thème — et deux écrans s'en servaient comme d'un tout :

- la carte écrivait « Ses campagnes (8) » sur un thème qui en porte douze, un
  chiffre qui n'est pas le nombre de campagnes du thème et se présentait comme
  s'il l'était (`CLAUDE.md` §7) ;
- la porte vers la plateforme déduisait de cet extrait les régies où le thème
  tourne — or les huit gardées sont les huit plus **grosses**, donc une régie où
  il dépense peu disparaissait, et sa porte ne s'ouvrait pas.

## Ce qu'il prouve

| | |
|---|---|
| **15** · le worker | la liste publiée s'arrête au plafond pendant que `n_campaigns` porte les quatorze · les huit gardées sont **toutes Meta** sur le jeu à deux régies, donc déduire la présence de l'extrait répondrait faux · `n_campaigns_canal` voit les deux Google · la somme des régies **est** le total · sous le plafond, liste et compte coïncident · une régie absente n'a **pas de clé**, elle ne vaut pas 0 |
| **25** · le web | le total vient de `summary`, jamais de l'extrait · la régie absente de l'extrait ouvre quand même sa porte · zéro campagne se dit zéro et n'ouvre rien · une régie écrite à 0 n'ouvre pas de porte · un payload d'avant le ticket se replie sur l'extrait **sans énoncer de nombre** (`n: null`) · `manquantes` n'est jamais négatif · Meta avant Google, quel que soit l'ordre des clés · **les régies du MANQUE ne sont pas les régies du thème** (§ ci-dessous) |

Le jeu de campagnes est le **même des deux côtés** — douze Meta grasses, deux
Google maigres — pour que les deux moitiés parlent du même cas.

## Le bloc 7 vient de la revue de code

`regiesDuManque` a d'abord été écrite comme « les régies du thème », et c'était
faux d'une manière qui ne se voit pas : sur un thème à **huit grosses Meta et
une petite Google**, l'extrait contient les huit Meta, la seule manquante est la
Google — et la phrase envoyait chercher sur `/meta` quelque chose qui n'y manque
pas. Le calcul exact est `n_campaigns_canal[régie] − (campagnes de cette régie
dans l'extrait)`. Les quatre vérifications du bloc 7 tiennent ce cas, celui où
les deux régies débordent, celui où rien ne manque, et celui où le payload ne
permet pas de savoir — on ne nomme alors personne.

## Ce que ces comptes mesurent : tout l'historique

`matrix.campaigns` est agrégé sur **toute la profondeur des données**
(`saas/recos_ia/insights.py`), pas sur la semaine, et l'extrait garde les plus
grosses dépenses **cumulées**. C'est la même profondeur que `matrice.period`, la
fenêtre que la porte emporte dans son lien — les deux se répondent, et c'est ce
qui fait qu'une porte ouverte sur une campagne arrêtée l'an dernier tombe bien
sur une page qui la montre. Un écran qui écrirait « cette semaine » à côté d'un
de ces comptes mentirait ; le vocabulaire est posé dans les commentaires des
trois fichiers concernés.

## Le plafond est recopié dans le test, exprès

`PLAFOND_PUBLIE = 8` est écrit dans `test_compte_des_campagnes.py` à côté de
`_CAMPAGNES_PUBLIEES` du worker. Si quelqu'un déplace le plafond, ce harnais
**doit** tomber : le front en déduit ce qui manque, et la phrase « les 4 autres
campagnes » se lit sur cette différence. Un test qui suivrait la constante en
silence ne vérifierait plus rien.

## Ce qu'il ne prouve pas

- **Le rendu.** Rien ici n'ouvre `theme-card.tsx` ni `porte-canal.tsx` : le
  harnais mesure la fonction qu'ils appellent (`lib/campagnes-theme.ts`), pas ce
  qu'ils en affichent. Le libellé de la phrase « les N autres campagnes » se
  relit à l'œil. Aucun runner n'est introduit dans `saas/web` — l'arbitrage de
  David sur le [16](../../issues/16-le-seam-du-payload.md) tient.
- **Un thème sans AUCUNE campagne dans le payload.** Le cas existe — un thème
  purement organique — mais le faux lecteur ne grée pas les publications
  Instagram (limite déjà écrite dans le LISEZMOI du 16). Le comportement est
  mesuré sur `_compte_par_canal` directement, et côté web sur un payload
  construit à la main.
- **Que le plafond de huit soit le bon.** Il n'a pas bougé et ce harnais ne le
  discute pas ; il vérifie seulement que l'extrait ne se fait plus passer pour
  le tout.
