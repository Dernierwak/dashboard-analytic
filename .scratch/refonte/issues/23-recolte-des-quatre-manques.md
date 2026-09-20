# Les quatre données qui manquent aux conseils faciles

Type: grilling
Status: open
Blocked by: 14

## Question

Gradué par [14](14-le-conseil-facile-et-la-degradation.md). David y a donné cinq
exemples de conseil « faisable rapidement » ; **quatre ne sont pas écrivables
aujourd'hui faute de donnée**, et l'écrire quand même serait un chiffre fabriqué
(`CLAUDE.md` §7).

| Ce que le conseil dirait | Ce qu'on a | Ce qu'il faudrait |
|---|---|---|
| « Ajoute ces mots-clés » | Aucune table de performance mot-clé. Le texte n'est récolté que pour légender un changement (`fetch_google_ads.py:941`). | Une récolte `keyword_view` |
| « Change ce titre » | `google_ads_ad_insights` a l'annonce et ses chiffres, **jamais son texte**. | Les assets texte de l'annonce |
| « Améliore ton audience Meta » | `meta_ads_insights` s'arrête à `ad_name` — aucun découpage âge / sexe / placement. | Un `breakdown` Meta |
| « Améliore cette page » | GA4 récolte `date × source × medium × campagne` (`fetch_ga4.py:86`). Aucune dimension de page. | `landingPagePlusQueryString` |

**Le cinquième exemple — bloquer le CPC — est disponible** (clics + dépense), et
c'est `_rule_gaspillage`, la règle que [11](11-d-ou-viennent-les-conseils.md) a
supprimée : elle relève de 22, pas d'ici.

### Ce qu'il faut trancher

- **L'ordre.** Chaque récolte débloque des conseils différents ; laquelle rend le
  plus de retouches faisables par franc de complexité ?
- **Le conflit avec [07](07-gabarit-de-plateforme.md).** David y a reporté la
  récolte des mots-clés : *« on attend d'avoir une excellente structure avant
  d'ajouter »*, et il y est écrit qu'un mot-clé n'est pas un rang de plus mais le
  rang 5 de Google. Ce ticket rouvre-t-il cette décision, ou attend-il ?
- **Le coût de quota.** Un `breakdown` Meta multiplie les lignes ; GA4 a des
  quotas de tokens par propriété. Aucune de ces récoltes n'est gratuite.
- **La limite déjà connue** : `change_event` Google plafonne à **30 jours**, et
  une fenêtre plus large fait rejeter la requête entière (`CLAUDE.md` §8).

### Ce qui n'est PAS dans ce ticket

Les règles qui consommeraient ces données — elles relèvent de 22. Ici on décide
seulement **ce qu'on va chercher, dans quel ordre, et à quel coût**.

### Consigne de conduite

Ticket **HITL**. Le périmètre touche `saas/collecte/`, que David a mis hors carte
(*« il la dit bonne »*) : ce ticket ne corrige rien de l'existant, il propose des
ajouts. Le dire clairement avant de commencer.

### Consigne de repli

Rendre le tableau des quatre récoltes chiffré (coût, quota, conseils débloqués)
même si l'ordre n'est pas tranché : c'est lui qui porte la décision.


## Avancement — session du 2026-09-11

**Ouvert puis REFERMÉ sans être résolu, par David** : *« non, mets-le à faire
plus tard »*. Il reste en **brique 7** du plan §4. Rien n'est tranché ici ; ce qui
suit est la recherche déjà faite, pour qu'elle ne soit pas à refaire.

### Les quatre prémisses du tableau sont exactes — vérifiées ligne à ligne

Premier ticket de cette carte dont aucune prémisse n'est fausse.

- `fetch_google_ads.py` l. 941 ne lit `ad_group_criterion.keyword.text` que pour
  **légender un `change_event`** : aucune table de performance mot-clé.
- `fetch_ad_insights` l. 224 prend `ad_group_ad.ad.id` et `.name`, **jamais** le
  texte de l'annonce.
- `_meta_chunk` (`automatisation/fetch_all.py` l. 298) part en `level: "ad"`,
  `time_increment: 1`, **sans aucun `breakdowns`**.
- `fetch_ga4.py` l. 86 s'arrête à `date × sessionSource × sessionMedium ×
  sessionCampaignName`. **Aucune dimension de page**, dans aucun des trois
  rapports GA4.

### Le coût n'est pas là où le ticket le cherchait

Le ticket redoutait le quota. Aux sources primaires, ce n'est pas lui qui mord.

| Récolte | Coût mesuré | Ce que ça change |
|---|---|---|
| Mots-clés (`keyword_view`) | **1 opération.** *« One SearchStream request counts as one API operation irrespective of the number of batches »* — Basic : 15 000/jour, Explorer : 2 880/jour contre production | Le code frappe **déjà** `googleAds:searchStream` et interroge **déjà** `ad_group_criterion`. Zéro infrastructure neuve. `keyword_view` accepte `ad_group_criterion.keyword.text`, les métriques et les segments |
| Texte d'annonce | `ad_group_ad` est **déjà la table interrogée** (l. 231). Requête séparée non segmentée par date = **1 opération** | Le texte ne varie pas dans le temps : le placer dans la requête datée le dupliquerait sur chaque ligne. **Non re-confirmé à la source** : les pages de champs v21/v25 ont rendu 404 ou vide |
| Breakdown Meta | `age, gender` est une paire autorisée. Multiplication : tranches d'âge × **3** genres (`female`, `male`, `unknown`, confirmés à la source) | Voir le piège `reach` ci-dessous. **Liste des tranches d'âge non re-vérifiée** — ne pas l'invoquer de mémoire |
| Page GA4 | ~10 jetons sur **200 000/propriété/jour** (40 000/heure) | Le quota **n'est pas** la contrainte. La cardinalité l'est |

### Trois faits qui déplacent la décision

**1 · La limite `change_event` 30 jours ne concerne AUCUNE des quatre récoltes.**
Elle porte sur `change_event` seul ; `keyword_view`, `ad_group_ad`, les insights
Meta et GA4 n'en dépendent pas. **Le quatrième point de « ce qu'il faut
trancher » tombe.**

**2 · Le titre du ticket est périmé depuis [24](24-conseils-payants-manquants.md).**
23 a été écrit le 2026-09-10 ; 24 a été résolu le lendemain et a trouvé le
gisement Annonce/Groupe d'annonces — **dix règles payantes, quatre livrées
d'abord**. Les conseils *faciles* ne manquent plus. Ce que 24 a mesuré, c'est
l'inverse : *« aucune règle payante au-dessus de 30 min d'effort — le bac 2 h+
reste vide côté pub »*. **Si ce ticket se rouvre, c'est sous ce titre-là** : ce
qui remplit le bac 2 h+, donc ce qu'une Marche de Stratégie peut proposer en 2ᵉ
ou 3ᵉ position ([14](14-le-conseil-facile-et-la-degradation.md), composition des
cinq).

**3 · Le breakdown Meta casserait `reach`, et 24 a posé une règle dessus.**
`reach` compte des **personnes dédoublonnées** : les sommer à travers des tranches
d'âge compte deux fois qui apparaît dans deux segments. Meta l'écrit pour les
breakdowns horaires (*« Hourly breakdowns do not support unique fields, which are
any fields prepended with `unique_*`, `reach` or `frequency` »*). Or `_meta_chunk`
récolte `reach`, et **`annonce_usee` de 24 est de la fréquence** — *« même
personne touchée 2,3×/jour »*. Un breakdown dans la même table rend la fréquence
fausse **sans que rien ne lève** (§7). S'il se fait : **seconde table, sans
`reach` ni `frequency`**, et écrit dans le code.

### Les questions restées ouvertes — la grille du tour 1, sans réponses

- **Les mots-clés rouvrent-ils [07](07-gabarit-de-plateforme.md) ?** Piste
  relevée : le report de 07 portait sur **l'affichage** (*« un mot-clé n'est pas
  un rang de plus, c'est le rang 5 de Google »*), pas sur la récolte. Or le
  conseil vit dans l'hebdo, jamais sur la page plateforme (24, décision 3). Les
  deux peuvent coexister **si** on s'engage à n'ajouter aucun rang 5 à `/google`
  tant que 07 n'est pas construit. Non tranché.
- **La page GA4 est-elle admissible au regard de §7 ?** Google donne *page path*
  comme **son propre exemple** de dimension à forte cardinalité, pose >500
  valeurs comme repère, et l'excédent se replie dans `(other)` — **seuil exact
  non publié** pour une propriété standard. Conseiller sur une page qui peut être
  silencieusement dans `(other)` est précisément ce que §7 interdit. Et **24 livre
  déjà `page_arrivee_muette`** (*« 640 clics envoyés, GA4 en compte 180 »*) : le
  conseil « ta page perd des gens » existe **sans** la dimension de page. Ce que
  la récolte ajoute, c'est uniquement de pouvoir **nommer laquelle**. Non tranché.
- **L'ordre des quatre** — la question principale du ticket. Elle dépend des deux
  précédentes, elle n'a pas été posée.

### Ce qui n'a pas pu être vérifié

**Aucun décompte de lignes** : le `.env` racine pointe un projet Supabase qui ne
répond plus — même relevé qu'en [25](25-identifiant-annonce-meta.md) et
[16](16-compteur-partage.md). La multiplication du breakdown Meta est donnée en
**facteur**, jamais en volume réel sur un compte.
