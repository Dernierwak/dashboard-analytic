# Le but de Pulse, en une phrase

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Une phrase qui dit ce que Pulse sert à faire, assez précise pour que **tout
module s'y rattache ou en sorte**. C'est le pivot de la carte : sans elle,
« améliorer l'app » n'a pas de sens, et c'est exactement ce qui manque à David
— *« les idées doivent s'emboîter, faire sens ensemble, et pas être des produits
séparés »*.

La phrase candidate existe déjà dans `CLAUDE.md` : *« où mettre ses dix minutes
cette semaine, et pourquoi »*. Ce ticket décide si elle tient, si elle se
reformule, ou si elle se remplace — à la lumière de ce que 01 montre du produit
réel et de ce que 02 montre du marché.

### Ce que la phrase doit permettre de faire, une fois écrite

- **Rattacher ou sortir chaque module.** Pour chacune des 10 pages, on doit
  pouvoir dire en une ligne comment elle sert le but — ou constater qu'elle ne
  le sert pas.
- **Nommer pour qui.** Une PME qui gère elle-même sa pub ? Une agence qui gère
  des clients ? Les deux ne veulent pas le même produit, et le code hésite
  aujourd'hui (`/equipe`, comptes invités).
- **Nommer le moment.** Pulse est-il ouvert une fois par semaine, ou consulté en
  continu ? Toute la structure des pages en dépend.
- **Résister à la question « et Looker Studio ne le fait pas ? »** — si la
  réponse est « si », la phrase ne tient pas.

### Consigne de conduite

Ticket **HITL** : la phrase est celle de David, pas la mienne. Le rôle de la
session est de proposer, contredire et resserrer, jamais de répondre à sa place.
Appeler les skills `vision-produit` puis `grilling` + `domain-modeling`.

Une fois la phrase arrêtée, elle **remplace** la formulation de `CLAUDE.md` §1 et
entre dans `CONTEXT.md` — c'est le seul endroit où ce genre de définition vit.

## Answer

Session HITL du 2026-09-08 avec David. **Quatre choses sont tranchées ; la
phrase elle-même ne l'est pas — et c'est David qui a dit pourquoi.**

### 1 · Pour qui : une ENTREPRISE, plusieurs paires d'yeux

Réponse de David : *« les deux »*, mais son exemple n'est pas une agence —
*« les artisans peuvent ajouter le marketing type, ou une boîte de 2 marketeurs,
ils peuvent partager au patron »*. C'est **un seul business, plusieurs personnes
autour du même compte**.

Le code va déjà dans ce sens : `dashboard_members` est une table
`owner_id → member_email` (« j'invite quelqu'un sur MON compte »), pas un modèle
« je gère N clients ». L'usage agence reste possible à l'envers, par
accumulation d'invitations (`choisirCompte`), mais rien n'a été construit pour
lui. **Le compte appartient à l'entreprise, pas à la personne.**

### 2 · Le moment : le jour que le client choisit — et c'est déjà construit

David : *« c'est pas lundi, le client se dit je veux faire le point jeudi, alors
les données sont à jour le jeudi »*.

Vérifié : `profiles.fetch_schedule`, réglable dans `/comptes`
(`components/jour-recolte.tsx`), lu par `_due_today` dans le worker. Le workflow
tourne tous les jours à 07:00 UTC et ne traite que les comptes dont c'est le
jour. **Rien à construire.**

### 3 · Le parcours de la semaine, dans les mots de David

> point général → *« ok super, il semble que tout roule »* → les thèmes
> principaux → *« ha super, il semble que ce que j'ai fait a aidé »* →
> *« je vais faire cela cette fois »* → et la possibilité d'analyser
> rapidement seul la plateforme sur laquelle il travaille.

Puis, sur l'onboarding : profil (questions qui nourrissent les recos IA) →
ajout d'une source → il voit qu'on récolte → il voit le dashboard → il ajoute
1-2 thèmes → gestion des coûts → rapport hebdo → les recos par thème attendent
qu'il **choisisse un thème** → premières tâches *« simples, pour pas le
dégoûter »*.

**Correction au ticket 01** : j'y avais écrit que `/meta`, `/google`,
`/instagram` « ne concluent rien ». David leur donne un rôle — la porte pour
creuser seul, en fin de parcours. Corrigé dans `etat-des-lieux.md`.

### 4 · Le carnet et les recos sont TOUS LES DEUX le produit

David a explicitement **refusé** le choix binaire que je lui proposais
(« le journal ou les recos ? ») :

> *« Pourquoi tu veux faire un choix ? […] Le produit te propose des
> plateformes que tu utilises. Il te permet d'ajouter des actions que tu as
> faites, mettre des thèmes. Tu as à la fin un peu tout ton historique de ce que
> tu fais pour travailler. **Cela permet de garder le client.** Et on te propose
> des choses à faire si tu as plus d'idées. »*

Deux faits mesurés pendant la session viennent se poser là-dessus :

- **Le carnet existe en écriture, pas en lecture.** `saveNote(texte, theme, jour)`
  écrit du texte libre dans `suivi_actions`, avec sa propre date (le code note
  même : « on note souvent le lendemain ce qu'on a fait la veille ; jamais dans
  le futur : une note est un fait, pas un projet »). Mais `NoteAjout` n'est
  monté que dans `theme-card.tsx` et `hors-theme.tsx` — donc uniquement dans une
  carte de thème du rapport de la semaine. **Aucune page ne relit l'historique** :
  le web lit `suivi_actions` une fois, `limit(60)`, pour fabriquer le rapport.
  Pas d'archive, pas de recherche, pas de vue par thème.
- **Aucun des 10 produits lus au ticket 02 n'a de carnet.** GoodMorning et Opteo
  sont des flux de conseils : rien ne s'accumule, on résilie sans rien perdre.
  C'est le seul mécanisme de rétention identifié sur toute la carte — et David
  l'avait nommé avant la recherche.

### 5 · La structure par plateforme : un gabarit, pas un dashboard de plus

David : *« l'application devrait grandir et ajouter des modules comme TikTok.
C'est pour cela que j'aimerais avoir une structure de Meta Ads clean […] same
pour Google Ads […] organique on veut aussi une structure qui fait sens. Ensuite
si le client utilise 1 ou 5, on s'en fiche, car on a une structure claire par
plateforme. »*

**Le document qui répond à ça existe et a été effacé.**
`docs/04-modules-partages-entre-sources.md` (323 l., commit `7f188f3`) s'ouvre
sur *la question de David, mot pour mot* : « si on change 1 élément d'une
source, où faut-il le changer, et à combien d'endroits ? », nomme TikTok,
LinkedIn et Pinterest, et classe chaque module en **générique / dupliqué /
spécifique par nature**, avec un gabarit pour brancher une nouvelle source.

Il révèle aussi un fait que le ticket 01 avait manqué : **`buildDash`
(`lib/channels.ts:531`) ne connaît ni Meta ni Google.** Il prend deux formes
neutres (`RawAd[]`, `Cfg`) et fabrique tout ; `getMetaDash` et `getGoogleDash`
ne font que lire leurs tables et l'appeler. La structure générique existe déjà
aux trois quarts — c'est sa carte qui manque.

### 6 · La phrase : NON tranchée, et David a dit pourquoi

Phrase **proposée par la session, pas validée par David** :

> *Pulse est le carnet de bord de ton marketing : tu y notes ce que tu fais, par
> thème, à travers toutes tes plateformes — et chaque semaine il te dit si ça a
> marché. Quand tu es à court d'idées, il t'en propose.*

David a arrêté cette direction :

> *« Tu me poses des questions pour faire des choses précises alors que le
> projet est encore flou. […] Nous n'avons aucun workflow, nous ne savons pas
> comment les pages travaillent ensemble. »*

Et il a nommé ce qui manque vraiment :

> *« Je veux qu'on sache comment on structure les dashboards, comment on
> travaille sur ce workflow de l'onboarding, le hebdomadaire, les recos thèmes
> sélectionnés, et le résumé de la semaine. **Tout cela avec une idée de comment
> tout parle entre eux.** »*

**Ce ticket est donc clos sur ce qu'il a réellement produit** : la cible, le
moment, le parcours, le rôle du carnet, le statut de la structure par
plateforme. La phrase s'écrira à la fin, quand le parcours sera clair — la
ciseler maintenant serait exactement l'erreur que David a relevée. Elle reste
dans la brume, sous « la phrase finale ».

### Le constat qui a fait graduer la brume

Le tableau des 9 étapes du parcours (dans la conversation) montre que **8 sur 9
existent déjà**. `SetupWizard` (245 l.) mène du profil à la première étoile en 3
étapes, état déduit des données, quittable et reprenable — et affiche même la
récompense du classement à l'endroit où il demande l'effort.

**Puis il lâche l'utilisateur.** Au-delà de l'étape 3, il n'y a plus de
parcours : 29 blocs sur une page, trois dashboards à côté, un carnet où l'on
écrit sans pouvoir relire. Le workflow n'a pas été perdu — **il n'a jamais
existé au-delà de l'onboarding.**

C'est ce constat qui rend formulables les tickets 06 et 07.
