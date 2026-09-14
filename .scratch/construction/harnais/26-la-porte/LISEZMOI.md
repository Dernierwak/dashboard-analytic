# Harnais du ticket 26 — la porte qui n'existe plus

**Ce dossier ne contient aucun test, et c'est voulu.** Il contient une **mesure**.
Le ticket [26](../../issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md)
est un ticket HITL : sa question était pour David, et le code y a répondu avant
lui. Ce qui restait à rendre était sa **consigne de repli** — *« ce que reçoit
aujourd'hui un compte à une étoile, à deux, à trois et à quatre, ligne par
ligne »*. La voici, exécutable.

Ni base, ni secret, ni réseau : `mesure.py` emprunte le faux lecteur du ticket
[16](../16-le-seam-du-payload/) et fait tourner `build_payload` sur des lignes
fixes.

```bash
cd .scratch/construction/harnais/26-la-porte
python3.12 mesure.py
```

## Ce que la mesure montre

Sur un compte de quatre thèmes, chacun avec une campagne Google jugeable et deux
Annonces d'un même Groupe dont une seule convertit :

| Étoiles | Cartes | Conseils servis | Les clés |
|---|---|---|---|
| 0 | 3 (repli par poids) | **0** | — |
| 1 | 1 | **2** | `annonce_sans_conversion`, `roas` (+ `page_arrivee_muette` au socle) |
| 2 | 2 | **4** | les deux mêmes, sur chaque thème |
| 3 | 3 | **5** | 2 + 2 + 1 — le plafond de cinq mord ici |
| 4 | 4 | **5** | la 4ᵉ carte existe, `conseille: false`, zéro conseil |

**Le fait que le ticket 26 relevait est là, en une colonne.**
`annonce_sans_conversion` est une des quatre règles payantes du ticket
[07](../07-quatre-regles/), et `roas` est le conseil-règle que le ticket
[22](../../../refonte/issues/22-rebrancher-le-plan-de-theme.md) comptait. Tous
deux sortent **dès la première étoile**. Sous le code que le ticket 26 décrivait
— où un thème étoilé recevait trois pistes rédigées par Gemini et aucun
conseil-règle — cette colonne aurait affiché **zéro**.

Ce qui borne un compte n'est donc plus une porte invisible : c'est le **plafond
de cinq**, décidé par David
([refonte 11](../../../refonte/issues/11-d-ou-viennent-les-conseils.md)) et
visible dans le rapport.

## Ce qu'il ne prouve pas

- **Ce n'est pas le compte de David.** Le ticket demandait la mesure « sur le
  compte de David » ; elle est rendue sur un compte gréé, parce qu'un harnais
  hors ligne ne lit aucune base. Les chiffres réels d'un vrai compte ne se
  voient **qu'après un passage du worker** — le cron du Jour de travail, ou
  `weekly-fetch.yml` en `report_only`.
- **Ce n'est pas un garde-fou.** Rien ici n'échoue si la porte revient. Le
  garde-fou existe ailleurs et il est nommé : `test_filtre_dur.py` du harnais
  [08](../08-filtre-dur/) vérifie que `_theme_ai_recos` n'existe plus et que les
  quatre familles de règles sont appelées sous `if _conseille:` sans `else`.
- Les Annonces de la mesure ne font parler qu'**une** des quatre règles payantes
  (`annonce_sans_conversion`). Les trois autres ont leurs propres vérifications
  dans le harnais [07](../07-quatre-regles/) ; les faire toutes sortir ici
  n'aurait rien ajouté à la question posée, qui est **si une règle passe**, pas
  laquelle.
