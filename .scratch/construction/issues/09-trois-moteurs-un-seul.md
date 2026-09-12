# Trois moteurs, deux langages, trois jeux de seuils : `insights.py` gagne

Type: task
Status: resolved
Blocked by: 07, 08

## Question

**Tranché par [11](../../refonte/issues/11-d-ou-viennent-les-conseils.md).**

**« Qu'est-ce qui marche chez toi » est calculé TROIS fois**, dans deux langages,
avec trois jeux de seuils qui **peuvent se contredire** :

1. `insights.py` — tout l'historique, **zéro IA**, clés stables… et **jamais
   affiché**.
2. Deux règles de `reco_engine.py` — `format_gagnant`, `creneau`, fenêtre courte.
3. La page `/instagram`, qui **recalcule en TypeScript**.

Le bloc « ce qui marche » et le conseil ne sont pas deux noms du même objet : ce
sont trois moteurs concurrents.

### Les décisions

- **`insights.py` gagne, les deux autres meurent.** Et ça **remplit le rang 4 de
  [07](../../refonte/issues/07-gabarit-de-plateforme.md) sur les trois
  plateformes sans un calcul nouveau**.
- **On arrête tout conseil portant sur une campagne d'une seule régie.**
  ⚠️ **Attention — cette décision a été partiellement renversée par
  [24](../../refonte/issues/24-conseils-payants-manquants.md)** : David y a
  supprimé le critère d'admission, et `gaspillage` et `scaler`, coupés par 11
  pour ce seul motif, sont **réhabilités**. En cas de conflit entre 11 et 24,
  **24 est plus récent et gagne** — mais le dire dans le ticket plutôt que de
  trancher en silence.
- **`/labels` promet au client des constats que RIEN ne rend à l'écran** —
  troisième tuyau mort après `preuve`. Le raccorder fait partie de ce ticket.

### Le piège de fichiers

Ce ticket touche `insights.py`, `reco_engine.py` **et** `/instagram` côté
TypeScript. Il croise le territoire des tickets **06**, **07** et **08** : ne pas
le lancer en parallèle de ceux-là (`CLAUDE.md` §5 — jamais deux agents sur les
mêmes fichiers).

### Consigne de repli

Faire mourir le recalcul TypeScript de `/instagram` en premier — c'est le plus
isolé, et c'est celui qui fait diverger deux langages.

## Answer

### Ce qui a été fait

**Le moteur B est mort.** `_rule_format_gagnant` et `_rule_creneau` n'existent
plus dans `reco_engine.py` — ni la fonction, ni leur clé dans les cinq tables de
grammaire (`KEY_LABELS`, `EFFORT_BY_KEY`, `_GESTE_REGLE`, `_LEVIER_REGLE`,
`_METRIC_REGLE`), ni dans `OBJECTIFS`, ni dans la pondération par constat
(`VISION_RULES`). Les deux seuils qui ne servaient qu'à elles
(`format_reach_pct`, `format_sample_solide`) partent avec : un seuil qu'aucune
règle ne lit se remet à diverger en silence. Une pierre tombale reste dans le
fichier, avec la mesure qui tranche — la règle jugeait la SEMAINE à +15 % de
l'historique, le constat juge un FORMAT à +20 % de la portée moyenne du compte,
sur tout l'historique : deux réponses, deux périmètres, un seul écran.

**Le moteur C est mort.** `formats`, `heatmap` et `bestSlot` ne sont plus
calculés dans `lib/channels.ts`, et les deux modules qu'ils nourrissaient (« Ce
qui marche pour toi · par format », « Quand publier ? ») ont quitté
`/instagram`. Le reste du dashboard est intact : le top 3 et la performance par
thème lisent le même `pool` qu'avant.

**Le moteur A s'affiche, et c'est ce que le ticket promettait de gratuit.**
`<CeQuiMarche />` (`components/ce-qui-marche.tsx`) rend les constats de
`vision.constats` au **rang 4** de `/meta`, `/google`, `/instagram` **et**
`/labels` — sans une ligne de calcul nouvelle. Chaque constat porte désormais sa
`platform` (`insights.py`), et `constatsDeLaPage` (`lib/constats.ts`) est le
**seul** endroit qui décide où il se lit : un constat de THÈME se lit partout
(il traverse les régies et l'organique — ce qu'aucune régie ne sait dire), le
format et le créneau sont organiques, la locomotive appartient à sa régie,
l'angle mort de couverture ne se lit que là où il se répare.

**La promesse de `/labels` est tenue.** La page annonçait des constats que rien
ne rendait ; elle les affiche en section 6 et dit où les lire.

**Le verdict du client existe enfin à l'écran.** `saveInsightFeedback` était
écrite depuis des mois et n'était appelée par AUCUN composant. `ConstatVerdict`
l'appelle : « ✓ ça me parle » / « ✗ pas d'accord », re-cliquable pour se défaire,
et le bouton dit ce qu'il fait — un constat rejeté reste écarté quand le moteur
le régénère à l'identique.

### Trois choses qui n'étaient pas dans la lettre du ticket

**1. `theme_event_cout` a enfin sa place.** La carte 06 la lui devait (« il
disparaît des cartes jusqu'à ce que 09 lui donne sa place dans les constats »).
Il était calculé chaque semaine et **jeté en silence** par `_est_conseil` — il
ne demande aucun geste, il demande de comparer un coût à sa marge. Il devient un
constat `cout_conversion` (`_constat_cout`), récolté **avant** le filtre qui le
jette, et seulement sur un thème conseillé. Sa clé porte le thème **et**
l'événement : changer d'événement principal change le chiffre dont on parle,
donc la clé, donc le verdict qui s'y rattache. Son **angle mort voyage avec le
chiffre** — ce coût est une borne haute (ce qui arrive sans campagne n'y entre
pas), et séparé de lui il se lirait comme une mesure complète (`CLAUDE.md` §7).

**2. Le bloc dit qu'il ne suit pas les commandes de la page.** La période et le
thème du bandeau filtrent les chiffres ; les constats sont calculés une fois par
semaine sur tout l'historique. Un bloc qui ne bouge pas quand on change la
période se lit comme un filtre cassé tant qu'on n'a pas écrit qu'il n'en dépend
pas.

**3. Un harnais de 06 a dû être corrigé.**
`test_indicateur_sans_proof_kpi.py` recopiait `PROOF_KPI` d'avant le ticket 06,
`creneau` et `format_gagnant` comprises. Les deux clés en sortent — avec, à leur
place, la vérification qu'elles ont **vraiment** quitté `_METRIC_REGLE`.

### Ce qui n'a PAS été fait, et pourquoi

**`gaspillage` et `scaler` sont vivantes.** Le ticket prévoyait d'arrêter tout
conseil portant sur une campagne d'une seule régie, ce qui les tuait toutes les
deux. [24](../../refonte/issues/24-conseils-payants-manquants.md) a renversé ce
motif et David les a réhabilitées ; **24 est plus récent, il gagne**. Rien n'a
été coupé de ce côté, et c'est écrit ici plutôt que tranché en silence.

### Vérifications

- **102 vérifications neuves** dans `../harnais/09-trois-moteurs/` (voir son
  `LISEZMOI.md`), **694 rejouées** sur les harnais 04 à 08, aucune régression.
- `python3.12 -m py_compile` vert sur `insights.py`, `reco_engine.py`,
  `build_report.py`.
- `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` et `npm run build`
  verts, **19 routes**.

### Ce qui n'a pas pu être vérifié

- **`build_payload` n'a pas tourné** : elle prend un client Supabase vivant. Le
  constat de coût n'a jamais été récolté sur un vrai rapport (`_constat_cout` est
  vérifiée sur un dict écrit à la main), et **aucun constat n'a jamais été
  publié avec sa `platform`** — les payloads déjà en base n'en ont pas. Un repli
  déduit du GENRE couvre le trou (`PLATEFORME_PAR_GENRE`, `lib/constats.ts`) :
  un format et un créneau n'existent que sur Instagram, un coût par conversion
  est de la publicité. `campagne_locomotive` en est exclue exprès — sa régie est
  justement ce que l'ancien payload ne dit pas, et la deviner la ferait
  apparaître sur une page où cette campagne n'existe pas. Elle se lit donc comme
  un constat de compte jusqu'à la première régénération : moins précis, jamais
  faux. C'est le seam du ticket 16.
- **Aucun verdict n'a été cliqué en base** : `ConstatVerdict` appelle une action
  qui n'avait jamais servi, faute d'écran pour l'appeler.
- **Rien du rendu web n'est testé** : aucun runner dans `saas/web` (décision de
  David, ticket 16). Le harnais lit du texte TypeScript, il ne l'exécute pas.

**Ça ne se voit qu'après un « ↻ Recharger mes conseils »** — c'est une correction
du traitement.

### Un fait remonté, pas corrigé

`/labels` dit toujours au client « **L'IA, elle, en rédige 3** — les 3 premières
étoiles posées ». Le ticket 08 a coupé les pistes rédigées par Gemini : la phrase
promet un conseil que plus personne n'écrit. Ce n'est pas dans le périmètre de
ce ticket-ci et ça touche à la porte de
[26](26-les-regles-payantes-n-atteignent-pas-le-rapport.md), qui attend David.
