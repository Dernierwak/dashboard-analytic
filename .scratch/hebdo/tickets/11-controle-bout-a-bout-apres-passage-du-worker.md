# 11: Contrôle bout à bout après passage du worker

**What to build:** la page hebdo en ligne montre, sur un vrai compte, ce que
la spec promet, et la base le confirme. Le client ne déclenche rien : ce
contrôle ne se fait qu'après un passage du worker.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10

**Status:** ready-for-agent

**Références :** [spec](../spec.md) — Testing Decisions ; `CLAUDE.md` §9.

- [ ] David lance `weekly-fetch.yml` à la main depuis GitHub Actions, avec
      `force` (la récolte doit remplir couverture, colonnes des posts et
      statut structuré Google).
- [ ] La semaine du titre est celle du dernier Jour de travail moins un
      jour ; le jour du fetch n'y entre pas.
- [ ] Bandeau, carte Meta, changements, frise et panneau affichent les
      valeurs que la base donne pour cette semaine (requêtes en lecture
      seule, aucun secret dans la conversation).
- [ ] Chaque « — » affiché correspond à une absence réelle en base, chaque
      0 à une source qui a répondu.
- [ ] La couverture et la date « à reconnecter depuis » sont écrites comme
      attendu ; ce qui n'a pas pu être vérifié (un état qu'aucun compte
      réel ne présente) est dit franchement.
- [ ] Les écarts trouvés deviennent des tickets, pas des corrections
      glissées dans ce contrôle.
