# 04: Trafic et navigation

Type: grilling
Status: resolved
Blocked by: 02
Assignee: —

## Question

La spec de `/instagram` a trois Objectifs : Portée, Engagement, Abonnés
(`.scratch/instagram/spec.md` § Sélecteur de vue). La story apporte des
métriques que les autres formats n'ont pas. David : « ça on peut les mettre
[…] dans Trafic, on a le clic ».

1. **Un Objectif Trafic** : quelles métriques, laquelle par défaut ?
   Candidats : clics sur le lien (`link_clicks`, story seule), clics sur le
   lien de la bio (`profile_activity` / `bio_link_clicked`, posts du fil et
   stories), visites de profil (déjà en Abonnés — en double, ou pas ?).
2. **La navigation** (avancer, revenir, quitter, story suivante) : dans
   Trafic, dans un Objectif à part, ou seulement dans le Panneau d'une
   journée ?
3. **Les formats qui n'ont pas la métrique** : la phrase de chacun (« Instagram
   ne donne pas de clics sur le lien pour un Reel ») — et si Trafic est
   presque vide hors stories, l'Objectif reste-t-il pour tous les formats ?
4. **Engagement pour une story** : pas de j'aime, commentaires ni
   enregistrements ; le taux d'engagement se calcule-t-il sur partages seuls,
   ou la rangée Story reçoit-elle une phrase ?

Les réponses de [l'essai](02-l-essai-reel-d-une-story.md) disent ce qui
existe vraiment ; ce ticket dit ce qu'on en montre.

## Answer

Tranché par Claude le 2026-11-25, sur délégation de David.

1. **Un Objectif Trafic**, une métrique : **clics sur le lien**
   (`link_clicks`). `profile_activity` n'entre pas : elle existe aussi pour
   les posts du fil, qui ne la récoltent pas ; la montrer pour les stories
   seules mélangerait deux couvertures. Visites de profil : restent en
   Abonnés, pas de doublon.
2. **La navigation ne fait pas un Objectif** : elle vit dans le **Panneau**
   d'une journée (par story : avancer, revenir, quitter, story suivante), et
   « sorties pour 100 vues » s'ajoute aux métriques de l'Objectif **Portée**
   pour la rangée Story seule.
3. **Les autres formats en Trafic** reçoivent la phrase « Instagram ne donne
   de clics sur le lien que pour les stories ». L'Objectif reste visible pour
   tous : il dit où le clic se mesure.
4. **Engagement d'une story** : pas de taux (j'aime, commentaires,
   enregistrements n'existent pas) — la rangée reçoit la phrase « Instagram ne
   donne ni j'aime, ni commentaires, ni enregistrements pour une story » ; les
   métriques **partages** et **interactions** s'affichent quand elles sont
   choisies. `replies` n'apparaît nulle part.
5. **Un 0 de clics** porte la mention « Instagram rend aussi 0 pour une story
   sans lien » tant que l'essai d'une story à lien ne l'a pas tranché.
