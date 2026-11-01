# 17: Le statut d'une campagne Google supprimée

Type: grilling
Status: resolved
Blocked by: —

## Question

La frise montre le statut d'une campagne (ticket 04), selon la règle de
[Les états de la page](13-les-etats-de-la-page.md), point 10 : terminée,
problème signalé par Meta, en cours, en pause, prévue. Google rend aussi
`REMOVED` (41 campagnes sur 158 en base,
[Ce que le traitement doit calculer](14-ce-que-le-traitement-doit-calculer.md), §6),
qui n'entre dans aucun de ces statuts. Une campagne supprimée dont la fin
déclarée est passée est déjà « terminée ». Pour les autres :

- **« terminée »** : simple, mais faux pour une campagne supprimée avant sa
  fin prévue ;
- **un sixième statut**, « supprimée », dans le filtre ;
- **hors de la frise**, sauf si elle a dépensé dans l'année.

## Answer

Grilling du 2026-11-01. **Un sixième statut, « supprimée », et une seule
barre par campagne, sans découpe.**

- **`REMOVED` donne toujours « supprimée »**, avant la règle de la fin
  passée du ticket 13 (point 10). David : « si c'est supprimé, c'est
  supprimé ». « Terminée » reste celle dont la fin déclarée est passée.
- **Les supprimées restent visibles par défaut**, même jamais diffusées : on
  voit qu'une campagne avait été prévue, puis supprimée. Le filtre des
  statuts les cache. La règle d'entrée dans l'année (ticket 14, §6) ne change
  pas.
- **Une barre par campagne** :
  - **début** : la date déclarée, sinon le premier jour de dépense ;
  - **fin déclarée** : trait plein jusqu'à elle ;
  - **supprimée** : la barre finit à la **date de suppression** si le
    journal la connaît, sinon au **dernier jour de dépense**, dans un style
    qui dit « supprimée ». Une supprimée qui n'a jamais dépensé, sans date
    de suppression connue, n'est qu'un repère à sa date de début ;
  - **vivante sans fin déclarée** (en cours, en pause, problème signalé par
    Meta) : trait plein jusqu'à la fin de la semaine du rapport, puis
    **pointillés jusqu'au 31 décembre**, avec la légende « pointillés = pas
    de date de fin ». Le trait plein avance d'une semaine à chaque rapport ;
    une fin déclarée plus tard rend la barre pleine.
- **Les pauses ne se dessinent pas.** David : « les règles complexes, on ne
  sait plus ce qu'on doit montrer ». Une pause se lit dans la dépense de la
  semaine au survol (0 sur une semaine en pause), qui est mesurée.
- **Statuts du filtre** : terminée, supprimée, problème signalé par Meta, en
  cours, en pause, prévue, plus « statut inconnu ».

**Faits mesurés le 2026-11-01** (lecture seule de la base) :
- Aucune des 41 campagnes `REMOVED` n'entre dans la frise de 2026 : 21 ont
  une fin déclarée antérieure à l'année, 20 n'ont ni fin, ni dépense en
  2026, ni début en 2026.
- Aucune n'a de date de suppression connue : le journal Google
  (`platform_changes`) commence le 2026-07-28, avec 5 changements de statut,
  tous des réactivations. Une suppression future sera datée, tant que le
  worker passe au moins tous les 30 jours (`change_event`).
- Dessiner les pauses aurait demandé de récolter l'ancien et le nouveau
  statut en champs à part (le journal ne garde qu'une phrase), et n'aurait
  marché que depuis le début du journal (avril pour Meta, juillet pour
  Google) : des barres découpées et d'autres pleines selon la date.
- Le dernier jour de dépense n'est pas toujours le jour de la suppression
  (une campagne en pause en mars, supprimée en juin). La barre dit alors
  quand la campagne a tourné, ce qui est mesuré.

**Pour la spec** : `platform_changes` ne garde la suppression Google que dans
sa phrase (« a été supprimée », `_ETATS` de
`fetch_data/sources/google/ads/fetchers/changes.py`). La spec dit comment le
builder la lit : un champ structuré à récolter, ou le seul repli sur le
dernier jour de dépense.
