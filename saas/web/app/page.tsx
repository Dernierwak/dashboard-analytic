// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports, publié en headless par
// saas/traitement/build_report.py (fetch cron) : même contenu partout.

import Link from "next/link";
import {
  getWeeklyData,
  feedbackKey,
  type ReportPayload,
} from "@/lib/report";
import { getChangementsApi } from "@/lib/changements-api";
import { getCouverture } from "@/lib/couverture";
import { chantiersEnCours, composerAFaire, estNoteOuverte, etatAFaire } from "@/lib/a-faire";
import { AFaire } from "@/components/a-faire";
import { RailActions } from "@/components/rail-actions";
import { TroisDates } from "@/components/trois-dates";
import { BilanDuCarnet } from "@/components/carnet";
import { AjoutAFaire } from "@/components/a-faire-lignes";
import { getThemeEvenements } from "@/lib/channels";
import { AlerteThemes } from "@/components/alerte-themes";
import { SetupWizard } from "@/components/setup-wizard";
import { ThemeCard, ecartTheme, penteNeutre } from "@/components/theme-card";
import { ancreTheme } from "@/lib/liens";
import { ThemesCarrousel } from "@/components/themes-carrousel";
import { KpiFocusCard } from "@/components/kpi-focus";
import { HorsTheme } from "@/components/hors-theme";
import { ThemeDonut } from "@/components/theme-donut";
import { FriseSemaine } from "@/components/frise-semaine";
import { RecoCard } from "@/components/reco-card";
import { PourAllerPlusLoin } from "@/components/pour-aller-plus-loin";
import { Triangle } from "@/components/pente";


export const dynamic = "force-dynamic";

// Le titre d'une section numérotée. Le second niveau (`tone="discret"`) a été
// retiré : son seul porteur était le bloc « hors de tes thèmes », qui est
// devenu un module à part entière avec son propre surtitre. Un habillage sans
// utilisateur n'est pas un niveau de hiérarchie, c'est du code mort.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-3.5 flex items-center gap-2.5">
      <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
      {children}
    </h2>
  );
}

// Le résumé de la semaine — sans carte : au milieu de blocs encadrés, un bloc
// nu attire l'œil plus fort qu'un cadre de plus.
//
// IL EST DESCENDU, ET IL EST REPLIÉ. Il vivait collé sous le verdict, en prose
// nue, et mangeait tout l'écran restant. C'est le dernier rang de l'ordre
// décidé par la refonte (`10-l-entree-premier-ecran.md` point 6), et la raison
// n'est pas graphique : **la prose IA est ce qu'il y a de moins vérifiable sur
// la page, et elle occupait les pixels les plus chers** — ceux où le lecteur
// cherche « ma semaine a été bonne ? » puis « qu'est-ce que je fais ». Contre
// la trame du lundi matin, le « pourquoi » ne se lit que si le verdict a
// inquiété : il descend d'un cran et s'ouvre à la demande.
//
// LE REPLI EST UN `<details>`, FERMÉ. Pas d'état React, pas de JavaScript : le
// texte est dans le document, donc lisible même si rien ne charge, et le geste
// est celui que le navigateur connaît déjà.
//
// Sa première phrase n'est plus mise en avant. Elle l'était, et elle disait la
// même chose que le verdict juste au-dessus — le worker demande à l'IA « une
// phrase de synthèse » alors que le verdict EST déjà une phrase de synthèse,
// calculée de façon déterministe. Deux affirmations identiques et de poids
// proche, collées l'une à l'autre : le doublon retiré de la section 2 vivait
// encore ici. Le résumé garde tout son texte, il cesse seulement de se
// disputer le niveau 1.
function ResumeSemaine({ brief }: { brief: string }) {
  return (
    <details className="group mb-9">
      <summary className="cursor-pointer select-none text-[12.5px] font-semibold text-brand hover:underline">
        <span className="group-open:hidden">Lire le résumé de la semaine ▾</span>
        <span className="hidden group-open:inline">Replier le résumé ▴</span>
      </summary>
      <div className="mt-3 max-w-[68ch]">
        <p className="text-[14px] sm:text-[15px] leading-relaxed text-muted whitespace-pre-line">
          {brief}
        </p>
        <p className="text-[10.5px] text-faint mt-2.5">
          Résumé écrit par l&apos;IA à partir de tous tes posts et campagnes de la semaine.
        </p>
      </div>
    </details>
  );
}

// Le verdict, en chiffre. Une page dont le niveau 1 est une phrase de 26 px
// alors qu'un module affiche 46 px plus bas n'a pas la hiérarchie qu'elle
// croit avoir : c'est la typographie qui classe, pas l'intention. L'écart
// passe donc en très grand, et la phrase entière reste juste dessous.
// Sans les nouvelles clés (rapports publiés avant), on retombe sur la phrase.
function Verdict({ report }: { report: ReportPayload }) {
  const pct = report.verdict_pct;
  const ton = report.verdict_tone ?? "stable";
  if (pct === null || pct === undefined || !report.verdict_metric) {
    return (
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
        {report.verdict}
      </h1>
    );
  }
  const cls = ton === "pos" ? "text-pos" : ton === "neg" ? "text-neg" : "text-muted";
  const plat = Math.abs(pct) <= 0.5;
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`font-mono text-[52px] sm:text-[68px] leading-[0.9] font-medium ${cls}`}>
          {plat ? "≈" : <Triangle sens={pct > 0 ? "haut" : "bas"} />} {pct > 0 ? "+" : ""}
          {pct.toFixed(0)}
          <span className="text-[26px] sm:text-[32px]"> %</span>
        </span>
        <span className="font-serif text-[17px] sm:text-[19px] text-muted leading-tight">
          {report.verdict_metric}
        </span>
      </div>
      <h1 className="font-serif text-[17px] sm:text-[19px] leading-snug text-ink text-balance mt-2 max-w-[60ch]">
        {report.verdict}
      </h1>
    </div>
  );
}

// LE RACCOURCI DU HERO A ÉTÉ RETIRÉ — « ▸ 2 actions en cours · 1 à juger —
// y aller ↓ ». Il pointait vers la carte du thème de la plus urgente, et le
// module « À faire » est maintenant posé juste en dessous du verdict : un
// renvoi vers ce qui tient dans le même écran ne fait plus gagner un scroll, il
// ajoute un quatrième endroit où le même chiffre se lit. Or c'est très
// exactement ce que ce module existe pour empêcher — et le raccourci comptait
// déjà FAUX au regard de la frontière décidée : il annonçait « à juger » ce qui
// était en observation (`status === "done" && !a.due`), et il comptait comme
// t'attendant les actions en cours, qui n'attendent rien de toi. Le comptage
// vit désormais dans `lib/a-faire.ts`, à un seul endroit.

// LE FILET — « Hors de tes thèmes » — a quitté cette page pour
// `components/hors-theme.tsx`. Il y était écrit en dur, donc invisible à tout
// écran de contrôle : la page entière est derrière `middleware.ts` et lit un
// vrai compte, on ne pouvait ni lui donner vingt-cinq lignes ni zéro pour voir
// ce que ça fait. C'est la règle du projet depuis `components/couts-modules.tsx`
// — une page compose, elle ne dessine pas.

export default async function Page() {
  // CE QUE LES PLATEFORMES DÉCLARENT ELLES-MÊMES. Nos cinq faits déduits de la
  // dépense sont aveugles à tout ce qui ne fait pas bouger le budget du jour —
  // un mot-clé en pause, un CPC cible relevé, une audience élargie. Quatre-vingt
  // -dix jours parce que Google Ads ne garde `change_event` que trente jours et
  // Meta un peu plus : demander plus large ne coûte rien, la couche de données
  // rend ce qu'elle a.
  const depuisChg = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  // QUATRE LECTURES QUI NE S'ATTENDENT PAS.
  //
  // Elles étaient en série — le rapport, puis les changements déclarés — et la
  // couverture des thèmes en aurait fait une troisième à la queue leu leu.
  // Aucune des quatre n'a besoin du résultat des autres, donc les enchaîner
  // revient à additionner des allers-retours Supabase sur la page la plus lue
  // du produit. La couverture est la plus chère des quatre (elle lit l'univers
  // complet des campagnes) : c'est justement celle qu'il ne faut pas mettre au
  // bout d'une file.
  //
  // `evenements` (`getThemeEvenements`) — AJOUTÉE ici, PAS relue depuis
  // `/conversions` : le mini-module objectif + conversions de chaque
  // `ThemeCard` (`theme-objectif-mini.tsx`, ci-dessous) a besoin de savoir
  // quels événements GA4 chaque thème suit comme conversions, en LECTURE
  // SEULE — la même fonction que `/conversions` utilise pour sa propre
  // édition, elle reste la seule source de vérité de `theme_ga4_events`.
  const [data, changementsApi, couverture, evenements] = await Promise.all([
    getWeeklyData(),
    getChangementsApi(depuisChg),
    getCouverture(),
    getThemeEvenements(),
  ]);
  const report = data.report;
  // LA FENÊTRE DU BILAN DES CARTES, EN DATES — celle que la porte vers la
  // plateforme emporte. C'est la période de la matrice, d'où sortent tous les
  // chiffres de `summary` ; `vision.period_label` n'en est que la version
  // française (« depuis le 1 jan »). Les deux bornes ou rien : une porte qui
  // n'emporte qu'une moitié de fenêtre ouvre sur une autre période que celle
  // affichée, et l'écart au clic se lit comme un bug (ticket 14).
  const periode = report?.matrice?.period ?? null;
  const fenetreBilan =
    periode?.since && periode?.until ? { from: periode.since, to: periode.until } : null;
  const conversionsParTheme = new Map(evenements.themes.map((t) => [t.label, t.principaux]));

  // Thèmes prioritaires — le fil qui relie la vision aux conseils. Plus de
  // plafond depuis le 14 août 2026 ; seules les trois premières étoiles ont des
  // conseils, et l'ordre est celui de l'étoilage.
  const priorities = Object.keys(data.insightFeedback)
    .filter((k) => k.startsWith("priority_label:"))
    .map((k) => k.split(":").slice(1).join(":"));

  const themesFocus = report?.themes_focus ?? [];
  const reglages = report?.reglages ?? [];
  // LE PLAFOND DE TROIS CHANTIERS EST MORT ICI, et il n'était écrit dans aucun
  // ticket. Il bloquait « ▶ Je le teste » dès trois actions non faites : avec
  // CINQ conseils par semaine (`saas/recos_ia/composition.py`), la liste ne
  // pouvait structurellement pas se vider par « fait » — deux conseils sur cinq
  // n'avaient d'autre sortie que le refus, c'est-à-dire exactement le raccourci
  // que le module « À faire » redoutait. Ce qui borne la charge, désormais,
  // c'est la COMPOSITION des cinq (jamais plus de deux gestes à effort ≥ 1 h),
  // et elle regarde ce que les lignes pèsent au lieu de les compter. Décidé par
  // `.scratch/refonte/issues/20-a-faire-cette-semaine.md`.

  // TOUS les thèmes ont désormais une carte, qu'ils aient une courbe ou non :
  // c'est la carte qui décide de montrer sa courbe. Deux cartes pour le même
  // thème — une pour le bilan, une pour les conseils — obligeaient le lecteur
  // à faire lui-même le lien entre « voilà la courbe » et « voilà quoi faire ».
  //
  // ── SOUS CE TITRE, IL N'Y A QUE CE QUE LE CLIENT A ÉTOILÉ ────────────────
  //
  // Deux étoiles posées, trois cartes à l'écran. La cause était dans le worker :
  // une campagne lancée depuis moins de quatorze jours ajoutait SON thème à
  // `theme_list`, même non étoilé (bloc `_neuf_ajoute`, `build_report.py`). Le
  // signal était réel, sa place ne l'était pas — il s'affichait sous un titre
  // qui affirme une priorité que le client n'a pas choisie. Corrigé à la source ;
  // le fait, lui, continue d'arriver par `report.changements` et tombe dans le
  // filet « Ce qu'aucun thème ne prend » (`chgOrphelins`, plus bas), par
  // construction, puisque ce filet est le complément exact des cartes.
  //
  // MAIS UN RAPPORT NE SE RÉÉCRIT QU'AU JOUR DE TRAVAIL : le payload déjà
  // publié porte le thème surnuméraire jusqu'à la prochaine publication.
  // On rattrape donc à l'affichage, avec la même règle — le procédé exact des
  // « est programmée » de `rail-actions.tsx`, et il se retire le jour où plus
  // aucun payload ancien ne circule.
  //
  // C'EST LA LISTE VIVANTE DES ÉTOILES QUI FAIT FOI, pas le `is_priority` figé
  // dans le payload : `priorities`, ci-dessus, est relu dans `insight_feedback`
  // à chaque rendu, et c'est CETTE liste qui décide des cartes affichées. Ce
  // choix couvre du même coup l'autre cas possible : un thème étoilé le jour de
  // la publication et désétoilé depuis.
  //
  // ET IL NE VIDE JAMAIS LA SECTION. Aucune étoile → le worker retient les trois
  // plus gros thèmes, c'est un défaut assumé et on les garde tous. Des étoiles
  // qui ne désignent aucune carte (thème renommé, rapport plus vieux que
  // l'étoilage) → on ne cache rien plutôt que de rendre une section vide.
  const etoiles = new Set(priorities);
  const etoilees = themesFocus.filter((t) => etoiles.has(t.label));
  const cartes = etoiles.size > 0 && etoilees.length > 0 ? etoilees : themesFocus;
  const gardeAJoue = cartes.length < themesFocus.length;
  const themesRendus = new Set(cartes.map((t) => t.label));

  const avecCourbe = cartes.filter((t) => t.series && t.series.points.length > 1);
  // Le classement entre thèmes n'a de sens que s'ils suivent LE MÊME
  // indicateur : comparer une portée à une dépense ne veut rien dire.
  const memeMetrique =
    avecCourbe.length > 1 &&
    avecCourbe.every((t) => t.series!.metric_label === avecCourbe[0].series!.metric_label);
  // Le classement entre tes thèmes. Pas de verdict absolu possible — il n'y a
  // pas de seuil de référence par thème — mais une comparaison qui reste À
  // L'INTÉRIEUR du même compte est légitime, et elle répond à la seule question
  // que cette section doit servir : où je mets mes dix minutes cette semaine.
  // …sauf quand l'indicateur commun est la DÉPENSE : un thème dont la dépense
  // baisse n'est pas un thème qui décroche, c'est un thème qu'on a coupé.
  const pentes = memeMetrique && !penteNeutre(avecCourbe[0].series!.metric_label)
    ? avecCourbe.map((t) => ({
        label: t.label,
        ecart: ecartTheme(t.series!.points.map((p) => p.value)),
      }))
    : [];
  const pire = pentes
    .filter((x): x is { label: string; ecart: number } => x.ecart !== null && x.ecart < -8)
    .sort((a, b) => a.ecart - b.ecart)[0];

  // LES ACTIONS QUI N'ONT PLUS DE MAISON.
  //
  // Le complément EXACT du filtre des cartes (`a.theme === theme.label`), donc
  // ni doublon ni trou par construction. Trois causes, toutes réelles : un
  // conseil pris depuis « Réglages de base » n'a pas de thème du tout ; un
  // thème peut sortir des trois prioritaires ; un thème renommé laisse ses
  // actions derrière lui.
  //
  // Sans ce filet, ces actions seraient invisibles ET inatteignables : plus un
  // seul endroit pour les marquer faites ou les abandonner, donc des chantiers
  // ouverts à vie. (Elles saturaient en plus le plafond de trois chantiers, mort
  // avec le module « À faire ».)
  //
  // `themesRendus` est calculé plus haut, avec `cartes` : c'est le même
  // ensemble, et c'est ce qui garantit que retirer une carte DÉPLACE ce qui la
  // concernait ici au lieu de le perdre.
  //
  // Les changements de plateforme suivent EXACTEMENT la même répartition que
  // les actions : au thème quand il a une carte, au filet sinon. Une campagne
  // non étiquetée n'a pas de thème — elle atterrit donc dans le filet, et
  // c'est bien là qu'on veut la voir : c'est le signe qu'il faut la classer.
  const tousChangements = report?.changements ?? [];
  const chgParTheme = (label: string) => tousChangements.filter((c) => c.theme === label);
  const chgOrphelins = tousChangements.filter(
    (c) => !c.theme || !themesRendus.has(c.theme)
  );
  const apiParTheme = (label: string) => changementsApi.filter((c) => c.theme === label);
  const apiOrphelins = changementsApi.filter(
    (c) => !c.theme || !themesRendus.has(c.theme)
  );

  const orphelines = [...data.actions, ...data.actionsArchived]
    .filter((a) => !a.theme || !themesRendus.has(a.theme))
    // Une ligne qu'on s'est écrite sans thème attend une décision, pas
    // une maison : elle vit au module « À faire ». Sans ce filtre, le filet la
    // COMPTERAIT (`survenusOrphelins`, juste en dessous) sans pouvoir l'afficher
    // — le rail la retire de son côté — et le chiffre du module mentirait sur ce
    // qu'il montre.
    .filter((a) => !estNoteOuverte(a));
  // Ce qui s'est RÉELLEMENT passé hors thème, par opposition à ce qui attend.
  // Vingt lignes « est programmée — aucune dépense encore » remplissaient le
  // bloc et noyaient les trois faits qui comptaient : elles ne comptent donc
  // pas dans le chiffre du module, elles se replient sous lui.
  const progOrphelines = chgOrphelins.filter((c) => c.type === "planifiee");
  const survenusOrphelins =
    orphelines.length + (chgOrphelins.length - progOrphelines.length) + apiOrphelins.length;
  // Le filet s'affiche aussi quand il est VIDE et qu'aucun thème n'a de carte :
  // sans lui, un compte qui n'a rien classé n'a aucun endroit où écrire une
  // note — et une note sans thème ne pourrait jamais naître, faute d'un bloc
  // pour l'accueillir.
  const filetPlein =
    orphelines.length + chgOrphelins.length + apiOrphelins.length > 0 || cartes.length === 0;

  // CE QUI ATTEND UNE DÉCISION DE TOI. Le tri et le comptage sont dans
  // `lib/a-faire.ts` — la page ne fait que les lui demander, et elle a besoin
  // de l'état AVANT la numérotation : un module qui disparaît ne prend pas de
  // numéro.
  const aFaire = composerAFaire(report, data.actions, data.suivis, data.feedback);
  const etatAFaireModule = etatAFaire(aFaire, priorities.length === 0, data.decouvertes);
  // CE QUI COURT ET N'ATTEND RIEN DE TOI — l'autre moitié exacte des actions
  // vivantes, calculée par le même module pour que les deux ne divergent pas.
  const enCours = chantiersEnCours(data.actions);

  // L'HEURE DU RENDU, LUE UNE FOIS. La troisième des trois dates (« mis à jour
  // le ») se calcule à partir d'elle ; la figer ici garantit que toute la ligne
  // parle du même instant.
  const maintenant = new Date();

  // Numérotation dynamique : « Ce que tu dois faire » et « Historique »
  // disparaissent quand ils sont vides. Numéroter en dur faisait commencer la
  // page à 2, et un lecteur qui voit un 2 cherche le 1.
  let _n = 0;
  const nAFaire = etatAFaireModule.visible ? ++_n : undefined;
  const nSemaine = report?.kpi_focus || report?.themes ? ++_n : undefined;
  const nThemes = cartes.length > 0 ? ++_n : undefined;

  // ── L'ORDRE DES CARTES DE THÈME ──────────────────────────────────────────
  //
  // LE PLAFOND DE TROIS EST TOMBÉ le 14 août 2026, et il n'a jamais été écrit
  // ici : cette page rend TOUT ce que le worker a retenu, sans en couper un
  // seul, et c'était déjà vrai quand le plafond tenait. Ce qui a changé est en
  // amont — `togglePriorityLabel` AVERTIT au lieu de refuser la quatrième
  // étoile, et le worker construit la carte de tous les thèmes étoilés.
  //
  // MAIS SEULES LES TROIS PREMIÈRES ÉTOILES REÇOIVENT DES PISTES RÉDIGÉES PAR
  // L'IA (`_THEMES_IA`, `build_report.py`). La raison n'est pas graphique : un
  // thème coûte jusqu'à deux appels Gemini par rapport, et quinze thèmes
  // feraient trente appels par compte et par semaine. « Les trois premières »
  // se lit dans l'ORDRE D'ÉTOILAGE — le seul critère sur lequel le client peut
  // agir : sous le poids en dépense, la carte devrait conseiller « dépense plus
  // sur ce thème » pour mériter des pistes, ce qui est absurde et nous arrange.
  //
  // Une carte sans pistes IA porte `ia_redigee: false` et l'explique elle-même
  // (`theme-card.tsx`) : un vide non expliqué se lit comme une panne.
  //
  // L'ORDRE, ET IL PÈSE PLUS QU'AVANT. Les étoilés d'abord — ce sont eux qu'on
  // a désignés comme le travail du moment. Puis ceux qui portent une action en
  // cours : un thème sur lequel un verdict va tomber n'est pas un thème de fond
  // de liste. Le reste garde l'ordre du worker, qui les classe par poids (part
  // de dépense ou part de publications, la plus grande des deux). Depuis qu'une
  // seule carte est visible à la fois, ce classement ne décide plus seulement
  // de qui est en haut : il décide de la carte qu'on OUVRE en arrivant.
  //
  // LE PLI A DISPARU AVEC L'EMPILEMENT. Au-delà de trois cartes, les suivantes
  // arrivaient fermées (`OUVERTES`, `estReplie`, `replie` sur `ThemeCard`, et
  // le `▾` du sommaire) : c'était la parade à un couloir de six mille pixels.
  // Il n'y a plus de couloir — `ThemesCarrousel` n'en montre qu'une — et un
  // repli qui ne replie rien est un geste de plus à comprendre pour rien.
  const themesVivants = new Set(
    data.actions.map((a) => a.theme).filter((t): t is string => !!t)
  );
  const cartesOrdonnees = cartes
    .map((t, rangWorker) => ({ t, rangWorker }))
    .sort(
      (a, b) =>
        Number(b.t.is_priority) - Number(a.t.is_priority) ||
        Number(themesVivants.has(b.t.label)) - Number(themesVivants.has(a.t.label)) ||
        a.rangWorker - b.rangWorker
    )
    .map((x) => x.t);

  return (
    // PAS DE `max-w-*` SUR LE CONTENEUR — et c'est un changement, pas un
    // oubli. `<main>` vit déjà à côté de `<aside>` (la colonne latérale,
    // `app/layout.tsx`) : sa largeur RÉELLE n'est jamais celle de l'écran,
    // c'est déjà écran moins colonne. Un `max-w-7xl` fixe par-dessus ça
    // semblait donner de la marge, mais recréait le même défaut à une autre
    // taille d'écran — un plafond fixe est toujours trop bas pour un écran
    // encore plus large, et 7xl (1 280 px) ne changeait déjà plus rien sur un
    // portable de 1 280 px UNE FOIS LA COLONNE DÉCOMPTÉE (1 000 px de
    // contenu disponible, sous le plafond). Le principe, du coup, n'est plus
    // « choisir le bon plafond » mais ne PAS en poser : le conteneur prend
    // toute la largeur que la colonne laisse, à toute taille d'écran et à
    // toute largeur de colonne (la colonne est maintenant redimensionnable,
    // voir `components/side-nav.tsx`).
    // Ce qui NE bouge pas : les paragraphes de prose portent chacun leur
    // propre plafond en `ch` (`max-w-[68ch]`, `max-w-[60ch]`…) — un texte
    // long reste lisible indépendamment de la largeur du conteneur qui le
    // porte. Seuls les modules qui bénéficient réellement de l'espace
    // (tableaux, grilles de cartes, courbes) suivent la largeur complète.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      {/* LA MISE EN PLACE EST REMONTÉE EN TÊTE, et c'est un défaut mesuré par
          `.scratch/refonte/issues/06-le-parcours-comment-les-pages-se-parlent.md`
          qu'on répare ici : le fil de démarrage était rendu tout en bas de la
          page, sous deux écrans de défilement, alors qu'il porte les seules
          actions qui débloquent tout le reste. La décision est au point 2 de
          `10-l-entree-premier-ecran.md` : tant qu'une étape est ouverte, le fil
          est le PREMIER bloc et le rapport passe dessous ; dès que tout est
          franchi il s'efface et le verdict reprend la tête. Ce composant décide
          lui-même s'il a quelque chose à dire — il rend `null` quand il n'y a
          plus d'étape — donc le déplacer ne change rien pour un compte installé.
          Ce qu'on ne fait PAS ici : le passage aux quatre étapes avec la
          connexion en gate (même ticket, point 1). C'est la brique « mise en
          place », hors v1 : elle ne sert qu'à un client qui n'est pas encore
          là (`plan-de-refonte.md` §3). */}
      <SetupWizard
        onboarded={data.onboarded}
        couverture={couverture}
        themes={data.labels}
        priorities={priorities}
        jourDeTravail={data.jourDeTravail}
        maintenantIso={maintenant.toISOString()}
      />

      {/* Hero — le verdict EST le titre : « ma semaine a été bonne ? » est la
          première question du lecteur, elle doit trouver sa réponse avant le
          premier scroll. Une phrase d'accroche à la place ne dit rien. */}
      <div className="mb-7">
        {/* Ce qui est CALCULÉ entre en carte ; ce qui est RÉDIGÉ reste nu.
            La ligne de partage n'est pas esthétique, c'est une convention de
            lecture : l'écart, la métrique et la phrase de verdict sont produits
            par des règles déterministes, le résumé est écrit par une IA. Un
            cadre autour du second lui donnerait l'autorité du premier. */}
        <div className="rounded-2xl border border-line bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6">
          {/* LES TROIS DATES PRENNENT LA PLACE DU LIBELLÉ DE SEMAINE, elles ne
              s'ajoutent pas à lui : `week_label` dit déjà « Semaine 37 · 7 → 13
              septembre · 7 jours pleins », donc la fenêtre mesurée se serait
              lue deux fois à trente pixels d'écart. La ligne des trois dates
              dit la même fenêtre et deux choses de plus — quand ce texte a été
              publié, et quand il changera. Le libellé reste le repli des
              payloads publiés avant que `since`/`until` existent. */}
          <div className="mb-2">
            {report?.since && report?.until ? (
              <TroisDates
                since={report.since}
                until={report.until}
                publieLe={data.publieLe}
                jourDeTravail={data.jourDeTravail}
                maintenant={maintenant}
              />
            ) : (
              <p className="text-[11px] uppercase tracking-widest text-faint font-semibold">
                {report?.week_label ?? data.weekLabel}
              </p>
            )}
          </div>
          {report ? (
            <Verdict report={report} />
          ) : (
            <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
              Ta semaine en bref.
            </h1>
          )}
        </div>
        {/* LE RÉSUMÉ IA N'EST PLUS ICI — il est descendu au dernier rang du
            premier écran, replié. Voir `ResumeSemaine` ci-dessus.
            L'OBJECTIF N'EST PLUS ICI non plus. Il flottait sous le résumé, à
            600 px des cartes qu'il pondère : on le lisait comme un réglage de
            compte, pas comme la cause de ce qu'on allait voir. Il est descendu
            au-dessus de la première carte de thème (section 2). */}
      </div>

      {/* LE BILAN DU CARNET — deuxième marche de l'ordre décidé par la refonte :
          verdict → BILAN DU CARNET → à faire → rail des chantiers → résumé IA
          replié (`.scratch/refonte/issues/10-l-entree-premier-ecran.md`). C'est
          un COMPTAGE des verdicts déjà persistés, pas une mesure : le moteur qui
          remesurait ce bilan sur le compte entier est mort avec ce ticket, parce
          qu'il pouvait contredire le rail sur la même décision. Le module de
          Carnet complet, lui, ne monte PAS ici : le rail des cartes de thème
          porte déjà la chronologie avec l'effet chiffré, et la relire en liste
          ferait deux lectures du même fil. */}
      <BilanDuCarnet />

      {/* À FAIRE CETTE SEMAINE — POSÉ ICI, ET PAS PLUS HAUT NI PLUS BAS.
          L'ordre décidé par la refonte est : verdict → bilan du Carnet →
          À FAIRE → rail des chantiers → résumé IA replié
          (`.scratch/refonte/issues/10-l-entree-premier-ecran.md`). Les cinq
          marches sont en place : le bilan depuis le ticket 12, le rail et la
          descente du résumé depuis le 13. Le verdict répond à « ma
          semaine a été bonne ? » ; ouvrir le rapport sur ce qui reste à faire en
          aurait fait une corvée dès la première ligne, d'où sa place SOUS le
          hero et pas dedans. */}
      {etatAFaireModule.visible ? (
        <section id="a-faire" className="mb-9 scroll-mt-4">
          <SectionTitle>
            <span className="text-faint font-mono mr-1.5">{nAFaire}</span> À faire cette
            semaine
          </SectionTitle>
          <AFaire liste={aFaire} etat={etatAFaireModule} themesRendus={themesRendus} />
          <AjoutAFaire themes={data.labels} />
        </section>
      ) : (
        /* LE MODULE DISPARAÎT, LA PORTE RESTE. Un compte à jour — rien à
           décider, plus rien à faire découvrir — n'a pas de module ; mais la
           porte d'écriture vivait DEDANS, et une fois le module effacé plus rien
           n'aurait pu le faire revenir : on ne pouvait plus s'écrire une ligne,
           donc plus rien n'entrait, donc le module restait effacé. C'était un
           cul-de-sac, et cette carte n'en veut aucun. Ce qui disparaît, c'est le
           module — son titre, ses compteurs, son cadre ; pas le geste. */
        <div className="mb-9">
          <AjoutAFaire themes={data.labels} />
        </div>
      )}

      {/* LE RAIL DES CHANTIERS EN COURS — quatrième marche de l'ordre décidé
          par la refonte, et la règle qu'elle applique était tranchée depuis
          longtemps sans jamais avoir été appliquée ici : **une action décidée
          vit en haut jusqu'à être faite**. Avant lui, ce qu'on avait lancé
          n'existait nulle part sur la page qu'on ouvre — il fallait entrer
          dans la carte de son thème pour le revoir.

          C'EST LE MÊME RAIL, PAS UN DEUXIÈME OBJET. `RailActions` est le module
          des cartes de thème, servi ici sans thème courant (chaque ligne porte
          donc le sien) et SANS faits de plateforme : ceux-là racontent ce qui a
          bougé sur un thème, ils se lisent dans sa carte, et les remonter ici
          referait la chronologie entière en tête de page.

          CE QU'IL NE MONTRE PAS, ET POURQUOI : les Verdicts tombés et les
          lignes que tu t'es écrites. Le module « À faire » juste au-dessus les
          porte déjà — le rail montre le temps qui passe, le module ce qui
          attend une décision de toi (`lib/a-faire.ts`, `chantiersEnCours`, où
          la partition est calculée une seule fois pour que les deux moitiés ne
          puissent pas se contredire). */}
      {enCours.length > 0 && (
        <section className="mb-9">
          <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">
              En cours
            </p>
            <RailActions actions={enCours} maxH="max-h-[320px]" />
          </div>
        </section>
      )}

      {/* LE RÉSUMÉ DE LA SEMAINE, DERNIÈRE MARCHE DU PREMIER ÉCRAN ET REPLIÉ.
          Il était collé sous le verdict : la prose la moins vérifiable de la
          page occupait les pixels les plus chers. Il se lit maintenant après ce
          qui est calculé et après ce qu'il y a à faire — le « pourquoi » ne
          s'ouvre que si le verdict a inquiété. */}
      {report?.brief && <ResumeSemaine brief={report.brief} />}

      {/* 1 · LA SEMAINE, TOUS THÈMES CONFONDUS — la vue d'ensemble : un seul
             indicateur en grand, et où part l'argent. Rien de filtré ici. */}
      {(report?.kpi_focus || (report?.themes && report.themes.rows.length > 0) || filetPlein) && (
        <section className="mb-9">
          <SectionTitle>
            <span className="text-faint font-mono mr-1.5">{nSemaine}</span> Ta semaine, tous
            thèmes confondus
          </SectionTitle>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            La vue d&apos;ensemble du compte : tout ce que tu publies et achètes, sans
            filtre. Choisis l&apos;indicateur que tu veux suivre.
          </p>
          {/* LA BOUSSOLE ET LE FILET SUR UNE MÊME LIGNE.
              Le bloc « hors de tes thèmes » était une bande pleine largeur en
              bas de page : on y arrivait après tout le reste, alors qu'il
              contient les seules actions qu'aucune carte de thème ne prend.
              Il passe à GAUCHE de la boussole — même section, même fenêtre, même
              périmètre (tout le compte, rien de filtré), et surtout : la courbe
              qui bouge et l'explication de pourquoi elle bouge dans le même
              écran.
              La boussole garde deux tiers, parce que sa courbe est l'intérêt du
              module et qu'un tiers l'écraserait. Sur téléphone la boussole passe
              en premier — c'est elle qu'on vient lire.

              LES DEUX CARTES FONT LA MÊME HAUTEUR. La grille était en
              `items-start` : chacune finissait où elle voulait et un vide de
              200 px s'ouvrait sous la plus courte. `items-stretch` étire les
              deux cellules sur la hauteur de la rangée, et c'est la BOUSSOLE
              qui la fixe — la cellule du filet porte `lg:relative` pour que sa
              carte s'y pose en `absolute` et cesse de peser dans le calcul.
              Sans quoi vingt-cinq lignes hors thème tireraient la rangée à
              2 000 px et la boussole flotterait dans le vide : l'inverse exact
              de ce qu'on corrige. Le détail est écrit dans `hors-theme.tsx`,
              qui en dépend ; ici on ne pose que la cellule.
              Sans boussole, le filet reste seul et pleine largeur — donc en
              flux normal, avec sa hauteur à lui (`rangee={false}`). */}
          <div className="grid gap-3 lg:grid-cols-3 items-stretch">
            {report?.kpi_focus && (
              <div className="lg:col-span-2 lg:order-2 min-w-0">
                <KpiFocusCard k={report.kpi_focus} />
              </div>
            )}
            {filetPlein && (
              <div
                className={`lg:order-1 min-w-0 ${
                  report?.kpi_focus ? "lg:relative" : "lg:col-span-3"
                }`}
              >
                <HorsTheme
                  actions={orphelines}
                  changements={chgOrphelins}
                  changementsApi={apiOrphelins}
                  survenus={survenusOrphelins}
                  programmees={progOrphelines.length}
                  rangee={!!report?.kpi_focus}
                />
              </div>
            )}
          </div>
          {report?.themes && report.themes.rows.length > 0 && (
            <div className="mt-3">
              <ThemeDonut rows={report.themes.rows} orphan={report.themes.orphan} univers={data.labels} />
            </div>
          )}
          {/* Le temps, sous les chiffres : ce qui était en l'air pour les
              obtenir. Les couleurs sont celles de l'anneau juste au-dessus. */}
          {report?.frise && (
            <div className="mt-3">
              <FriseSemaine f={report.frise} univers={data.labels} />
            </div>
          )}
        </section>
      )}

      {/* « IL TE MANQUE DES THÈMES » — POSÉ EXACTEMENT ICI, ET PAS AILLEURS.
          C'est la charnière entre la section 1 et la section 2, et c'est le
          seul endroit de la page où l'alerte change une lecture au lieu de
          l'interrompre.

          En amont, la section 1 dit « tous thèmes confondus » : rien de filtré,
          donc rien qui manque — l'argent non étiqueté EST dans ces chiffres-là,
          l'alerte n'y aurait rien à corriger. Elle y aurait même nui : la
          section 1 porte déjà `HorsTheme`, dont le surtitre dit « Hors de tes
          thèmes ». Deux modules voisins avec le même mot pour deux objets
          différents — celui-ci compte des FRANCS non rattachés, l'autre des
          FAITS que personne ne prend — et on ne saurait plus lequel répond à
          quoi.

          En aval commence la section 2, où tous les chiffres sont filtrés PAR
          THÈME. C'est là, et seulement là, que ce qui n'a pas de thème devient
          un trou : les bilans, les courbes et les conseils qui suivent portent
          sur la part étiquetée du compte, et rien dans une carte de thème ne
          peut dire ce qu'elle ne voit pas. L'alerte est la seule phrase qui
          rende honnête tout ce qui vient après elle — d'où sa place juste
          avant, comme une convention de lecture.

          Elle est HORS de la section 2, volontairement : un compte qui n'a
          encore rien étiqueté n'a aucune carte, donc pas de section 2 — et
          c'est précisément le compte qui a le plus besoin de lire ça.

          Elle ne s'affiche pas quand rien n'échappe : voir `alerte-themes.tsx`.
          Le module se vide de lui-même, il ne félicite personne. */}
      <AlerteThemes c={couverture} />

      {/* 2 · TES THÈMES PRIORITAIRES — LA section du thème. Elle porte tout ce
             qui le concerne : son bilan, sa courbe, ses conseils, et ce qu'on a
             déjà tenté dessus. Il y avait deux sections pour ça, à 900 px
             d'écart, avec le même titre et la même étoile. */}
      {cartes.length > 0 && (
        <section id="conseils" className="mb-9 scroll-mt-4">
          {/* LE BOUTON « ↻ Recharger mes conseils » PARTAGEAIT CETTE LIGNE.
              Il est sorti de l'app avec les trois autres déclencheurs : les
              conseils se réécrivent au Jour de travail, et à ce moment-là
              seulement. La date de la prochaine réécriture est déjà en tête de
              page, dans les trois dates — c'est la réponse à la question que ce
              bouton posait, et elle n'oblige personne à attendre trente
              secondes devant un rond qui tourne
              (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`). */}
          <div className="mb-1">
            <SectionTitle>
              <span className="text-faint font-mono mr-1.5">{nThemes}</span> Tes thèmes
              prioritaires
            </SectionTitle>
          </div>
          {/* L'objectif et les thèmes suivis étaient écrits ici ET dans le
              widget juste dessous : la même phrase à 40 px d'écart. Le texte
              d'introduction se borne à ce qu'il est seul à dire — ce que la
              section contient. */}
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 max-w-[68ch]">
            Pour chaque thème : où il en est, ce qui peut le faire bouger, et ce que tes
            actions passées ont donné.
          </p>
          {/* LA PHRASE DE PASSAGE, ET SEULEMENT QUAND ELLE EST ENCORE VRAIE.
              Elle est écrite par le worker et NOMME les premiers thèmes du
              rapport (« voilà les leviers sur A, B et C »). Si le garde-fou
              vient d'en retirer un, elle annonce une carte qui n'est plus là :
              une phrase de liaison qui ment sur ce qu'elle relie vaut moins que
              pas de phrase. Elle revient exacte au prochain rechargement — et
              cette condition disparaît avec le garde-fou. */}
          {!gardeAJoue && report?.themes_intro && (
            <p className="text-[13.5px] text-muted leading-relaxed mb-4 -mt-1.5">
              {report.themes_intro}
            </p>
          )}

          {/* LE SOMMAIRE EST DEVENU LA BARRE D'ONGLETS — il vit maintenant dans
              `ThemesCarrousel`, plus bas, avec les flèches et le « 2 / 5 ».
              C'était déjà la liste des noms de tous les thèmes : en faire la
              navigation évitait d'ajouter un troisième dispositif à côté. */}

          {/* « SI TU NE FAIS QUE TROIS CHOSES » N'EST PLUS ICI.
              C'était une sélection cross-thème rendue en tête, qui pointait vers
              les cartes. Elle en désignait trois quand douze conseils sortaient ;
              il y en a CINQ au maximum depuis le plafond de semaine
              (`saas/recos_ia/composition.py`), sur trois thèmes au maximum — un
              renvoi vers cinq choses qui tiennent dans le même écran n'aide
              plus, il double. David a déplacé l'objet, il ne l'a pas supprimé :
              « cela devrait être plus une notification "tu as encore X recos" ;
              cette notification peut vivre sur l'app, elle ne doit pas être
              rattachée à la page hebdomadaire ». C'est le module de commandes,
              `.scratch/refonte/issues/12-module-de-commandes.md`. */}

          {/* L'OBJECTIF DU COMPTE ET L'OBJECTIF PAR THÈME NE SE RÈGLENT PLUS ICI.
              La carte globale (`ObjectifTheme`) qui vivait à cet endroit — un
              sélecteur `<ObjectifSelect>` éditable + un résumé des thèmes
              prioritaires — est retirée : régler l'objectif du compte se fait
              maintenant sur `/conversions` (module dédié), et l'objectif de
              CHAQUE thème s'affiche désormais en lecture seule DANS sa propre
              carte (`theme-objectif-mini.tsx`, dans `ThemeCard`, juste sous
              son bilan chiffré) — plus juste qu'un résumé global qui ne disait
              jamais lequel des N thèmes affichés avait un « objectif propre »
              sans qu'on remonte les yeux le vérifier. */}
          <ThemesCarrousel
            themes={cartesOrdonnees.map((t) => ({
              label: t.label,
              ancre: ancreTheme(t.label),
              etoile: t.is_priority,
            }))}
          >
            {cartesOrdonnees.map((t) => (
              <ThemeCard
                key={t.label}
                theme={t}
                actions={data.actions}
                archived={data.actionsArchived}
                changements={chgParTheme(t.label)}
                changementsApi={apiParTheme(t.label)}
                rows={report?.themes?.rows ?? null}
                fenetre={report?.vision?.period_label || null}
                fenetreDates={fenetreBilan}
                decroche={pire?.label === t.label}
                labels={data.labels}
                feedback={data.feedback}
                comments={data.comments}
                suivis={data.suivis}
                conversionsTheme={conversionsParTheme.get(t.label) ?? []}
                objectifEffectif={t.objectif ?? data.objectif ?? null}
                aucunePriorite={priorities.length === 0}
              />
            ))}
          </ThemesCarrousel>
        </section>
      )}

      {/* LE FILET N'EST PLUS ICI — il est monté à gauche de « Ta boussole »,
          dans la section 1. Il occupait une bande pleine largeur en bas de
          page, après tout le reste, alors qu'il porte les seules actions
          qu'aucune carte de thème ne prend. */}

      {/* LE PARCOURS DE DÉMARRAGE N'EST PLUS ICI — il est remonté en tête de
          page, au-dessus du verdict. Il vivait sous deux écrans de défilement
          alors qu'il porte les seules actions qui débloquent le reste. */}

      {!data.hasData ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[14px] text-ink font-medium">Pas encore de données ici.</p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Branche une source sur la page{" "}
            <Link href="/comptes" className="text-brand font-semibold hover:underline">
              ⚙ Connexions
            </Link>{" "}
            : sa récolte part tout de suite, et tes chiffres s&apos;afficheront ici.
          </p>
        </div>
      ) : (
        <>


          {/* LA SECTION « TES CONSEILS » A DISPARU.
              Elle rendait une seconde carte par thème — même titre, même
              étoile, mêmes campagnes — à 900 px de la première. Ses conseils
              vivent maintenant dans la carte du thème, à gauche sous la
              courbe, en face de ce que les actions passées ont donné. C'est la
              boucle conseil → action → effet dans un seul écran, au lieu de
              trois sections qui ne se regardaient pas.
              Le seul cas qu'elle traitait encore seule : aucun thème classé. */}
          {themesFocus.length === 0 && (
            <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5 mb-8">
              <p className="text-[13px] text-ink leading-relaxed">
                <span className="font-semibold text-brand">Presque prêt — </span>
                classe tes contenus sur la page{" "}
                <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                — tes chiffres s&apos;y regroupent par thème à la seconde, et le rapport
                se construit thème par thème au prochain jour de travail.
              </p>
            </div>
          )}

          {/* POUR ALLER PLUS LOIN — le savoir-faire de fond, par thème.
              Publié par le worker depuis des mois (`themes_tips`) et rendu par
              AUCUN composant, pendant que `reco-actions.tsx` promettait par
              écrit que « ◇ Trop compliqué » y remonterait la semaine suivante.
              Les deux bouts sont raccordés : le worker passe maintenant les
              conseils marqués trop compliqués au prompt (`bloques`). */}
          <PourAllerPlusLoin themes={report?.themes_tips ?? []} />

          {/* Réglages de base — prérequis (GA4, funnel) sortis du flux par thème */}
          {reglages.length > 0 && (
            /* `id` : le module « À faire » renvoie ici quand la ligne est un
               réglage de base — il n'a pas de carte de thème où s'expliquer. */
            <details id="reglages" className="mb-8 scroll-mt-4" open>
              <summary className="text-[14px] font-semibold text-ink cursor-pointer select-none mb-3">
                Réglages de base ({reglages.length}){" "}
                <span className="text-faint font-normal">· à mettre en place une fois pour tout débloquer</span>
              </summary>
              <div className="space-y-3 mt-2">
                {reglages.map((r) => (
                  <RecoCard
                    key={r.key}
                    r={r}
                    current={data.feedback[feedbackKey(r.key, null)] ?? data.feedback[r.key] ?? null}
                    comment={data.comments[feedbackKey(r.key, null)] ?? data.comments[r.key] ?? null}
                    theme={null}
                    action={data.suivis[r.key] ?? null}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
