# « Ses campagnes (8) » sur un thème qui en porte douze

Type: task
Status: open

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
