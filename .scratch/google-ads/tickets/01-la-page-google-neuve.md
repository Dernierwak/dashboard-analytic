# 01: La page Google neuve : Bandeau, Sélecteur, Tendance

**Status:** ready-for-agent

**Blocked by:** None (can start immediately)

**What to build:** le client ouvre `/google` et retrouve le haut de sa page
Meta avec les chiffres de Google : le Bandeau de commandes (campagne, période,
« Chiffres Google au <Jour de travail>, 07:00 », pilule au défilement), le
Sélecteur de vue Notoriété / Trafic / Conversion et la Tendance (total jour par
jour, période d'avant en pointillé). L'ancienne page Streamlit disparaît. Tout
se lit sur les colonnes déjà en base ; la vue Conversion montre conversions,
coût par conversion et taux de conversion — valeur et ROAS viennent au 03.

Spec : § Solution, § La structure, § Les vues et leurs métriques, § La
fraîcheur, § L'état de la page vit dans l'URL, § La lecture des données côté
web. Construire en partant des modules Meta construits et de leur grammaire,
pas des maquettes.

- [ ] La couche de lecture Google existe en fonctions pures, sans directive ni import, et son harnais passe sous Node : taux total ÷ total, diviseur nul → « — », aucun « +∞ % », jour en cours exclu, jour sans ligne = trou, plus de 1 000 lignes lues entières, campagne renommée = une ligne (identité par ID).
- [ ] Notoriété = impressions, CPM ; Trafic = clics (`metrics.clicks`), CTR, CPC ; Conversion = conversions, coût par conversion, taux (conversions ÷ clics, dénominateur écrit). Le mot « moyenne » n'apparaît pas.
- [ ] Une « ⓘ » sur impressions et clics dit que ces totaux mêlent des types de campagnes.
- [ ] Choisir une campagne resserre Sélecteur et Tendance ; la période est comparée à la période d'avant de même durée.
- [ ] Vue, campagne et période vivent dans l'URL ; un lien n'énumère que ce qu'il change.
- [ ] Les composants de l'ancienne page qui ne servent plus à rien sont retirés (aucune référence restante).
- [ ] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build` verts, **18 routes**.
- [ ] Vérifié dans Chrome sur un compte réel : les trois vues, une campagne choisie, la pilule.
