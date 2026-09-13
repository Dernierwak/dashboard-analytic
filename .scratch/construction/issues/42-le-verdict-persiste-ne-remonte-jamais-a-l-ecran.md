# Le verdict persisté ne remonte jamais à l'écran

Type: task
Status: open

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
