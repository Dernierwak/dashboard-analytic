"""Les blocs neufs du payload hebdo, un fichier par clé (`.scratch/hebdo/spec.md`).

`assemble.blocs_neufs` les appelle et `build_payload` fusionne le résultat :
les tickets du chantier écrivent leur bloc ici sans toucher au monolithe, qui
ne garde que les anciennes clés jusqu'à leur départ (ticket 10).
"""
