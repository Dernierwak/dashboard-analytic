# 11: Reprise de l'historique et contrôle bout à bout

**Status:** ready-for-agent

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10

**What to build:** la page Google a du passé et ses chiffres se retrouvent dans
Google Ads. L'historique par jour est repris par la récolte complète (37 mois au
plus) ; un contrôle de bout en bout, après un passage réel du worker, confirme
chaque module dans Chrome.

Spec : § La récolte (reprise), § Testing Decisions (ce qui ne se teste qu'en
vrai).

- [ ] Reprise lancée par la récolte complète (départ forcé) depuis l'onglet GitHub Actions — commande et paramètres écrits dans le ticket ; `change_event` garde ses 30 jours.
- [ ] Totaux d'octobre 2026 du compte A face à Google Ads (repère du ticket 10 de la carte : 182 679 impressions, 15 688 clics, 8 703,37 CHF, 303,69 conversions) ; tout écart est expliqué ou devient un ticket.
- [ ] Chrome : les trois vues, une campagne choisie, la Comparaison (Tous / Search / PMax), le Tableau déplié sur un Search et un PMax, point → panneau du jour, « Lire » → une annonce Search, les deux modes des Groupes de termes, un lien partagé qui rouvre le même état.
- [ ] Aucune page de contrôle temporaire restante, aucune référence à son échafaudage ; 18 routes.
- [ ] La carte (`../map.md`) et la spec notent ce qui a été construit ; les suites relevées en chemin vont au `BACKLOG.md` ou en ticket.
