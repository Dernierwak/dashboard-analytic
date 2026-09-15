# Un seul « ✓ Je l'ai fait » fait descendre la Marche suivante deux fois

Type: bug
Status: open
Blocked by:

## Question

**Trouvé par la revue de code lancée sur le ticket 29**, qui portait sur toute
la branche. Ne vient pas de 29 : c'est le travail du ticket 24 (Marche
suivante).

### Le fait

`saas/traitement/build_report.py` l. 3899, la garde `_neuf` :

```python
_neuf = (_semaine_precedente is None or (
    _faites and str(_faites[-1].get("done_at") or "")[:10]
    >= _semaine_precedente))
```

Son commentaire annonce la bonne intention — « depuis la dernière fois qu'on t'a
parlé » — mais `_semaine_precedente` n'est pas la date où on a parlé : c'est le
**`week_start` du rapport précédent**, donc un LUNDI (l. 2411), alors que le
rapport est publié le Jour de travail du client.

L'écart entre ce lundi et la publication est une fenêtre où un clic est compté
**deux fois**. Compte servi le jeudi :

| | publication | `week_start` |
|---|---|---|
| Rapport A | jeu. 03/09 | 31/08 |
| Rapport B | jeu. 10/09 | 07/09 |
| Rapport C | jeu. 17/09 | 14/09 |

Le client clique « ✓ Je l'ai fait » le **mardi 08/09**.

- Rapport B : `_semaine_precedente` = 31/08 → `08/09 >= 31/08` → la Marche part.
- Rapport C : `_semaine_precedente` = 07/09 → `08/09 >= 07/09` → **elle repart**,
  avec une étape différente.

L'empreinte anti-répétition ne rattrape rien : chaque étape porte sa propre clé,
c'est écrit dans le commentaire juste au-dessus. C'est exactement le « on
descendait une échelle que plus personne ne montait » que la garde existe pour
empêcher — borné à 2 au lieu de ∞, et à **3** pour un compte servi le lundi, où
`week_start` recule de deux crans.

### Ce qu'il faut trancher, parce que la borne juste n'est pas stockée

La borne honnête est la **date de publication du rapport précédent**. Elle
n'existe pas telle quelle en base :

- `weekly_reports` porte `week_start` (un lundi) et `updated_at timestamptz`
  (`supabase/migrations/weekly_reports.sql` l. 10) — **pas** de `created_at` ni
  de `published_at` ;
- `rapports_publies` (`saas/traitement/lecteur.py` l. 254) ne sélectionne que
  `week_start, payload` ;
- `updated_at` bouge à chaque **republication** — or la publication est
  idempotente et rejouable (`build_report.py` l. 5969). Republier une vieille
  semaine ferait donc reculer, ou avancer, une borne qui ne devrait pas bouger.

Trois voies :

1. **Lire `updated_at`** et s'en servir comme borne. Une ligne à changer dans le
   `select`, juste dans le cas courant, faux après une republication manuelle.
2. **Ajouter `published_at`**, posé une seule fois à la première écriture et
   jamais réécrit. La seule borne qui dise vraiment « la dernière fois qu'on t'a
   parlé ». Coûte une migration.
3. **Basculer sur `week_start_rapport`** (le `week_start` du rapport EN COURS).
   C'est ce que la revue proposait. Ça supprime bien le doublon — mais ça
   **perd** les clics posés entre la publication précédente et le lundi suivant :
   un clic du dimanche 06/09 ne serait plus neuf pour aucun rapport, et la
   Marche ne partirait jamais. On échange un doublon contre un silence, ce qui
   n'est pas évidemment mieux.

### Ce qui n'est pas mesuré

**Combien de clics tombent réellement dans la fenêtre.** Elle va du lundi au
Jour de travail : trois jours sur sept pour un compte servi le jeudi, zéro pour
un compte servi le lundi — mais ce compte-là, lui, recule de deux crans. Pas
d'accès à la base depuis cet environnement pour compter les `done_at` concernés.

### Le piège de fichiers

`saas/traitement/build_report.py` (l. 2405-2415 et 3899),
`saas/traitement/lecteur.py` (l. 254), et une migration si la voie 2 est
retenue. Les harnais de `.scratch/construction/harnais/24-marche-suivante/`
rejouent ce chemin.
