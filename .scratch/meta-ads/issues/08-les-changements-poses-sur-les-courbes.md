# Les changements posés sur les courbes

Type: prototype
Status: open
Blocked by: 05

## Question

Le brief appelle ça « la fonctionnalité clé » : les modifications faites sur les
campagnes (budget, enchères, audience, créas, statut) apparaissent en petits
points sur les courbes, aux dates concernées ; un clic ouvre un panneau latéral
avec tous les changements de ce jour-là ; si un filtre campagne est actif, le
panneau ne montre que cette campagne.

**Bonne nouvelle, et c'est le point de départ du ticket : la récolte existe
déjà.**
- La table `platform_changes` est en place (`supabase/migrations/platform_changes.sql`,
  section 14 du `000_run_me_all.sql` : « ce que les plateformes déclarent avoir
  changé »).
- `saas/collecte/meta/fetch_meta_ads.py::fetch_activities` récolte l'endpoint
  `activities` de Meta (`event_type, event_time, object_id, object_name,
  extra_data`) et **traduit déjà** les types en langage produit
  (`update_ad_creative` → `creatif`, etc.).
- Le composant `saas/web/components/changements.tsx` existe, avec
  `trierChangements`, et `lib/changements-api.ts` les lit. Ils sont utilisés sur la
  page `/` aujourd'hui.

Donc rien à récolter. Ce qui reste est une question de **forme et de vérité**.

**Ce qu'il faut décider**
1. **Un point par jour ou un point par changement ?** Une journée où le client a
   touché huit ad sets ne peut pas porter huit points lisibles sur une courbe.
2. **À quoi le point se rattache.** `platform_changes` porte `object_id` et
   `object_name` : un changement d'ad set se pose-t-il sur la courbe de la
   campagne parente ? Si oui, il faut le lien ad set → campagne, et ce lien passe
   par le contrat du ticket 07 (d'où la dépendance à vérifier : ce ticket peut
   commencer sur 05 seul, mais il pourrait devoir attendre 07 pour cette partie —
   le dire dans la réponse plutôt que de le contourner).
3. **Ce qui n'a pas de point.** Meta ne déclare pas tout. Un changement fait hors
   de l'interface, ou un type que `_traduire_meta` ne connaît pas, n'apparaît
   nulle part. Un dashboard qui laisse croire que « pas de point = rien n'a
   changé » ment. Comment le dire à l'écran ?
4. **Le panneau latéral est-il le même que celui des assets** (ticket 06) ? Un seul
   mécanisme de panneau vaut mieux que deux.
5. **Le lien qui ouvre un jour.** `CLAUDE.md` §8 : un lien énumère ce qu'il
   CHANGE, jamais ce qu'il garde — sinon il perd par construction tout paramètre
   ajouté après lui, en produisant une URL valide. Le dashboard aura une bascule
   de module, un filtre campagne et une période : le lien vers un jour doit les
   préserver sans les énumérer.

**Ce que le prototype doit rendre** : la maquette des points et du panneau sur une
courbe réelle, et les réponses écrites aux cinq points ci-dessus.
