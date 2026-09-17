# Le verdict persisté ne remonte jamais à l'écran

Type: task
Status: resolved

## Question

**Trouvé en corrigeant le ticket [17](17-verdict-persiste-qui-derive.md)**, qui
fige le verdict en base. `CLAUDE.md` §4 : ça devient un ticket, pas un détour —
la correction du 17 vit dans `saas/traitement/`, celle-ci dans `saas/web/`.

### Le fait

`saas/web/lib/report.ts` ramène les lignes de `suivi_actions` avec un
`select("*")` (l. ~735), donc la colonne `verdict` est **dans la main**. Elle
n'est jamais lue. Le verdict affiché vient uniquement du payload :

```ts
const measured = new Map<string, TrackedAction>();
for (const v of report?.tracking?.verified ?? []) measured.set(String(v.id), v);
// …
verdict: m?.verdict,
```

Or `tracking.verified` est bâti à partir de `suivi_en_cours()`, qui filtre
`status IN ('running','done')`. **Une action rangée n'y est plus.** Son verdict
existe en base, mais l'écran ne le voit pas : `etat()`
(`saas/web/components/etat-action.tsx`) tombe sur la branche `archived` sans
verdict et écrit « rangée » à la place de « ça a marché » / « ça n'a pas
marché ».

### Ce que ça coûte

Deux chiffres qui se contredisent sur la même page. Le bilan du carnet
(`saas/web/lib/carnet.ts`) compte, lui, `suivi_actions.verdict` en direct : il
annonce « 30 derniers jours : 6 actions jugées, 4 ont marché » pendant que les
lignes rangées de cette même fenêtre n'affichent aucun verdict. Le motif est
connu du dépôt — deux lectures de la même question qui ne répondent pas pareil.

C'est aussi la seule raison pour laquelle le rail dépend encore du payload sur
ce point : depuis le ticket 17, la **colonne est la vérité** et le payload n'en
est qu'une copie.

## 2 · Et rien ne garde la photo du verdict

Corollaire direct, trouvé en corrigeant le 17 : `suivi_actions` porte le verdict
(`better`/`worse`/`stable`) mais **pas les deux chiffres qui l'ont produit**.
Depuis le 17, le triplet `then/now/delta` n'est servi que la semaine où le
verdict tombe — après, le remesurer donnerait la dérive du compte, pas l'effet
de l'action. Conséquence : l'écran écrit « on suit le CTR » là où il écrivait
« CTR 3,1 → 5,8 ▲ +87 % », et **pour toute l'archive d'un coup** au premier
passage du worker.

C'est le bon comportement tant qu'on n'a que la colonne `verdict`. La question à
trancher est : **est-ce que ces deux chiffres méritent deux colonnes**
(`verdict_depart` / `verdict_constate`, écrites au même instant que `verdict`,
et donc figées comme lui) ? Si oui, l'écran retrouve sa ligne d'effet — sur la
photo du jour du verdict, honnête celle-là. Si non, on l'écrit dans
`docs/mesures-impossibles.md` et on cesse d'y revenir.

Ce qui est déjà écrit, quoi qu'il arrive : **on ne rejoue pas l'historique**.
Les actions jugées avant ces colonnes n'auront jamais leur photo.

## Ce qu'il faut faire

- Lire le verdict sur la LIGNE (`r.verdict`), le payload ne servant plus que
  pour le triplet `then/now/delta` du jour de la chute.
- Vérifier ce que devient une ligne rangée SANS verdict (abandonnée avant
  l'échéance, ou jugée non mesurable) : elle doit rester « rangée », pas
  hériter d'une pastille.
- Il n'y a **aucun runner dans `saas/web`** : ça se vérifie à la main, et ça se
  dit.

---

## Réponse

**La partie 1 est corrigée et vérifiée.** Le §2 est sorti en ticket
[62](62-deux-colonnes-pour-garder-la-photo-du-verdict.md) avec une
recommandation écrite — ce n'est pas une tâche, c'est une décision de schéma qui
touche trois dossiers, et `build_report.py` était tenu par un autre chantier.

### 1 · Le verdict se lit sur la ligne

`saas/web/lib/report.ts` lit `r.verdict` sur la ligne `suivi_actions` que
`select("*")` ramenait déjà. Le payload ne sert plus qu'au triplet
`then/now/delta`, servi la seule semaine de la chute.

**Et sans repli sur le payload**, ce qui est le cœur du correctif et non un
détail : un verdict que le payload porte alors que la colonne est vide, c'est
une écriture qui n'a pas pris — un refus RLS ne lève rien et touche zéro ligne
(`CLAUDE.md` §8). Cette ligne-là repassera par la branche de mesure et son
verdict sera **recalculé contre le KPI du jour** au rapport suivant. Le servir
remettrait à l'écran exactement le verdict qui dérive que le 17 venait de
retirer du worker. Elle reste donc « à juger » : un verdict retardé, pas un
verdict faux.

Une première version gardait un garde de migration (`"verdict" in r` → repli sur
le payload si la colonne n'existe pas). **Il est parti** : la colonne est dans
`000_run_me_all.sql` §23 — le fichier unique, rejouable — jusque dans son
registre d'auto-vérification (`('c', 'suivi_actions', 'verdict')`), et le seul
chemin qu'il ouvrait était celui du verdict qui dérive.

La lecture valide ce qu'elle trouve : un `verdict` hors des trois connus est
ignoré plutôt que rabattu sur « stable » par le `?? VERDICT.stable` d'`etat()`
— afficher un jugement que personne n'a rendu (`CLAUDE.md` §7). La liste des
trois n'existe plus qu'une fois côté TS, l'union du type en dérive.

### 2 · Ce qu'une ligne rangée sans verdict devient : rien de neuf

Elle reste « rangée » / « hypothèse rangée ». Vérifié, pas supposé.

**Mais le correctif ouvre un chemin resté inerte jusqu'ici**, et c'est la
trouvaille de cette session : `etat()` teste `a.verdict` **avant**
`estDecisionClient`. Une hypothèse `auto` que personne n'a confirmée et qui
porte un verdict — les lignes jugées avant que le ticket 06 ne sorte `"auto"` de
`suivi_en_cours` — arrivait donc à la **pastille pleine**, celle que le
commentaire trois lignes plus haut réserve aux vraies décisions. Elle garde
maintenant sa forme creuse et le mot « hypothèse », comme à tous ses autres
paliers : le verdict est vrai, il a été mesuré, mais il ne dit pas que le client
a fait quelque chose.

### 3 · Une ligne abandonnée peut porter un verdict, et on ne l'affiche pas

`drop` admet un départ `done` (`DEPART_ADMIS`, `app/actions.ts`) et les deux
boutons sont côte à côte au moment du verdict : « × j'abandonne » cliqué sur une
action déjà jugée est un geste normal. `etat()` annonce « abandonnée » — où la
ligne a fini. Le verdict, lui, reste **compté** là où on compte des mesures.

Conséquence assumée, écrite dans `theme-card.tsx` : le ratio « ce que tu as
tenté a bougé l'indicateur » a changé de contenu sans que sa ligne bouge — les
actions rangées et abandonnées y entrent enfin. Il dit maintenant la même chose
que `compterVerdicts` (`lib/carnet.ts`), qui les comptait déjà en base. C'est
précisément la contradiction que ce ticket refermait.

### Ce qui a été vérifié, et comment

`rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` muet, `npm run build`
vert, **19 routes** exactement.

**Et un harnais réellement joué**, `.scratch/construction/harnais/42-le-verdict-sur-la-ligne/`
(`bash jouer.sh`) : **15 vérifications** sur `etat()`, sans base, sans secret,
sans réseau. C'est la technique relevée par le ticket
[53](53-saas-web-n-execute-aucun-test.md) à partir du
[29](29-un-post-a-plusieurs-themes-le-filtre-n-en-voit-qu-un.md) — `etat()`
n'importe en valeur que `components/pente.tsx`, qui ne prend qu'un type de
React : les deux se compilent seuls et s'exécutent sous node. Aucun composant
n'est rendu, on n'appelle qu'une fonction qui retourne un objet.

**Rejoué contre le code d'avant : une seule des quinze tombe** — celle du §2
ci-dessus. C'est honnête et c'est attendu : le défaut que ce ticket décrit vit
dans `report.ts`, une fonction qui va chercher Supabase et n'a **pas** de couture
équivalente au `Lecteur` du traitement. Le harnais épingle donc la conséquence à
l'écran et la branche neuve, pas la lecture elle-même.

### Ce qui n'a pas pu être vérifié, et se dit

- **Rien n'est joué en base.** Qu'une ligne réelle porte bien son verdict après
  rangement reste à constater sur la vraie base.
- **Ça se voit à la lecture, pas après un passage du worker** : c'est une
  lecture web, pas du traitement. Mais ça ne montre quelque chose que si des
  verdicts sont déjà figés en colonne — donc après qu'un passage du worker en a
  écrit au moins un depuis le déploiement du 17.
- **`report.ts` n'est couvert par aucune exécution**, seulement par `tsc`, le
  `build` et la lecture. Le ticket 53 reste la bonne adresse pour ça.
