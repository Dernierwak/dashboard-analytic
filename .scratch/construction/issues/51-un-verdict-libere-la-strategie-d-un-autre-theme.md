# Un verdict libère la Stratégie d'un AUTRE thème

Type: bug
Status: open

## Question

**Trouvé en corrigeant le ticket
[27](27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md)**, qui ne le
règle pas : il déplace la garde d'attente de la clé vers le thème, mais la
condition qui LÈVE cette garde reste, elle, indexée par clé sur tout le compte.
`CLAUDE.md` §4 : ça devient un ticket, pas un détour silencieux.

### Le fait

L'épinglage d'une Stratégie se lève dès qu'un verdict est tombé — décision du
wayfinder ticket 06, et elle est bonne : une théorie dont le Verdict est rendu
ne doit pas bloquer la suivante jusqu'à la fin d'une fenêtre de calendrier.

Mais « est-ce que le verdict de CETTE Stratégie est tombé ? » se lit ainsi
(`build_report.py`, bloc « PAS DE NOUVELLE MARCHE AVANT LE VERDICT ») :

```python
_verdict_tombe = bool(verdicts.get(_plan.get("reco_key")))
```

et `verdicts` vient de `fetch_reco_verdicts` (`saas/commun/fetch_data.py`) :
`{reco_key: verdict}` sur **tout le compte**, sur les **quatre dernières
semaines**, sans aucune notion de thème.

Or une même règle se déclenche sur plusieurs thèmes. Un client qui a cliqué
« ✓ C'est fait » sur `page_endormie` pour son thème *Piscine*, et dont le
verdict est tombé, **libère du même coup** la Stratégie `page_endormie` de son
thème *Sauna* — dont il n'a rien fait, et dont rien n'a été mesuré. La théorie
du second thème est remplacée alors qu'elle n'a jamais rendu de verdict.

La fenêtre glissante de quatre semaines borne la casse dans le temps ; elle ne
la corrige pas.

### Ce qu'il faut trancher

- **Le verdict qui libère une Stratégie doit-il être celui de CE thème ?** Ça
  se défend — c'est ce que « une théorie par thème » veut dire. Mais
  `suivi_actions` porte bien une colonne `theme` : la lecture peut donc rendre
  `{(theme, reco_key): verdict}` sans migration. Reste à vérifier que rien
  d'autre ne dépend de la forme actuelle — `build_recos` la lit aussi, pour la
  repondération du feedback `done`, et là le compte entier est peut-être le bon
  grain.
- **Faut-il indexer sur le CYCLE plutôt que sur la clé ?** Un verdict rendu il
  y a trois semaines sur une Stratégie qui a depuis été rouverte n'est pas le
  verdict du cycle en cours. `theme_plan.decided_at` donne la borne.

### Ce que ce ticket NE remet pas en cause

La décision du wayfinder 06 — `ATTENTE_MIN_NOUVELLE_HYPOTHESE` ne borne que le
cas où aucun verdict n'est arrivé — reste entière. C'est le CHOIX du verdict
qu'on corrige, pas le fait qu'il libère.

### Consigne de repli

Rendre la mesure : sur le compte de David, combien de clés `reco_key` portent
un verdict tout en étant l'hypothèse active de **plus d'un** thème. Zéro, et le
défaut est théorique ; un seul, et il est vécu. Le harnais
`.scratch/construction/harnais/27-une-theorie-par-theme/` grée déjà un compte
hors ligne : lui ajouter un second thème suffit à reproduire.
