"""Le Carnet, module unique posé partout — et ce qu'il n'a PAS le droit de faire.

CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS. Il lit du TEXTE TypeScript, il ne
l'exécute pas : aucun runner de test n'entre dans `saas/web`, c'est une décision
de David (ticket 16, § « Testing Decisions » de la spec). Un test de texte prouve
qu'un module est posé, qu'une règle est écrite et qu'un geste interdit n'existe
pas ; il ne prouve pas ce que la page rend. Ça, c'est `npx tsc --noEmit`,
`npm run build`, les 19 routes, et le fil parcouru à la main.
"""
import re

import pulse
from t import ok, egal, bilan

CARNET = pulse.SOURCE_CARNET.read_text(encoding="utf-8")
MODULE = pulse.SOURCE_MODULE.read_text(encoding="utf-8")
LIGNE = pulse.SOURCE_LIGNE.read_text(encoding="utf-8")
AJOUT = pulse.SOURCE_AJOUT.read_text(encoding="utf-8")
ACTIONS = pulse.SOURCE_ACTIONS.read_text(encoding="utf-8")


def code(src: str) -> str:
    """Le fichier SANS ses commentaires.

    Chercher un mot interdit dans le source entier ferait échouer les
    vérifications sur les pierres tombales — celles qui expliquent justement
    pourquoi la chose interdite n'est pas là. Le mot « verdict » DOIT vivre en
    commentaire dans ces fichiers ; ce qu'on interdit, c'est qu'il vive en
    code."""
    sans_bloc = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return "\n".join(l for l in sans_bloc.splitlines()
                     if not l.strip().startswith("//"))


CARNET_CODE, MODULE_CODE, LIGNE_CODE = code(CARNET), code(MODULE), code(LIGNE)

PAGES_AVEC_MODULE = ["meta", "google", "instagram", "labels", "couts"]


def test_le_module_est_pose_partout():
    """« Un module unique posé partout » — cinq pages, le même composant, et
    jamais une copie locale."""
    for nom in PAGES_AVEC_MODULE:
        src = pulse.page(nom)
        ok(f"/{nom} · monte le Carnet", "<Carnet" in src, nom)
        ok(f"/{nom} · l'importe du composant partagé",
           'from "@/components/carnet"' in src, nom)


def test_les_pages_payantes_lui_passent_leur_campagne_et_leur_regie():
    """Le contexte d'écriture : une note écrite depuis `/meta` hérite de la
    régie de la page et de la campagne cochée au bandeau."""
    for nom, canal in (("meta", "meta"), ("google", "google")):
        src = pulse.page(nom)
        ok(f"/{nom} · dit sa régie", f'canal="{canal}"' in src, nom)
        ok(f"/{nom} · passe la campagne du bandeau", "campKey={d.filters.camp}" in src, nom)
        ok(f"/{nom} · passe de quoi la nommer", "campagnes={d.campOptions}" in src, nom)
    # L'organique et les deux pages de thème n'ont pas de campagne : elles ne
    # doivent pas en inventer une.
    for nom in ("instagram", "labels", "couts"):
        ok(f"/{nom} · ne passe aucune campagne", "campKey=" not in pulse.page(nom), nom)


def test_l_accueil_prend_le_bilan_et_pas_le_module():
    """LE RAIL NE SE DÉFAIT PAS. Il porte déjà la chronologie complète avec
    l'effet chiffré, dans la carte de son thème — le relire en liste ferait deux
    lectures du même fil, ce que la fusion de `685a3e9` avait justement défait.
    L'accueil ne prend donc du Carnet que son BILAN."""
    accueil = pulse.page(".")
    ok("l'accueil monte le bilan", "<BilanDuCarnet />" in accueil)
    ok("l'accueil ne monte PAS le module", "<Carnet" not in accueil.replace("<BilanDuCarnet", ""))
    # Et le rail n'a pas bougé d'un pixel : les deux composants qui le montent
    # le montent toujours, et la porte d'écriture y est restée.
    for nom in ("theme-card", "hors-theme"):
        src = (pulse.WEB / "components" / f"{nom}.tsx").read_text(encoding="utf-8")
        ok(f"{nom} · monte toujours le rail", "<RailActions" in src, nom)
        ok(f"{nom} · garde sa porte d'écriture", "<NoteAjout" in src, nom)
    # L'ordre décidé : verdict → bilan du Carnet → à faire.
    ok("le bilan est posé AVANT le module « À faire »",
       accueil.index("<BilanDuCarnet />") < accueil.index('id="a-faire"'))


def test_le_module_ne_juge_jamais_une_note():
    """« Pulse marque, le client juge » — décision de David, renversant la
    recommandation de la session : juger la note obligerait Pulse à choisir le
    chiffre à sa place, donc à inventer une intention."""
    rendu = MODULE_CODE.split("export async function Carnet(")[1]
    for interdit in ("verdict", "better", "worse", "delta", "%"):
        ok(f"le module n'affiche aucun « {interdit} » sur une note",
           interdit not in rendu, interdit)
    for interdit in ("verdict", "better", "worse", "baseline", "delta"):
        ok(f"la ligne d'une note ne connaît pas « {interdit} »",
           interdit not in LIGNE_CODE, interdit)
    ok("la règle est écrite dans la ligne", "Pulse marque, le client juge" in LIGNE)


def test_aucune_marque_n_est_rallumee_sur_une_courbe():
    """Le piège d'août : les marques ont existé et David les a fait retirer le
    24 août 2026. Si ce chantier en rallume, c'est en VARIANTES comparables, pas
    en décision d'agent — donc pas ici."""
    for fichier, nom in ((MODULE, "carnet.tsx"), (CARNET, "carnet.ts"), (LIGNE, "carnet-ligne.tsx")):
        for interdit in ("LineChart", "marqueurs", "markers", "MetricChart"):
            ok(f"{nom} ne touche pas « {interdit} »", interdit not in fichier, f"{nom} {interdit}")
    ok("la raison est écrite dans le module", "24 août 2026" in MODULE)


def test_le_module_dit_ce_qu_il_ne_montre_pas():
    """Une absence à l'écran n'est pas une absence en base (`CLAUDE.md` §7)."""
    ok("il compte ce que le filtre écarte", "horsContexte" in MODULE and "horsContexte > 0" in MODULE)
    ok("le comptage total est un `head`, pas une liste tronquée",
       'count: "exact", head: true' in CARNET)
    ok("la raison du `head` est écrite", "1 000 lignes" in CARNET)
    ok("il dit quand la migration n'est pas jouée",
       "!carnet.migrationOk" in MODULE and "suivi_actions_auteur_campagne.sql" in MODULE)
    ok("le bilan dit sa fenêtre ET son périmètre",
       "sur tout le compte" in MODULE and "{b.jours} jours" in MODULE)


def test_le_bilan_compte_il_ne_mesure_pas():
    ok("il lit `verdict`, déjà persisté", '.not("verdict", "is", null)' in CARNET)
    ok("il compte sur `check_at`", '.gte("check_at", depuis)' in CARNET)
    ok("la raison du `check_at` est écrite",
       "la seule date qui dit quand le verdict" in CARNET)
    ok("rien n'est jugé absent = zéro",
       "une absence de bilan est\n *  une absence, pas un zéro" in CARNET)
    # Aucun calcul de taux : on compte des lignes, on n'en dérive rien. Un
    # pourcentage sur quatre actions serait un chiffre juste qui ment.
    for interdit in ("/ juges", "* 100", "Math.round", "toFixed"):
        ok(f"aucun taux fabriqué (« {interdit} »)", interdit not in CARNET_CODE, interdit)


def test_l_auteur_ne_s_invente_pas():
    ok("l'auteur ne s'affiche que sur un compte partagé", "carnet.partage &&" in MODULE)
    ok("un auteur inconnu se dit", '"un membre"' in MODULE)
    ok("la limite de lecture des membres est écrite", "dm_select" in CARNET)
    ok("le nom de la personne connectée est certain", '"toi"' in CARNET)


def test_l_ecriture_pose_l_auteur_et_la_paire_de_campagne():
    ok("`author_id` prend `compte.moi`, pas `compte.uid`", "author_id: compte.moi," in ACTIONS)
    ok("la raison est écrite", "où la PERSONNE compte et non le COMPTE" in ACTIONS)
    ok("la campagne est une paire",
       "campaign_channel: n.campagne?.canal ?? null," in ACTIONS
       and "campaign_key: n.campagne?.cle ?? null," in ACTIONS)
    ok("la porte d'écriture passe la campagne",
       "saveNote(texte, theme, jour || undefined, campagne)" in AJOUT)
    ok("elle écrit à l'écran ce que la note va hériter", "Rattachée à :" in AJOUT)


def test_le_repli_de_migration_ne_perd_pas_une_campagne_en_silence():
    """Écrire la note sans sa campagne après avoir affiché « rattachée à :
    campagne X » tiendrait une promesse à moitié sans le dire."""
    ok("le repli refuse quand une campagne est désignée",
       "if (n.campagne)" in ACTIONS and "ne sait pas encore la porter" in ACTIONS)
    ok("il accepte sans auteur", "sansColonnesNeuves" in ACTIONS)
    ok("la raison est écrite", "une note sans auteur est une note ancienne" in ACTIONS)


def test_une_note_ne_se_touche_que_par_son_auteur():
    ok("un filtre d'auteur existe", "function filtreAuteur" in ACTIONS)
    ok("le Propriétaire est l'exception", "compte.uid === compte.moi) return requete" in ACTIONS)
    ok("une note sans auteur reste à tout le monde",
       "author_id.is.null" in ACTIONS)
    ok("la règle est écrite comme APPLICATIVE, pas RLS",
       "CETTE RÈGLE EST APPLICATIVE, PAS RLS" in ACTIONS)
    for geste in ("updateNote", "deleteNote"):
        bloc = ACTIONS.split(f"export async function {geste}(")[1].split("\nexport ")[0]
        ok(f"{geste} · filtre sur l'auteur", "filtreAuteur(" in bloc, geste)
        # `.select("id")` seul n'est pas décoratif : sans lui un refus RLS
        # répondrait « enregistré » sans avoir rien écrit (`CLAUDE.md` §8).
        ok(f"{geste} · lit les lignes touchées", '.select("id")' in bloc, geste)
        ok(f"{geste} · refuse sur zéro ligne", "length === 0" in bloc, geste)
        ok(f"{geste} · relit avant de dire pourquoi", "pourquoiRien(" in bloc, geste)
        ok(f"{geste} · rafraîchit toutes les pages", 'revalidatePath("/", "layout")' in bloc, geste)


def test_le_message_de_refus_ne_nomme_personne():
    """ADR 0004 : un statut n'a pas d'auteur, on nomme l'état, jamais quelqu'un.
    Ici l'auteur EXISTE, mais on ne le nomme pas non plus à quelqu'un qui n'a
    peut-être pas le droit de le lire (`dm_select`)."""
    bloc = ACTIONS.split("async function pourquoiRien(")[1].split("\n/**")[0]
    ok("le message dit l'état", "écrite par quelqu'un d'autre" in bloc)
    for interdit in ("email", "member_email", "auteur.nom", "author_id}"):
        ok(f"il ne nomme personne (« {interdit} »)", interdit not in bloc, interdit)


def test_les_modules_partages_n_ont_pas_de_directive_client():
    """Une constante exportée depuis un module `"use client"` devient une
    référence client côté serveur : la valeur lue est un proxy, rien ne lève, TS
    passe (`CLAUDE.md` §8). `lib/carnet.ts` est lu par des pages serveur."""
    ok("`lib/carnet.ts` n'a pas de directive", '"use client"' not in CARNET_CODE)
    ok("le module non plus", '"use client"' not in MODULE_CODE)
    ok("la raison est écrite", "CE FICHIER N'A PAS DE DIRECTIVE" in CARNET)
    # Les deux qui en ont besoin l'ont : elles portent de l'état.
    ok("la ligne éditable est cliente", LIGNE.startswith('"use client"'))
    ok("la porte d'écriture est cliente", AJOUT.startswith('"use client"'))


def test_aucune_semaine_passee_ne_se_rouvre():
    """« La mémoire est le fil continu, pas l'archive rejouée » — décision §2 de
    08. Un rapport archivé porte des chiffres FIGÉS qui contrediraient le rail
    sur les mêmes jours : deux vérités à l'écran. Que `weekly_reports` soit lu
    `.limit(1)` est donc VOULU, pas un défaut à réparer — et ce test existe pour
    qu'une prochaine session ne le « corrige » pas."""
    report = pulse.SOURCE_REPORT_TS.read_text(encoding="utf-8")
    ok("un seul rapport est lu", '.from("weekly_reports")' in report and ".limit(1)" in report)
    ok("le Carnet ne lit aucun rapport", "weekly_reports" not in CARNET)
    ok("le module non plus", "weekly_reports" not in MODULE)


def test_une_note_pas_encore_cochee_n_entre_pas_au_carnet():
    """Une note `running` est ce qu'on COMPTE faire : elle vit au module
    « À faire » et ne se date qu'au moment où on la coche."""
    ok("la lecture exclut les `running`", '.neq("status", "running")' in CARNET)
    ok("la raison est écrite", "elle vit au module" in CARNET)
    # Trois lectures de notes, trois exclusions : la liste filtrée, le total du
    # carnet (qui sert à dire ce que le filtre écarte) et le repli sans les
    # colonnes neuves. Une seule qui oublierait ferait dire « 3 autres notes »
    # là où il n'y en a qu'une de vraie.
    egal("et elle l'exclut partout où elle lit des notes",
         CARNET_CODE.count('.neq("status", "running")'), 3)


if __name__ == "__main__":
    test_le_module_est_pose_partout()
    test_les_pages_payantes_lui_passent_leur_campagne_et_leur_regie()
    test_l_accueil_prend_le_bilan_et_pas_le_module()
    test_le_module_ne_juge_jamais_une_note()
    test_aucune_marque_n_est_rallumee_sur_une_courbe()
    test_le_module_dit_ce_qu_il_ne_montre_pas()
    test_le_bilan_compte_il_ne_mesure_pas()
    test_l_auteur_ne_s_invente_pas()
    test_l_ecriture_pose_l_auteur_et_la_paire_de_campagne()
    test_le_repli_de_migration_ne_perd_pas_une_campagne_en_silence()
    test_une_note_ne_se_touche_que_par_son_auteur()
    test_le_message_de_refus_ne_nomme_personne()
    test_les_modules_partages_n_ont_pas_de_directive_client()
    test_aucune_semaine_passee_ne_se_rouvre()
    test_une_note_pas_encore_cochee_n_entre_pas_au_carnet()
    raise SystemExit(0 if bilan("le carnet, posé partout") else 1)
