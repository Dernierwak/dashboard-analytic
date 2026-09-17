# « Ses campagnes (8) » sur un thème qui en porte douze

Type: task
Status: resolved

## Question

Trouvé en construisant [14](14-la-porte-vers-la-plateforme.md), qui a dû
renoncer à afficher un nombre de campagnes pour cette raison.

### Le fait

Le worker plafonne la liste publiée : `"campaigns": [... for c in t_camps[:8]]`
(`saas/traitement/build_report.py`, l. 3693-3697), **et garde le compte exact à
côté** — `"n_campaigns": len(t_camps)` (l. 3668).

La carte du thème affiche le pied de la liste plafonnée :

```tsx
Ses campagnes <span …>({theme.campaigns.length})</span>
```

(`saas/web/components/theme-card.tsx`). Sur un thème qui porte douze campagnes,
elle écrit donc **« Ses campagnes (8) »** — un chiffre qui n'est pas le nombre de
campagnes du thème, présenté comme s'il l'était. `CLAUDE.md` §7 : aucun chiffre
fabriqué. Et le dépliage ne le rattrape pas : les quatre manquantes ne sont nulle
part, y compris pour réparer leur étiquette, qui est la seule raison d'être de ce
bloc.

### Ce qu'il faut trancher

- **Le pied dit-il `n_campaigns` et la liste reste à huit** (« 8 sur 12
  affichées ») — honnête, et le lecteur sait qu'il en manque ?
- **Ou le plafond monte-t-il** ? Il a un coût : le payload est déjà gros, et la
  liste est éditable ligne par ligne (`CampaignLabelSelect`).
- **Et que fait-on des campagnes hors des huit qu'on veut ré-étiqueter ?**
  `/meta` et `/google` les portent toutes, et la porte du ticket 14 y mène
  maintenant — c'est peut-être la réponse entière.

### Ce que ça bloque aujourd'hui

La porte vers la plateforme n'affiche **aucun** compte par plateforme à cause de
ça : un « 3 campagnes » tiré de la liste plafonnée vaudrait « trois ou plus »
sans le dire. Le plafond mord aussi sur la PRÉSENCE — les huit gardées sont les
huit plus grosses dépenses, donc une régie où le thème dépense peu peut ne pas
ouvrir de porte du tout sur un thème qui porte plus de huit campagnes.

## Answer

### Ce qui a été tranché

**Le plafond reste à huit, et c'est l'extrait qui arrête de se faire passer pour
le tout.** Le monter avait un coût réel (le payload est déjà gros, chaque ligne
est éditable) sans rien régler : à douze, un thème à quinze campagnes reposerait
la même question. La troisième piste du ticket est la bonne — `/meta` et
`/google` portent TOUTES les campagnes, la porte du [14](14-la-porte-vers-la-plateforme.md)
y mène, et il suffisait de le **dire**.

### Ce qui a été construit

**Le compte exact, régie par régie** — `summary.n_campaigns_canal`
(`build_report.py`, `_compte_par_canal`). Il porte sur `t_camps` ENTIER, jamais
sur l'extrait. Une régie où le thème ne tourne pas n'a **pas de clé** : un `0`
écrit là serait vrai mais ne dirait rien de plus que l'absence. Le plafond
s'appelle désormais `_CAMPAGNES_PUBLIEES` et porte sa raison d'être.

**Un seul endroit qui lit ces comptes** — `saas/web/lib/campagnes-theme.ts`.
`compteCampagnes` rend `{ total, affichees, manquantes }`, `regiesDuTheme` rend
les régies dans l'ordre de lecture des pages avec leur compte. Sur un payload
publié **avant** ce ticket, il retombe sur l'extrait — le comportement d'avant —
mais ne prétend rien : `n` vaut `null`, « on ne sait pas », jamais un nombre
deviné.

**Le pied dit le compte du thème** — « Ses campagnes (12) » sur un thème qui en
porte douze, et non plus (8).

**Le dépliage rattrape ce qui manque**, ce qu'il ne faisait pas : sous la liste,
quand elle est tronquée, « Cette liste garde les 8 plus grosses dépenses. Les 4
autres campagnes de ce thème s'étiquettent sur Google, qui les porte toutes. »
Les régies nommées sont celles qui portent **les manquantes**, pas celles du
thème : sur huit grosses Meta et une petite Google, la seule absente est la
Google, et nommer les deux enverrait chercher sur `/meta` ce qui n'y manque pas
(`regiesDuManque`, trouvé par la revue de code). Sur un payload d'avant ce
ticket, où ce calcul est impossible, la phrase reste et dit « ses pages de
régie » — elle ne nomme personne au hasard.

**La porte ne perd plus de régie** — `destinations()` lisait l'extrait, donc sur
un thème à douze campagnes Meta grasses et deux Google maigres, la porte vers
`/google` **ne s'ouvrait pas**. Elle lit maintenant le compte entier. C'est la
moitié du ticket qui ne se voyait nulle part et qui coûtait le plus.

### Pourquoi la porte n'affiche toujours pas de chiffre

Le ticket note qu'elle n'en affiche aucun « à cause de ça ». Le chiffre est
maintenant exact et disponible — il n'est pourtant pas affiché, pour une **autre**
raison que celle du 14 : Instagram est dans la même rangée, et son chiffre
(`summary.posts`) se mesure sur tout l'historique quand celui des campagnes se
mesure sur la fenêtre du bilan. Une rangée où « 7 » et « 12 » ne compteraient pas
la même chose serait pire que pas de chiffre. Le total reste affiché trente
pixels plus bas. **La donnée est là si on veut revenir dessus** — c'est une
décision d'affichage, plus un blocage.

### Ce que ces comptes mesurent, et ce qu'ils ne mesurent pas

**Tout l'historique, jamais la semaine.** `matrix.campaigns` est agrégé sur toute
la profondeur des données (`insights.py`, `build_matrix`), et l'extrait garde les
plus grosses dépenses **cumulées**. Une campagne arrêtée l'an dernier est donc
comptée dans « Ses campagnes (12) ». C'est cohérent avec le lien de la porte, qui
emporte `matrice.period` — la même profondeur, de la première donnée au dernier
jour plein : une porte ouverte sur une campagne ancienne tombe bien sur une page
qui la montre. Le premier jet de ce ticket écrivait « sur la fenêtre du bilan »
dans les commentaires, ce qui laissait entendre la semaine ; corrigé dans les
trois fichiers.

### Vérifié

`.scratch/construction/harnais/34-le-compte-des-campagnes/` — **15 vérifications**
côté worker (`build_payload` devant le faux lecteur du 16) et **25** côté web
(`lib/campagnes-theme.ts` transpilé et exécuté). Le jeu est le même des deux
côtés : douze campagnes Meta grasses, deux Google maigres, pour que la perte de
régie soit prouvée et pas seulement décrite.

`npx tsc --noEmit` et `npm run build` verts, **19 routes**.
`python3.12 -m py_compile` sur `build_report.py`.

**Ça ne se voit qu'après un passage du worker** — le cron du Jour de travail
(07:00 UTC) ou un lancement à la main depuis GitHub Actions (`weekly-fetch.yml`,
`report_only`) : `n_campaigns_canal` n'existe pas dans les payloads déjà
publiés, et jusque-là les deux écrans se replient sur l'extrait, exactement
comme avant.
