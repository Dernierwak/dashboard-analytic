# Passer en Production : l'entreprise, Google, Meta

Type: task
Status: open
Blocked by: 04

## Question

**Rien à décider ici : du travail que David seul peut faire, et qui débloque
toute validation chez un vrai client.**

[04](04-ce-qui-doit-etre-valide-en-premier.md) a établi que le jugement de David
sur son propre compte est le seul juge disponible **aujourd'hui**, et que le
comptage chez de vrais clients attend cette tâche. La carte avait rangé ce sujet
hors périmètre en le qualifiant de « check-list d'exécution, pas une décision » :
**c'était une erreur de périmètre**, corrigée par 04.

### Pourquoi c'est bloquant, mesuré

Documentation Google, source primaire :

> *« A Google Cloud Platform project with an OAuth consent screen configured for
> an external user type and a publishing status of "Testing" is issued a refresh
> token expiring in 7 days, unless the only OAuth scopes requested are a subset
> of name, email address, and user profile. »*

Le critère n'est pas « sensitive / restricted » mais **tout scope autre que nom /
email / profil**. Pulse demande `adwords` et `analytics.readonly` : les deux
tombent dedans. **Le jeton meurt à 7 jours, le worker hebdomadaire casse chaque
semaine, par construction.** Un client de test ne peut donc pas utiliser Pulse
deux semaines de suite.

S'ajoutent, en Testing : **100 utilisateurs de test maximum** et un **écran
d'avertissement** à chaque consentement.

Et pour la vérification complète : **`adwords` est classé *restricted*** par
Google (affirmation explicite de sa doc Google Ads API), ce qui impose une
**évaluation de sécurité CASA annuelle par un tiers agréé** dès que les données
transitent par un serveur — le cas de Pulse.

### Ce qu'il faut faire

David, mot pour mot : *« je dois créer une entreprise pour mettre Google et Meta
app en ligne et pouvoir mettre l'application pour tous. »*

**Ce que l'agent a fait — plus rien à en attendre :**

- [x] **Le dossier Google** — `saas/web/legal/GOOGLE_VERIFICATION.md` (2026-09-11) :
      les deux scopes, leur justification en anglais prête à coller, les
      sous-processeurs, l'ordre des opérations.
- [x] **Le dossier Meta** — `saas/web/legal/META_APP_REVIEW.md` (2026-09-11) :
      les cinq permissions, l'appel exact que chacune sert (fichier et ligne), et
      leur justification en anglais.
- [x] **Les pages légales alignées sur le vrai produit** (2026-09-11), et
      `<APP_NAME>` rempli — c'est **Pulse**, ce n'est pas une décision.
- [x] **Le script de la vidéo**, réécrit contre le code (2026-09-11).

**Ce que David seul peut faire, dans l'ordre où chaque ligne débloque la
suivante :**

- [ ] **Créer l'entreprise** — préalable aux **deux** vérifications : Google, et
      Meta (la vérification d'entreprise est exigée de toute app qui demande
      l'Advanced Access).
- [ ] **Vérifier le palier de facturation de l'API Gemini** → [26](26-gemini-palier-payant.md).
      Passe avant le dépôt, et décide d'une phrase de la vidéo.
- [ ] **Remplir les placeholders restants** dans `PRIVACY_POLICY.md` et
      `TERMS_OF_SERVICE.md` : entreprise, adresse, pays, juridiction, deux
      emails, date, plafond de responsabilité. Ils sont listés dans le
      [README](../../../saas/web/legal/README.md).
- [x] **Publier TROIS pages** à une URL publique HTTPS — **fait le 2026-09-11,
      option A.** `/privacy`, `/terms`, `/suppression` existent, répondent 200
      sans session, et **ne serviront les vrais documents qu'une fois les
      placeholders remplis** (ligne ci-dessus). Voir la troisième session.
- [ ] **Vérifier le domaine** dans Google Search Console.
- [ ] **Trancher `ads_management` → `ads_read`** avant de déposer chez Meta —
      Pulse ne fait que lire, et demander plus que ce qu'on utilise est un motif
      de refus classique. Le test qui l'éclaire est gratuit (`META_APP_REVIEW.md`
      §1).
- [ ] **Google : passer en Production**, puis engager la vérification (dont CASA
      pour `adwords`).
- [ ] **Lancer le test des 7 jours** le jour du basculement — gratuit, et seule
      façon de répondre (voir ci-dessous).
- [ ] **Meta : passer l'app en Live** et déposer l'App Review.

### Le point à TESTER avant de bâtir dessus

**Donné comme incertain, pas comme fait.** Le mur des 7 jours est rattaché par la
doc au *publishing status « Testing »*, pas à l'absence de vérification. L'état
« Production, non encore vérifiée » n'est décrit avec **aucune** expiration de
jeton — seulement avec un écran « danger » et un plafond de 100 utilisateurs.
Aucune page Google ne l'écrit noir sur blanc.

**Si c'est vrai, ça change le calendrier du produit** : on pourrait valider chez
3-5 vraies entreprises **pendant** la vérification, au lieu de l'attendre.
À vérifier sur un compte réel : basculer en Production, connecter un compte, et
regarder si la récolte tient plus de 7 jours.

### Ce que ce ticket rend au reste de la carte

À sa clôture, écrire ici les faits dont les tickets suivants dépendent : statut
de publication atteint, URL des pages légales publiées, date de dépôt de la
vérification, et **le verdict du test des 7 jours**.

### Consigne de conduite

Ticket **HITL, tâche** : l'agent ne peut rien exécuter à la place de David
(compte Google Cloud, compte Meta, création d'entreprise). Ce qu'un agent PEUT
faire et doit proposer : compléter les templates de `saas/web/legal/`, et
préparer la liste des scopes et des justifications que le dossier réclame.
**Aucun secret dans la conversation** (§7) : ni jeton, ni identifiant client.

### Consigne de repli

Rendre la check-list à jour avec ce qui est fait et ce qui reste, plutôt que
d'entamer les templates légaux.


## Avancement — session du 2026-09-11

**Ce que l'agent pouvait faire est fait ; ce qui reste demande un compte que
David seul possède.** Le ticket reste ouvert : il se clôt quand les statuts de
publication sont atteints et que le verdict du test des 7 jours est écrit.

### Ce qui a été produit

**`saas/web/legal/GOOGLE_VERIFICATION.md`** — le dossier n'existait pas. Il porte
les deux scopes avec leur catégorie Google (`adwords` **restricted**,
`analytics.readonly` **sensitive**), la justification en anglais prête à coller
dans le formulaire, la liste exacte des sous-processeurs, le mur des 7 jours, et
l'ordre des opérations en sept étapes.

Deux affirmations du dossier ont été vérifiées contre le code plutôt que
supposées :

- **La lecture seule est vraie.** Aucun appel d'écriture Google Ads n'existe dans
  le dépôt : `git grep -nE ":mutate|mutateOperations|MutateGoogleAds" --
  'saas/collecte/**'` ne renvoie rien.
- **Aucune donnée d'utilisateur final n'est demandée à GA4.** Les seules
  dimensions sont `date`, `sessionSource`, `sessionMedium`, `sessionCampaignName`
  et `eventName` (`saas/collecte/ga4/fetch_ga4.py` l. 87-95 et 367-375), et la
  table n'a pas d'autre colonne (`ga4_insights`, migration l. 341). Ni `userId`,
  ni `clientId`, ni géolocalisation, ni appareil. C'est un argument fort du
  dossier, et il est vrai.

### Les pages légales décrivaient un autre produit

Confrontées au code, elles portaient trois défauts dont **deux auraient fait
refuser le dossier**, et tous les trois sont corrigés :

- **Google Analytics 4 était absent de la politique de confidentialité**, alors
  que le scope `analytics.readonly` est demandé. Un scope non couvert par la
  politique publiée est un motif de refus direct.
- **L'API Gemini n'y figurait pas** — ni dans les sous-processeurs, ni nulle
  part — alors que cinq sites d'appel lui envoient de la donnée issue des scopes
  Google. La politique affirmait même ne rien partager hors de la liste du §5.
- **Stripe et une offre Free/Pro y étaient décrits** : `git grep -il stripe` ne
  renvoie que des templates et un fichier de skill. Aucun paiement n'existe dans
  le produit. Publier ça, c'est une fausse déclaration dans un document qu'un
  reviewer lit.

S'y ajoutaient deux promesses que le code ne tient pas, réécrites en ce qu'elles
sont : l'authentification à deux facteurs (non implémentée) et l'export /
suppression « depuis les réglages » (aucun bouton — c'est une demande à traiter à
la main, et la politique le dit maintenant).

La politique gagne aussi le paragraphe **Limited Use** que la vérification Google
réclame explicitement, et une section §3.1 qui déclare l'usage de Gemini.

### Les deux questions ouvertes, tranchées à la source

**Le mur des 7 jours : la doc n'a pas bougé, le test reste le seul juge.**
Re-vérifiée le 2026-09-11,
[developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)
rattache toujours l'expiration au *publishing status « Testing »*, et **ne décrit
l'état « In production, non vérifiée » avec aucune durée de jeton**. La page
d'aide sur la vérification n'en parle pas davantage. L'hypothèse du ticket tient
donc debout — elle n'est ni confirmée ni infirmée par écrit, et trois gestes y
répondent : basculer, connecter, revenir au 8ᵉ jour.

**Le point neuf, et il est bloquant : le palier de l'API Gemini.** Les termes de
l'API distinguent un palier gratuit où *« human reviewers may read, annotate, and
process your API input and output »* et où Google utilise le contenu pour
améliorer ses produits, et un palier payant où il ne le fait pas. La Limited Use
requirement des scopes *sensitive* et *restricted* interdit précisément les deux.
**Sur le palier gratuit, Pulse est en infraction** — et le dossier le dit
lui-même au reviewer, puisque la politique déclare Gemini comme elle le doit.
C'est le ticket [26](26-gemini-palier-payant.md), et il passe avant le dépôt.

### Ce qui reste, et que personne d'autre ne peut faire

Créer l'entreprise · remplir les placeholders d'entreprise dans les deux
documents · les publier à une URL HTTPS · vérifier le domaine dans Search
Console · basculer en Production et lancer le test des 7 jours · déposer la
vérification Google (CASA comprise) · passer l'app Meta en Live.


## Avancement — deuxième session du 2026-09-11

**Le dossier Meta n'existait pas, et le script de la vidéo aurait fait refuser la
vidéo.** Les deux sont écrits ; le ticket reste ouvert, il ne se clôt qu'aux
statuts de publication atteints et au verdict du test des 7 jours.

### La vidéo de démonstration disait le contraire du code

`OAUTH_DEMO_VIDEO_SCRIPT.md` faisait lire à haute voix, face à l'écran de
consentement : *« We only ask for the `adwords` scope. We do not request any
other permissions. »* **C'est faux.**
`saas/web/app/api/oauth/google/start/route.ts` l. 11-14 demande `adwords` **et**
`analytics.readonly`, sur un seul écran de consentement — et le commentaire
explique pourquoi c'est voulu. Un reviewer compare la vidéo à la liste des scopes
déposés : l'écart se voit en dix secondes, et il coûte un cycle entier.

Trois autres défauts du même fichier, tous du même genre — un produit décrit de
mémoire plutôt que regardé :

- **`st.status`** : vocabulaire Streamlit, retiré depuis. L'app est en Next.js.
- **« Settings → Google Ads »** et **« Google Ads tab »** : ces écrans n'existent
  pas. Les vrais sont `/comptes`, `/google` et `/conversions`.
- **« Users can delete all their data at any time »** : aucun bouton ne le fait.
  C'est exactement la promesse que la politique de confidentialité a dû corriger
  le matin même. `components/deconnecter-bouton.tsx` dit la vérité, lui : le
  jeton est révoqué, *« tes données déjà enregistrées restent »*.

Le script réécrit tient les quatre cases de `GOOGLE_VERIFICATION.md` §5, montre
**un écran par scope** (`/google` pour `adwords`, `/conversions` pour
`analytics.readonly` — sa page s'intitule déjà « Ce que Google Analytics compte
pour toi »), et porte la phrase Gemini **conditionnée à [26](26-gemini-palier-payant.md)** :
on la dit quand le palier est vérifié, ou on ne tourne pas encore.

### Le dossier Meta, et la permission de trop

`saas/web/legal/META_APP_REVIEW.md` — écrit sur le même patron que le dossier
Google : chaque permission avec l'appel qu'elle sert, fichier et ligne, puis la
justification en anglais.

**Le fait qui compte : Pulse demande `ads_management` et n'écrit jamais rien.**
Aucun `POST` vers `graph.facebook.com` n'existe dans le dépôt — les deux seuls
`POST` de `saas/web/lib/oauth-api.ts` (l. 98, l. 186) vont chez Google, un
rafraîchissement de jeton et une requête `search`. Les quatre appels Meta sont
des lectures : `/act_<id>/insights`, `/campaigns`, `/adsets`, `/activities`.
La permission de lecture existe et s'appelle **`ads_read`** ; sa page de
référence décrit son usage autorisé comme l'accès aux données de performance
*« for use in personalized dashboards and data analytics »*. Demander plus que ce
qu'on utilise est un motif de refus classique.

**Ce qu'on ne sait pas** — et on ne l'invente pas : la référence de `ads_read`
nomme l'Ads Insights API, elle ne dit pas si `/campaigns`, `/adsets` et
`/activities` en relèvent, et la page de `/activities` n'a aucune section de
permissions. Le test est gratuit (une app n'a pas besoin d'App Review sur ses
**propres** comptes) et c'est la seule réponse fiable. Son coût est réel : changer
les permissions force tous les comptes déjà connectés à re-consentir — aujourd'hui
un seul, demain chaque client.

**Deuxième fait neuf** : la vérification d'entreprise est exigée de toute app qui
demande l'Advanced Access, et Pulse lit les comptes de ses clients. Meta dépend
donc de la création de l'entreprise **exactement comme Google** — les deux
vérifications ont le même premier verrou.

**Troisième** : Meta réclame une **URL d'instructions de suppression des
données**. Pulse n'a pas de bouton de suppression, donc cette page dit à qui
écrire et sous quel délai — mais elle doit exister. Ce sont **trois** pages à
publier, pas deux.

### Le mur qui n'était pas écrit : aucune page légale n'a d'URL

`find saas/web/app -name page.tsx` ne renvoie que les dix pages du produit :
**ni `/privacy`, ni `/terms`, ni suppression**. Les documents sont des `.md` que
rien ne sert. Et `saas/web/middleware.ts` l. 33-35 redirige vers `/login` tout ce
qui ne commence pas par `/login` : une page `/privacy` créée sans toucher au
middleware **renverrait le reviewer sur l'écran de connexion**, qui en conclurait
que la politique n'est pas publique.

C'est le seul morceau de **construction** que ce ticket réclame, et il est petit.
Il porte deux effets de bord à traiter le même jour : ouvrir les trois chemins
dans le middleware, et **mettre à jour le compte de routes de `CLAUDE.md` §9**
(16 aujourd'hui) — sinon chaque session suivante lit une fausse alerte de « page
de contrôle oubliée ». L'arbitrage entre publier dans l'app (A) ou sur GitHub
Pages (B) est écrit dans le README §2 : B débloque le dépôt en une heure, A
referme le sujet.

### Ce que l'agent a rempli, et qui n'attendait personne

`<APP_NAME>` était traité comme un placeholder d'entreprise. Ce n'en est pas un :
l'app s'appelle **Pulse** partout — `app/layout.tsx` l. 13, `app/login/page.tsx`
l. 67. Rempli dans les deux documents. Les placeholders restants sont tous des
faits que David seul connaît.


## Avancement — troisième session du 2026-09-11

**Le seul morceau de construction du ticket est fait : les trois URL existent.**
Le ticket reste ouvert — il se clôt aux statuts de publication atteints et au
verdict du test des 7 jours, et il attend maintenant des gestes que David seul
peut faire.

### L'arbitrage A / B est tranché : A

B (GitHub Pages) débloquait le dépôt en une heure, mais posait la politique sur
un `github.io` — que Google vérifie en propriété **« préfixe d'URL »**, pas en
propriété de domaine (README, étape 3). Le raccourci se serait payé à l'étape
suivante. A referme le sujet, et `saas/web` était déjà déployé.

### Ce qui a été construit

| URL | Document servi | Statut sans session |
|---|---|---|
| `/privacy` | `legal/PRIVACY_POLICY.md` | 200 |
| `/terms` | `legal/TERMS_OF_SERVICE.md` | 200 |
| `/suppression` | `legal/DATA_DELETION.md` | 200 |

Mesuré sur le serveur de production local : les trois répondent **200** sans
cookie, `/comptes` répond toujours **307 → /login**.

**Les pages LISENT le `.md`, elles ne le recopient pas** (`saas/web/lib/legal.ts`,
`components/document-legal.tsx`). Un document juridique tenu en deux exemplaires
finit par en avoir deux versions, et c'est celle qu'on n'a pas relue qui est
publiée. David édite le `.md` — après un avocat, par exemple — et la page suit
sans qu'une ligne de code bouge.

Trois effets de bord traités le même jour :

- **`middleware.ts` porte `CHEMINS_PUBLICS`.** Sans lui, le reviewer atterrissait
  sur `/login` et concluait que la politique n'est pas publiée. Rien d'autre
  n'entre dans cette liste.
- **Le compte de routes passe de 16 à 19**, dans `CLAUDE.md` §9 et dans
  `saas/web/CLAUDE.md` — sinon chaque session suivante lit une fausse alerte de
  « page de contrôle oubliée ».
- **`next.config.mjs` porte `outputFileTracingIncludes`.** Le chemin du `.md` est
  construit (`path.join(process.cwd(), "legal", …)`), donc le traçage de Next ne
  peut pas le deviner : sans cette liste les trois pages **marchent en local et
  tombent en 500 en production** — sur l'URL qu'on vient de donner à un reviewer.
  Vérifié dans les `.nft.json` : le `.md` y est. Next trace en fait le dossier
  `legal/` entier ; aucune route ne les sert et ils ne portent aucun secret,
  c'est du poids et pas une fuite. Noté dans le fichier.

### La garde qui empêche de publier une fausse déclaration

**Un document dont un `<PLACEHOLDER>` reste, ou qui porte un commentaire
« À VÉRIFIER AVANT PUBLICATION », n'est pas servi.** La page répond 200 et dit
qu'il n'est pas encore publié ; la raison exacte part dans les journaux du
serveur, jamais à l'écran — « nos DPA ne sont pas encore signés » est vrai, et ce
n'est pas une phrase qu'on affiche sur son propre site.

Les deux marqueurs existaient déjà dans les `.md` : aucune convention nouvelle à
retenir, on a seulement rendu lisible par la machine ce qui était écrit pour un
humain. C'est ce qui garantit mécaniquement que la politique n'affirmera pas le
palier payant de Gemini avant que [26](26-gemini-palier-payant.md) soit tranché —
la consigne de repli de ce ticket-là n'a plus besoin d'être respectée de mémoire.

**Conséquence directe : aujourd'hui les trois URL existent et ne publient rien.**
Remplir les placeholders d'entreprise est désormais le SEUL geste entre ici et
trois documents servis.

### Quatre affirmations fausses, trouvées en regardant le code

Trois étaient dans des documents écrits le matin même, et deux auraient été
confrontées au produit par un reviewer.

- **`git grep -n revoke` ne renvoie rien dans le dépôt.** `deconnecter()`
  (`app/comptes/actions.ts` l. 129-147) met les colonnes de jeton à `NULL` dans
  `connected_accounts` — **aucun appel de révocation n'existe**. Le jeton reste
  donc valide chez Google tant que l'utilisateur ne le révoque pas de son côté ;
  ce qui disparaît, c'est notre copie. Le script de la vidéo faisait dire à
  l'écran *« the refresh token is revoked immediately »*, et la politique §2.2
  promettait de révoquer « from your settings ». Les deux sont réécrits, et le
  script porte la mise en garde.
- **Les CGU §10.1 promettaient « delete your account at any time from your
  settings ».** Aucun bouton ne le fait — c'est exactement la promesse que la
  politique avait dû corriger le matin même, restée une section plus bas.
  Réécrite, et elle renvoie vers `/suppression`.
- **Les CGU §10.2 listaient « You fail to pay your subscription »** comme motif
  de résiliation, alors que le §3 du même document dit qu'aucune offre payante
  n'existe. Conditionné à l'existence d'une offre.
- **Les liens croisés des CGU pointaient vers `./PRIVACY_POLICY.md`.** Sur la
  page publiée, c'est un **404** — et c'est le lien qu'un reviewer suit depuis
  les CGU vers la politique. Tous les liens croisés sont passés en chemins de
  site (`/privacy`, `/suppression`).

Aucune de ces quatre n'a été trouvée par le compilateur : elles sont sorties en
**regardant le document rendu**, pas en le relisant.

### Ce que ce ticket rend au reste de la carte

- **Les trois chemins sont fixés** : `/privacy`, `/terms`, `/suppression`. Les
  URL complètes n'existent qu'une fois le domaine choisi ; les placeholders
  `<PRIVACY_URL>` et `<DELETION_URL>` du script vidéo les attendent.
- **Le compte de routes de référence est 19.**
- **La suppression de données est une procédure écrite, pas un bouton** —
  `DATA_DELETION.md` la décrit, et elle est cohérente avec la politique §6 et les
  CGU §10.1. Le jour où un bouton existe, les trois se corrigent ensemble.

### Ce qui reste, et que personne d'autre ne peut faire

Créer l'entreprise · **remplir les placeholders d'entreprise** (c'est ce qui
allume les trois pages) · vérifier le palier Gemini → [26](26-gemini-palier-payant.md) ·
vérifier le domaine dans Search Console · trancher `ads_management` → `ads_read` ·
basculer en Production et lancer le test des 7 jours · déposer la vérification
Google (CASA comprise) · passer l'app Meta en Live.


## Avancement — session du 2026-09-21

**Rien de neuf à construire : tout ce qu'un agent peut faire sur ce ticket était
déjà fait, et cette session l'a vérifié au lieu de le croire.** Le ticket reste
ouvert — il se clôt aux statuts de publication atteints et au verdict du test
des 7 jours, et les huit gestes restants demandent tous un compte que David seul
possède.

### Le chemin que personne n'avait jamais vu : le document servi

Les trois sessions du 2026-09-11 ont mesuré que `/privacy`, `/terms` et
`/suppression` répondent **200 sans session**. Ce qu'elles n'ont pas pu mesurer,
c'est ce qui sortirait **une fois les placeholders remplis** : la garde éteint
les trois documents, donc le rendu réel n'avait jamais été observé. C'est
précisément le geste qui reste à David, et il allume trois pages d'un coup sur
l'URL qu'un reviewer Google tient déjà.

Vérifié le 2026-09-21, `legal/` sauvegardé puis restauré à l'identique
(`diff -r` vide) :

- Les huit placeholders remplis de valeurs factices et les deux marqueurs
  `À VÉRIFIER AVANT PUBLICATION` neutralisés, **la garde se lève et les trois
  documents sont servis** — 71 kB, 48 kB et 29 kB de HTML.
- **Aucune syntaxe markdown ne fuit dans le rendu** : ni `**`, ni backtick, ni
  `|` de tableau, ni `[texte](lien)`, ni `<!-- -->`, ni `<PLACEHOLDER>`, sur
  aucune des trois pages.
- **Aucun fragment du `.md` ne manque à l'écran.** Chaque ligne source — titres,
  paragraphes, items de liste, et chaque cellule de chaque tableau — a été
  recherchée dans le HTML rendu, aux espaces près : **0 absent sur 3 pages**.
- **Les liens croisés sont tous des chemins de site** (`/privacy`, `/terms`,
  `/suppression`), aucun `.md` résiduel, donc aucun 404 sur le trajet
  CGU → politique qu'un reviewer suit. Les deux liens externes
  (`developers.google.com/terms/api-services-user-data-policy`,
  `myaccount.google.com/permissions`) sortent en absolu.
- `legal/` restauré, **la garde est retombée** : `/privacy` réaffiche « pas
  encore publié ».

### Le reste de la vérification

- `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` **vert**,
  `npm run build` **vert**, **19 routes** — le compte de référence de
  `CLAUDE.md` §9 est bien celui du build.
- `/privacy`, `/terms`, `/suppression` → **200** sans cookie ; `/comptes` et `/`
  → **307 vers /login**. Le middleware n'a pas ouvert plus que les trois.
- **Les trois pages sont liées depuis l'app** : `app/login/page.tsx` l. 192-194,
  soit le seul écran qu'un reviewer non connecté atteint. Ce n'était écrit nulle
  part dans le ticket ; c'est vrai.
- Les journaux du serveur portent bien la raison exacte du refus de publier, et
  l'écran ne la porte pas.

### Ce que la vérification a trouvé, et qui devient un ticket

**[30](30-markdown-legal-avocat.md)** — `decouper()` rend six constructions
markdown ; une liste numérotée, une citation `>` ou un `####` sont publiés en
clair. Mesuré sur une sonde du découpage : trois clauses `1.` `2.` `3.` fondent
en **un seul paragraphe**. Les trois `.md` servis n'en emploient aucune
aujourd'hui — l'équilibre tient jusqu'à la relecture d'avocat que le README
réclame lui-même. Pas corrigé ici : `CLAUDE.md` §4, ce qui n'était pas demandé
devient un ticket, pas un détour.

### Ce qui reste, et que personne d'autre ne peut faire — inchangé

Créer l'entreprise · **remplir les placeholders d'entreprise** (c'est ce qui
allume les trois pages, et le rendu est maintenant vérifié) · vérifier le palier
Gemini → [26](26-gemini-palier-payant.md) · vérifier le domaine dans Search
Console · trancher `ads_management` → `ads_read` · basculer en Production et
lancer le test des 7 jours · déposer la vérification Google (CASA comprise) ·
passer l'app Meta en Live.

### Revue de code, et la seule correction qu'elle a valu ici

Huit remarques, confrontées une à une aux trois `.md` réellement servis :
**sept ne sont déclenchées par aucun document d'aujourd'hui** et rejoignent
[30](30-markdown-legal-avocat.md), qui passe de trois cas à huit — dont la
**continuation de puce**, le plus probable de tous puisque le dépôt entier est
composé à 80 colonnes.

La huitième n'était pas une construction markdown, et elle touchait la promesse
de ce ticket : **la lecture du `.md` n'était pas gardée.** Un fichier absent du
bundle serverless — le scénario même que `outputFileTracingIncludes` existe pour
éviter — remontait hors du composant serveur ; comme il n'existe ni `error.tsx`
ni `global-error.tsx`, la page aurait servi le **500 par défaut de Next sur
l'URL déposée chez Google**, au lieu du message « pas encore publié » que tout
le reste du module s'attache à rendre. Un filet qui ne dépend pas d'un réglage
de build vaut mieux qu'un écran d'erreur.

Corrigé dans `lib/legal.ts`, et **vérifié en retirant le fichier serveur
tournant** : `/terms` répond **200** avec le message d'attente, l'`ENOENT` part
dans les journaux, le fichier remis la page redevient normale.

Noté au même endroit, sans code : `experimental.outputFileTracingIncludes` est
l'emplacement de **Next 14**. En Next 15 la clé passe à la racine et celle-ci
est ignorée **en silence** — une montée de version sortirait les `.md` du bundle
sans casser le build. Écrit dans `next.config.mjs`, à côté du réglage.

Après correction : `npx tsc --noEmit` vert, `npm run build` vert, **19 routes**.
