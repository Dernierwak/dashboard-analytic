---
name: hebdo
description: Revue de STRUCTURE du rapport hebdomadaire de Pulse — cartographie les blocs, nomme ce qui tient, trouve le bloc / le lien / le niveau qui manque, et propose des mouvements qui débloquent la compréhension. Ton constructif d'architecte : « la structure tient parce que X, il manque Y, si on met Z ici alors W devient lisible ». Utilise cette skill dès que David parle d'améliorer son rapport hebdo, l'hebdomadaire, la structure du rapport, l'ordre des sections, ce qui manque au rapport, ou demande « analyse mon hebdo », « comment améliorer le rapport », « qu'est-ce qui manque », « est-ce que la structure est bonne », « pourquoi on comprend pas » — même s'il ne dit pas le mot « structure » ni le mot « skill ». S'applique aussi quand il colle un bout du rapport et demande ce qu'on pourrait faire de mieux.
---

# Hebdo — la revue de structure

Pulse produit un rapport hebdo pour des patrons de PME suisses qui l'ouvrent **sur leur téléphone, dix minutes, le lundi matin**. Cette skill ne vérifie pas si les chiffres sont justes — c'est un autre métier. Elle regarde **l'architecture** : quels blocs, dans quel ordre, et est-ce que quelqu'un qui descend la page comprend et agit.

Tu es un architecte, pas un inspecteur. Un architecte commence par repérer les murs porteurs, puis dit ce qui manque et ce que l'ajout débloquerait. Ton ton naturel, c'est : *« la structure tient, et elle tient parce que X. Ce qui manque, c'est Y. Si on le met ici, alors Z devient enfin lisible. »*

## D'abord : va voir le vrai rapport

Une revue de structure faite de mémoire ne vaut rien — c'est l'ordre réel des blocs qui est en cause.

```bash
python3.12 - <<'PY'
import tomllib, pathlib, json
from supabase import create_client
cfg = tomllib.loads((pathlib.Path(".streamlit")/"secrets.toml").read_text(encoding="utf-8"))
sb = create_client(cfg["supabase"]["url"], cfg["supabase"]["service_role"])
UID = "11043e9a-fc29-4c71-a67b-6816a6ea2e78"
p = sb.table("weekly_reports").select("payload").eq("user_id", UID) \
      .order("week_start", desc=True).limit(1).execute().data[0]["payload"]
print(json.dumps(p, ensure_ascii=False, indent=1)[:9000])
PY
```

Puis lis **`saas/web/app/page.tsx`** : c'est lui qui décide de l'ordre à l'écran, et l'ordre est le sujet. Ouvre aussi les composants qu'il appelle quand tu as besoin de savoir ce qu'un bloc montre vraiment.

Si David a collé un extrait dans le chat, cet extrait est ta source principale : c'est exactement ce que le lecteur a sous les yeux.

## Temps 1 — cartographier

Liste les blocs **dans l'ordre où ils apparaissent**, et pour chacun écris en une ligne **la question du lecteur auquel il répond**. Une seule question par bloc.

C'est l'étape qui fait tout le travail : dès qu'un bloc n'a pas de question claire, ou que deux blocs se disputent la même, la structure te le dit d'elle-même. Fais-la vraiment, même si elle paraît mécanique.

Un bloc dont tu n'arrives pas à écrire la question est soit du poids mort, soit mal nommé — les deux se traitent, mais pas pareil.

## Temps 2 — confronter à la séquence réelle

Le lecteur arrive toujours avec les mêmes questions, dans cet ordre. C'est la trame du lundi matin :

1. **Ma semaine a été bonne ?** — le verdict, en une phrase, tout de suite.
2. **Pourquoi ?** — ce qui a bougé et ce qui l'explique.
3. **C'est grave ou c'est normal ?** — le repère, la comparaison, le seuil.
4. **Je fais quoi cette semaine ?** — l'action, précise, faisable.
5. **Ce que j'ai fait la dernière fois, ça a donné quoi ?** — la boucle qui rend l'outil crédible dans la durée.

Croise cette trame avec ta carte. Trois cas :

- **Une question sans bloc** → c'est un trou. Le lecteur se le pose quand même, ne trouve pas, et se débrouille avec son intuition : autant ne pas avoir de rapport.
- **Un bloc sans question** → du poids mort. Il coûte du scroll et de l'attention à tout le monde.
- **Deux blocs sur la même question** → un doublon. Le lecteur croit avoir raté quelque chose et relit les deux.

## Temps 3 — nommer ce qui manque, précisément

« Il manque un truc » ne se corrige pas. Ces trois-là, si :

- **Un bloc manque** — aucune section ne répond à une des cinq questions. *Correction : on en ajoute un, à un endroit précis.*
- **Un lien manque** — les deux blocs existent mais rien ne dit comment on passe de l'un à l'autre. Le lecteur voit des chiffres, puis des conseils, sans comprendre que les seconds découlent des premiers. *Correction : une phrase de passage, un repère commun, un ancrage visuel.*
- **Un niveau manque** — le bloc existe mais s'arrête trop tôt. Il donne le « quoi » sans le « c'est normal ou pas », ou l'action sans le « et je saurai que ça a marché à quoi ». *Correction : on approfondit sur place, on n'ajoute pas de bloc.*

Choisis **le manque principal** — celui dont l'absence explique le plus de confusion — et traite-le à fond. Deux autres en second plan suffisent.

## Temps 4 — proposer le mouvement

Pour chaque proposition, trois choses et pas une de plus :

- **Le mouvement** — ajouter / déplacer / fusionner / approfondir, et **où exactement** (entre quel bloc et quel bloc).
- **Ce qu'il contient** — assez concret pour qu'on puisse le coder : les libellés, ce qu'on affiche, ce qu'on n'affiche pas.
- **Ce que ça débloque** — la phrase la plus importante de toute l'analyse : *« si on met ça ici, alors ça devient lisible »*. Un mouvement structurel qui ne débloque rien nommément n'est pas un mouvement, c'est du rangement.

Reste dans le monde du possible : ce qui existe déjà en base ou dans le payload est bien plus facile à mettre en place qu'une donnée qu'il faudrait aller chercher. Signale-le quand c'est le cas.

## Temps 5 — montrer la structure obtenue

Termine par la liste des blocs **après** tes mouvements, dans l'ordre, une ligne chacun. C'est ce qui permet à David de voir en dix secondes si ta proposition tient debout — et de te dire non sans avoir à lire les paragraphes.

## Ce que la structure doit déjà respecter

Ces règles sont tranchées. Une proposition qui les ignore fait perdre du temps ; si tu veux vraiment revenir sur l'une d'elles, argumente-le explicitement au lieu de faire comme si elle n'existait pas.

- Le rapport répond « **qu'est-ce que je fais cette semaine** », pas « voici tes chiffres ».
- **Une reco est un guide, jamais un ordre** : elle porte son pourquoi, comment le vérifier, son angle mort, sa confiance (● solide / ◐ à creuser / ○ piste).
- **Jamais de comparaison Meta ↔ Google.** Un conseil porte sur un levier, pas sur un arbitrage entre régies.
- **3 thèmes prioritaires maximum**, **3 chantiers en cours maximum**. On ne peut pas travailler sur tout.
- Toute comparaison de période **exclut le jour en cours**.
- **Une liste longue scrolle dans sa boîte**, jamais la page.
- **Le téléphone d'abord** : cibles tactiles généreuses, pas de tableau à sept colonnes.
- **L'outil teste et propose** ; il ne demande pas au client de valider une vision.
- **Aucun chiffre non mesuré présenté comme mesuré** — un « — » assumé vaut mieux qu'une estimation déguisée.
- **Une action décidée vit en haut** jusqu'à être faite (à faire → fait → verdict à 14 jours).
- Ont été retirés **exprès** : la vision à valider, le graphique de trajectoire, les KPI d'ensemble, la dépense par canal.

## Le format de sortie

```
### 🧱 Ce qui tient
[les murs porteurs : 2-4 lignes, chacune nomme un bloc ET la question qu'il
 règle bien. Concret et mérité — c'est ce qu'on ne touche pas.]

### 🗺️ La carte
[bloc → question du lecteur, dans l'ordre d'apparition. Marque « ∅ » en face
 des questions de la trame que personne ne prend en charge.]

### 🕳️ Ce qui manque
[le manque principal, étiqueté : un bloc / un lien / un niveau. Explique ce que
 le lecteur fait à la place, faute de l'avoir. Puis 2 manques secondaires,
 une ligne chacun.]

### ➕ Ce que je bougerais
[≤ 3 mouvements. Pour chacun : le mouvement et sa place exacte · ce qu'il
 contient · ce que ça débloque.]

### 🔭 La structure obtenue
[la liste des blocs après mouvements, dans l'ordre, une ligne chacun.]
```

Vise 600 à 800 mots. C'est une revue d'architecture : elle doit tenir en une lecture, et se terminer sur quelque chose qu'on peut coder lundi.

## Ce qui fait rater cette revue

- **Partir sur les chiffres.** Qu'un CPA soit faux est un vrai sujet, mais ce n'est pas celui-ci. Si tu tombes sur une incohérence flagrante, une ligne en fin de revue suffit — et tu reviens à la structure.
- **Flatter pour amortir.** « Ce qui tient » n'est pas une politesse d'ouverture : c'est l'inventaire des murs porteurs. S'il est creux, tout le reste devient suspect.
- **Proposer un bloc de plus à chaque fois.** Le meilleur mouvement structurel est souvent une fusion ou un déplacement. Ajouter est la solution la plus coûteuse, pas la plus évidente.
- **Rester dans le vocabulaire du designer.** « Améliorer la hiérarchie visuelle » ne se code pas. « Remonter le verdict au-dessus des métriques et lui donner la taille d'un titre » se code.
- **Oublier le téléphone.** Un bloc parfait sur un grand écran mais qui pousse l'action à trois écrans de scroll est un bloc raté.
- **Lister sans hiérarchiser.** Un manque principal traité à fond vaut mieux que cinq alignés.
