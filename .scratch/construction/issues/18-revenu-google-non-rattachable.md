# La dépense Google entre par l'identifiant, son revenu ne peut entrer que par le nom

Type: task
Status: open

## Question

**Une question pour David avant une ligne de code** : ce n'est pas un bug à
réparer, c'est une règle d'attribution à choisir — et
[`docs/mesures-impossibles.md`](../../../docs/mesures-impossibles.md) plus
`CLAUDE.md` §7 disent que ça ne se tranche pas en douce.

Sorti par la revue de code du ticket [01](01-roas-gonfle.md). Le défaut est
**antérieur** à 01 et vit aussi dans `build_matrix`
(`saas/recos_ia/insights.py`), qui calcule le ROAS d'un thème affiché
aujourd'hui à l'écran.

### Le fait

Les deux côtés de la division n'utilisent pas la même clé pour rattacher une
campagne Google à un thème :

- **Dépense** : par `campaign_id` → `goog_cfg[cid]["label"]`
  (`_pub_fenetre`, `build_report.py` l. 2624 ; `build_matrix`, l. 95-113).
  Robuste : c'est la clé que porte `google_campaign_config`.
- **Revenu** : par nom normalisé → `name2label` (`build_report.py` l. 2078-2084)
  ou `rev_by_name` (`insights.py` l. 120-122), tous deux construits sur le
  `campaign_name` stocké. Et `name2label` **ignore** une ligne `goog_cfg` dont
  le `campaign_name` est vide — `fetch_google_campaign_config` y met `""` quand
  la colonne est nulle (`saas/commun/fetch_data.py` l. 246).

Donc une campagne Google étiquetée mais dont le nom stocké est vide, ou ne
correspond plus à l'`utm_campaign` que GA4 enregistre après un renommage dans
Google Ads, **verse sa dépense au dénominateur sans jamais pouvoir verser son
revenu au numérateur**.

Scénario : thème « Audio Tour », une campagne Meta (200 CHF, 1 000 CHF de
revenu) et une campagne Google étiquetée dont le nom ne matche pas (300 CHF).
Avant 01 : ROAS = 1000/200 = 5.0 — gonflé, c'est le bug que 01 a réparé.
Après 01 : ROAS = 1000/500 = 2.0 — **écrasé par le même mécanisme, à l'envers.**
Une hypothèse `roas` sur ce thème lira `worse` à chaque mesure.

### Ce qu'il faut faire

1. **D'abord mesurer, sur le compte de David** : combien de lignes
   `google_campaign_config` portent un `label` et un `campaign_name` vide ou
   introuvable dans `ga4_insights.campaign` ? Si c'est zéro, le ticket devient
   une garde préventive et pas une réparation urgente — et ça se dit.
2. **Ensuite demander à David**, avec le chiffre en main. Les deux lectures se
   défendent et aucune n'est neutre :
   - *Compter la dépense quand même* (aujourd'hui) : le ROAS du thème est
     pessimiste, mais la dépense affichée reste vraie.
   - *Écarter cette dépense du dénominateur* : le ROAS redevient cohérent, mais
     une dépense réelle disparaît du calcul — un autre chiffre faux.
   - *Se taire* : pas de ROAS pour ce thème tant qu'une campagne étiquetée n'est
     pas rattachable. Le plus honnête, le plus silencieux.
3. **Ne pas trancher dans le code.** La consigne de repli de 01 s'applique mot
   pour mot : écrire une règle d'attribution en douce serait le chiffre fabriqué
   que §7 interdit.

### Ce qui n'est PAS dans ce ticket

Séparer un ROAS par canal. Ça reste une décision produit non prise, et ce
ticket ne la rouvre pas.

---

## Avancement 2026-09-13 — le harnais de mesure est prêt, la mesure ne l'est pas

**Le ticket reste `open`, et il doit le rester** : l'étape 1 (mesurer) n'a pas pu
être faite d'ici, donc l'étape 2 (demander à David) n'est pas mûre. Rien n'a été
touché dans `build_report.py` ni dans `insights.py` — l'étape 3 tient.

### Ce qui a été vérifié dans le code

L'asymétrie décrite par le ticket est confirmée, aux deux endroits :

- dépense par identifiant — `goog_cfg.get(cid)["label"]`, `build_report.py`
  l. 2440 / 2688 / 2791 / 3198, et `insights.py` l. 117-137 ;
- revenu par nom normalisé — `name2label`, `build_report.py` l. 2143-2149
  (la ligne `if ... and (_c or {}).get("campaign_name")` écarte bien un nom
  vide), et `rev_by_name`, `insights.py` l. 141-149.

Les deux normalisations sont identiques (`str(s or "").strip().lower()`), donc
`trim(lower(...))` en SQL reproduit le pont à l'identique.

### Pourquoi la mesure n'a pas pu être faite

Le `.env` de la racine porte bien une `SUPABASE_SERVICE_ROLE_KEY`, mais **son
hôte ne résout plus** — il se comporte comme une référence de projet morte. Le
projet vivant est celui de `saas/web/.env.local`, qui ne porte que la clé
**anon** : sous RLS et sans session, la requête ne rendrait rien. Demander la
clé `service_role` du projet vivant dans une conversation est exclu (§7).

Au passage, à corriger quand tu passeras par là : **la ligne 5 du `.env` de la
racine est un `q` isolé**. Sans effet sur le lecteur maison (il saute les lignes
sans `=`), mais `source .env` meurt dessus.

### Ce qui est livré à la place

`.scratch/construction/harnais/18-revenu-google/` — trois requêtes en lecture
seule à coller dans l'éditeur SQL Supabase, où la session suffit et où aucun
secret ne circule. `pglast` a parsé les trois : `SelectStmt` uniquement, aucune
écriture possible. Voir le `README.md` du dossier.

### Une quatrième option, trouvée en mesurant, à ajouter aux trois du ticket

`google_ads_insights` stocke le nom que la campagne portait **le jour de la
récolte** (`fetch_google_ads.py` l. 191). Après un renommage, l'historique garde
donc l'ANCIEN nom — exactement celui que GA4 a enregistré en `utm_campaign` à
l'époque, et que `google_campaign_config` a perdu en ne gardant que le nom
courant.

D'où : *rattacher le revenu par n'importe quel nom porté par la campagne dans
son historique*. Ça ne fabrique aucun chiffre — le lien est attesté par une
ligne récoltée — et ça ne touche pas au cas « nom vide », qui reste muet.
`mesure_repli_historique.sql` dit ce que cette option récupérerait, en campagnes
et en francs, avant qu'on en discute.

**Elle ne se code pas plus que les trois autres tant que David n'a pas tranché.**

### La suite, dans l'ordre

1. David joue les trois requêtes dans l'éditeur SQL Supabase et colle les
   résultats ici.
2. Avec le chiffre en main, la question de l'étape 2 se pose — sur quatre
   options désormais.
3. Une fois seulement la règle choisie, le code change aux deux endroits à la
   fois (`build_report.py` ET `insights.py`), sinon l'écran et le rapport
   diront deux choses différentes.
