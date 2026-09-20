# Le palier de l'API Gemini : lequel on utilise, et lequel on veut

Type: task
Status: open

## Question

> **Le corps ci-dessous est la question telle qu'elle a été posée, et sa
> prémisse est fausse — voir l'avancement du 2026-09-11 en bas. Le titre
> disait « gratuit, on est en infraction » : ce n'est pas vrai pour un
> exploitant suisse ou européen. La décision de payer tient, sa raison a
> changé.**

**Rien à décider sur le fond — il faut regarder dans quelle console, et payer si
la réponse est mauvaise.** Découvert en travaillant
[18](18-passer-en-production.md) le 2026-09-11.

**Ce ticket ne dépend de rien** : l'arête `Blocked by: 18` posée à sa création
était à l'envers — c'est le *dépôt* de la vérification, dans 18, qui attend ce
verdict (18, checklist l. 47-48), pas l'inverse. Corrigé le 2026-09-11. Les
autres gestes de 18 (créer l'entreprise, publier les pages légales) n'attendent
pas ce ticket, donc 18 reste ouvrable en parallèle.

Pulse envoie à l'API Gemini des extraits de la donnée lue avec les scopes
`adwords` (**restricted**) et `analytics.readonly` (**sensitive**) — cinq sites
d'appel, `gemini-2.5-flash`, via `generativelanguage.googleapis.com`
(`saas/recos_ia/labeling.py` l. 45, `saas/traitement/build_report.py` l. 59, et
`categorizing.py`, `theme_memoire.py`, `user_persona.py`).

### Le fait, aux deux sources primaires

Termes de l'API Gemini ([ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)) :

> **Palier gratuit** — *« Google uses the content you submit to the Services and
> any generated responses to provide, improve, and develop Google products and
> services »* et *« human reviewers may read, annotate, and process your API
> input and output »*.
>
> **Palier payant** — *« Google doesn't use your prompts […] or responses to
> improve our products »*.

Google API Services User Data Policy, Limited Use, qui s'applique aux scopes
*sensitive* et *restricted*
([developers.google.com/terms/api-services-user-data-policy](https://developers.google.com/terms/api-services-user-data-policy)) :

> *« Limit your use of data to providing or improving user-facing features that
> are prominent in the requesting application's user interface »*
>
> *« Don't allow humans to read the data, unless: You first obtained the user's
> affirmative agreement […] It is necessary for security purposes […] It is
> necessary to comply with applicable law »*

**Les deux ne tiennent pas ensemble sur le palier gratuit.** La donnée
publicitaire d'un client partirait vers un service qui s'autorise à la faire lire
par des humains et à s'en servir pour améliorer les produits de Google. Sur le
palier payant, Gemini redevient un simple sous-traitant qui rédige une
fonctionnalité visible à l'écran, et l'usage rentre dans les clous.

Ce n'est pas une lecture pessimiste du texte : c'est la lecture qu'un reviewer
Google fera du dossier, et il aura la liste des sous-processeurs sous les yeux,
parce que `PRIVACY_POLICY.md` §3.1 l'y met — comme il le doit.

### Ce qu'il faut faire

- [ ] Ouvrir la console du projet Google Cloud qui porte la clé Gemini et
      **vérifier que la facturation y est activée**.
- [ ] Si elle ne l'est pas : l'activer, et **re-générer la clé dans le projet
      payant** si la clé actuelle appartient à un autre projet.
- [ ] Confirmer que les cinq appels partent bien avec cette clé — une seule
      variable les porte, `GEMINI_API_KEY`.
- [ ] Une fois vérifié, **lever le commentaire d'avertissement** posé dans
      `PRIVACY_POLICY.md` §3.1 : la phrase « We use the paid tier » n'est vraie
      qu'à ce moment-là.

**Aucun secret dans la conversation** (`CLAUDE.md` §7) : ni la clé, ni un
fragment, ni l'identifiant du projet. La vérification se fait dans la console,
et ce ticket n'enregistre que le verdict.

### Le coût, pour décider les yeux ouverts

`gemini-2.5-flash` est le modèle le moins cher de la gamme, et Pulse l'appelle
cinq fois par compte et par semaine. Le montant n'est pas le sujet : le palier
payant est le prix d'entrée du dossier de vérification, pas une optimisation.

### Consigne de repli

Si la console n'est pas accessible dans la session : laisser la case cochée
« non vérifié » et **ne pas retirer** l'avertissement de `PRIVACY_POLICY.md`.
Publier la politique en affirmant le palier payant sans l'avoir vérifié serait
exactement le genre d'affirmation que `CLAUDE.md` §7 interdit.


## Avancement — session du 2026-09-11

**Le ticket disait « rien à décider sur le fond ». C'était faux : sa prémisse
était fausse, et la corriger change la raison de payer — pas la décision.**
Il reste ouvert : le verdict de la console n'appartient qu'à David, et
`gcloud` n'existe pas sur cette machine.

### La clause que le ticket n'avait pas lue

Les termes ont été relus **au texte brut**, pas par un résumé — et il a fallu ça,
parce que deux lectures automatiques du même document se sont contredites. Une
seule occurrence de « European Economic Area » existe dans la page (version en
vigueur du **23 mars 2026**), section *How Google Uses Your Data* :

> *« If you're in the European Economic Area, Switzerland, or the United Kingdom,
> the terms under "How Google uses Your Data" in "Paid Services" apply to all
> Services, including Google AI Studio and unpaid quota in the Gemini API, even
> though they are offered free of charge. »*

**Donc : pour un exploitant suisse ou européen, le palier gratuit porte déjà le
régime de données du palier payant.** Pas d'usage pour améliorer les produits de
Google, pas de relecture humaine pour les améliorer, renvoi au *Data Processing
Addendum*. Les deux citations du ticket restent exactes — elles sont simplement
**désactivées** pour nous par la clause suivante, que le ticket n'avait pas lue.

**L'affirmation « sur le palier gratuit, Pulse est en infraction » est donc
retirée** de `GOOGLE_VERIFICATION.md` §3, de `PRIVACY_POLICY.md` §3.1 et du
README. Même motif que l'ADR 0003 en [24](24-conseils-payants-manquants.md) :
décision intacte, justification réécrite.

### Ce qui fait qu'on paie quand même — la vraie liste

- **La clause dépend d'un fait qui n'existe pas encore.** « If you're in the EEA,
  Switzerland, or the UK » se juge sur l'exploitant, et l'entreprise est
  précisément la première case non cochée de [18](18-passer-en-production.md).
  Adosser la conformité du dossier à une clause régionale portant sur une société
  qui n'est pas créée, c'est se donner un point à défendre pour rien.
- **Une phrase du palier gratuit échappe à la clause.** Celle-ci n'importe que la
  section *How Google uses Your Data*. La section *Unpaid Services* porte à part :
  *« Do not submit sensitive, confidential, or personal information to the Unpaid
  Services. »* Un reviewer qui lit notre politique — où Gemini est déclaré comme
  sous-traitant, comme il le doit — a cette phrase à opposer.
- **Le quota gratuit casserait le rapport en silence.** `_call_gemini` retombe sur
  le chemin déterministe quand l'appel échoue : un quota atteint n'allume rien,
  il **appauvrit le rapport sans le dire**. Le risque grandit à chaque client.
- **Ça coûte 5 $.** Le prix d'entrée du palier payant, c'est lier un compte de
  facturation et **prépayer un minimum de 5 $** ; Tier 1 est plafonné à
  250 $/mois, l'effet est *« instantly »*, et **on peut délier le projet pour
  revenir au gratuit** ([docs Billing](https://ai.google.dev/gemini-api/docs/billing)).
  Le ticket disait « le montant n'est pas le sujet » ; il l'est, parce que 5 $
  réversibles ferment un débat juridique.

### Ce que la session a vérifié dans le code — la case 3 est close

- **Une seule clé existe, et c'est le secret GitHub Actions `GEMINI_API_KEY`.**
  `secret("gemini.api_key")` (`saas/commun/app_secrets.py`) lit la variable
  d'environnement `GEMINI_API_KEY`, sinon le `.env` racine — et **le `.env`
  racine n'en contient aucune**. En local, le code prend donc son chemin « pas de
  clé ». Il n'y a aucune divergence local / production à craindre.
- **Un seul workflow, un seul job.** `weekly-fetch.yml` l. 53 passe
  `secrets.GEMINI_API_KEY` à l'unique étape, qui lance `fetch_all.py` — lequel
  pilote `build_report.py` et `labeling.py`. Les cinq sites d'appel partent tous
  de cette clé-là.
- **Aucune clé nouvelle ne sera nécessaire.** Les clés *« have no independent
  billing settings; they inherit the tier limits and billing status of the
  project »* : activer la facturation sur le projet qui porte déjà la clé suffit,
  et le secret GitHub reste inchangé. **La case 2 du ticket tombe** sauf si la
  clé appartient à un projet qu'on ne veut pas facturer.

### Ce qui reste — un seul regard, sans CLI

`gcloud` est absent de cette machine : la vérification ne peut pas être
automatisée ici.

- [ ] Ouvrir la page des clés d'API de **Google AI Studio** et lire la colonne
      **Billing Tier** de la ligne du projet qui porte `GEMINI_API_KEY`.
      Un bouton **« Set up billing »** = palier gratuit.
- [ ] Si gratuit : cliquer « Set up billing », lier ou créer le compte de
      facturation, prépayer 5 $. Free → Tier 1 prend effet *« instantly »*.
      **Ne pas régénérer la clé.**
- [ ] Une fois vérifié, **lever le commentaire `À VÉRIFIER AVANT PUBLICATION`**
      de `PRIVACY_POLICY.md` §3.1. Tant qu'il est là, `/privacy` **refuse de
      servir le document** — la garde posée en [18](18-passer-en-production.md)
      rend cette consigne mécanique, elle n'a plus à être tenue de mémoire.

**Aucun secret dans la conversation** (`CLAUDE.md` §7) : ni la clé, ni un
fragment, ni l'identifiant du projet. Ce ticket n'enregistre que le verdict.
