# CLAUDE.md — saas/config/

`secrets.py` est l'unique lecteur de credentials du worker Python. Il résout
d'abord les variables d'environnement, puis le fichier `.env` à la racine du
dépôt. Ne recopier aucune valeur de secret ailleurs.
