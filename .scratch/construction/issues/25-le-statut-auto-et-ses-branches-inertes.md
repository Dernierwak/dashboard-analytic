# Le statut `auto` : des branches inertes, et des lignes orphelines en base

Type: task
Status: open
Blocked by: 12

## Question

**Découvert en finissant le ticket [06](06-rebrancher-le-plan-de-theme.md)**, qui
a fait mourir l'entrée automatique au carnet. `CLAUDE.md` §4 : ce qui n'était pas
demandé et que je découvre devient un ticket, pas un détour silencieux.

Depuis 06, **plus rien n'écrit ni ne relit une ligne `suivi_actions` au statut
`"auto"`**. Il reste deux choses derrière.

### 1 · Six fichiers web gèrent encore un statut qui n'arrive plus

Le worker ne les remonte plus dans `tracking`, donc `data.actions` n'en contient
jamais : ces branches sont **inertes, pas actives**. Elles n'ont aucun effet, mais
elles font croire à un mécanisme vivant.

| Fichier | Ce qui reste |
|---|---|
| `app/actions.ts` | `"auto"` dans `DEPART_ADMIS` (trois gestes), dans `DEJA`, et dans le `delete` du toggle de `startTracking` |
| `app/page.tsx` | `capReached` exclut `"auto"` du plafond de trois chantiers |
| `components/etat-action.tsx` | la pastille et le libellé « suivie automatiquement » |
| `components/theme-card.tsx` | trois filtres qui l'incluent ou l'excluent selon le cas |
| `components/rail-actions.tsx` | le rang « à juger » |
| `components/reco-actions.tsx` | le libellé du bouton |

**Ne pas retirer à l'aveugle** : `theme-card.tsx` porte trois filtres dont les
commentaires disent qu'ils ont déjà été corrigés deux fois (« rejet du checker,
3ᵉ passe »). Chacun se lit avant d'être touché.

### 2 · Les lignes déjà en base n'ont pas de sortie écrite

Elles restent, reconnaissables à `detail.origin == "auto"` — **rien n'a été
effacé** (`CLAUDE.md` §7, rien de destructeur sans regarder d'abord). Elles ne
s'affichent plus nulle part et ne reçoivent plus de verdict, ce qui est le
comportement voulu. Mais personne ne les a comptées, et **le nombre décide de la
question** :

- **peu** (le cas attendu : une par thème rédigé par Gemini et par cycle) → les
  laisser dormir est la bonne réponse, et il suffit de l'écrire ;
- **beaucoup** → elles gonflent une table que le carnet relit, et la question
  d'un rangement (`status="archived"`, jamais `DELETE`) se pose — **à valider par
  David**, pas à trancher dans le code.

**Le compte se fait avant de proposer quoi que ce soit.** Le projet Supabase du
`.env.local` de `saas/web` ne donne que la clé anon (relevé au ticket 02).

### Pourquoi il est bloqué par 12

[12](12-le-carnet-et-la-mort-de-preuve.md) fait du carnet **un module unique posé
partout** et tue `preuve`. Il réécrit une partie de ces mêmes fichiers : nettoyer
avant lui, c'est nettoyer du code qu'il va déplacer.

### Consigne de repli

Faire le **compte** des lignes orphelines et l'écrire ici, sans toucher à une
ligne de code. C'est ce qui décide du reste, et c'est utile même si le nettoyage
attend.
