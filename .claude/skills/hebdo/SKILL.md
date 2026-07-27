---
name: hebdo
description: Analyse le rapport hebdomadaire de Pulse (weekly_reports.payload + la page rendue) avec trois voix — le client qui ne comprend pas, le pro qui recommande, le garde-fou qui vérifie la cohérence avec les règles déjà décidées. Utilise cette skill dès que David parle de son rapport hebdo, de l'hebdomadaire, du rapport de la semaine, des conseils de la semaine, ou demande « analyse mon hebdo », « critique le rapport », « est-ce que mon rapport est bon », « pourquoi on comprend rien », « comment améliorer le rapport » — même s'il ne dit pas le mot « skill ». S'applique aussi quand il colle un extrait du rapport et demande ce qui cloche.
---

# Hebdo — l'analyse du rapport de la semaine

Pulse produit un rapport hebdo pour des patrons de PME suisses qui l'ouvrent **sur leur téléphone, 10 minutes, entre deux choses**. Ton travail ici n'est pas de dire si le rapport est joli. C'est de dire s'il **fait agir quelqu'un qui n'a ni le temps ni l'envie de faire de l'analyse**.

Tu portes trois voix successives, et elles ne se mélangent pas :

1. **Le client** — il lit, il bute, il dit à voix haute ce qu'il ne comprend pas.
2. **Le pro** — quinze ans de rapports clients, il sait ce que coûte une phrase floue et ce qu'il ferait à la place.
3. **Le garde-fou** — il connaît les règles que David a déjà posées et signale quand une « bonne idée » les contredit.

## D'abord : lis le vrai rapport

Une critique dans le vide ne vaut rien. Avant d'écrire une ligne, va chercher le contenu réel — c'est ce qui sépare cette skill d'un avis générique.

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

Lis aussi le rendu — `saas/web/app/page.tsx` et les composants qu'il appelle — parce que le payload ne dit pas dans quel ordre les choses arrivent à l'œil, et l'ordre est la moitié du problème.

Si David a collé un extrait dans le chat, cet extrait fait foi : c'est exactement ce que le client a sous les yeux. Pars de là, quitte à compléter avec le payload.

Si tu ne peux pas accéder aux données, dis-le en une phrase et travaille sur ce que tu as. Ne fabrique jamais un chiffre pour illustrer un point.

## Voix 1 — le client

Écris **à la première personne**, dans les mots d'un patron de PME. Pas de vocabulaire produit, pas de « l'utilisateur ». Il dit « je », il est un peu agacé, il est de bonne foi.

Cite le rapport **mot pour mot** quand tu butes dessus. « Ce qui fonctionne · 36 328 CHF investis · CTR 7,3 % » — un vrai client répond « OK et donc ? ». C'est cette phrase-là qu'il faut faire entendre.

Trois choses différentes se cachent derrière « je ne comprends pas », et les confondre mène à la mauvaise correction :

- **Je ne comprends pas les mots.** Jargon, sigles, formulation d'analyste. → ça se réécrit.
- **Je comprends les mots mais pas ce que ça change pour moi.** Le chiffre est juste, il ne débouche sur rien. → ça se prescrit.
- **Je comprends, mais je ne te crois pas.** Chiffre orphelin, pas de repère, contradiction avec ce que je vois ailleurs. → ça se prouve ou ça se retire.

Nomme laquelle des trois, à chaque fois. C'est ce qui rend la critique actionnable.

Vise 3 à 5 butées réelles, dans l'ordre où le client les rencontre en scrollant. S'il n'y a rien qui coince, dis-le — ne fabrique pas de la friction pour faire du volume.

## Voix 2 — le pro

Une fois les butées posées, explique **ce que ça coûte**. Pas « ce n'est pas optimal » : le prix réel.

Un client qui ne comprend pas ne râle pas. Il ferme l'onglet, il ne revient pas la semaine suivante, et trois mois plus tard il dit que « ça n'a rien changé ». C'est ça l'enjeu — pas l'esthétique. Formule-le en termes de comportement : ce qu'il fait ou ne fait pas à cause de cette phrase.

Puis donne **3 recommandations maximum**, classées par (ce que ça change × facilité). Pour chacune :

- **Le geste** — précis, au niveau du composant ou de la phrase. « Remplacer X par Y », pas « améliorer la lisibilité ».
- **Pourquoi ça marche** — le mécanisme, pas l'opinion. Si tu peux citer un principe (hiérarchie de l'information, charge cognitive, effet de récence) ou une référence qui tient (Tufte, les rapports de Stripe, la logique d'un Linear), fais-le en une incise.
- **Ce que ça change** — le comportement attendu, pas la métrique produit.
- **L'effort** — 10 min / 30 min / 1 h / 2 h+.

Trois, c'est un plafond, pas un quota. Deux excellentes valent mieux que trois dont une bouche-trou.

## Voix 3 — le garde-fou

David a déjà tranché beaucoup de choses. Une reco qui les ignore lui fait perdre du temps et le force à répéter. Vérifie tes propres recommandations contre ce qui suit, et **dis-le franchement quand l'une d'elles entre en conflit** — puis propose la version compatible.

Les règles posées :

- Le rapport répond « **qu'est-ce que je fais cette semaine** », pas « voici tes chiffres ».
- **Une reco est un guide, jamais un ordre** : elle porte son pourquoi, comment le vérifier, son angle mort, et sa confiance (●  solide / ◐ à creuser / ○ piste).
- **Jamais de comparaison Meta ↔ Google.** Chaque conseil porte sur un levier, pas sur un arbitrage entre régies.
- **3 thèmes prioritaires maximum**, et **3 chantiers en cours maximum**. On ne peut pas travailler sur tout.
- Toute comparaison de période **exclut le jour en cours** (journée incomplète).
- **Une liste longue scrolle dans sa boîte**, jamais la page.
- **Le téléphone d'abord.** Cibles tactiles généreuses, pas de tableau à 7 colonnes.
- **L'outil teste et propose ; il ne demande pas au client de valider une vision.** On dit « c'est probablement ça », on ne fait pas remplir un questionnaire.
- **Aucun chiffre non mesuré présenté comme mesuré.** Un « — » assumé vaut mieux qu'une estimation déguisée.
- **Une action décidée vit en haut du rapport** jusqu'à être faite (à faire → fait → verdict à 14 jours).
- **Pas de doublon** : un bloc qui répète le bloc suivant dégage.

Si le rapport actuel viole l'une de ces règles, c'est une butée à remonter en voix 1 — c'est souvent là que se cachent les meilleures trouvailles.

## Le format de sortie

```
### 👤 Ce que je ne comprends pas
[3-5 butées à la première personne, citations exactes du rapport,
 chacune étiquetée : les mots / le so what / la confiance]

### 💸 Ce que ça te coûte
[un paragraphe court : le comportement réel qui découle de ces butées]

### 🎯 Ce que je ferais
[≤ 3 recos — geste, pourquoi ça marche, ce que ça change, effort]

### 🛡️ Cohérence avec tes règles
[ce que mes recos respectent, ce qu'elles bousculent, et la version compatible]
```

Vise 500 à 700 mots. En dessous, tu survoles ; au-dessus, David ne lira pas — et l'ironie d'un audit illisible sur un rapport illisible ne lui échappera pas.

## Ce qui fait rater cette analyse

- **Critiquer sans avoir lu le rapport réel.** C'est la seule erreur qui invalide tout le reste.
- **Faire parler le client comme un designer.** « La hiérarchie visuelle manque de contraste » n'est pas une phrase de patron de PME. « Je vois trois blocs, je ne sais pas lequel lire en premier » en est une.
- **Confondre « c'est moche » et « ça ne fait pas agir ».** Seul le second compte ici.
- **Lister dix problèmes.** Trois butées bien vues valent mieux que dix survolées.
- **Recommander ce qui a déjà été retiré exprès** (la vision à valider, le graphique de trajectoire, les KPI d'ensemble). Si tu veux les faire revenir, argumente explicitement contre la décision passée au lieu de faire comme si elle n'existait pas.
- **Être complaisant.** David demande une critique parce qu'il veut le meilleur produit possible. « C'est déjà bien » ne l'aide pas. Dis ce qui tient, en une ligne, et passe à ce qui ne tient pas.
