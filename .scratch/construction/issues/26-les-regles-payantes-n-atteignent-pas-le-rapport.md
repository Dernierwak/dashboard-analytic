# Les règles payantes sont écrites, et aucun client ne les verra

Type: task
Status: open

## Question

**Découvert en finissant le ticket [07](07-quatre-regles-payantes.md)**, dont
c'est la prémisse. `CLAUDE.md` §4 : ce qui n'était pas demandé et que je
découvre devient un ticket, pas un détour silencieux. Et la carte : *« si le
code contredit la décision, c'est un fait, pas une permission — on le remonte
dans le ticket et on demande. »*

**Ce ticket ne re-litige rien.** Il constate un écart entre ce que deux tickets
de la refonte tiennent pour acquis et ce que le code fait.

### Le fait

`build_payload` a **deux chemins** pour les conseils d'un thème :

- `_ia_redigee == True` → **composition 100 % Gemini** (décision de David du
  27 août 2026). *« Plus aucun conseil-règle (`build_recos`, `_orga_recos`,
  `_reco_evenements`) ne participe aux 3 recos de ce thème. »*
- `_ia_redigee == False` → les conseils-règles, mélangés et coupés à trois.
  C'est là que vivent `roas`, les quatre `orga_*`, `theme_event_*` — et
  désormais les quatre règles payantes du ticket 07.

Et `_ia_redigee` vaut :

```python
_themes_ia = {_nrm(_l) for _l in theme_list[:_THEMES_IA]}   # _THEMES_IA = 3
_ia_redigee = nlbl in _themes_ia
```

`theme_list` **est** la liste des thèmes étoilés (`priority_labels`), ou les
trois premiers par poids quand le client n'a rien étoilé. Donc :

> **Tant qu'un client a trois thèmes étoilés ou moins, `theme_list` fait au
> plus trois entrées, `_themes_ia` les contient TOUTES, et pas un seul
> conseil-règle n'atteint le rapport.** Ni les quatre neuves, ni `roas`, ni
> les quatre `orga_*`.

Le chemin des règles ne s'ouvre qu'à partir de la **quatrième étoile** —
`togglePriorityLabel` (`app/actions.ts`) le permet et l'annonce au client
(*« ce thème aura sa carte, ses chiffres et ses conseils calculés, mais pas de
pistes rédigées par l'IA »*), mais `CLAUDE.md` §1 dit *« trois au maximum »*.

### Ce que ça contredit

- [22](../../refonte/issues/22-rebrancher-le-plan-de-theme.md) a compté *« sept
  clés qui concourent pour les cinq places »* et conclu *« un compte sans
  Instagram reçoit UN conseil par semaine — `roas`, et lui seul »*. Sous ce
  code, il en reçoit **zéro** : `roas` est un conseil-règle.
- [24](../../refonte/issues/24-conseils-payants-manquants.md) a écrit dix
  règles pour fermer ce trou, et [07](07-quatre-regles-payantes.md) en a livré
  quatre, vérifiées. **Aucune ne peut sortir chez un client à trois étoiles.**

Le trou n'était donc pas seulement *règles payantes × plafond par thème*
(24, décision 7) : il y a une **porte** avant, et les deux tickets l'ont
comptée ouverte.

### Ce qu'il faut trancher

C'est une question produit, pas une correction : **à qui appartiennent les
trois places d'un thème étoilé ?**

- **Gemini seul** — la décision du 27 août tient telle quelle, et les dix règles
  payantes de 24 n'ont de sens que pour la 4ᵉ étoile et au-delà. Il faut alors
  dire ce qu'un compte à une étoile reçoit quand Gemini ne répond pas : le
  filet (`_reco_theme_calme`) est une **veille**, pas un conseil.
- **Les règles d'abord, Gemini pour compléter** — c'est ce qui existait avant
  le 27 août (`_need = max(0, 3 - len(t_recos))`), et c'est ce que 22 et 24
  supposent. Ça rouvre une décision de David : il faut la lui poser.
- **Les deux, mais pas aux mêmes places** — les conseils-règles portent une
  mesure, les pistes de Gemini portent une théorie. 22 (décision 1) a déjà
  posé *2 « générale » + 1 « hypothèse »* : un partage par RÔLE existerait
  sans toucher au plafond de trois.

### Ce qui est déjà fait et n'attend que cette porte

Le ticket 07 est livré et vérifié : les quatre règles, leurs cinq colonnes,
leurs deux lectures (`fetch_google_ads_ad_insights` paginée,
`fetch_platform_budgets`), 172 vérifications. **Rien n'est à refaire** — le
branchement est posé au bon endroit (le chemin des règles, avec
`_orga_recos` et `_reco_evenements`). Ce ticket ne déplace pas du code, il
décide qui passe la porte.

### Consigne de conduite

Ticket **HITL** : la question est à David, et elle rouvre une décision qu'il a
prise lui-même le 27 août 2026. Lire d'abord la note « COMPOSITION 100 % GEMINI »
dans `build_payload` — elle porte ses mots exacts.

### Consigne de repli

Rendre la mesure et rien d'autre : **ce que reçoit aujourd'hui un compte à une
étoile, à deux, à trois et à quatre**, ligne par ligne, sur le compte de David.
Un compte mesuré vaut mieux qu'une restructuration proposée.

## Comments

**2026-09-12, ce ticket est répondu par construction — par
[08](08-filtre-dur-et-plafond-de-cinq.md), qui n'a pas rouvert sa question.**

08 a exécuté une décision déjà prise par David
([refonte 11](../../refonte/issues/11-d-ou-viennent-les-conseils.md)) : **les
pistes rédigées par Gemini sont coupées.** `_theme_ai_recos` n'existe plus, et
le chemin `_ia_redigee == True` avec elle. **Il n'y a donc plus de porte à
arbitrer** : les trois places d'un thème appartiennent aux règles, pour tout
thème conseillé — dès la PREMIÈRE étoile. Le fait que ce ticket relevait est
corrigé : `roas`, les quatre `orga_*`, `theme_event_*` et les quatre règles
payantes du ticket 07 atteignent le rapport d'un compte à une, deux ou trois
étoiles.

La troisième option que ce ticket proposait — « les deux, mais pas aux mêmes
places », un partage par RÔLE — est sans objet : il n'y a plus qu'un auteur.

**Ce ticket reste `open` exprès.** Il est HITL et sa question était pour David ;
une session ne ferme pas un ticket qui lui était adressé, même quand le code a
fini par lui donner une réponse. À lire, puis à fermer par lui.

---

**2026-09-14, la consigne de repli est rendue : la porte est mesurée, plus
seulement racontée.**

Le commentaire du 12 disait que la porte avait disparu ; il le disait en lisant
le code. La mesure que ce ticket demandait en repli — *« ce que reçoit
aujourd'hui un compte à une étoile, à deux, à trois et à quatre, ligne par
ligne »* — est maintenant **exécutée**, sur le seam du ticket
[16](16-le-seam-du-payload.md) : `build_payload` tourne sur un lecteur figé, un
compte à quatre thèmes, sans base, sans secret, sans réseau. Elle se rejoue —
`.scratch/construction/harnais/26-la-porte/`, `python3.12 mesure.py`.

| Étoiles | Cartes rendues | Conseils servis | Ce que le compte reçoit |
|---|---|---|---|
| 0 | 3 (repli par poids) | **0** | cartes, chiffres, courbes, le point de vue de la semaine — aucun conseil, et c'est voulu |
| 1 | 1 | **2** | `annonce_sans_conversion`, `roas` — plus `page_arrivee_muette` au socle |
| 2 | 2 | **4** | les deux mêmes sur chacun des deux thèmes |
| 3 | 3 | **5** | 2 + 2 + 1 — **le plafond de cinq mord ici**, pas la porte |
| 4 | 4 | **5** | la 4ᵉ étoile garde carte, chiffres et courbe, `conseille: false`, zéro conseil |

**Ce que cette mesure prouve, et qui est exactement le fait que ce ticket
relevait :** `annonce_sans_conversion` est **une des quatre règles payantes du
ticket [07](07-quatre-regles-payantes.md)**, et `roas` est le conseil-règle que
le ticket [22](../../refonte/issues/22-rebrancher-le-plan-de-theme.md) comptait.
Tous deux **sortent dès la PREMIÈRE étoile**. Sous le code que ce ticket
décrivait, la colonne « 1 étoile » aurait affiché **0**.

Ce qui limite un compte à trois étoiles n'est donc plus une porte invisible,
c'est le **plafond de cinq**, qui est une décision assumée de David
([refonte 11](../../refonte/issues/11-d-ou-viennent-les-conseils.md)) et qui est
visible dans le rapport.

Vérifié le 2026-09-14 : harnais 08 (`test_filtre_dur.py`, 59/59) et **toute** la
suite hors ligne (`jouer_tout.py`, 40 fichiers, « Tout passe »). **Aucun code
produit n'a été touché par cette session** — il n'y avait rien à implémenter, la
question était déjà répondue par construction.

**Le ticket reste `open` : la mesure ne le ferme pas, David le ferme.**
